from __future__ import annotations

from pathlib import Path

from app.infrastructure.codex.personality_store import JsonPersonalityStore


def test_personality_store_round_trips_session(tmp_path) -> None:
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))

    store.save("developer", "session-123", "bot/personalities/developer.md")
    stored = store.get("developer")

    assert stored is not None
    assert stored.personality_key == "developer"
    assert stored.session_id == "session-123"
    assert stored.guide_path == "bot/personalities/developer.md"


def test_personality_store_returns_none_for_missing_personality(tmp_path: Path) -> None:
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))

    assert store.get("developer") is None


def test_personality_store_ignores_invalid_json(tmp_path: Path) -> None:
    path = tmp_path / "agent_personalities.json"
    path.write_text("{broken", encoding="utf-8")
    store = JsonPersonalityStore(str(path))

    assert store.get("developer") is None
