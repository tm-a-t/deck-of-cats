from __future__ import annotations

from app.infrastructure.execution.sandbox_runner import SandboxRunner
from app.infrastructure.execution.worktree_manager import WorktreeManager
from app.shared.errors import ExternalIntegrationError


class GithubBranchAdapter:
    def __init__(
        self,
        runner: SandboxRunner,
        worktree_manager: WorktreeManager,
        timeout_seconds: int,
    ) -> None:
        self._runner = runner
        self._worktree_manager = worktree_manager
        self._timeout_seconds = timeout_seconds

    async def prepare_branch(self, task_id: str) -> str:
        worktree_path, branch = self._worktree_manager.create(task_id)
        result = await self._runner.run(
            command=f"git checkout -B {branch}",
            cwd=worktree_path,
            timeout_seconds=self._timeout_seconds,
        )
        if result.returncode != 0:
            raise ExternalIntegrationError(
                f"Failed to prepare branch {branch}: {result.stderr.strip() or result.stdout.strip()}"
            )
        return branch
