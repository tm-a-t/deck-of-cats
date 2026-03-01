from __future__ import annotations

import hashlib
import hmac
import logging
from collections.abc import Callable
from dataclasses import dataclass

from app.application.ports.notifier_port import NotifierPort
from app.application.ports.unit_of_work import UnitOfWork
from app.application.ports.vcs.merge_port import MergePort
from app.domain.events.domain_events import DomainEvent
from app.shared.enums import MergeDecision, TaskStatus
from app.shared.errors import InvalidTransitionError, NotFoundError, SecurityViolationError
from app.shared.time import utcnow


logger = logging.getLogger(__name__)


@dataclass
class AcceptMergeDecisionUseCase:
    uow_factory: Callable[[], UnitOfWork]
    merge_port: MergePort
    notifier: NotifierPort

    async def execute(self, task_id: str, decision: MergeDecision, decision_token: str) -> None:
        logger.info("Decision received task_id=%s decision=%s", task_id, decision.value)
        with self.uow_factory() as uow:
            task = uow.tasks.get(task_id)
            if task is None:
                raise NotFoundError(f"Task {task_id} not found")

            if task.status != TaskStatus.AWAITING_DECISION:
                raise InvalidTransitionError(f"Task {task_id} is not awaiting decision")

            if task.decision_expires_at is None or utcnow() > task.decision_expires_at:
                raise SecurityViolationError("Decision token expired")

            received_hash = hashlib.sha256(decision_token.encode("utf-8")).hexdigest()
            if task.decision_token_hash is None or not hmac.compare_digest(task.decision_token_hash, received_hash):
                raise SecurityViolationError("Invalid decision token")

            task.start_decision_applying()
            uow.tasks.update(task)
            for event in task.pull_events():
                if isinstance(event, DomainEvent):
                    uow.outbox.enqueue(event.aggregate_id, event.event_type, event.payload)
            uow.commit()
            logger.info("Decision applying started task_id=%s decision=%s", task_id, decision.value)

        side_effect_error: Exception | None = None
        side_effect_task = None
        with self.uow_factory() as uow:
            task = uow.tasks.get(task_id)
            if task is None:
                raise NotFoundError(f"Task {task_id} not found")
            side_effect_task = task

        if side_effect_task is None:
            raise NotFoundError(f"Task {task_id} not found")

        try:
            if decision == MergeDecision.MERGE:
                logger.info("Merging PR task_id=%s pr_number=%s", task_id, side_effect_task.pr_number)
                await self.merge_port.merge_pr(side_effect_task)
            else:
                logger.info("Closing PR task_id=%s pr_number=%s", task_id, side_effect_task.pr_number)
                await self.merge_port.close_pr(side_effect_task)
        except Exception as exc:  # pragma: no cover - defensive boundary
            side_effect_error = exc
            logger.exception("Decision side effect failed task_id=%s decision=%s", task_id, decision.value)

        with self.uow_factory() as uow:
            task = uow.tasks.get(task_id)
            if task is None:
                raise NotFoundError(f"Task {task_id} not found")
            if task.status != TaskStatus.DECISION_APPLYING:
                raise InvalidTransitionError(f"Task {task_id} is not in decision applying state")

            if side_effect_error is None:
                task.finalize_decision(decision)
            else:
                task.rollback_decision_applying(str(side_effect_error))

            uow.tasks.update(task)
            for event in task.pull_events():
                if isinstance(event, DomainEvent):
                    uow.outbox.enqueue(event.aggregate_id, event.event_type, event.payload)
            uow.commit()

        if side_effect_error is not None:
            raise side_effect_error

        logger.info("Decision applied successfully task_id=%s decision=%s", task_id, decision.value)
        await self.notifier.notify_task_finished(task)
