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


def git_current_branch(cwd: Path = ROOT) -> str:
    lines = git_lines(["branch", "--show-current"], cwd=cwd)
    return lines[0].strip() if lines else ""


def git_common_dir(cwd: Path = ROOT) -> Path | None:
    lines = git_lines(["rev-parse", "--git-common-dir"], cwd=cwd)
    if not lines:
        return None
    common_dir = Path(lines[0].strip())
    if not common_dir.is_absolute():
        common_dir = cwd / common_dir
    return common_dir.resolve()


def git_branch_exists(branch: str, cwd: Path = ROOT) -> bool:
    result = git_process(["show-ref", "--verify", "--quiet", f"refs/heads/{branch}"], cwd=cwd)
    return result["returncode"] == 0


def git_worktree_entries(cwd: Path = ROOT) -> list[dict[str, str | bool]]:
    result = git_process(["worktree", "list", "--porcelain"], cwd=cwd)
    if not result["ok"]:
        return []

    entries: list[dict[str, str | bool]] = []
    entry: dict[str, str | bool] = {}
    for raw_line in result["stdout"].splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("worktree "):
            if entry:
                entries.append(entry)
            entry = {"worktree": line.removeprefix("worktree ").strip()}
        elif line.startswith("HEAD "):
            entry["HEAD"] = line.removeprefix("HEAD ").strip()
        elif line.startswith("branch "):
            ref = line.removeprefix("branch ").strip()
            entry["branch_ref"] = ref
            entry["branch"] = ref.removeprefix("refs/heads/")
        elif line == "detached":
            entry["detached"] = True
    if entry:
        entries.append(entry)
    return entries
