from __future__ import annotations

import subprocess

import app.infrastructure.vcs.base_branch_resolver as branch_module
from app.infrastructure.vcs.base_branch_resolver import resolve_base_branch


def test_returns_configured_branch_when_current_branch_mode_disabled() -> None:
    result = resolve_base_branch("/repo", "master", False)

    assert result == "master"


def test_returns_current_branch_when_enabled(monkeypatch) -> None:
    def _fake_run(*args, **kwargs):
        _ = args, kwargs
        return subprocess.CompletedProcess(args=("git",), returncode=0, stdout="codex-evolve\n", stderr="")

    monkeypatch.setattr(branch_module.subprocess, "run", _fake_run)

    result = resolve_base_branch("/repo", "master", True)

    assert result == "codex-evolve"


def test_falls_back_to_configured_branch_when_git_probe_fails(monkeypatch) -> None:
    def _fake_run(*args, **kwargs):
        _ = args, kwargs
        return subprocess.CompletedProcess(args=("git",), returncode=1, stdout="", stderr="boom")

    monkeypatch.setattr(branch_module.subprocess, "run", _fake_run)

    result = resolve_base_branch("/repo", "master", True)

    assert result == "master"
