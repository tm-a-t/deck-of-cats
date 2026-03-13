from __future__ import annotations

import os
from pathlib import Path
import shutil

import pytest

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.codex.codex_cli_adapter import CodexCliAdapter
from app.infrastructure.codex.personality_store import JsonPersonalityStore
from app.infrastructure.codex.prompt_builder import CodexPromptBuilder
from app.infrastructure.codex.result_parser import CodexResultParser
from app.infrastructure.execution.process_runner import ProcessRunner


pytestmark = pytest.mark.asyncio


class _RepoRootWorktreeManager:
    def __init__(self, repo_root: Path) -> None:
        self._repo_root = repo_root

    def create(self, task_id: str) -> tuple[str, str]:
        _ = task_id
        return (str(self._repo_root), "integration/lead-review")


class _StubPromptBuilder(CodexPromptBuilder):
    def build_lead_review_prompt(self, task: TaskAggregate) -> str:
        return (
            "Reply exactly in this format:\n"
            "DECISION: MERGE\n"
            f"SUMMARY: lead review ok for {task.public_id}\n"
            f"DETAILS: reviewed {task.title}"
        )


def _task() -> TaskAggregate:
    task = TaskAggregate.create(
        task_id="88888888-8888-8888-8888-888888888888",
        author_id=1,
        title="Lead review smoke",
        body="Run a real lead review smoke check",
        correlation_id="corr-lead-smoke",
    )
    task.changed_files = ["bot/app/di.py"]
    return task


@pytest.mark.skipif(
    os.getenv("RUN_CODEX_E2E") != "1",
    reason="Set RUN_CODEX_E2E=1 to run real codex lead-review checks",
)
async def test_codex_lead_review_path_returns_structured_decision(tmp_path: Path) -> None:
    codex_executable = os.getenv("CODEX_CLI_EXECUTABLE", "codex")
    if shutil.which(codex_executable) is None:
        pytest.skip(f"{codex_executable} is not available in PATH")

    repo_root = Path(__file__).resolve().parents[3]
    adapter = CodexCliAdapter(
        runner=ProcessRunner(),
        worktree_manager=_RepoRootWorktreeManager(repo_root),
        prompt_builder=_StubPromptBuilder(),
        result_parser=CodexResultParser(),
        timeout_seconds=240,
        codex_executable=codex_executable,
        sandbox_mode=os.getenv("CODEX_CLI_SANDBOX_MODE", "workspace-write"),
        approval_policy=os.getenv("CODEX_CLI_APPROVAL_POLICY", "never"),
        personality_store=JsonPersonalityStore(str(tmp_path / "agent_personalities.json")),
    )

    result = await adapter.lead_review(_task())

    assert result.ok is True, result.details
    assert result.metadata is not None
    assert result.metadata["personality_key"] == "lead"
    assert result.metadata["review_decision"] == "merge"
