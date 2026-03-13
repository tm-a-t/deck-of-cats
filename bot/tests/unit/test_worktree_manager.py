from __future__ import annotations

from pathlib import Path

import app.infrastructure.execution.worktree_manager as worktree_module
from app.infrastructure.execution.worktree_manager import WorktreeManager


def test_create_links_bot_venv_into_worktree(monkeypatch, tmp_path: Path) -> None:
    repo_path = tmp_path / "repo"
    source_bot_dir = repo_path / "bot"
    source_bot_dir.mkdir(parents=True)
    source_venv = source_bot_dir / ".venv"
    source_venv.mkdir()

    created_paths: list[Path] = []

    def _fake_run(args, check, capture_output, text):
        _ = check, capture_output, text
        worktree_path = Path(args[7])
        created_paths.append(worktree_path)
        (worktree_path / "bot").mkdir(parents=True)

        class _Result:
            returncode = 0
            stdout = ""
            stderr = ""

        return _Result()

    monkeypatch.setattr(worktree_module.subprocess, "run", _fake_run)

    manager = WorktreeManager(str(repo_path), "codex-evolve")

    worktree_path, branch = manager.create("12345678-1234-1234-1234-1234567890ab")

    assert branch == "bot/task-12345678"
    assert Path(worktree_path) == created_paths[0]
    target_venv = Path(worktree_path) / "bot" / ".venv"
    assert target_venv.is_symlink()
    assert target_venv.resolve() == source_venv.resolve()
