from __future__ import annotations

from typing import Protocol

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.domain.entities.pr import PullRequest


class PullRequestPort(Protocol):
    async def create_pr(self, task: TaskAggregate, branch_name: str) -> PullRequest:
        ...
