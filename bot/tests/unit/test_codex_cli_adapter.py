from __future__ import annotations

from pathlib import Path

import pytest

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.codex.codex_cli_adapter import CodexCliAdapter
from app.infrastructure.codex.personality import CodexPersonalityRegistry
from app.infrastructure.codex.personality_store import JsonPersonalityStore
from app.infrastructure.codex.prompt_builder import CodexPromptBuilder
from app.infrastructure.codex.result_parser import CodexResultParser
from app.infrastructure.execution.process_runner import ProcessResult


pytestmark = pytest.mark.asyncio


def _task() -> TaskAggregate:
    task = TaskAggregate.create(
        task_id="55555555-5555-5555-5555-555555555555",
        author_id=1,
        title="Add personality sessions",
        body="Store agent personalities and resume them when appropriate",
        correlation_id="corr-personality",
    )
    task.changed_files = ["bot/app/di.py", "bot/app/settings.py"]
    return task


class _FakeRunner:
    def __init__(self, stdout: str, returncode: int = 0, stderr: str = "") -> None:
        self.stdout = stdout
        self.returncode = returncode
        self.stderr = stderr
        self.calls: list[dict[str, object]] = []

    async def run(self, args, cwd: str, timeout_seconds: int) -> ProcessResult:
        self.calls.append({"args": list(args), "cwd": cwd, "timeout_seconds": timeout_seconds})
        return ProcessResult(
            args=tuple(args),
            returncode=self.returncode,
            stdout=self.stdout,
            stderr=self.stderr,
            timed_out=False,
        )


class _FakeWorktreeManager:
    def create(self, task_id: str) -> tuple[str, str]:
        _ = task_id
        return ("/tmp/codex-worktree", "bot/task-55555555")


def _implement_json(session_id: str) -> str:
    return "\n".join(
        [
            f'{{"type":"thread.started","thread_id":"{session_id}"}}',
            '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"RESULT: FAIL\\nSUMMARY: blocked\\nDETAILS: blocked\\nCHANGED_FILES:\\n- bot/README.md"}}',
            '{"type":"turn.completed"}',
        ]
    )


def _validate_json(session_id: str) -> str:
    return "\n".join(
        [
            f'{{"type":"thread.started","thread_id":"{session_id}"}}',
            '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"RESULT: PASS\\nSUMMARY: Validation completed\\nDETAILS: All checks are green"}}',
            '{"type":"turn.completed"}',
        ]
    )


def _lead_review_json(session_id: str) -> str:
    return "\n".join(
        [
            f'{{"type":"thread.started","thread_id":"{session_id}"}}',
            '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"DECISION: MERGE\\nSUMMARY: Ready to merge\\nDETAILS: The implementation matches the task and is good enough"}}',
            '{"type":"turn.completed"}',
        ]
    )


async def test_implement_starts_new_developer_personality_and_persists_session(tmp_path: Path) -> None:
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))
    runner = _FakeRunner(stdout=_implement_json("session-dev-1"))
    adapter = CodexCliAdapter(
        runner=runner,
        worktree_manager=_FakeWorktreeManager(),
        prompt_builder=CodexPromptBuilder(),
        result_parser=CodexResultParser(),
        timeout_seconds=30,
        codex_executable="codex",
        sandbox_mode="workspace-write",
        approval_policy="never",
        personality_registry=CodexPersonalityRegistry.default(),
        personality_store=store,
    )

    result = await adapter.implement(_task())

    stored = store.get("developer")
    assert stored is not None
    assert stored.session_id == "session-dev-1"
    assert result.ok is False
    assert result.metadata is not None
    assert result.metadata["personality_key"] == "developer"
    assert result.metadata["personality_run_mode"] == "exec"
    assert result.metadata["codex_session_id"] == "session-dev-1"
    assert runner.calls[0]["args"][:4] == [
        "codex",
        "--yolo",
        "exec",
        "--json",
    ]
    prompt = runner.calls[0]["args"][4]
    assert "This is a new task." in prompt
    assert "bot/personalities/developer.md" in prompt
    assert "read and follow this guide exactly" in prompt


