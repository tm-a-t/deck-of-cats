from __future__ import annotations

from app.application.ports.preview.preview_query_port import PreviewQueryPort
from app.application.workflows.models import StepResult
from app.application.workflows.steps.base import StepHandler
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.enums import StepName


class PreviewStep(StepHandler):
    name = StepName.PREVIEW

    def __init__(self, preview_query: PreviewQueryPort, timeout_seconds: int) -> None:
        self._preview_query = preview_query
        self._timeout_seconds = timeout_seconds

    async def execute(self, task: TaskAggregate) -> StepResult:
        preview = await self._preview_query.wait_preview_url(task, self._timeout_seconds)
        if not preview:
            return StepResult(ok=False, summary="Preview URL not ready in time")
        return StepResult(
            ok=True,
            summary="Preview ready",
            details=preview,
            metadata={"preview_url": preview},
        )
