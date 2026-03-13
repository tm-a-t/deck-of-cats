from __future__ import annotations

from app.application.ports.codex_exec_port import CodexExecPort
from app.application.workflows.models import StepResult
from app.application.workflows.steps.base import StepHandler
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.enums import StepName


class CodexLeadReviewStep(StepHandler):
    name = StepName.LEAD_REVIEW

    def __init__(self, codex_exec: CodexExecPort) -> None:
        self._codex_exec = codex_exec

    async def execute(self, task: TaskAggregate) -> StepResult:
        return await self._codex_exec.lead_review(task)
