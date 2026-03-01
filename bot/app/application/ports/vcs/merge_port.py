from __future__ import annotations

from typing import Protocol

from app.domain.aggregates.task_aggregate import TaskAggregate


class MergePort(Protocol):
    async def merge_pr(self, task: TaskAggregate) -> None:
        ...

    async def close_pr(self, task: TaskAggregate) -> None:
        ...
