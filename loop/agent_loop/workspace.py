from __future__ import annotations

from pathlib import Path

from loop.agent_loop.git_utils import collect_changed_files, git_process, git_revision


VALID_COMMIT_POLICIES = {"any_changes", "passed_changes", "always_try"}


def commit_policy(config: dict) -> str:
    return str(config.get("loop", {}).get("commit", {}).get("policy", "any_changes")).strip()


def commit_signing_enabled(config: dict) -> bool:
    return bool(config.get("loop", {}).get("commit", {}).get("sign", False))


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
            "summary": "no checkout changes to commit",
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
    commit_args = ["commit", "-m", subject, "-m", body]
    if not commit_signing_enabled(config):
        commit_args.insert(1, "--no-gpg-sign")
    commit_result = git_process(commit_args, cwd=workspace_root, timeout=120)
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
