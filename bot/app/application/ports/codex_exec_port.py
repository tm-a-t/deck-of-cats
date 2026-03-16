from __future__ import annotations

from typing import Protocol

from app.application.workflows.models import StepResult
from app.domain.aggregates.task_aggregate import TaskAggregate


class CodexExecPort(Protocol):
    async def research(self, task: TaskAggregate) -> StepResult:
        ...

    async def implement(self, task: TaskAggregate) -> StepResult:
        ...

    async def validate(self, task: TaskAggregate) -> StepResult:
        ...

    async def lead_review(self, task: TaskAggregate) -> StepResult:
        ...
