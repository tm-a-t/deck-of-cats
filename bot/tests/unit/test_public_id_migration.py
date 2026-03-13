from __future__ import annotations

import sqlite3

from app.infrastructure.persistence.sqlite.models import init_db


def test_init_db_backfills_public_id_for_legacy_rows() -> None:
    conn = sqlite3.connect(":memory:")
    conn.execute(
        """
        CREATE TABLE tasks (
            id TEXT PRIMARY KEY,
            author_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
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
        )
        """
    )
    conn.execute(
        """
        INSERT INTO tasks (
            id, author_id, title, body, correlation_id, status, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "abcfb694-15de-4ab7-8e42-df16610e4cb5",
            1,
            "title",
            "body",
            "corr",
            "NEW",
            0,
            "2026-01-01T00:00:00",
            "2026-01-01T00:00:00",
        ),
    )

    init_db(conn)

    row = conn.execute("SELECT public_id FROM tasks WHERE id = ?", ("abcfb694-15de-4ab7-8e42-df16610e4cb5",)).fetchone()
    assert row is not None
    assert row[0] == "T-ABCFB694"

    columns = conn.execute("PRAGMA table_info(tasks)").fetchall()
    column_names = {str(column[1]) for column in columns}
    assert "author_username" in column_names
    assert "author_display_name" in column_names
    assert "changed_files_json" in column_names
