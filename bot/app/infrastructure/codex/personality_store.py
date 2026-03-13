from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class StoredPersonalitySession:
    personality_key: str
    session_id: str
    guide_path: str
    updated_at: str


class JsonPersonalityStore:
    def __init__(self, path: str) -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)

    def get(self, personality_key: str) -> StoredPersonalitySession | None:
        payload = self._read()
        raw = payload.get(personality_key)
        if not isinstance(raw, dict):
            return None

        session_id = str(raw.get("session_id", "")).strip()
        guide_path = str(raw.get("guide_path", "")).strip()
        updated_at = str(raw.get("updated_at", "")).strip()
        if not session_id:
            return None

        return StoredPersonalitySession(
            personality_key=personality_key,
            session_id=session_id,
            guide_path=guide_path,
            updated_at=updated_at,
        )

    def save(self, personality_key: str, session_id: str, guide_path: str) -> None:
        normalized_session_id = session_id.strip()
        if not normalized_session_id:
            raise ValueError("session_id must be non-empty")

        payload = self._read()
        payload[personality_key] = {
            "session_id": normalized_session_id,
            "guide_path": guide_path,
            "updated_at": dt.datetime.now(dt.UTC).isoformat(),
        }
        self._write(payload)

    def _read(self) -> dict[str, dict[str, str]]:
        if not self._path.exists():
            return {}

        raw = self._path.read_text(encoding="utf-8").strip()
        if not raw:
            return {}

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        if not isinstance(parsed, dict):
            return {}
        return {str(key): value for key, value in parsed.items() if isinstance(value, dict)}

    def _write(self, payload: dict[str, dict[str, str]]) -> None:
        tmp_path = self._path.with_suffix(f"{self._path.suffix}.tmp")
        tmp_path.write_text(
            json.dumps(payload, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        tmp_path.replace(self._path)
