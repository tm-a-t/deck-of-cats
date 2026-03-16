from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.application.orchestrators.dev_cycle_orchestrator import DevCycleOrchestrator
from app.application.workflows.dev_cycle_workflow import DevCycleWorkflow
from app.application.workflows.models import StepResult
from app.application.workflows.steps.base import StepHandler
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.notifier.null_notifier import NullNotifier
from app.infrastructure.persistence.sqlite.lock_repository_impl import SQLiteLockRepository
from app.infrastructure.persistence.sqlite.models import init_db
from app.infrastructure.persistence.sqlite.uow import SqliteUnitOfWork
from app.shared.enums import MergeDecision, StepName, TaskKind, TaskStatus


pytestmark = pytest.mark.asyncio


class _Step(StepHandler):
    def __init__(self, result: StepResult) -> None:
        self._result = result

    async def execute(self, task: TaskAggregate) -> StepResult:
        _ = task
        return self._result


class _FakeAutoDecisionUseCase:
    def __init__(self) -> None:
        self.calls: list[tuple[str, MergeDecision, str]] = []

    async def execute_system(self, task_id: str, decision: MergeDecision, feedback: str | None = None) -> None:
        self.calls.append((task_id, decision, feedback or ""))


class _Notifier(NullNotifier):
    def __init__(self) -> None:
        self.finished: list[TaskAggregate] = []

    async def notify_task_finished(self, task: TaskAggregate) -> None:
        self.finished.append(task)


def _task() -> TaskAggregate:
    return TaskAggregate.create(
        task_id="12121212-1212-1212-1212-121212121212",
        author_id=1,
        title="Pipeline test",
        body="Rewrite the pipeline",
        correlation_id="corr-pipeline",
    )


async def test_validate_failure_returns_task_to_developer_with_tester_feedback(tmp_path: Path) -> None:
    db_path = tmp_path / "bot.sqlite3"
    uow_factory = lambda: SqliteUnitOfWork(str(db_path))
    lock_conn = sqlite3.connect(":memory:")
    init_db(lock_conn)
    lock_port = SQLiteLockRepository(lock_conn)

    task = _task()
    with uow_factory() as uow:
        uow.tasks.add(task)
        uow.commit()

    orchestrator = DevCycleOrchestrator(
        uow_factory=uow_factory,
        workflow=DevCycleWorkflow(),
        steps={
            StepName.CODEX_IMPLEMENT: _Step(
                StepResult(
                    ok=True,
                    summary="Developer finished code",
                    details="Implementation complete",
                    metadata={"changed_files": ["bot/app/di.py"]},
                )
            ),
            StepName.CODEX_VALIDATE: _Step(
                StepResult(
                    ok=False,
                    summary="Validation failed",
                    details="Tester found a broken flow",
                )
            ),
        },
        lock_port=lock_port,
        notifier=NullNotifier(),
        max_retries=3,
        decision_ttl_seconds=60,
    )

    await orchestrator.run_task(task.id)

    with uow_factory() as uow:
        stored = uow.tasks.get(task.id)

    assert stored is not None
    assert stored.status == TaskStatus.RETRY_SCHEDULED
    assert stored.changed_files == ["bot/app/di.py"]
    assert "Tester feedback history:" in stored.body
    assert "Tester found a broken flow" in stored.body


async def test_auto_lead_review_calls_system_decision_use_case(tmp_path: Path) -> None:
    db_path = tmp_path / "bot.sqlite3"
    uow_factory = lambda: SqliteUnitOfWork(str(db_path))
    lock_conn = sqlite3.connect(":memory:")
    init_db(lock_conn)
    lock_port = SQLiteLockRepository(lock_conn)
    auto_decision = _FakeAutoDecisionUseCase()

    task = _task()
    task.start_codex_implement()
    task.mark_codex_implement_passed(["bot/app/di.py"])
    task.mark_codex_validate_passed()
    task.mark_pr_created(pr_number=7, pr_url="https://github.com/octo/deck/pull/7")
    task.pull_events()

    with uow_factory() as uow:
        uow.tasks.add(task)
        uow.commit()

    orchestrator = DevCycleOrchestrator(
        uow_factory=uow_factory,
        workflow=DevCycleWorkflow(auto_lead_review=True),
        steps={
            StepName.LEAD_REVIEW: _Step(
                StepResult(
                    ok=True,
                    summary="Lead wants rework",
                    details="The code is close, but not ready",
                    metadata={
                        "review_decision": MergeDecision.RERUN_TESTS.value,
                        "review_feedback": "The code is close, but not ready",
                    },
                )
            ),
        },
        lock_port=lock_port,
        notifier=NullNotifier(),
        max_retries=3,
        decision_ttl_seconds=60,
        auto_decision_use_case=auto_decision,
    )

    await orchestrator.run_task(task.id)

    assert auto_decision.calls == [
        (task.id, MergeDecision.RERUN_TESTS, "The code is close, but not ready")
    ]


async def test_research_task_reaches_completed_terminal_state_and_notifies(tmp_path: Path) -> None:
    db_path = tmp_path / "bot.sqlite3"
    uow_factory = lambda: SqliteUnitOfWork(str(db_path))
    lock_conn = sqlite3.connect(":memory:")
    init_db(lock_conn)
    lock_port = SQLiteLockRepository(lock_conn)
    notifier = _Notifier()

    task = TaskAggregate.create(
        task_id="34343434-3434-3434-3434-343434343434",
        author_id=1,
        title="Research the bot",
        body="Analyze repeated failures",
        correlation_id="corr-research",
        kind=TaskKind.RESEARCH,
    )
    with uow_factory() as uow:
        uow.tasks.add(task)
        uow.commit()

    orchestrator = DevCycleOrchestrator(
        uow_factory=uow_factory,
        workflow=DevCycleWorkflow(),
        steps={
            StepName.RESEARCH: _Step(
                StepResult(
                    ok=True,
                    summary="Research completed",
                    details="Top ideas ready",
                )
            ),
        },
        lock_port=lock_port,
        notifier=notifier,
        max_retries=3,
        decision_ttl_seconds=60,
    )

    await orchestrator.run_task(task.id)

    with uow_factory() as uow:
        stored = uow.tasks.get(task.id)

    assert stored is not None
    assert stored.status == TaskStatus.RESEARCH_COMPLETED
    assert [item.id for item in notifier.finished] == [task.id]
