from __future__ import annotations

import json

from loop.agent_loop.git_utils import collect_changed_files, git_revision, git_status_short
from loop.agent_loop.io_utils import read_text, utc_now
from loop.agent_loop.paths import PROMPTS_DIR, ROOT


def base_context(config: dict, state: dict, run_id: str) -> dict:
    return {
        "run_id": run_id,
        "timestamp_utc": utc_now().isoformat(),
        "repo": {
            "root": str(ROOT),
            "revision": git_revision(),
            "status_short": git_status_short(),
            "changed_files": collect_changed_files(),
            "has_changelog": (ROOT / "changelog.md").exists(),
        },
        "loop_state": {
            "seen_feedback_ids": state.get("seen_feedback_ids", []),
            "external_submissions": state.get("external_submissions", [])[-20:],
            "recent_cycles": state.get("cycles", [])[-10:],
        },
        "config": {
            "poki": config.get("poki", {}),
            "validation": config.get("validation", {}),
        },
        "source_of_truth": {
            "rules": "rules.md",
            "changelog": "changelog.md",
            "loop_description": "loop.md",
        },
    }


def prompt_for(role: str, context: dict) -> str:
    prompt_path = PROMPTS_DIR / f"{role}.md"
    prompt = read_text(prompt_path)
    if not prompt:
        raise RuntimeError(f"Missing prompt: {prompt_path}")
    return (
        prompt.rstrip()
        + "\n\n<context_json>\n"
        + json.dumps(context, indent=2, ensure_ascii=False)
        + "\n</context_json>\n"
        + "\nReturn only JSON matching the configured output schema.\n"
    )


def parse_json_payload(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


def validate_payload(role: str, payload: dict) -> None:
    required_by_role = {
        "poki_feedback": ("status", "summary", "feedback", "details"),
        "tester": (
            "status",
            "summary",
            "bugs",
            "friction",
            "interest_verdict",
            "fun_factor",
            "playable",
            "major_untested_changes",
            "send_to_external_testing",
            "design_input_summary",
            "details",
        ),
        "poki_submit": (
            "status",
            "summary",
            "submission_id",
            "submitted_build_label",
            "requested_test_type",
            "details",
        ),
        "designer": (
            "status",
            "summary",
            "hypothesis",
            "proposal_title",
            "rule_change",
            "implementation_brief",
            "acceptance_criteria",
            "risk_level",
        ),
        "developer": (
            "status",
            "summary",
            "details",
            "changed_files",
            "validation_commands",
        ),
    }
    missing = [key for key in required_by_role[role] if key not in payload]
    if missing:
        raise ValueError(f"{role} payload missing keys: {', '.join(missing)}")
