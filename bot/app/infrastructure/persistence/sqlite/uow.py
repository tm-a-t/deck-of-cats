from __future__ import annotations

import sqlite3
from pathlib import Path

from app.application.ports.unit_of_work import UnitOfWork
from app.infrastructure.persistence.sqlite.models import init_db
from app.infrastructure.persistence.sqlite.outbox_repository_impl import SQLiteOutboxRepository
from app.infrastructure.persistence.sqlite.step_execution_repository_impl import SQLiteStepExecutionRepository
from app.infrastructure.persistence.sqlite.task_repository_impl import SQLiteTaskRepository


class SqliteUnitOfWork(UnitOfWork):
    def __init__(self, db_path: str) -> None:
        self._db_path = db_path
        self._conn: sqlite3.Connection | None = None
        self.tasks = None
        self.step_executions = None
        self.outbox = None

    def __enter__(self) -> "SqliteUnitOfWork":
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self._db_path, check_same_thread=False)
        init_db(self._conn)
        self.tasks = SQLiteTaskRepository(self._conn)
        self.step_executions = SQLiteStepExecutionRepository(self._conn)
        self.outbox = SQLiteOutboxRepository(self._conn)
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._conn is None:
            return
        if exc:
            self._conn.rollback()
        else:
            self._conn.commit()
        self._conn.close()
        self._conn = None

    def commit(self) -> None:
        if self._conn is None:
            raise RuntimeError("UnitOfWork is not entered")
        self._conn.commit()

    def rollback(self) -> None:
        if self._conn is None:
            raise RuntimeError("UnitOfWork is not entered")
        self._conn.rollback()
