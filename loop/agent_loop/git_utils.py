from __future__ import annotations

from pathlib import Path

from loop.agent_loop.io_utils import run_process
from loop.agent_loop.paths import ROOT


def git_process(args: list[str], *, cwd: Path = ROOT, timeout: int = 20) -> dict:
    return run_process(["git", *args], cwd=cwd, timeout=timeout)


def git_lines(args: list[str], *, cwd: Path = ROOT, timeout: int = 20) -> list[str]:
    result = git_process(args, cwd=cwd, timeout=timeout)
    if not result["ok"]:
        return []
    return [line.rstrip("\n") for line in result["stdout"].splitlines() if line.strip()]


def git_revision(cwd: Path = ROOT) -> str:
    lines = git_lines(["rev-parse", "--short", "HEAD"], cwd=cwd)
    return lines[0].strip() if lines else "unknown"


def git_status_short(cwd: Path = ROOT) -> list[str]:
    return [line.strip() for line in git_lines(["status", "--short"], cwd=cwd)]


def collect_changed_files(cwd: Path = ROOT) -> list[str]:
    files = {line.strip() for line in git_lines(["diff", "--name-only", "HEAD"], cwd=cwd) if line.strip()}
    for raw_line in git_lines(["status", "--short", "--untracked-files=normal"], cwd=cwd):
        if len(raw_line) < 4:
            continue
        path = raw_line[3:].strip()
        if path:
            files.add(path)
    return sorted(files)
