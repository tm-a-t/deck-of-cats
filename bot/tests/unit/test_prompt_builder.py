from __future__ import annotations

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.codex.prompt_builder import CodexPromptBuilder


def _task() -> TaskAggregate:
    task = TaskAggregate.create(
        task_id="99999999-9999-9999-9999-999999999999",
        author_id=1,
        title="Validate homepage",
        body="Check homepage title and controls",
        correlation_id="corr-x",
    )
    task.changed_files = ["bot/app/di.py", "bot/app/settings.py"]
    return task


def test_validate_prompt_includes_backend_and_playwright_guides() -> None:
    prompt = CodexPromptBuilder().build_validate_prompt(_task())

    assert "bot/docs/codex-python-validation-guide.md" in prompt
    assert "bot/docs/codex-playwright-validation-guide.md" in prompt
    assert "./.venv/bin/python -m pytest" in prompt
    assert "Before any browser check, read and follow this guide exactly" in prompt
    assert "bot/app/di.py" in prompt
    assert "Use that list to focus your checks first" in prompt


def test_personality_preamble_marks_new_task_and_guide() -> None:
    prompt = CodexPromptBuilder().build_personality_preamble(
        personality_key="developer",
        guide_path="bot/personalities/developer.md",
        is_new_session=True,
    )

    assert "Personality: developer" in prompt
    assert "This is a new task." in prompt
    assert "read and follow this guide exactly" in prompt
    assert "bot/personalities/developer.md" in prompt


def test_personality_preamble_for_resumed_session_mentions_reread() -> None:
    prompt = CodexPromptBuilder().build_personality_preamble(
        personality_key="developer",
        guide_path="bot/personalities/developer.md",
        is_new_session=False,
    )

    assert "Continue as the existing Codex agent personality" in prompt
    assert "This is a new task." in prompt
    assert "If you are not fully sure you remember the role or workflow" in prompt


def test_implement_prompt_tells_developer_not_to_run_tests() -> None:
    prompt = CodexPromptBuilder().build_implement_prompt(_task())

    assert "Do not run tests, browser validation, or broad verification commands" in prompt
    assert '"Tester feedback history:"' in prompt
    assert '"Lead review history:"' in prompt


def test_chat_agent_prompt_mentions_chat_turn_and_json_contract() -> None:
    prompt = CodexPromptBuilder().build_chat_agent_prompt(
        personality_key="chat-agent:123",
        guide_path="bot/personalities/chat-agent.md",
        is_new_session=True,
        chat_id=123,
        user_message="Покажи мои задачи",
        active_tasks=[{"public_id": "T-AAAA1111", "status": "NEW", "title": "Add direct chat agent"}],
    )

    assert "This is a new chat turn." in prompt
    assert "bot/personalities/chat-agent.md" in prompt
    assert '"action": "create_task|list_tasks|show_task|show_logs|help|reply"' in prompt
    assert "T-AAAA1111 | NEW | Add direct chat agent" in prompt


def test_chat_agent_log_summary_prompt_requires_russian_paraphrase_without_raw_dump() -> None:
    prompt = CodexPromptBuilder().build_chat_agent_log_summary_prompt(
        personality_key="chat-agent:123",
        guide_path="bot/personalities/chat-agent.md",
        is_new_session=False,
        chat_id=123,
        user_message="Перескажи лог человеческими словами",
        task_public_id="T-AAAA1111",
        task_title="Add direct chat agent",
        task_status="CODEX_VALIDATE_RUNNING",
        log_text="Backend-only change; browser validation skipped.",
    )

    assert "The user is asking about an existing task log" in prompt
    assert "Do not return JSON." in prompt
    assert "Do not dump the raw log text back to the user" in prompt
    assert "Backend-only change; browser validation skipped." in prompt


def test_chat_reply_prompt_requests_plain_text_for_conversation_only() -> None:
    prompt = CodexPromptBuilder().build_chat_reply_prompt(
        personality_key="chat-agent-reply:123",
        guide_path="bot/personalities/chat-agent.md",
        is_new_session=True,
        chat_id=123,
        user_message="Как дела?",
    )

    assert "plain conversation, not task creation, task status, or log analysis" in prompt
    assert "Reply in Russian only." in prompt
    assert "Return plain text only." in prompt


def test_lead_review_prompt_contains_structured_decision_contract() -> None:
    prompt = CodexPromptBuilder().build_lead_review_prompt(_task())

    assert "PR URL:" in prompt
    assert "DECISION: MERGE|RERUN_TESTS|CLOSE" in prompt
    assert "Do not edit files, do not run tests, and do not create commits" in prompt
