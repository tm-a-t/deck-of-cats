from __future__ import annotations

import subprocess
from pathlib import Path

from app.shared.errors import ExternalIntegrationError


class WorktreeManager:
    def __init__(self, repo_path: str, base_branch: str) -> None:
        self._repo_path = Path(repo_path)
        self._base_branch = base_branch
        self._runtime_root = self._repo_path / "bot" / "runtime" / "worktrees"
        self._runtime_root.mkdir(parents=True, exist_ok=True)

    def create(self, task_id: str) -> tuple[str, str]:
        branch = f"bot/task-{task_id[:8]}"
        worktree_path = self._runtime_root / task_id

        if not worktree_path.exists():
            result = subprocess.run(
                [
                    "git",
                    "-C",
                    str(self._repo_path),
                    "worktree",
                    "add",
                    "-B",
                    branch,
                    str(worktree_path),
                    self._base_branch,
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                raise ExternalIntegrationError(
                    f"Failed to create worktree: {result.stderr.strip() or result.stdout.strip()}"
                )

        return str(worktree_path), branch

    def cleanup(self, task_id: str) -> None:
        worktree_path = self._runtime_root / task_id
        if worktree_path.exists():
            result = subprocess.run(
                ["git", "-C", str(self._repo_path), "worktree", "remove", "--force", str(worktree_path)],
                check=False,
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                raise ExternalIntegrationError(
                    f"Failed to cleanup worktree: {result.stderr.strip() or result.stdout.strip()}"
                )
