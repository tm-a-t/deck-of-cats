from __future__ import annotations

import sqlite3

from app.infrastructure.persistence.sqlite.models import init_db
from app.infrastructure.persistence.sqlite.step_execution_repository_impl import SQLiteStepExecutionRepository
from app.shared.enums import StepExecutionStatus, StepName


def test_get_latest_error_payload_returns_most_recent_non_empty() -> None:
    conn = sqlite3.connect(":memory:")
    init_db(conn)
    repo = SQLiteStepExecutionRepository(conn)

    repo.create_attempt("task-1", StepName.CODEX_VALIDATE, 1, "idem-1")
    repo.mark_status(
        "task-1",
        StepName.CODEX_VALIDATE,
        1,
        StepExecutionStatus.FAILED,
        error_code="STEP_FAILED",
        error_payload="first payload",
    )

    repo.create_attempt("task-1", StepName.CODEX_VALIDATE, 2, "idem-2")
    repo.mark_status(
        "task-1",
        StepName.CODEX_VALIDATE,
        2,
        StepExecutionStatus.RETRY_SCHEDULED,
        error_code="STEP_FAILED",
        error_payload="second payload",
    )

    assert repo.get_latest_error_payload("task-1") == "second payload"


def test_get_latest_error_payload_returns_none_when_absent() -> None:
    conn = sqlite3.connect(":memory:")
    init_db(conn)
    repo = SQLiteStepExecutionRepository(conn)

    repo.create_attempt("task-2", StepName.CODEX_IMPLEMENT, 1, "idem-a")
    repo.mark_status(
        "task-2",
        StepName.CODEX_IMPLEMENT,
        1,
        StepExecutionStatus.PASSED,
        error_payload="",
    )

    assert repo.get_latest_error_payload("task-2") is None
