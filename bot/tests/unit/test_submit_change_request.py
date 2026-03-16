from __future__ import annotations

import asyncio

import pytest

from app.application.use_cases.submit_change_request import SubmitChangeRequestUseCase
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.persistence.sqlite.uow import SqliteUnitOfWork
from app.shared.enums import TaskKind


pytestmark = pytest.mark.asyncio


class _FakeNotifier:
    def __init__(self) -> None:
        self.started: list[TaskAggregate] = []

    async def notify_task_started(self, task: TaskAggregate) -> None:
        self.started.append(task)

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


async def test_submit_change_request_can_target_chat_and_autostart_without_notification(tmp_path) -> None:
    db_path = tmp_path / "bot.sqlite3"
    uow_factory = lambda: SqliteUnitOfWork(str(db_path))
    notifier = _FakeNotifier()
    orchestrator = _FakeOrchestrator()
    use_case = SubmitChangeRequestUseCase(
        uow_factory=uow_factory,
        notifier=notifier,
        orchestrator=orchestrator,
        auto_start=False,
    )

    task_id = await use_case.execute(
        author_id=7,
        chat_id=99,
        title="Add chat agent",
        body="Implement direct Telegram intake",
        notify_started=False,
        start_immediately=True,
    )
    await asyncio.sleep(0)

    with uow_factory() as uow:
        stored = uow.tasks.get(task_id)

    assert stored is not None
    assert stored.chat_id == 99
    assert stored.kind == TaskKind.CHANGE
    assert notifier.started == []
    assert orchestrator.calls == [task_id]
