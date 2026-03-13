from __future__ import annotations

import hashlib

import pytest

from app.application.use_cases.accept_merge_decision import AcceptMergeDecisionUseCase
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.notifier.null_notifier import NullNotifier
from app.infrastructure.persistence.sqlite.uow import SqliteUnitOfWork
from app.shared.enums import MergeDecision, TaskStatus


pytestmark = pytest.mark.asyncio


class _FakeMergePort:
    def __init__(self) -> None:
        self.calls: list[str] = []

    async def approve_pr(self, task: TaskAggregate) -> None:
        _ = task
        self.calls.append("approve")

    async def merge_pr(self, task: TaskAggregate) -> None:
        _ = task
        self.calls.append("merge")

    async def close_pr(self, task: TaskAggregate) -> None:
        _ = task
        self.calls.append("close")


def _task() -> TaskAggregate:
    task = TaskAggregate.create(
        task_id="44444444-4444-4444-4444-444444444444",
        author_id=1,
        title="Self evolve",
        body="Improve the bot",
        correlation_id="corr-1",
    )
    task.start_codex_implement()
    task.mark_codex_implement_passed(["bot/app/di.py"])
    task.mark_codex_validate_passed()
    task.mark_pr_created(pr_number=7, pr_url="https://github.com/octo/deck/pull/7")
    return task


async def test_accept_merge_decision_self_approves_and_schedules_restart(tmp_path) -> None:
    db_path = tmp_path / "bot.sqlite3"
    uow_factory = lambda: SqliteUnitOfWork(str(db_path))
    token = "decision-token"
    task = _task()
    task.request_decision(token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(), ttl_seconds=60)
    task.pull_events()

    with uow_factory() as uow:
        uow.tasks.add(task)
        uow.commit()

    merge_port = _FakeMergePort()
    restart_calls: list[str] = []
    exit_codes: list[int] = []
    use_case = AcceptMergeDecisionUseCase(
        uow_factory=uow_factory,
        merge_port=merge_port,
        notifier=NullNotifier(),
        self_approve_prs=True,
        self_restart_scheduler=lambda: restart_calls.append("queued") or "/tmp/restart.sh",
        exit_handler=lambda code: exit_codes.append(code),
    )

    await use_case.execute(task_id=task.id, decision=MergeDecision.MERGE, decision_token=token)

    with uow_factory() as uow:
        stored = uow.tasks.get(task.id)

    assert stored is not None
    assert stored.status == TaskStatus.MERGED
    assert merge_port.calls == ["approve", "merge"]
    assert restart_calls == ["queued"]
    assert exit_codes == [0]


async def test_execute_system_can_send_task_back_to_rework(tmp_path) -> None:
    db_path = tmp_path / "bot.sqlite3"
    uow_factory = lambda: SqliteUnitOfWork(str(db_path))
    task = _task()
    task.pull_events()

    with uow_factory() as uow:
        uow.tasks.add(task)
        uow.commit()

    merge_port = _FakeMergePort()
    use_case = AcceptMergeDecisionUseCase(
        uow_factory=uow_factory,
        merge_port=merge_port,
        notifier=NullNotifier(),
    )

    await use_case.execute_system(
        task_id=task.id,
        decision=MergeDecision.RERUN_TESTS,
        feedback="Lead wants the implementation cleaned up before merge",
    )

    with uow_factory() as uow:
        stored = uow.tasks.get(task.id)

    assert stored is not None
    assert stored.status == TaskStatus.RETRY_SCHEDULED
    assert "Lead review history:" in stored.body
    assert "Lead wants the implementation cleaned up before merge" in stored.body
    assert merge_port.calls == []
