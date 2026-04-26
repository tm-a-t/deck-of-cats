from __future__ import annotations

from pathlib import Path

from loop.agent_loop.git_utils import collect_changed_files
from loop.agent_loop.paths import ROOT


def gameplay_docs_check(changed_files: list[str], developer_payload: dict) -> dict:
    changed = set(changed_files)
    declared = {str(path).strip() for path in developer_payload.get("changed_files", []) if str(path).strip()}
    gameplay_changed = bool(developer_payload.get("gameplay_change"))
    errors = []
    if declared:
        undeclared_missing = sorted(declared - changed)
        if undeclared_missing:
            errors.append("declared changed files not found in git status: " + ", ".join(undeclared_missing))
    if gameplay_changed and "rules.md" not in changed:
        errors.append("gameplay_change true without rules.md")
    if "changelog.md" not in changed:
        errors.append("developer step did not change changelog.md")
    return {
        "name": "docs and changed-files guard",
        "ok": not errors,
        "summary": "ok" if not errors else "; ".join(errors),
        "gameplay_change": gameplay_changed,
        "changed_files": changed_files,
        "declared_changed_files": sorted(declared),
    }


def summarize_developer_result(developer_payload: dict, workspace_root: Path = ROOT) -> dict:
    changed_files = collect_changed_files(workspace_root)
    docs_guard = gameplay_docs_check(changed_files, developer_payload)
    commands = developer_payload.get("validation_commands", [])
    ok = docs_guard["ok"] and bool(commands)
    return {
        "ok": ok,
        "summary": "developer completed and reported validation" if ok else "developer result needs attention",
        "checks": [
            docs_guard,
            {
                "name": "developer-reported validation",
                "ok": bool(commands),
                "summary": "; ".join(commands) if commands else "developer reported no validation commands",
                "commands": commands,
            },
        ],
    }
