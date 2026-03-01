from __future__ import annotations

from abc import ABC, abstractmethod

from app.application.workflows.models import StepResult
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.enums import StepName


class StepHandler(ABC):
    name: StepName

    @abstractmethod
    async def execute(self, task: TaskAggregate) -> StepResult:
        raise NotImplementedError
