from __future__ import annotations

from app.domain.aggregates.task_aggregate import TaskAggregate


class NullNotifier:
    async def notify_task_started(self, task: TaskAggregate) -> None:
        _ = task

    async def notify_step_result(self, task: TaskAggregate, step: str, message: str) -> None:
        _ = (task, step, message)

    async def notify_decision_required(self, task: TaskAggregate, token: str) -> None:
        _ = (task, token)

    async def notify_task_finished(self, task: TaskAggregate) -> None:
        _ = task
