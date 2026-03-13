from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.infrastructure.codex.chat_agent_adapter import ChatAgentRequest, CodexChatAgentAdapter
from app.infrastructure.codex.chat_agent_parser import ChatAgentParser
from app.infrastructure.codex.json_output_parser import CodexJsonOutputParser
from app.infrastructure.codex.personality_store import JsonPersonalityStore
from app.infrastructure.codex.prompt_builder import CodexPromptBuilder
from app.infrastructure.execution.process_runner import ProcessResult


pytestmark = pytest.mark.asyncio


class _FakeRunner:
    def __init__(self, stdout: str | list[str]) -> None:
        self.stdout = stdout
        self.calls: list[dict[str, object]] = []

    async def run(self, args, cwd: str, timeout_seconds: int) -> ProcessResult:
        if isinstance(self.stdout, list):
            stdout = self.stdout.pop(0)
        else:
            stdout = self.stdout
        self.calls.append({"args": list(args), "cwd": cwd, "timeout_seconds": timeout_seconds})
        return ProcessResult(
            args=tuple(args),
            returncode=0,
            stdout=stdout,
            stderr="",
            timed_out=False,
        )


def _chat_json(session_id: str) -> str:
    return _decision_json(
        session_id=session_id,
        action="list_tasks",
        reply_text="Показываю задачи.",
    )


def _decision_json(
    session_id: str,
    action: str,
    reply_text: str,
    title_en: str = "",
    body_en: str = "",
    task_ref: str = "",
) -> str:
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
                                "action": action,
                                "reply_text": reply_text,
                                "title_en": title_en,
                                "body_en": body_en,
                                "task_ref": task_ref,
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


def _reply_json(session_id: str, text: str) -> str:
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


async def test_chat_agent_adapter_uses_model_override_for_specific_chat(tmp_path: Path) -> None:
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))
    runner = _FakeRunner(
        stdout=[
            _decision_json(
                session_id="session-route",
                action="reply",
                reply_text="Маршрутизация решила, что это обычный разговор.",
            ),
            _reply_json("session-spark", "Это обычный разговорный ответ."),
        ]
    )
    adapter = CodexChatAgentAdapter(
        runner=runner,
        prompt_builder=CodexPromptBuilder(),
        parser=ChatAgentParser(),
        json_output_parser=CodexJsonOutputParser(),
        personality_store=store,
        repo_path="/tmp/repo",
        timeout_seconds=30,
        chat_reply_model_overrides={175504456: "gpt-5.3-codex-spark"},
    )

    decision = await adapter.plan(
        ChatAgentRequest(
            chat_id=175504456,
            user_message="Просто поболтаем",
            active_tasks=[],
        )
    )

    route_args = runner.calls[0]["args"]
    reply_args = runner.calls[1]["args"]
    assert len(runner.calls) == 2
    assert decision.reply_text == "Это обычный разговорный ответ."
    assert "-m" not in route_args
    assert reply_args[:9] == [
        "codex",
        "-a",
        "never",
        "-s",
        "workspace-write",
        "-m",
        "gpt-5.3-codex-spark",
        "exec",
        "--json",
    ]
    assert "The routing layer has already decided this message is plain conversation" in str(reply_args[9])


async def test_chat_agent_adapter_keeps_model_override_when_resuming_target_chat(tmp_path: Path) -> None:
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))
    store.save("chat-agent:175504456", "session-route-existing", "bot/personalities/chat-agent.md")
    store.save("chat-agent-reply:175504456", "session-spark-existing", "bot/personalities/chat-agent.md")
    runner = _FakeRunner(
        stdout=[
            _decision_json(
                session_id="session-route-existing",
                action="reply",
                reply_text="Маршрутизация снова решила, что это разговор.",
            ),
            _reply_json("session-spark-existing", "Продолжаю обычный разговор."),
        ]
    )
    adapter = CodexChatAgentAdapter(
        runner=runner,
        prompt_builder=CodexPromptBuilder(),
        parser=ChatAgentParser(),
        json_output_parser=CodexJsonOutputParser(),
        personality_store=store,
        repo_path="/tmp/repo",
        timeout_seconds=30,
        chat_reply_model_overrides={175504456: "gpt-5.3-codex-spark"},
    )

    await adapter.plan(
        ChatAgentRequest(
            chat_id=175504456,
            user_message="Продолжим разговор",
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
        "session-route-existing",
    ]
    assert runner.calls[1]["args"][:11] == [
        "codex",
        "-a",
        "never",
        "-s",
        "workspace-write",
        "-m",
        "gpt-5.3-codex-spark",
        "exec",
        "resume",
        "--json",
        "session-spark-existing",
    ]


async def test_chat_agent_adapter_keeps_default_model_for_other_chats(tmp_path: Path) -> None:
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))
    runner = _FakeRunner(stdout=_chat_json("session-default"))
    adapter = CodexChatAgentAdapter(
        runner=runner,
        prompt_builder=CodexPromptBuilder(),
        parser=ChatAgentParser(),
        json_output_parser=CodexJsonOutputParser(),
        personality_store=store,
        repo_path="/tmp/repo",
        timeout_seconds=30,
        chat_reply_model_overrides={175504456: "gpt-5.3-codex-spark"},
    )

    await adapter.plan(
        ChatAgentRequest(
            chat_id=175504457,
            user_message="Просто поболтаем",
            active_tasks=[],
        )
    )

    assert "-m" not in runner.calls[0]["args"]


async def test_chat_agent_adapter_keeps_task_creation_on_default_model_in_target_chat(tmp_path: Path) -> None:
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))
    runner = _FakeRunner(
        stdout=_decision_json(
            session_id="session-target-task",
            action="create_task",
            reply_text="Сформировал задачу.",
            title_en="Implement scoped change",
            body_en="Implement the requested scoped change.",
        )
    )
    adapter = CodexChatAgentAdapter(
        runner=runner,
        prompt_builder=CodexPromptBuilder(),
        parser=ChatAgentParser(),
        json_output_parser=CodexJsonOutputParser(),
        personality_store=store,
        repo_path="/tmp/repo",
        timeout_seconds=30,
        chat_reply_model_overrides={175504456: "gpt-5.3-codex-spark"},
    )

    decision = await adapter.plan(
        ChatAgentRequest(
            chat_id=175504456,
            user_message="Сделай новую фичу",
            active_tasks=[],
        )
    )

    assert decision.action.value == "create_task"
    assert len(runner.calls) == 1
    assert "-m" not in runner.calls[0]["args"]
