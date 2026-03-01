from __future__ import annotations

import sqlite3

from app.domain.repositories.step_execution_repository import StepExecutionRepository
from app.shared.enums import StepExecutionStatus, StepName
from app.shared.time import to_iso, utcnow


class SQLiteStepExecutionRepository(StepExecutionRepository):
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def create_attempt(
        self,
        task_id: str,
        step: StepName,
        attempt: int,
        idempotency_key: str,
    ) -> None:
        self._conn.execute(
            """
            INSERT INTO step_executions (
                task_id, step, attempt, status, idempotency_key, started_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                task_id,
                step.value,
                attempt,
                StepExecutionStatus.PENDING.value,
                idempotency_key,
                to_iso(utcnow()),
            ),
        )

    def mark_status(
        self,
        task_id: str,
        step: StepName,
        attempt: int,
        status: StepExecutionStatus,
        log_path: str | None = None,
        error_code: str | None = None,
        error_payload: str | None = None,
    ) -> None:
        ended_at = None
        if status in {
            StepExecutionStatus.PASSED,
            StepExecutionStatus.FAILED,
            StepExecutionStatus.RETRY_SCHEDULED,
            StepExecutionStatus.SKIPPED,
        }:
            ended_at = to_iso(utcnow())

        if status == StepExecutionStatus.RUNNING:
            self._demote_other_running_attempts(task_id=task_id, step=step, attempt=attempt)

        params = (
            status.value,
            ended_at,
            log_path,
            error_code,
            error_payload,
            task_id,
            step.value,
            attempt,
        )
        query = """
            UPDATE step_executions
            SET
                status = ?,
                ended_at = ?,
                log_path = ?,
                error_code = ?,
                error_payload = ?
            WHERE task_id = ? AND step = ? AND attempt = ?
            """
        try:
            self._conn.execute(query, params)
        except sqlite3.IntegrityError:
            if status != StepExecutionStatus.RUNNING:
                raise
            self._demote_other_running_attempts(task_id=task_id, step=step, attempt=attempt)
            try:
                self._conn.execute(query, params)
            except sqlite3.IntegrityError as exc:
                raise RuntimeError(
                    f"Failed to enforce single RUNNING attempt for task_id={task_id} step={step.value}"
                ) from exc

    def _demote_other_running_attempts(self, task_id: str, step: StepName, attempt: int) -> None:
        self._conn.execute(
            """
            UPDATE step_executions
            SET
                status = ?,
                ended_at = COALESCE(ended_at, started_at),
                error_code = COALESCE(error_code, ?),
                error_payload = COALESCE(error_payload, ?)
            WHERE
                task_id = ?
                AND step = ?
                AND status = ?
                AND attempt <> ?
            """,
            (
                StepExecutionStatus.RETRY_SCHEDULED.value,
                "RUNNING_INVARIANT_REPAIRED",
                "Auto-repaired duplicate RUNNING attempt before setting a new RUNNING one",
                task_id,
                step.value,
                StepExecutionStatus.RUNNING.value,
                attempt,
            ),
        )

    def get_last_attempt(self, task_id: str, step: StepName) -> int:
        row = self._conn.execute(
            """
            SELECT COALESCE(MAX(attempt), 0)
            FROM step_executions
            WHERE task_id = ? AND step = ?
            """,
            (task_id, step.value),
        ).fetchone()
        if row is None:
            return 0
        return int(row[0])

    def count_failed_attempts(self, task_id: str, step: StepName) -> int:
        row = self._conn.execute(
            """
            SELECT COUNT(*)
            FROM step_executions
            WHERE task_id = ?
              AND step = ?
              AND status IN (?, ?)
            """,
            (
                task_id,
                step.value,
                StepExecutionStatus.FAILED.value,
                StepExecutionStatus.RETRY_SCHEDULED.value,
            ),
        ).fetchone()
        if row is None:
            return 0
        return int(row[0])
