from __future__ import annotations

import hashlib
import secrets

from app.application.workflows.models import StepResult
from app.application.workflows.steps.base import StepHandler
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.enums import StepName


class DecisionStep(StepHandler):
    name = StepName.DECISION

    async def execute(self, task: TaskAggregate) -> StepResult:
        _ = task
        token = secrets.token_urlsafe(8)
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        return StepResult(
            ok=True,
            summary="Decision requested",
            metadata={"decision_token": token, "decision_token_hash": token_hash},
        )
