from __future__ import annotations

from app.application.ports.vcs.branch_port import BranchPort
from app.application.ports.vcs.pr_port import PullRequestPort
from app.application.workflows.models import StepResult
from app.application.workflows.steps.base import StepHandler
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.enums import StepName


class PrStep(StepHandler):
    name = StepName.PR

    def __init__(self, branch_port: BranchPort, pr_port: PullRequestPort) -> None:
        self._branch_port = branch_port
        self._pr_port = pr_port

    async def execute(self, task: TaskAggregate) -> StepResult:
        branch_name = await self._branch_port.prepare_branch(task.id)
        pr = await self._pr_port.create_pr(task, branch_name)
        metadata: dict[str, str | int] = {"pr_number": pr.number, "pr_url": pr.url}
        if pr.head_sha:
            metadata["pr_head_sha"] = pr.head_sha
        return StepResult(
            ok=True,
            summary="PR created",
            details=pr.url,
            metadata=metadata,
        )
