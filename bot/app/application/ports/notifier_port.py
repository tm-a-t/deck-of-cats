from __future__ import annotations

from typing import Protocol

from app.domain.aggregates.task_aggregate import TaskAggregate


class NotifierPort(Protocol):
    async def notify_task_started(self, task: TaskAggregate) -> None:
        ...

    async def notify_step_result(self, task: TaskAggregate, step: str, message: str) -> None:
        ...

    async def notify_decision_required(self, task: TaskAggregate, token: str) -> None:
        ...

    async def notify_task_finished(self, task: TaskAggregate) -> None:
        ...
