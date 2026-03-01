from __future__ import annotations

from app.application.workflows.models import StepResult
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.enums import StepName, TaskStatus


class DevCycleWorkflow:
    def next_step(self, task: TaskAggregate) -> StepName | None:
        if task.status in {TaskStatus.NEW, TaskStatus.RETRY_SCHEDULED}:
            task.start_codex_implement()
            return StepName.CODEX_IMPLEMENT

        if task.status == TaskStatus.CODEX_IMPLEMENT_RUNNING:
            return StepName.CODEX_IMPLEMENT
        if task.status == TaskStatus.CODEX_VALIDATE_RUNNING:
            return StepName.CODEX_VALIDATE
        if task.status == TaskStatus.PR_CREATING:
            return StepName.PR
        if task.status == TaskStatus.AWAITING_PREVIEW:
            return StepName.PREVIEW
        if task.status == TaskStatus.AWAITING_DECISION and task.decision_token_hash is None:
            return StepName.DECISION
        return None

    def apply_success(
        self,
        task: TaskAggregate,
        step: StepName,
        result: StepResult,
        decision_ttl_seconds: int,
    ) -> None:
        if step == StepName.CODEX_IMPLEMENT:
            task.mark_codex_implement_passed()
            return
        if step == StepName.CODEX_VALIDATE:
            task.mark_codex_validate_passed()
            return
        if step == StepName.PR:
            pr_number = int((result.metadata or {}).get("pr_number", 0))
            pr_url = str((result.metadata or {}).get("pr_url", ""))
            task.mark_pr_created(pr_number=pr_number, pr_url=pr_url)
            return
        if step == StepName.PREVIEW:
            preview_url = str((result.metadata or {}).get("preview_url", ""))
            task.mark_preview_ready(preview_url=preview_url)
            return
        if step == StepName.DECISION:
            token_hash = str((result.metadata or {}).get("decision_token_hash", ""))
            task.request_decision(token_hash=token_hash, ttl_seconds=decision_ttl_seconds)
            return

        raise ValueError(f"Unsupported step: {step}")
