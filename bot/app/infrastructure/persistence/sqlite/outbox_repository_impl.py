from __future__ import annotations

import json
import sqlite3

from app.application.ports.outbox_port import OutboxPort


class SQLiteOutboxRepository(OutboxPort):
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def enqueue(self, aggregate_id: str, event_type: str, payload: dict) -> None:
        self._conn.execute(
            """
            INSERT INTO outbox_events (aggregate_id, event_type, payload, published_at)
            VALUES (?, ?, ?, NULL)
            """,
            (aggregate_id, event_type, json.dumps(payload, ensure_ascii=True)),
        )
