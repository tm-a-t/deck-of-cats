from __future__ import annotations

from app.domain.aggregates.task_aggregate import TaskAggregate


class GithubChecksAdapter:
    async def checks_passed(self, task: TaskAggregate) -> bool:
        _ = task
        return True
