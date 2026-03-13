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
    task.mark_codex_implement_passed(["bot/app/settings.py"])
    task.mark_codex_validate_passed()
    task.mark_pr_created(pr_number=1, pr_url="https://example/pr/1")
    task.request_decision(token_hash="h", ttl_seconds=10)
    task.start_decision_applying()
    task.finalize_decision(MergeDecision.CLOSE)

    assert task.status == TaskStatus.CLOSED
    assert task.public_id == "T-11111111"
    assert task.chat_id == 1
    assert task.pr_number == 1
    assert task.changed_files == ["bot/app/settings.py"]


def test_task_aggregate_rework_feedback_flow() -> None:
    task = TaskAggregate.create(
        task_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        author_id=1,
        title="Title",
        body="Initial request",
        correlation_id="corr",
    )

    task.start_codex_implement()
    task.mark_codex_implement_passed(["bot/app/settings.py"])
    task.mark_codex_validate_passed()
    task.mark_pr_created(pr_number=1, pr_url="https://example/pr/1")
    task.request_decision(token_hash="h", ttl_seconds=10)
    task.start_decision_applying()
    task.finalize_decision(MergeDecision.RERUN_TESTS)

    assert task.status == TaskStatus.AWAITING_REWORK_INPUT

    task.apply_rework_feedback("Почини верстку и кнопки")

    assert task.status == TaskStatus.RETRY_SCHEDULED
    assert "Rework history:" in task.body
    assert "Почини верстку и кнопки" in task.body


def test_task_aggregate_tester_feedback_schedules_retry() -> None:
    task = TaskAggregate.create(
        task_id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        author_id=1,
        title="Title",
        body="Initial request",
        correlation_id="corr",
    )

    task.start_codex_implement()
    task.mark_codex_implement_passed(["bot/app/di.py", "bot/app/settings.py"])
    task.schedule_reimplementation_from_tester(
        summary="Validation failed",
        details="The tester found a failing scenario in the new flow",
    )

    assert task.status == TaskStatus.RETRY_SCHEDULED
    assert "Tester feedback history:" in task.body
    assert "bot/app/di.py" in task.body
    assert "The tester found a failing scenario in the new flow" in task.body


def test_task_aggregate_lead_rework_finalization_schedules_retry() -> None:
    task = TaskAggregate.create(
        task_id="cccccccc-cccc-cccc-cccc-cccccccccccc",
        author_id=1,
        title="Title",
        body="Initial request",
        correlation_id="corr",
    )

    task.start_codex_implement()
    task.mark_codex_implement_passed(["bot/app/di.py"])
    task.mark_codex_validate_passed()
    task.mark_pr_created(pr_number=1, pr_url="https://example/pr/1")
    task.start_decision_applying()
    task.finalize_lead_rework("Lead says the code still misses an important edge case")

    assert task.status == TaskStatus.RETRY_SCHEDULED
    assert "Lead review history:" in task.body
    assert "Lead says the code still misses an important edge case" in task.body
