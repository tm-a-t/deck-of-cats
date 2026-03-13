from __future__ import annotations

import sqlite3

SCHEMA_SQL = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    public_id TEXT,
    author_id INTEGER NOT NULL,
    author_username TEXT,
    author_display_name TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    changed_files_json TEXT,
    correlation_id TEXT NOT NULL,
    status TEXT NOT NULL,
    version INTEGER NOT NULL,
    pr_url TEXT,
    pr_number INTEGER,
    preview_url TEXT,
    decision_token_hash TEXT,
    decision_expires_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS step_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    step TEXT NOT NULL,
    attempt INTEGER NOT NULL,
    status TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    next_retry_at TEXT,
    lock_until TEXT,
    locked_by TEXT,
    error_code TEXT,
    error_payload TEXT,
    log_path TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_step_attempt
ON step_executions(task_id, step, attempt);

CREATE UNIQUE INDEX IF NOT EXISTS ux_step_idempotency
ON step_executions(idempotency_key);

CREATE TABLE IF NOT EXISTS pull_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    pr_number INTEGER NOT NULL,
    url TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(provider, pr_number)
);

CREATE TABLE IF NOT EXISTS preview_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    url TEXT NOT NULL,
    ready_at TEXT
);

CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    decision TEXT NOT NULL,
    decision_token_hash TEXT,
    expires_at TEXT,
    decided_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aggregate_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    published_at TEXT
);

CREATE TABLE IF NOT EXISTS inbox_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    external_event_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    received_at TEXT NOT NULL,
    UNIQUE(provider, external_event_id)
);

CREATE TABLE IF NOT EXISTS locks (
    key TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    lock_until TEXT NOT NULL
);
"""


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_SQL)
    _ensure_tasks_public_id(conn)
    _ensure_tasks_author_identity(conn)
    _ensure_tasks_changed_files(conn)
    _ensure_single_running_attempt(conn)
    conn.commit()


def _ensure_tasks_public_id(conn: sqlite3.Connection) -> None:
    columns = conn.execute("PRAGMA table_info(tasks)").fetchall()
    column_names = {str(row[1]) for row in columns}
    if "public_id" not in column_names:
        conn.execute("ALTER TABLE tasks ADD COLUMN public_id TEXT")

    conn.execute(
        """
        UPDATE tasks
        SET public_id = 'T-' || UPPER(SUBSTR(REPLACE(id, '-', ''), 1, 8))
        WHERE COALESCE(public_id, '') = ''
        """
    )
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_tasks_public_id ON tasks(public_id)")


def _ensure_tasks_author_identity(conn: sqlite3.Connection) -> None:
    columns = conn.execute("PRAGMA table_info(tasks)").fetchall()
    column_names = {str(row[1]) for row in columns}
    if "author_username" not in column_names:
        conn.execute("ALTER TABLE tasks ADD COLUMN author_username TEXT")
    if "author_display_name" not in column_names:
        conn.execute("ALTER TABLE tasks ADD COLUMN author_display_name TEXT")


def _ensure_tasks_changed_files(conn: sqlite3.Connection) -> None:
    columns = conn.execute("PRAGMA table_info(tasks)").fetchall()
    column_names = {str(row[1]) for row in columns}
    if "changed_files_json" not in column_names:
        conn.execute("ALTER TABLE tasks ADD COLUMN changed_files_json TEXT")


def _ensure_single_running_attempt(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        UPDATE step_executions AS current
        SET
            status = 'RETRY_SCHEDULED',
            ended_at = COALESCE(current.ended_at, current.started_at),
            error_code = COALESCE(current.error_code, 'RUNNING_INVARIANT_REPAIRED'),
            error_payload = COALESCE(
                current.error_payload,
                'Auto-repaired duplicate RUNNING attempt during migration'
            )
        WHERE
            current.status = 'RUNNING'
            AND EXISTS (
                SELECT 1
                FROM step_executions AS newer
                WHERE
                    newer.task_id = current.task_id
                    AND newer.step = current.step
                    AND newer.status = 'RUNNING'
                    AND (
                        newer.attempt > current.attempt
                        OR (newer.attempt = current.attempt AND newer.id > current.id)
                    )
            )
        """
    )
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_step_running_single
        ON step_executions(task_id, step)
        WHERE status = 'RUNNING'
        """
    )
