from __future__ import annotations

import asyncio

import pytest

from app.application.use_cases.launch_research_project import LaunchResearchProjectUseCase
from app.application.use_cases.submit_change_request import SubmitChangeRequestUseCase
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.persistence.sqlite.uow import SqliteUnitOfWork
from app.shared.enums import StepExecutionStatus, StepName, TaskKind, TaskStatus


pytestmark = pytest.mark.asyncio


class _FakeNotifier:
    async def notify_task_started(self, task: TaskAggregate) -> None:
        _ = task

    async def notify_step_result(self, task: TaskAggregate, step: str, message: str) -> None:
        _ = (task, step, message)

    async def notify_decision_required(self, task: TaskAggregate, token: str) -> None:
        _ = (task, token)

    async def notify_task_finished(self, task: TaskAggregate) -> None:
        _ = task


class _FakeOrchestrator:
    def __init__(self) -> None:
        self.calls: list[str] = []

    async def run_task(self, task_id: str) -> None:
        self.calls.append(task_id)


async def test_launch_research_project_creates_research_task_with_recent_log_context(tmp_path) -> None:
    db_path = tmp_path / "bot.sqlite3"
    uow_factory = lambda: SqliteUnitOfWork(str(db_path))

    source_task = TaskAggregate.create(
        task_id="10101010-1010-1010-1010-101010101010",
        author_id=7,
        chat_id=99,
        title="Fix merge callback bug",
        body="Investigate why merge callback fails",
        correlation_id="corr-source",
    )
    source_task.last_error = "Merge confirmation callback failed"
    source_task.status = TaskStatus.FAILED
    source_task.version = 1
    with uow_factory() as uow:
        uow.tasks.add(source_task)
        uow.step_executions.create_attempt(source_task.id, StepName.CODEX_VALIDATE, 1, "idem-1")
        uow.step_executions.mark_status(
            source_task.id,
            StepName.CODEX_VALIDATE,
            1,
            StepExecutionStatus.FAILED,
            error_payload="GitHub merge failed with 405 because the PR had conflicts",
        )
        uow.commit()

    submit = SubmitChangeRequestUseCase(
        uow_factory=uow_factory,
        notifier=_FakeNotifier(),
        orchestrator=_FakeOrchestrator(),
        auto_start=False,
    )
    launch = LaunchResearchProjectUseCase(uow_factory=uow_factory, submit_change_request=submit)

    task_id = await launch.execute(author_id=7, chat_id=99)
    await asyncio.sleep(0)

    with uow_factory() as uow:
        created = uow.tasks.get(task_id)

    assert created is not None
    assert created.kind == TaskKind.RESEARCH
    assert created.status == TaskStatus.NEW
    assert "Identify where the bot or agent pipeline behaves incorrectly" in created.body
    assert "Fix merge callback bug" in created.body
    assert "GitHub merge failed with 405 because the PR had conflicts" in created.body
    assert "best 3-5 ideas" in created.body
