from __future__ import annotations

import pytest

from app.infrastructure.codex.chat_agent_parser import (
    ChatAgentAction,
    ChatAgentParseError,
    ChatAgentParser,
)


def test_chat_agent_parser_reads_create_task_payload() -> None:
    parser = ChatAgentParser()

    parsed = parser.parse(
        """
        {
          "action": "create_task",
          "reply_text": "Создаю задачу.",
          "title_en": "Add direct chat agent",
          "body_en": "Implement direct Telegram intake.",
          "task_ref": ""
        }
        """
    )

    assert parsed.action == ChatAgentAction.CREATE_TASK
    assert parsed.reply_text == "Создаю задачу."
    assert parsed.title_en == "Add direct chat agent"
    assert parsed.body_en == "Implement direct Telegram intake."
    assert parsed.task_ref is None


def test_chat_agent_parser_rejects_missing_body_for_create_task() -> None:
    parser = ChatAgentParser()

    with pytest.raises(ChatAgentParseError):
        parser.parse(
            """
            {
              "action": "create_task",
              "reply_text": "Создаю задачу.",
              "title_en": "Add direct chat agent",
              "body_en": "",
              "task_ref": ""
            }
            """
        )
