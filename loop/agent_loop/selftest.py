from __future__ import annotations

from pathlib import Path
import subprocess
import tempfile

from loop.agent_loop.codex_runner import codex_failure_error
from loop.agent_loop.io_utils import read_json
from loop.agent_loop.local_tester_harness import playwright_script
from loop.agent_loop.orchestrator import (
    cycle_finished_message,
    poki_steps_enabled,
    role_result_message,
    role_started_message,
    skipped_poki_feedback_step,
)
from loop.agent_loop.paths import LOOP_DIR, PROMPTS_DIR, ROLES, SCHEMA_BY_ROLE, SCHEMAS_DIR
from loop.agent_loop.prompts import base_context, prompt_for, validate_payload
from loop.agent_loop.state import load_config, load_state, save_state
from loop.agent_loop.telegram_monitor import (
    TELEGRAM_MESSAGE_LIMIT,
    TelegramMonitor,
    TelegramNotificationError,
    truncate_message,
)
from loop.agent_loop.validation import gameplay_docs_check
from loop.agent_loop.workspace import commit_iteration_changes


def self_test() -> dict:
    config = load_config(LOOP_DIR / "config.example.json")
    if not poki_steps_enabled(config):
        raise RuntimeError("Poki steps should be enabled by default")
    if "worktree" in config["loop"]:
        raise RuntimeError("loop worktree config should not be present by default")
    if config["loop"]["commit"]["policy"] != "any_changes":
        raise RuntimeError("default loop commit policy should commit any changed cycle")
    if config["loop"]["commit"]["sign"]:
        raise RuntimeError("loop commits should be unsigned by default")
    if config["codex"]["role_timeouts_seconds"]["tester"] != 1200:
        raise RuntimeError("tester timeout should stay below the outer loop timeout")
    harness_source = playwright_script()
    if "__deckOfCatsTest" not in harness_source or "Phaser.GAMES" in harness_source:
        raise RuntimeError("local tester harness should use the Deck of Cats test hook")
    timeout_error = codex_failure_error("tester", {"timed_out": True}, 1200)
    if timeout_error != "tester timed out after 1200s before returning JSON":
        raise RuntimeError("codex timeout error should explain which role timed out")
    disabled_config = {**config, "poki": {**config.get("poki", {}), "enabled": False}}
    if poki_steps_enabled(disabled_config):
        raise RuntimeError("Poki steps should be disabled when poki.enabled is false")
    validate_payload("poki_feedback", skipped_poki_feedback_step()["payload"])

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

    assert_validation_cases()
    assert_workspace_cases()
    assert_telegram_monitor_cases()
    assert_telegram_message_copy_cases()

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
            "gameplay_change": True,
            "changed_files": ["rules.md", "changelog.md"],
            "validation_commands": ["node sim/fast-sim.js --runs 1 --json"],
        },
    }


def assert_validation_cases() -> None:
    gameplay_payload = {"gameplay_change": True, "changed_files": ["rules.md", "changelog.md"]}
    if not gameplay_docs_check(["rules.md", "changelog.md"], gameplay_payload)["ok"]:
        raise RuntimeError("gameplay validation should pass when rules.md and changelog.md changed")

    non_gameplay_payload = {"gameplay_change": False, "changed_files": ["js/scene.js", "changelog.md"]}
    if not gameplay_docs_check(["js/scene.js", "changelog.md"], non_gameplay_payload)["ok"]:
        raise RuntimeError("non-gameplay validation should not require rules.md")

    missing_rules = gameplay_docs_check(["js/scene.js", "changelog.md"], gameplay_payload)
    if missing_rules["ok"]:
        raise RuntimeError("gameplay validation should fail without rules.md")

    missing_changelog = gameplay_docs_check(["rules.md"], gameplay_payload)
    if missing_changelog["ok"]:
        raise RuntimeError("validation should fail without changelog.md")


def run_git(cwd: Path, args: list[str]) -> str:
    result = subprocess.run(["git", *args], cwd=cwd, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr or result.stdout}")
    return result.stdout


def temp_loop_config(
    policy: str = "any_changes",
    sign: bool = False,
) -> dict:
    return {
        "loop": {
            "commit": {
                "enabled": True,
                "policy": policy,
                "sign": sign,
            },
        }
    }


