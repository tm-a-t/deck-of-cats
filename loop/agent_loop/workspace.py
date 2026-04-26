from __future__ import annotations

from pathlib import Path

from loop.agent_loop.git_utils import (
    collect_changed_files,
    git_branch_exists,
    git_common_dir,
    git_current_branch,
    git_process,
    git_revision,
    git_worktree_entries,
)
from loop.agent_loop.paths import ROOT


VALID_COMMIT_POLICIES = {"any_changes", "passed_changes", "always_try"}


def worktree_enabled(config: dict) -> bool:
    return bool(config.get("loop", {}).get("worktree", {}).get("enabled", True))


def configured_workspace_root(config: dict, controller_root: Path = ROOT) -> Path:
    if not worktree_enabled(config):
        return controller_root
    raw_path = str(config.get("loop", {}).get("worktree", {}).get("path", "../pirates-v0-loop-worktree"))
    path = Path(raw_path).expanduser()
    if not path.is_absolute():
        path = controller_root / path
    return path.resolve()


def configured_worktree_branch(config: dict) -> str:
    return str(config.get("loop", {}).get("worktree", {}).get("branch", "loop/auto")).strip()


def branch_worktree_path(branch: str, controller_root: Path = ROOT) -> Path | None:
    for entry in git_worktree_entries(controller_root):
        if entry.get("branch") == branch:
            return Path(str(entry["worktree"])).resolve()
    return None


def is_same_git_repo(path: Path, controller_root: Path = ROOT) -> bool:
    path_common_dir = git_common_dir(path)
    controller_common_dir = git_common_dir(controller_root)
    return path_common_dir is not None and controller_common_dir is not None and path_common_dir == controller_common_dir


def ensure_workspace_root(config: dict, controller_root: Path = ROOT) -> Path:
    controller_root = controller_root.resolve()
    if not worktree_enabled(config):
        return controller_root

    path = configured_workspace_root(config, controller_root)
    branch = configured_worktree_branch(config)
    if not branch:
        raise RuntimeError("loop worktree branch is empty")
    if path == controller_root:
        raise RuntimeError("loop worktree path must not be the controller checkout")

    if path.exists():
        if not is_same_git_repo(path, controller_root):
            raise RuntimeError(f"loop worktree path is not a worktree for this repo: {path}")
        current_branch = git_current_branch(path)
        if current_branch != branch:
            raise RuntimeError(
                f"loop worktree is on branch {current_branch or 'detached HEAD'}, expected {branch}: {path}"
            )
        return path

    existing_path = branch_worktree_path(branch, controller_root)
    if existing_path is not None and existing_path != path:
        raise RuntimeError(f"loop worktree branch {branch} is already checked out at {existing_path}")

    path.parent.mkdir(parents=True, exist_ok=True)
    if git_branch_exists(branch, controller_root):
        result = git_process(["worktree", "add", str(path), branch], cwd=controller_root, timeout=120)
    else:
        result = git_process(["worktree", "add", "-b", branch, str(path), "HEAD"], cwd=controller_root, timeout=120)
    if not result["ok"]:
        detail = (result["stderr"] or result["stdout"] or "unknown git worktree error").strip()
        raise RuntimeError(f"failed to create loop worktree at {path}: {detail}")

    current_branch = git_current_branch(path)
    if current_branch != branch:
        raise RuntimeError(f"created loop worktree on {current_branch or 'detached HEAD'}, expected {branch}: {path}")
    return path


def commit_policy(config: dict) -> str:
    return str(config.get("loop", {}).get("commit", {}).get("policy", "any_changes")).strip()


def should_attempt_commit(config: dict, cycle_status: str) -> tuple[bool, str]:
    commit_cfg = config.get("loop", {}).get("commit", {})
    if not bool(commit_cfg.get("enabled", True)):
        return False, "commit disabled by config"

    policy = commit_policy(config)
    if policy not in VALID_COMMIT_POLICIES:
        return False, f"invalid loop commit policy: {policy}"
    if policy == "passed_changes" and cycle_status != "passed":
        return False, "commit policy only commits passed cycles"
    return True, policy


def commit_iteration_changes(
    config: dict,
    workspace_root: Path,
    run_id: str,
    cycle_status: str,
    cycle_summary: str,
) -> dict:
    workspace_root = workspace_root.resolve()
    should_commit, reason = should_attempt_commit(config, cycle_status)
    if not should_commit:
        ok = not reason.startswith("invalid ")
        return {
            "ok": ok,
            "status": "skipped" if ok else "failed",
            "summary": reason,
            "changed_files": [],
            "sha": None,
        }

    changed_files = collect_changed_files(workspace_root)
    if not changed_files:
        return {
            "ok": True,
            "status": "no_changes",
            "summary": "no worktree changes to commit",
            "changed_files": [],
            "sha": None,
        }

    add_result = git_process(["add", "-A"], cwd=workspace_root, timeout=120)
    if not add_result["ok"]:
        detail = (add_result["stderr"] or add_result["stdout"] or "git add failed").strip()
        return {
            "ok": False,
            "status": "failed",
            "summary": detail,
            "changed_files": changed_files,
            "sha": None,
        }

    diff_result = git_process(["diff", "--cached", "--quiet"], cwd=workspace_root, timeout=120)
    if diff_result["returncode"] == 0:
        return {
            "ok": True,
            "status": "no_changes",
            "summary": "no staged changes to commit",
            "changed_files": [],
            "sha": None,
        }
    if diff_result["returncode"] != 1:
        detail = (diff_result["stderr"] or diff_result["stdout"] or "git diff --cached failed").strip()
        return {
            "ok": False,
            "status": "failed",
            "summary": detail,
            "changed_files": changed_files,
            "sha": None,
        }

    subject = f"loop: changes from loop iteration {run_id}"
    body = "\n".join(
        [
            f"Loop iteration: {run_id}",
            f"Cycle status: {cycle_status}",
            f"Cycle summary: {cycle_summary}",
            "",
            "This commit was created automatically by the loop.",
        ]
    )
    commit_result = git_process(["commit", "-m", subject, "-m", body], cwd=workspace_root, timeout=120)
    if not commit_result["ok"]:
        detail = (commit_result["stderr"] or commit_result["stdout"] or "git commit failed").strip()
        return {
            "ok": False,
            "status": "failed",
            "summary": detail,
            "changed_files": changed_files,
            "sha": None,
        }

    sha = git_revision(workspace_root)
    return {
        "ok": True,
        "status": "committed",
        "summary": f"created loop iteration commit {sha}",
        "changed_files": changed_files,
        "sha": sha,
    }