async def test_implement_resumes_existing_developer_personality(tmp_path: Path) -> None:
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))
    store.save("developer", "session-dev-existing", "bot/personalities/developer.md")
    runner = _FakeRunner(stdout=_implement_json("session-dev-existing"))
    adapter = CodexCliAdapter(
        runner=runner,
        worktree_manager=_FakeWorktreeManager(),
        prompt_builder=CodexPromptBuilder(),
        result_parser=CodexResultParser(),
        timeout_seconds=30,
        personality_registry=CodexPersonalityRegistry.default(),
        personality_store=store,
    )

    result = await adapter.implement(_task())

    assert result.metadata is not None
    assert result.metadata["personality_run_mode"] == "resume"
    assert result.metadata["codex_session_id"] == "session-dev-existing"
    assert runner.calls[0]["args"][:6] == [
        "codex",
        "--yolo",
        "exec",
        "resume",
        "--json",
        "session-dev-existing",
    ]
    prompt = runner.calls[0]["args"][6]
    assert "This is a new task." in prompt
    assert "bot/personalities/developer.md" in prompt
    assert "re-read this guide" in prompt


async def test_validate_uses_fresh_tester_personality_even_if_store_has_entry(tmp_path: Path) -> None:
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))
    store.save("tester", "session-tester-old", "bot/personalities/tester.md")
    runner = _FakeRunner(stdout=_validate_json("session-tester-new"))
    adapter = CodexCliAdapter(
        runner=runner,
        worktree_manager=_FakeWorktreeManager(),
        prompt_builder=CodexPromptBuilder(),
        result_parser=CodexResultParser(),
        timeout_seconds=30,
        personality_registry=CodexPersonalityRegistry.default(),
        personality_store=store,
    )

    result = await adapter.validate(_task())

    stored = store.get("tester")
    assert stored is not None
    assert stored.session_id == "session-tester-old"
    assert result.ok is True
    assert result.metadata is not None
    assert result.metadata["personality_key"] == "tester"
    assert result.metadata["personality_run_mode"] == "exec"
    assert result.metadata["codex_session_id"] == "session-tester-new"
    assert runner.calls[0]["args"][:4] == [
        "codex",
        "--yolo",
        "exec",
        "--json",
    ]
    prompt = runner.calls[0]["args"][4]
    assert "bot/personalities/tester.md" in prompt
    assert "read and follow this guide exactly" in prompt
    assert "bot/app/di.py" in prompt
    assert "Use that list to focus your checks first" in prompt


async def test_lead_review_uses_persistent_lead_personality_and_returns_decision(tmp_path: Path) -> None:
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))
    runner = _FakeRunner(stdout=_lead_review_json("session-lead-1"))
    adapter = CodexCliAdapter(
        runner=runner,
        worktree_manager=_FakeWorktreeManager(),
        prompt_builder=CodexPromptBuilder(),
        result_parser=CodexResultParser(),
        timeout_seconds=30,
        personality_registry=CodexPersonalityRegistry.default(),
        personality_store=store,
    )

    result = await adapter.lead_review(_task())

    stored = store.get("lead")
    assert stored is not None
    assert stored.session_id == "session-lead-1"
    assert result.ok is True
    assert result.summary == "Ready to merge"
    assert result.metadata is not None
    assert result.metadata["personality_key"] == "lead"
    assert result.metadata["review_decision"] == "merge"
    assert runner.calls[0]["args"][:4] == [
        "codex",
        "--yolo",
        "exec",
        "--json",
    ]
    prompt = runner.calls[0]["args"][4]
    assert "bot/personalities/lead.md" in prompt
    assert "DECISION: MERGE|RERUN_TESTS|CLOSE" in prompt


def test_validate_changed_files_ignores_bot_venv_runtime_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        CodexCliAdapter,
        "_collect_changed_files",
        classmethod(lambda cls, worktree_path: (["bot/.venv", "bot/README.md"], None)),
    )

    mismatch = CodexCliAdapter._validate_changed_files(
        worktree_path="/tmp/codex-worktree",
        declared_files=["bot/README.md"],
    )

    assert mismatch is None
