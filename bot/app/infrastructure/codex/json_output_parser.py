from __future__ import annotations

import json
from dataclasses import dataclass


class CodexJsonOutputParseError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedCodexJsonOutput:
    session_id: str | None
    final_message: str | None


class CodexJsonOutputParser:
    def parse(self, output: str) -> ParsedCodexJsonOutput:
        session_id: str | None = None
        final_message: str | None = None

        for raw_line in output.splitlines():
            line = raw_line.strip()
            if not line:
                continue

            try:
                payload = json.loads(line)
            except json.JSONDecodeError as exc:
                raise CodexJsonOutputParseError(f"Invalid Codex JSON output line: {line}") from exc

            if not isinstance(payload, dict):
                continue

            event_type = payload.get("type")
            if event_type == "thread.started":
                raw_session_id = str(payload.get("thread_id", "")).strip()
                if raw_session_id:
                    session_id = raw_session_id
                continue

            if event_type != "item.completed":
                continue

            item = payload.get("item")
            if not isinstance(item, dict) or item.get("type") != "agent_message":
                continue

            text = str(item.get("text", "")).strip()
            if text:
                final_message = text

        return ParsedCodexJsonOutput(session_id=session_id, final_message=final_message)