def assert_workspace_cases() -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        repo = tmp / "repo"
        repo.mkdir()
        run_git(repo, ["init"])
        run_git(repo, ["config", "user.name", "Loop Self Test"])
        run_git(repo, ["config", "user.email", "loop-self-test@example.invalid"])
        run_git(repo, ["config", "commit.gpgsign", "false"])
        (repo / "README.md").write_text("base\n", encoding="utf-8")
        run_git(repo, ["add", "README.md"])
        run_git(repo, ["commit", "-m", "initial"])

        config = temp_loop_config()
        run_git(repo, ["config", "commit.gpgsign", "true"])
        run_git(repo, ["config", "gpg.program", "/bin/false"])

        (repo / "feature.txt").write_text("changed by loop\n", encoding="utf-8")
        commit = commit_iteration_changes(config, repo, "self-test-run", "failed", "failed cycle summary")
        if commit["status"] != "committed" or not commit["sha"]:
            raise RuntimeError(f"failed dirty cycle should commit changes: {commit}")
        if run_git(repo, ["log", "-1", "--pretty=%s"]).strip() != "loop: changes from loop iteration self-test-run":
            raise RuntimeError("loop commit subject did not identify the loop iteration")
        commit_body = run_git(repo, ["log", "-1", "--pretty=%B"])
        if "This commit was created automatically by the loop." not in commit_body:
            raise RuntimeError("loop commit body did not identify the automatic loop commit")

        clean = commit_iteration_changes(config, repo, "self-test-clean", "passed", "clean cycle")
        if clean["status"] != "no_changes" or not clean["ok"]:
            raise RuntimeError(f"clean loop cycle should not create an empty commit: {clean}")

        (repo / "failed-only.txt").write_text("left dirty\n", encoding="utf-8")
        skipped = commit_iteration_changes(
            temp_loop_config(policy="passed_changes"),
            repo,
            "self-test-skipped",
            "failed",
            "failed cycle summary",
        )
        if skipped["status"] != "skipped" or not skipped["ok"]:
            raise RuntimeError(f"passed_changes policy should skip failed cycles: {skipped}")


def assert_telegram_monitor_cases() -> None:
    if TelegramMonitor.from_env({}) is not None:
        raise RuntimeError("telegram monitor should be disabled when env vars are missing")

    calls = []

    def fake_transport(url: str, payload: dict[str, object], timeout: float) -> dict[str, object]:
        calls.append({"url": url, "payload": payload, "timeout": timeout})
        return {"ok": True}

    monitor = TelegramMonitor.from_env(
        {"TELEGRAM_BOT_TOKEN": "secret-token", "TELEGRAM_ADMIN_CHAT_ID": "-100123"},
        transport=fake_transport,
    )
    if monitor is None:
        raise RuntimeError("telegram monitor should be enabled when env vars are present")

    monitor.send_message("Loop started")
    if len(calls) != 1:
        raise RuntimeError("telegram monitor did not call transport once")
    payload = calls[0]["payload"]
    if payload.get("chat_id") != "-100123" or payload.get("text") != "Loop started":
        raise RuntimeError("telegram monitor sent unexpected chat id or message text")

    long_message = "x" * (TELEGRAM_MESSAGE_LIMIT + 100)
    truncated = truncate_message(long_message)
    if len(truncated) > TELEGRAM_MESSAGE_LIMIT or not truncated.endswith("..."):
        raise RuntimeError("telegram message truncation failed")

    def failing_transport(url: str, payload: dict[str, object], timeout: float) -> dict[str, object]:
        raise RuntimeError("request failed for secret-token")

    failing_monitor = TelegramMonitor("secret-token", "-100123", transport=failing_transport)
    try:
        failing_monitor.send_message("Loop started")
    except TelegramNotificationError as exc:
        if "secret-token" in str(exc):
            raise RuntimeError("telegram error leaked bot token") from exc
    else:
        raise RuntimeError("telegram monitor should raise on transport failure")

    if failing_monitor.safe_send(None, "Loop started", reason="self-test", log_failure=False):
        raise RuntimeError("telegram safe_send should be non-fatal and return false on failure")


def assert_telegram_message_copy_cases() -> None:
    samples = [
        role_started_message("designer", "self-test"),
        role_result_message(
            "designer",
            {
                "payload": {
                    "status": "ok",
                    "summary": "proposal",
                    "proposal_title": "Clearer Route Choice",
                    "hypothesis": "Players will understand the next choice faster.",
                    "risk_level": "low",
                }
            },
            "self-test",
        ),
        role_result_message(
            "developer",
            {
                "payload": {
                    "status": "ok",
                    "summary": "done",
                    "changed_files": ["loop/agent_loop/orchestrator.py"],
                    "validation_commands": ["python3 -m loop.agent_loop self-test"],
                }
            },
            "self-test",
        ),
        cycle_finished_message(
            {
                "run_id": "self-test",
                "status": "passed",
                "summary": "cycle completed",
                "validation": {"ok": True, "summary": "all checks passed"},
            }
        ),
    ]
    for sample in samples:
        if sample.startswith("Run "):
            raise RuntimeError(f"telegram message should put the action before the run id: {sample}")
        if not sample.endswith("(run self-test)"):
            raise RuntimeError(f"telegram message should end with the run id: {sample}")
