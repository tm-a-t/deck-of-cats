from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.infrastructure.codex.chat_agent_adapter import (
    ChatAgentLogSummaryRequest,
    ChatAgentRequest,
    CodexChatAgentAdapter,
)
from app.infrastructure.codex.chat_agent_parser import ChatAgentParser
from app.infrastructure.codex.json_output_parser import CodexJsonOutputParser
from app.infrastructure.codex.personality_store import JsonPersonalityStore
from app.infrastructure.codex.prompt_builder import CodexPromptBuilder
from app.infrastructure.execution.process_runner import ProcessResult


pytestmark = pytest.mark.asyncio


class _FakeRunner:
    def __init__(self, stdout: str) -> None:
        self.stdout = stdout
        self.calls: list[dict[str, object]] = []

    async def run(self, args, cwd: str, timeout_seconds: int) -> ProcessResult:
        self.calls.append({"args": list(args), "cwd": cwd, "timeout_seconds": timeout_seconds})
        return ProcessResult(
            args=tuple(args),
            returncode=0,
            stdout=self.stdout,
            stderr="",
            timed_out=False,
        )


def _chat_json(session_id: str) -> str:
    return "\n".join(
        [
            json.dumps({"type": "thread.started", "thread_id": session_id}, ensure_ascii=False),
            json.dumps(
                {
                    "type": "item.completed",
                    "item": {
                        "id": "item_0",
                        "type": "agent_message",
                        "text": json.dumps(
                            {
                                "action": "list_tasks",
                                "reply_text": "Показываю задачи.",
                                "title_en": "",
                                "body_en": "",
                                "task_ref": "",
                            },
                            ensure_ascii=False,
                        ),
                    },
                },
                ensure_ascii=False,
            ),
            json.dumps({"type": "turn.completed"}, ensure_ascii=False),
        ]
    )


def _plain_text_json(session_id: str, text: str) -> str:
    return "\n".join(
        [
            json.dumps({"type": "thread.started", "thread_id": session_id}, ensure_ascii=False),
            json.dumps(
                {
                    "type": "item.completed",
                    "item": {
                        "id": "item_0",
                        "type": "agent_message",
                        "text": text,
                    },
                },
                ensure_ascii=False,
            ),
            json.dumps({"type": "turn.completed"}, ensure_ascii=False),
        ]
    )


async def test_chat_agent_adapter_persists_session_per_chat(tmp_path: Path) -> None:
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))
    runner = _FakeRunner(stdout=_chat_json("session-chat-1"))
    adapter = CodexChatAgentAdapter(
        runner=runner,
        prompt_builder=CodexPromptBuilder(),
        parser=ChatAgentParser(),
        json_output_parser=CodexJsonOutputParser(),
        personality_store=store,
        repo_path="/tmp/repo",
        timeout_seconds=30,
    )

    decision = await adapter.plan(
        ChatAgentRequest(
            chat_id=123,
            user_message="Какие задачи открыты?",
            active_tasks=[{"public_id": "T-AAAA1111", "status": "NEW", "title": "Add bot feature"}],
        )
    )

    stored = store.get("chat-agent:123")
    assert stored is not None
    assert stored.session_id == "session-chat-1"
    assert decision.reply_text == "Показываю задачи."
    prompt = runner.calls[0]["args"][7]
    assert "This is a new chat turn." in prompt
    assert "bot/personalities/chat-agent.md" in prompt
    assert "T-AAAA1111 | NEW | Add bot feature" in prompt


async def test_chat_agent_adapter_resumes_existing_chat_session(tmp_path: Path) -> None:
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))
    store.save("chat-agent:777", "session-existing", "bot/personalities/chat-agent.md")
    runner = _FakeRunner(stdout=_chat_json("session-existing"))
    adapter = CodexChatAgentAdapter(
        runner=runner,
        prompt_builder=CodexPromptBuilder(),
        parser=ChatAgentParser(),
        json_output_parser=CodexJsonOutputParser(),
        personality_store=store,
        repo_path="/tmp/repo",
        timeout_seconds=30,
    )

    await adapter.plan(
        ChatAgentRequest(
            chat_id=777,
            user_message="Покажи задачи",
            active_tasks=[],
        )
    )

    assert runner.calls[0]["args"][:9] == [
        "codex",
        "-a",
        "never",
        "-s",
        "workspace-write",
        "exec",
        "resume",
        "--json",
        "session-existing",
    ]


async def test_chat_agent_adapter_can_explain_logs_with_same_personality(tmp_path: Path) -> None:
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))
    store.save("chat-agent:777", "session-existing", "bot/personalities/chat-agent.md")
    runner = _FakeRunner(stdout=_plain_text_json("session-existing", "Коротко: тесты прошли, но scope сломан."))
    adapter = CodexChatAgentAdapter(
        runner=runner,
        prompt_builder=CodexPromptBuilder(),
        parser=ChatAgentParser(),
        json_output_parser=CodexJsonOutputParser(),
        personality_store=store,
        repo_path="/tmp/repo",
        timeout_seconds=30,
    )

    explanation = await adapter.explain_logs(
        ChatAgentLogSummaryRequest(
            chat_id=777,
            user_message="Перескажи лог простыми словами",
            task_public_id="T-AAAA1111",
            task_title="Limit chat model scope",
            task_status="CODEX_VALIDATE_RUNNING",
            log_text="pytest passed but coding-style message still used spark model",
        )
    )

    assert explanation == "Коротко: тесты прошли, но scope сломан."
    prompt = runner.calls[0]["args"][9]
    assert "Do not dump the raw log text back to the user" in prompt
    assert "pytest passed but coding-style message still used spark model" in prompt
