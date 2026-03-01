from __future__ import annotations

from app.application.workflows.dev_cycle_workflow import DevCycleWorkflow
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.enums import StepName, TaskStatus


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


def test_awaiting_decision_without_token_requests_decision_step() -> None:
    workflow = DevCycleWorkflow()
    task = _task()
    task.start_codex_implement()
    task.mark_codex_implement_passed()
    task.mark_codex_validate_passed()
    task.mark_pr_created(1, "u")
    task.mark_preview_ready("p")

    step = workflow.next_step(task)
    assert step == StepName.DECISION


def test_awaiting_rework_input_does_not_autostart_step() -> None:
    workflow = DevCycleWorkflow()
    task = _task()
    task.status = TaskStatus.AWAITING_REWORK_INPUT

    step = workflow.next_step(task)

    assert step is None
