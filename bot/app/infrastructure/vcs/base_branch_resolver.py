from __future__ import annotations

import subprocess
from pathlib import Path


def resolve_base_branch(repo_path: str, configured_base_branch: str, prefer_current_branch: bool) -> str:
    if not prefer_current_branch:
        return configured_base_branch

    result = subprocess.run(
        ["git", "-C", str(Path(repo_path)), "branch", "--show-current"],
        check=False,
        capture_output=True,
        text=True,
    )
    current_branch = result.stdout.strip()
    if result.returncode == 0 and current_branch and current_branch != "HEAD":
        return current_branch

    return configured_base_branch
