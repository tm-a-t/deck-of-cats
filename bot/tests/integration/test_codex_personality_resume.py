from __future__ import annotations

import os
from pathlib import Path
import shutil

import pytest

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.codex.codex_cli_adapter import CodexCliAdapter
from app.infrastructure.codex.personality import CodexPersonality, CodexPersonalityRegistry
from app.infrastructure.codex.personality_store import JsonPersonalityStore
from app.infrastructure.codex.prompt_builder import CodexPromptBuilder
from app.infrastructure.codex.result_parser import CodexResultParser
from app.infrastructure.execution.process_runner import ProcessRunner
from app.shared.enums import StepName


pytestmark = pytest.mark.asyncio


class _RepoRootWorktreeManager:
    def __init__(self, repo_root: Path) -> None:
        self._repo_root = repo_root

    def create(self, task_id: str) -> tuple[str, str]:
        _ = task_id
        return (str(self._repo_root), "integration/personality")


class _StubPromptBuilder(CodexPromptBuilder):
    def build_validate_prompt(self, task: TaskAggregate) -> str:
        return (
            "Reply exactly in this format:\n"
            "RESULT: PASS\n"
            f"SUMMARY: personality flow ok for {task.public_id}\n"
            f"DETAILS: handled {task.title}"
        )


def _task(task_id: str, title: str) -> TaskAggregate:
    return TaskAggregate.create(
        task_id=task_id,
        author_id=1,
        title=title,
        body="Use personality memory for this validation run",
        correlation_id=f"corr-{task_id}",
    )


@pytest.mark.skipif(
    os.getenv("RUN_CODEX_E2E") != "1",
    reason="Set RUN_CODEX_E2E=1 to run real codex personality resume checks",
)
async def test_codex_can_persist_and_resume_personality(tmp_path: Path) -> None:
    codex_executable = os.getenv("CODEX_CLI_EXECUTABLE", "codex")
    if shutil.which(codex_executable) is None:
        pytest.skip(f"{codex_executable} is not available in PATH")

    repo_root = Path(__file__).resolve().parents[3]
    store = JsonPersonalityStore(str(tmp_path / "agent_personalities.json"))
    registry = CodexPersonalityRegistry(
        {
            StepName.CODEX_IMPLEMENT: CodexPersonality(
                key="developer",
                guide_path="bot/personalities/developer.md",
                persist_session=True,
            ),
            StepName.CODEX_VALIDATE: CodexPersonality(
                key="developer",
                guide_path="bot/personalities/developer.md",
                persist_session=True,
            ),
        }
    )
    adapter = CodexCliAdapter(
        runner=ProcessRunner(),
        worktree_manager=_RepoRootWorktreeManager(repo_root),
        prompt_builder=_StubPromptBuilder(),
        result_parser=CodexResultParser(),
        timeout_seconds=240,
        codex_executable=codex_executable,
        sandbox_mode=os.getenv("CODEX_CLI_SANDBOX_MODE", "workspace-write"),
        approval_policy=os.getenv("CODEX_CLI_APPROVAL_POLICY", "never"),
        personality_registry=registry,
        personality_store=store,
    )

    first = await adapter.validate(_task("66666666-6666-6666-6666-666666666666", "First personality task"))
    second = await adapter.validate(_task("77777777-7777-7777-7777-777777777777", "Second personality task"))

    stored = store.get("developer")
    assert first.ok is True, first.details
    assert second.ok is True, second.details
    assert first.metadata is not None
    assert second.metadata is not None
    assert first.metadata["personality_run_mode"] == "exec"
    assert second.metadata["personality_run_mode"] == "resume"
    assert stored is not None
    assert stored.session_id == first.metadata["codex_session_id"] == second.metadata["codex_session_id"]
