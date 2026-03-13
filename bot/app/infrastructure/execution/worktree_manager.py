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

        self._ensure_bot_venv_link(worktree_path)
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

    def _ensure_bot_venv_link(self, worktree_path: Path) -> None:
        source_venv = self._repo_path / "bot" / ".venv"
        target_bot_dir = worktree_path / "bot"
        target_venv = target_bot_dir / ".venv"

        if not source_venv.exists() or not target_bot_dir.exists():
            return
        if target_venv.is_symlink():
            try:
                if target_venv.resolve() == source_venv.resolve():
                    return
            except OSError:
                pass
            target_venv.unlink()
        elif target_venv.exists():
            return

        target_venv.symlink_to(source_venv, target_is_directory=True)
