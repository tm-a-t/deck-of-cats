from __future__ import annotations

from loop.agent_loop.io_utils import run_process
from loop.agent_loop.paths import ROOT


def git_lines(args: list[str]) -> list[str]:
    result = run_process(["git", *args], cwd=ROOT, timeout=20)
    if not result["ok"]:
        return []
    return [line.rstrip("\n") for line in result["stdout"].splitlines() if line.strip()]


def git_revision() -> str:
    lines = git_lines(["rev-parse", "--short", "HEAD"])
    return lines[0].strip() if lines else "unknown"


def git_status_short() -> list[str]:
    return [line.strip() for line in git_lines(["status", "--short"])]


def collect_changed_files() -> list[str]:
    files = {line.strip() for line in git_lines(["diff", "--name-only", "HEAD"]) if line.strip()}
    for raw_line in git_lines(["status", "--short", "--untracked-files=normal"]):
        if len(raw_line) < 4:
            continue
        path = raw_line[3:].strip()
        if path:
            files.add(path)
    return sorted(files)
