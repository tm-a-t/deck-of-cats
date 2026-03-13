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
    worktree_cleanup: Callable[[str], None] | None = None
    self_approve_prs: bool = False
    self_restart_scheduler: Callable[[], str] | None = None
    exit_handler: Callable[[int], None] | None = None

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

        await self._apply_started_decision(task_id=task_id, decision=decision)

    async def execute_system(self, task_id: str, decision: MergeDecision, feedback: str | None = None) -> None:
        logger.info("System decision received task_id=%s decision=%s", task_id, decision.value)
        with self.uow_factory() as uow:
            task = uow.tasks.get(task_id)
            if task is None:
                raise NotFoundError(f"Task {task_id} not found")

            if task.status != TaskStatus.AWAITING_DECISION:
                raise InvalidTransitionError(f"Task {task_id} is not awaiting decision")

            task.start_decision_applying()
            uow.tasks.update(task)
            for event in task.pull_events():
                if isinstance(event, DomainEvent):
                    uow.outbox.enqueue(event.aggregate_id, event.event_type, event.payload)
            uow.commit()
            logger.info("System decision applying started task_id=%s decision=%s", task_id, decision.value)

        await self._apply_started_decision(task_id=task_id, decision=decision, system_feedback=feedback)

    async def _apply_started_decision(
        self,
        task_id: str,
        decision: MergeDecision,
        system_feedback: str | None = None,
    ) -> None:
        side_effect_error: Exception | None = None
        with self.uow_factory() as uow:
            side_effect_task = uow.tasks.get(task_id)
            if side_effect_task is None:
                raise NotFoundError(f"Task {task_id} not found")

        try:
            if decision == MergeDecision.MERGE:
                if self.self_approve_prs:
                    logger.info("Self-approving PR task_id=%s pr_number=%s", task_id, side_effect_task.pr_number)
                    await self.merge_port.approve_pr(side_effect_task)
                logger.info("Merging PR task_id=%s pr_number=%s", task_id, side_effect_task.pr_number)
                await self.merge_port.merge_pr(side_effect_task)
            elif decision == MergeDecision.CLOSE:
                logger.info("Closing PR task_id=%s pr_number=%s", task_id, side_effect_task.pr_number)
                await self.merge_port.close_pr(side_effect_task)
            elif decision == MergeDecision.RERUN_TESTS:
                logger.info("Rework requested by user task_id=%s", task_id)
            else:
                raise InvalidTransitionError(f"Unsupported decision: {decision}")
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
                if decision == MergeDecision.RERUN_TESTS and system_feedback is not None:
                    task.finalize_lead_rework(system_feedback)
                else:
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

        if decision in {MergeDecision.MERGE, MergeDecision.CLOSE} and self.worktree_cleanup is not None:
            try:
                self.worktree_cleanup(task.id)
            except Exception:  # pragma: no cover - cleanup should not break finalization
                logger.exception("Worktree cleanup failed task_id=%s", task.id)

        logger.info("Decision applied successfully task_id=%s decision=%s", task_id, decision.value)
        await self.notifier.notify_task_finished(task)

        if decision == MergeDecision.MERGE and self.self_approve_prs and self.self_restart_scheduler is not None:
            try:
                script_path = self.self_restart_scheduler()
                logger.info("Self-restart queued task_id=%s script=%s", task_id, script_path)
            except Exception:  # pragma: no cover - restart scheduling must not hide merge success
                logger.exception("Failed to schedule self-restart task_id=%s", task_id)
                return

            if self.exit_handler is not None:
                self.exit_handler(0)
