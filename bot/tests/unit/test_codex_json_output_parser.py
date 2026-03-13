from __future__ import annotations

import pytest

from app.infrastructure.codex.json_output_parser import CodexJsonOutputParseError, CodexJsonOutputParser


def test_parser_extracts_session_id_and_last_agent_message() -> None:
    parser = CodexJsonOutputParser()

    parsed = parser.parse(
        """
        {"type":"thread.started","thread_id":"session-123"}
        {"type":"item.completed","item":{"type":"agent_message","text":"first"}}
        {"type":"item.completed","item":{"type":"agent_message","text":"RESULT: PASS\\nSUMMARY: ok\\nDETAILS: ok"}}
        {"type":"turn.completed"}
        """
    )

    assert parsed.session_id == "session-123"
    assert parsed.final_message == "RESULT: PASS\nSUMMARY: ok\nDETAILS: ok"


def test_parser_rejects_invalid_json_lines() -> None:
    parser = CodexJsonOutputParser()

    with pytest.raises(CodexJsonOutputParseError):
        parser.parse("not-json")
