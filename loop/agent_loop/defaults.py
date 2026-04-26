from __future__ import annotations


DEFAULT_CONFIG = {
    "loop": {
        "interval_minutes": 60,
        "external_submissions_per_day": 2,
        "worktree": {
            "enabled": True,
            "path": "../pirates-v0-loop-worktree",
            "branch": "loop/auto",
        },
        "commit": {
            "enabled": True,
            "policy": "any_changes",
        },
    },
    "codex": {
        "executable": "codex",
        "approval_policy": "never",
        "sandbox": "workspace-write",
        "timeout_seconds": 1800,
        "extra_exec_args": [],
        "role_extra_exec_args": {
            "poki_feedback": ["--enable", "computer_use", "--enable", "browser_use", "--enable", "in_app_browser"],
            "tester": ["--enable", "computer_use", "--enable", "browser_use", "--enable", "in_app_browser"],
            "poki_submit": ["--enable", "computer_use", "--enable", "browser_use", "--enable", "in_app_browser"],
        },
        "role_sandboxes": {
            "poki_feedback": "danger-full-access",
            "poki_submit": "danger-full-access",
            "designer": "read-only",
            "tester": "danger-full-access",
            "developer": "workspace-write",
        },
        "role_timeouts_seconds": {
            "poki_feedback": 900,
            "tester": 1800,
            "poki_submit": 1800,
            "designer": 1200,
            "developer": 2400,
        },
    },
    "poki": {
        "enabled": True,
        "developers_game_url": "",
        "browser_profile": "",
        "test_type": "playtest-recordings",
        "build_dir": ".",
        "upload_command": ["npx", "@poki/cli", "upload"],
    },
    "validation": {
        "sim_runs": 10,
        "sim_seed": 42,
        "sim_max_steps": 5000,
        "timeout_seconds": 180,
        "expected_title": "Deck of Cats — Deck Builder",
    },
}
