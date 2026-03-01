from __future__ import annotations

from string import hexdigits

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
            metadata = result.metadata or {}
            pr_number = int(metadata.get("pr_number", 0))
            pr_url = str(metadata.get("pr_url", ""))
            task.mark_pr_created(pr_number=pr_number, pr_url=pr_url)
            pr_head_sha = metadata.get("pr_head_sha")
            if isinstance(pr_head_sha, str):
                task.pr_url = TaskAggregate.attach_expected_head_sha(task.pr_url, pr_head_sha)
            return
        if step == StepName.PREVIEW:
            preview_url = str((result.metadata or {}).get("preview_url", ""))
            task.mark_preview_ready(preview_url=preview_url)
            return
        if step == StepName.DECISION:
            metadata = result.metadata or {}
            token_hash = str(metadata.get("decision_token_hash", ""))
            expected_head_sha = self._resolve_expected_head_sha(task, metadata)
            task.request_decision(
                token_hash=token_hash,
                ttl_seconds=decision_ttl_seconds,
                expected_merge_head_sha=expected_head_sha,
            )
            return

        raise ValueError(f"Unsupported step: {step}")

    def _resolve_expected_head_sha(
        self,
        task: TaskAggregate,
        metadata: dict[str, str | int | bool | list[str]],
    ) -> str | None:
        for key in ("merge_head_sha", "head_sha", "pr_head_sha"):
            value = metadata.get(key)
            if isinstance(value, str) and self._is_git_sha(value):
                return value

        from_pr_url = TaskAggregate.extract_expected_head_sha(task.pr_url)
        if from_pr_url:
            return from_pr_url

        return None

    @staticmethod
    def _is_git_sha(value: str) -> bool:
        if not (7 <= len(value) <= 64):
            return False
        return all(char in hexdigits for char in value)
