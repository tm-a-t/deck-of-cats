from __future__ import annotations

from loop.agent_loop.codex_runner import run_codex
from loop.agent_loop.feedback import can_submit_external, new_feedback_items, record_submission
from loop.agent_loop.git_utils import git_revision
from loop.agent_loop.io_utils import stamp, utc_now, write_json
from loop.agent_loop.logging_utils import emit_log
from loop.agent_loop.paths import RUNS_DIR
from loop.agent_loop.prompts import base_context
from loop.agent_loop.state import load_state, save_state
from loop.agent_loop.validation import summarize_developer_result


def write_report(run_dir, report: dict) -> None:
    write_json(run_dir / "run.json", report)


def finish_cycle(state: dict, report: dict, status: str, summary: str, used_feedback: list[dict]) -> dict:
    report["status"] = status
    report["summary"] = summary
    report["finished_at_utc"] = utc_now().isoformat()
    if status == "passed":
        seen = set(state.get("seen_feedback_ids", []))
        for item in used_feedback:
            seen.add(item["id"])
        state["seen_feedback_ids"] = sorted(seen)
    state.setdefault("cycles", []).append(
        {
            "run_id": report["run_id"],
            "status": status,
            "summary": summary,
            "revision": git_revision(),
            "timestamp_utc": report["finished_at_utc"],
        }
    )
    state["cycles"] = state["cycles"][-100:]
    emit_log(RUNS_DIR / report["run_id"], "cycle_finished", summary, status=status)
    return report


def step_payload(step: dict) -> dict:
    return step.get("payload") or {}


def run_once(config: dict) -> dict:
    run_id = stamp()
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    state = load_state()
    emit_log(run_dir, "cycle_started", "cycle started", revision=git_revision())
    report = {
        "run_id": run_id,
        "started_at_utc": utc_now().isoformat(),
        "status": "running",
        "summary": "",
        "steps": [],
        "validation": None,
    }
    used_feedback: list[dict] = []

    def add_step(step: dict) -> dict:
        report["steps"].append(step)
        write_report(run_dir, report)
        return step

    context = base_context(config, state, run_id)
    feedback_step = add_step(run_codex("poki_feedback", context, config, run_dir))
    feedback_payload = step_payload(feedback_step)
    if feedback_step["ok"] and feedback_payload.get("status") == "ok":
        used_feedback = new_feedback_items(feedback_payload, state)
    emit_log(
        run_dir,
        "feedback_checked",
        "feedback check finished",
        status=feedback_payload.get("status", "failed") if feedback_payload else "failed",
        new_feedback_count=len(used_feedback),
    )

    if used_feedback:
        emit_log(run_dir, "design_input_selected", "using new Poki feedback", kind="poki_feedback")
        design_input = {
            "kind": "poki_feedback",
            "summary": f"{len(used_feedback)} new Poki feedback item(s)",
            "feedback": used_feedback,
            "feedback_check": feedback_payload,
        }
    else:
        design_input = run_local_tester_lane(
            config,
            state,
            run_id,
            run_dir,
            report,
            feedback_step,
            feedback_payload,
            add_step,
            used_feedback,
        )
        if "failed_report" in design_input:
            return design_input["failed_report"]

    designer_payload = run_designer_lane(config, state, run_id, run_dir, report, design_input, add_step, used_feedback)
    if "failed_report" in designer_payload:
        return designer_payload["failed_report"]

    developer_context = base_context(config, state, run_id)
    developer_context["design_input"] = design_input
    developer_context["designer_proposal"] = designer_payload
    developer_step = add_step(run_codex("developer", developer_context, config, run_dir))
    developer_payload = step_payload(developer_step)
    if not developer_step["ok"] or developer_payload.get("status") != "ok":
        report = finish_cycle(
            state,
            report,
            "failed",
            developer_payload.get("summary") or developer_step.get("error") or "developer failed",
            used_feedback,
        )
        write_report(run_dir, report)
        save_state(state)
        return report

    report["validation"] = summarize_developer_result(developer_payload)
    emit_log(
        run_dir,
        "developer_validation_reported",
        report["validation"]["summary"],
        ok=report["validation"]["ok"],
    )
    write_report(run_dir, report)

    status = "passed" if report["validation"]["ok"] else "failed"
    summary = "cycle completed" if report["validation"]["ok"] else "developer reported incomplete validation"
    report = finish_cycle(state, report, status, summary, used_feedback)
    write_report(run_dir, report)
    save_state(state)
    return report


