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


logger = logging.getLogger(__name__)


@dataclass
class SubmitChangeRequestUseCase:
    uow_factory: Callable[[], UnitOfWork]
    notifier: NotifierPort
    orchestrator: DevCycleOrchestrator | None = None
    auto_start: bool = False

    async def execute(self, author_id: int, title: str, body: str) -> str:
        task_id = TaskId.new().value
        correlation_id = CorrelationId.new().value
        task = TaskAggregate.create(
            task_id=task_id,
            author_id=author_id,
            title=title,
            body=body,
            correlation_id=correlation_id,
        )

        with self.uow_factory() as uow:
            uow.tasks.add(task)
            for event in task.pull_events():
                if isinstance(event, DomainEvent):
                    uow.outbox.enqueue(event.aggregate_id, event.event_type, event.payload)
            uow.commit()

        logger.info(
            "Task created task_id=%s author_id=%s title=%r auto_start=%s",
            task.id,
            task.author_id,
            task.title,
            self.auto_start,
        )
        await self.notifier.notify_task_started(task)
        if self.auto_start and self.orchestrator is not None:
            logger.info("Task scheduled for immediate run task_id=%s", task.id)
            asyncio.create_task(self.orchestrator.run_task(task.id))
        return task.id
