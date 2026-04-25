from __future__ import annotations

from pathlib import Path
import tempfile

from loop.agent_loop.io_utils import read_json
from loop.agent_loop.paths import LOOP_DIR, PROMPTS_DIR, ROLES, SCHEMA_BY_ROLE, SCHEMAS_DIR
from loop.agent_loop.prompts import base_context, prompt_for, validate_payload
from loop.agent_loop.state import load_config, load_state, save_state


def self_test() -> dict:
    config = load_config(LOOP_DIR / "config.example.json")
    missing = []
    for role in ROLES:
        if not (PROMPTS_DIR / f"{role}.md").exists():
            missing.append(f"loop/prompts/{role}.md")
        if not (SCHEMAS_DIR / SCHEMA_BY_ROLE[role]).exists():
            missing.append(f"loop/schemas/{SCHEMA_BY_ROLE[role]}")
    if missing:
        raise RuntimeError("missing loop files: " + ", ".join(sorted(set(missing))))

    for schema_file in sorted(set(SCHEMA_BY_ROLE.values())):
        schema = read_json(SCHEMAS_DIR / schema_file, {})
        if schema.get("type") != "object" or not schema.get("required"):
            raise RuntimeError(f"schema is too loose: {schema_file}")

    context = base_context(config, {"seen_feedback_ids": [], "external_submissions": [], "cycles": []}, "self-test")
    for role in ROLES:
        rendered = prompt_for(role, context)
        if "<context_json>" not in rendered or "rules.md" not in rendered:
            raise RuntimeError(f"prompt render failed for {role}")

    for role, payload in fixture_payloads().items():
        validate_payload(role, payload)

    with tempfile.TemporaryDirectory() as tmpdir:
        state_path = Path(tmpdir) / "state.json"
        state = load_state(state_path)
        state["seen_feedback_ids"] = ["abc"]
        save_state(state, state_path)
        loaded = load_state(state_path)
        if loaded["seen_feedback_ids"] != ["abc"]:
            raise RuntimeError("state roundtrip failed")

    return {"status": "passed", "summary": "loop self-test passed"}


def fixture_payloads() -> dict[str, dict]:
    return {
        "poki_feedback": {"status": "ok", "summary": "none", "feedback": [], "details": "ok"},
        "tester": {
            "status": "ok",
            "summary": "playable",
            "bugs": [],
            "friction": [],
            "interest_verdict": "promising",
            "fun_factor": 3,
            "playable": True,
            "major_untested_changes": False,
            "send_to_external_testing": False,
            "external_test_reason": "",
            "design_input_summary": "baseline",
            "details": "ok",
        },
        "poki_submit": {
            "status": "submitted",
            "summary": "submitted",
            "submission_id": "test",
            "submitted_build_label": "test",
            "requested_test_type": "playtest-recordings",
            "details": "ok",
        },
        "designer": {
            "status": "ok",
            "summary": "proposal",
            "hypothesis": "Improve first-minute clarity.",
            "proposal_title": "Opening Clarity",
            "rule_change": "Make early feedback clearer.",
            "implementation_brief": "Small copy/feedback change.",
            "acceptance_criteria": ["Rules and changelog updated."],
            "risk_level": "low",
        },
        "developer": {
            "status": "ok",
            "summary": "done",
            "details": "ok",
            "changed_files": ["rules.md", "changelog.md"],
            "validation_commands": ["node sim/fast-sim.js --runs 1 --json"],
            "needs_repair": False,
        },
        "repair": {
            "status": "ok",
            "summary": "done",
            "details": "ok",
            "changed_files": ["rules.md", "changelog.md"],
            "validation_commands": ["node sim/fast-sim.js --runs 1 --json"],
            "needs_repair": False,
        },
    }
