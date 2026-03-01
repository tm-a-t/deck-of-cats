from __future__ import annotations

from typing import Protocol

from app.domain.aggregates.task_aggregate import TaskAggregate


class ChecksPort(Protocol):
    async def checks_passed(self, task: TaskAggregate) -> bool:
        ...
