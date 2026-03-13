from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum


class ChatAgentParseError(ValueError):
    pass


class ChatAgentAction(str, Enum):
    CREATE_TASK = "create_task"
    LIST_TASKS = "list_tasks"
    SHOW_TASK = "show_task"
    SHOW_LOGS = "show_logs"
    HELP = "help"
    REPLY = "reply"


@dataclass(frozen=True)
class ChatAgentDecision:
    action: ChatAgentAction
    reply_text: str
    title_en: str
    body_en: str
    task_ref: str | None


class ChatAgentParser:
    def parse(self, message: str) -> ChatAgentDecision:
        normalized = self._strip_code_fences(message).strip()
        if not normalized:
            raise ChatAgentParseError("Chat agent returned an empty response")

        try:
            payload = json.loads(normalized)
        except json.JSONDecodeError as exc:
            raise ChatAgentParseError(f"Chat agent did not return valid JSON: {normalized}") from exc

        if not isinstance(payload, dict):
            raise ChatAgentParseError("Chat agent JSON payload must be an object")

        raw_action = str(payload.get("action", "")).strip().lower()
        try:
            action = ChatAgentAction(raw_action)
        except ValueError as exc:
            raise ChatAgentParseError(f"Unsupported chat agent action: {raw_action or '<empty>'}") from exc

        reply_text = self._normalize_text(payload.get("reply_text"))
        title_en = self._normalize_text(payload.get("title_en"))
        body_en = self._normalize_multiline_text(payload.get("body_en"))
        task_ref = self._normalize_text(payload.get("task_ref")) or None

        if action == ChatAgentAction.CREATE_TASK and not body_en:
            raise ChatAgentParseError("Chat agent must provide body_en for create_task")

        return ChatAgentDecision(
            action=action,
            reply_text=reply_text,
            title_en=title_en,
            body_en=body_en,
            task_ref=task_ref,
        )

    @staticmethod
    def _strip_code_fences(value: str) -> str:
        stripped = value.strip()
        if stripped.startswith("```") and stripped.endswith("```"):
            lines = stripped.splitlines()
            if len(lines) >= 2:
                return "\n".join(lines[1:-1])
        return stripped

    @staticmethod
    def _normalize_text(value: object) -> str:
        if value is None:
            return ""
        return " ".join(str(value).split()).strip()

    @staticmethod
    def _normalize_multiline_text(value: object) -> str:
        if value is None:
            return ""
        lines = [line.rstrip() for line in str(value).strip().splitlines()]
        return "\n".join(line for line in lines if line.strip())
