from __future__ import annotations

from datetime import datetime
import json
import sqlite3

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.domain.repositories.task_repository import TaskRepository
from app.shared.enums import TaskStatus
from app.shared.errors import ConcurrencyError


class SQLiteTaskRepository(TaskRepository):
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def add(self, task: TaskAggregate) -> None:
        self._conn.execute(
            """
            INSERT INTO tasks (
                id, public_id, author_id, chat_id, author_username, author_display_name, title, body, changed_files_json, correlation_id, status, version,
                pr_url, pr_number, preview_url, decision_token_hash,
                decision_expires_at, last_error, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                task.id,
                task.public_id,
                task.author_id,
                task.chat_id,
                task.author_username,
                task.author_display_name,
                task.title,
                task.body,
                _json(task.changed_files),
                task.correlation_id,
                task.status.value,
                task.version,
                task.pr_url,
                task.pr_number,
                task.preview_url,
                task.decision_token_hash,
                _iso(task.decision_expires_at),
                task.last_error,
                _iso(task.created_at),
                _iso(task.updated_at),
            ),
        )

    def get(self, task_id: str) -> TaskAggregate | None:
        row = self._conn.execute(
            """
            SELECT
                id, public_id, author_id, chat_id, author_username, author_display_name, title, body, changed_files_json, correlation_id, status, version,
                pr_url, pr_number, preview_url, decision_token_hash,
                decision_expires_at, last_error, created_at, updated_at
            FROM tasks
            WHERE id = ?
            """,
            (task_id,),
        ).fetchone()

        if row is None:
            return None

        return TaskAggregate(
            id=row[0],
            public_id=row[1] or TaskAggregate.derive_public_id(row[0]),
            author_id=row[2],
            chat_id=row[3] or row[2],
            author_username=row[4],
            author_display_name=row[5],
            title=row[6],
            body=row[7],
            changed_files=_json_list(row[8]),
            correlation_id=row[9],
            status=TaskStatus(row[10]),
            version=row[11],
            pr_url=row[12],
            pr_number=row[13],
            preview_url=row[14],
            decision_token_hash=row[15],
            decision_expires_at=_dt(row[16]),
            last_error=row[17],
            created_at=_dt(row[18]) or datetime.utcnow(),
            updated_at=_dt(row[19]) or datetime.utcnow(),
        )

    def update(self, task: TaskAggregate) -> None:
        expected_version = task.version - 1 if task.version > 0 else 0
        cursor = self._conn.execute(
            """
            UPDATE tasks
            SET
                title = ?,
                body = ?,
                changed_files_json = ?,
                public_id = ?,
                chat_id = ?,
                author_username = ?,
                author_display_name = ?,
                status = ?,
                version = ?,
                pr_url = ?,
                pr_number = ?,
                preview_url = ?,
                decision_token_hash = ?,
                decision_expires_at = ?,
                last_error = ?,
                updated_at = ?
            WHERE id = ? AND version = ?
            """,
            (
                task.title,
                task.body,
                _json(task.changed_files),
                task.public_id,
                task.chat_id,
                task.author_username,
                task.author_display_name,
                task.status.value,
                task.version,
                task.pr_url,
                task.pr_number,
                task.preview_url,
                task.decision_token_hash,
                _iso(task.decision_expires_at),
                task.last_error,
                _iso(task.updated_at),
                task.id,
                expected_version,
            ),
        )
        if cursor.rowcount == 0:
            raise ConcurrencyError(f"Optimistic lock failed for task {task.id}")

    def list_active(self, chat_id: int | None = None) -> list[TaskAggregate]:
        query = """
            SELECT id FROM tasks
            WHERE status NOT IN ('MERGED', 'CLOSED', 'DEAD_LETTER')
        """
        params: tuple[object, ...] = ()
        if chat_id is not None:
            query += " AND chat_id = ?"
            params = (chat_id,)
        query += " ORDER BY updated_at DESC"
        rows = self._conn.execute(query, params).fetchall()
        return [task for row in rows if (task := self.get(row[0])) is not None]

    def find_by_short_id(self, short_id: str, chat_id: int | None = None) -> TaskAggregate | None:
        query = """
            SELECT id
            FROM tasks
            WHERE (lower(public_id) = lower(?)
               OR id LIKE ?)
        """
        params: tuple[object, ...] = (short_id, f"{short_id}%")
        if chat_id is not None:
            query += " AND chat_id = ?"
            params += (chat_id,)
        query += """
            ORDER BY created_at DESC
            LIMIT 1
        """
        row = self._conn.execute(query, params).fetchone()
        if row is None:
            return None
        return self.get(row[0])


def _dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _json(value: list[str]) -> str:
    return json.dumps(value)


def _json_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item) for item in parsed if isinstance(item, str)]
