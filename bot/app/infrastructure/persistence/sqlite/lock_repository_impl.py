from __future__ import annotations

import sqlite3
from datetime import timedelta

from app.application.ports.lock_port import LockPort
from app.shared.time import to_iso, utcnow


class SQLiteLockRepository(LockPort):
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def acquire(self, key: str, owner: str, ttl_seconds: int) -> bool:
        now = utcnow()
        until = now + timedelta(seconds=ttl_seconds)
        now_iso = to_iso(now)
        until_iso = to_iso(until)
        try:
            cursor = self._conn.execute(
                """
                INSERT INTO locks (key, owner, lock_until)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    owner = excluded.owner,
                    lock_until = excluded.lock_until
                WHERE locks.lock_until <= ? OR locks.owner = ?
                """,
                (key, owner, until_iso, now_iso, owner),
            )
            self._conn.commit()
            return cursor.rowcount > 0
        except (sqlite3.IntegrityError, sqlite3.OperationalError):
            return False

    def release(self, key: str, owner: str) -> None:
        try:
            self._conn.execute("DELETE FROM locks WHERE key = ? AND owner = ?", (key, owner))
            self._conn.commit()
        except sqlite3.OperationalError:
            return
