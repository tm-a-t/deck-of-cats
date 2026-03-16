from __future__ import annotations

from app.application.workflows.dev_cycle_workflow import DevCycleWorkflow
from app.application.workflows.models import StepResult
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.enums import StepName, TaskKind, TaskStatus


def _task() -> TaskAggregate:
    return TaskAggregate.create(
        task_id="22222222-2222-2222-2222-222222222222",
        author_id=1,
        title="t",
        body="b",
        correlation_id="c",
    )


def test_new_task_moves_to_codex_implement_step() -> None:
    workflow = DevCycleWorkflow()
    task = _task()

    step = workflow.next_step(task)

    assert step == StepName.CODEX_IMPLEMENT
    assert task.status.value == "CODEX_IMPLEMENT_RUNNING"


def test_new_research_task_moves_to_research_step() -> None:
    workflow = DevCycleWorkflow()
    task = TaskAggregate.create(
        task_id="23232323-2323-2323-2323-232323232323",
        author_id=1,
        title="research",
        body="research body",
        correlation_id="c-research",
        kind=TaskKind.RESEARCH,
    )

    step = workflow.next_step(task)

    assert step == StepName.RESEARCH
    assert task.status == TaskStatus.RESEARCH_RUNNING


def test_awaiting_decision_without_token_requests_decision_step() -> None:
    workflow = DevCycleWorkflow()
    task = _task()
    task.start_codex_implement()
    task.mark_codex_implement_passed(["bot/app/settings.py"])
    task.mark_codex_validate_passed()
    task.mark_pr_created(1, "u")

    step = workflow.next_step(task)
    assert step == StepName.DECISION


def test_awaiting_decision_without_token_requests_lead_review_when_enabled() -> None:
    workflow = DevCycleWorkflow(auto_lead_review=True)
    task = _task()
    task.start_codex_implement()
    task.mark_codex_implement_passed(["bot/app/settings.py"])
    task.mark_codex_validate_passed()
    task.mark_pr_created(1, "u")

    step = workflow.next_step(task)
    assert step == StepName.LEAD_REVIEW


def test_awaiting_rework_input_does_not_autostart_step() -> None:
    workflow = DevCycleWorkflow()
    task = _task()
    task.status = TaskStatus.AWAITING_REWORK_INPUT

    step = workflow.next_step(task)

    assert step is None


def test_research_success_marks_task_completed() -> None:
    workflow = DevCycleWorkflow()
    task = TaskAggregate.create(
        task_id="24242424-2424-2424-2424-242424242424",
        author_id=1,
        title="research",
        body="research body",
        correlation_id="c-research-complete",
        kind=TaskKind.RESEARCH,
    )
    task.start_research()

    workflow.apply_success(
        task=task,
        step=StepName.RESEARCH,
        result=StepResult(ok=True, summary="done", details="details"),
        decision_ttl_seconds=60,
    )

    assert task.status == TaskStatus.RESEARCH_COMPLETED
