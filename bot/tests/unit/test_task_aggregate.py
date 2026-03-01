from __future__ import annotations

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.enums import MergeDecision, TaskStatus


def test_task_aggregate_happy_path() -> None:
    task = TaskAggregate.create(
        task_id="11111111-1111-1111-1111-111111111111",
        author_id=1,
        title="Title",
        body="Body",
        correlation_id="corr",
    )

    task.start_codex_implement()
    task.mark_codex_implement_passed()
    task.mark_codex_validate_passed()
    task.mark_pr_created(pr_number=1, pr_url="https://example/pr/1")
    task.mark_preview_ready("https://example/preview")
    task.request_decision(token_hash="h", ttl_seconds=10)
    task.start_decision_applying()
    task.finalize_decision(MergeDecision.CLOSE)

    assert task.status == TaskStatus.CLOSED
    assert task.pr_number == 1
    assert task.preview_url is not None
