from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass

from app.application.orchestrators.dev_cycle_orchestrator import DevCycleOrchestrator
from app.application.ports.notifier_port import NotifierPort
from app.application.ports.unit_of_work import UnitOfWork
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.domain.events.domain_events import DomainEvent
from app.domain.value_objects.correlation_id import CorrelationId
from app.domain.value_objects.task_id import TaskId
from app.shared.enums import TaskKind


logger = logging.getLogger(__name__)


@dataclass
class SubmitChangeRequestUseCase:
    uow_factory: Callable[[], UnitOfWork]
    notifier: NotifierPort
    orchestrator: DevCycleOrchestrator | None = None
    auto_start: bool = False

    async def execute(
        self,
        author_id: int,
        chat_id: int | None,
        title: str,
        body: str,
        task_kind: TaskKind = TaskKind.CHANGE,
        author_username: str | None = None,
        author_display_name: str | None = None,
        notify_started: bool = True,
        start_immediately: bool | None = None,
    ) -> str:
        normalized_body = " ".join(body.split()).strip()
        if not normalized_body:
            raise ValueError("Task body is required")

        normalized_title = " ".join(title.split()).strip() or self._derive_title(normalized_body)
        task_id = TaskId.new().value
        correlation_id = CorrelationId.new().value
        effective_auto_start = self.auto_start if start_immediately is None else start_immediately
        task = TaskAggregate.create(
            task_id=task_id,
            author_id=author_id,
            chat_id=chat_id,
            kind=task_kind,
            title=normalized_title,
            body=normalized_body,
            correlation_id=correlation_id,
            author_username=author_username,
            author_display_name=author_display_name,
        )

        with self.uow_factory() as uow:
            uow.tasks.add(task)
            for event in task.pull_events():
                if isinstance(event, DomainEvent):
                    uow.outbox.enqueue(event.aggregate_id, event.event_type, event.payload)
            uow.commit()

        logger.info(
            "Task created task_id=%s kind=%s author_id=%s chat_id=%s title=%r auto_start=%s",
            task.id,
            task.kind.value,
            task.author_id,
            task.chat_id,
            task.title,
            effective_auto_start,
        )
        if notify_started:
            await self.notifier.notify_task_started(task)
        if effective_auto_start and self.orchestrator is not None:
            logger.info("Task scheduled for immediate run task_id=%s", task.id)
            asyncio.create_task(self.orchestrator.run_task(task.id))
        return task.id

    @staticmethod
    def _derive_title(body: str, limit: int = 64) -> str:
        if len(body) <= limit:
            return body
        return body[: limit - 1].rstrip() + "…"