def run_local_tester_lane(config, state, run_id, run_dir, report, feedback_step, feedback_payload, add_step, used_feedback):
    emit_log(run_dir, "design_input_needed", "no new feedback; running local AI tester")
    tester_context = base_context(config, state, run_id)
    tester_context["feedback_check"] = feedback_payload or {
        "status": "blocked" if not feedback_step["ok"] else "ok",
        "summary": feedback_step.get("error") or "no new feedback",
    }
    tester_step = add_step(run_codex("tester", tester_context, config, run_dir))
    tester_payload = step_payload(tester_step)
    if not tester_step["ok"] or tester_payload.get("status") != "ok":
        report = finish_cycle(
            state,
            report,
            "failed",
            tester_payload.get("summary") or tester_step.get("error") or "tester failed",
            used_feedback,
        )
        write_report(run_dir, report)
        save_state(state)
        return {"failed_report": report}

    submission_payload = maybe_submit_external(config, state, run_id, run_dir, tester_payload, add_step)
    emit_log(run_dir, "design_input_selected", "using local AI tester summary", kind="local_ai_test")
    return {
        "kind": "local_ai_test",
        "summary": tester_payload.get("design_input_summary", tester_payload.get("summary", "")),
        "tester": tester_payload,
        "external_submission": submission_payload,
    }


def maybe_submit_external(config, state, run_id, run_dir, tester_payload, add_step):
    submission_payload = {"status": "skipped", "summary": "not requested"}
    if not (
        tester_payload.get("playable")
        and tester_payload.get("major_untested_changes")
        and tester_payload.get("send_to_external_testing")
    ):
        return submission_payload

    revision = git_revision()
    allowed, reason = can_submit_external(state, config, revision)
    if not allowed:
        emit_log(run_dir, "external_submission_skipped", reason)
        return {"status": "skipped", "summary": reason}

    emit_log(run_dir, "external_submission_started", "submitting build to Poki playtest")
    submit_context = base_context(config, state, run_id)
    submit_context["tester_summary"] = tester_payload
    submit_step = add_step(run_codex("poki_submit", submit_context, config, run_dir))
    submission_payload = step_payload(submit_step) or {
        "status": "failed",
        "summary": submit_step.get("error", "poki submit failed"),
    }
    record_submission(state, run_id, revision, submission_payload)
    return submission_payload


def run_designer_lane(config, state, run_id, run_dir, report, design_input, add_step, used_feedback):
    designer_context = base_context(config, state, run_id)
    designer_context["design_input"] = design_input
    designer_step = add_step(run_codex("designer", designer_context, config, run_dir))
    designer_payload = step_payload(designer_step)
    if designer_step["ok"] and designer_payload.get("status") == "ok":
        return designer_payload

    report = finish_cycle(
        state,
        report,
        "failed",
        designer_payload.get("summary") or designer_step.get("error") or "designer failed",
        used_feedback,
    )
    write_report(run_dir, report)
    save_state(state)
    return {"failed_report": report}


def run_once_safe(config: dict) -> dict:
    try:
        return run_once(config)
    except Exception as exc:  # noqa: BLE001 - top-level loop guard.
        run_id = stamp()
        run_dir = RUNS_DIR / run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        state = load_state()
        report = {
            "run_id": run_id,
            "started_at_utc": utc_now().isoformat(),
            "finished_at_utc": utc_now().isoformat(),
            "status": "failed",
            "summary": f"unhandled loop error: {exc}",
            "steps": [],
            "validation": None,
            "error_type": type(exc).__name__,
        }
        write_report(run_dir, report)
        emit_log(run_dir, "cycle_finished", report["summary"], status="failed", error_type=type(exc).__name__)
        state.setdefault("cycles", []).append(
            {
                "run_id": run_id,
                "status": "failed",
                "summary": report["summary"],
                "revision": git_revision(),
                "timestamp_utc": report["finished_at_utc"],
            }
        )
        state["cycles"] = state["cycles"][-100:]
        save_state(state)
        return report
