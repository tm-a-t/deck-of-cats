from __future__ import annotations

from typing import Protocol

from app.domain.aggregates.task_aggregate import TaskAggregate


class PreviewQueryPort(Protocol):
    async def wait_preview_url(self, task: TaskAggregate, timeout_seconds: int) -> str | None:
        ...
