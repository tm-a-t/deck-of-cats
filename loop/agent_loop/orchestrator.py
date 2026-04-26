from __future__ import annotations

from loop.agent_loop.codex_runner import run_codex
from loop.agent_loop.feedback import can_submit_external, new_feedback_items, record_submission
from loop.agent_loop.git_utils import git_revision
from loop.agent_loop.io_utils import stamp, utc_now, write_json
from loop.agent_loop.logging_utils import emit_log
from loop.agent_loop.paths import RUNS_DIR
from loop.agent_loop.prompts import base_context
from loop.agent_loop.state import load_state, save_state
from loop.agent_loop.telegram_monitor import TelegramMonitor, compact_list, compact_text
from loop.agent_loop.validation import summarize_developer_result


ROLE_START_MESSAGES = {
    "poki_feedback": "Started checking Poki feedback.",
    "tester": "Started the local tester.",
    "poki_submit": "Started submitting to Poki.",
    "designer": "Started choosing the next design change.",
    "developer": "Started implementing the change.",
}

ROLE_FALLBACK_LABELS = {
    "poki_feedback": "Poki feedback",
    "tester": "Local tester",
    "poki_submit": "Poki submission",
    "designer": "Designer",
    "developer": "Developer",
}


def notify_monitor(monitor: TelegramMonitor | None, run_dir, message: str, reason: str) -> None:
    if monitor is not None:
        monitor.safe_send(run_dir, message, reason=reason)


def with_run(message: str, run_id: str) -> str:
    return f"{message} (run {run_id})"


def role_started_message(role: str, run_id: str) -> str:
    return with_run(ROLE_START_MESSAGES.get(role, f"Started {role}."), run_id)


def role_result_message(role: str, step: dict, run_id: str) -> str:
    payload = step_payload(step)
    label = ROLE_FALLBACK_LABELS.get(role, role)
    if not payload:
        error = compact_text(step.get("error") or "no structured result")
        return with_run(f"{label} failed before returning a usable result. {error}", run_id)

    status = payload.get("status", "unknown")
    summary = compact_text(payload.get("summary", ""))
    if role == "poki_feedback":
        count = len(payload.get("feedback", []))
        return with_run(f"Checked Poki feedback. Status: {status}. Summary: {summary}. New items: {count}.", run_id)

    if role == "tester":
        playable = "playable" if payload.get("playable") else "not playable"
        external = "wants Poki testing" if payload.get("send_to_external_testing") else "does not need Poki testing"
        verdict = payload.get("interest_verdict", "unknown")
        fun = payload.get("fun_factor", "?")
        return with_run(
            f"Local tester finished. Status: {status}. Summary: {summary}. "
            f"Verdict: {verdict}; fun {fun}/5; {playable}; {external}.",
            run_id,
        )

    if role == "poki_submit":
        if status == "submitted":
            build = compact_text(payload.get("submitted_build_label", ""), 120)
            submission = compact_text(payload.get("submission_id", ""), 120)
            return with_run(f"Submitted to Poki. Summary: {summary}. Build: {build}; submission: {submission}.", run_id)
        return with_run(f"Poki submission finished. Status: {status}. Summary: {summary}.", run_id)

    if role == "designer":
        if status == "ok":
            title = compact_text(payload.get("proposal_title") or summary, 120)
            hypothesis = compact_text(payload.get("hypothesis", ""), 260)
            risk = payload.get("risk_level", "unknown")
            return with_run(f"Designer chose: {title}. Risk: {risk}. Reason: {hypothesis}", run_id)
        return with_run(f"Designer finished. Status: {status}. Summary: {summary}.", run_id)

    if role == "developer":
        files = compact_list(payload.get("changed_files", []))
        validation = compact_list(payload.get("validation_commands", []), limit=2)
        return with_run(
            f"Developer finished. Status: {status}. Summary: {summary}. Changed files: {files}. Checks: {validation}.",
            run_id,
        )

    return with_run(f"{label} finished. Status: {status}. Summary: {summary}.", run_id)


def cycle_finished_message(report: dict) -> str:
    summary = compact_text(report.get("summary", ""))
    status = report.get("status")
    if status == "passed":
        message = "Loop finished successfully."
    elif status == "failed":
        message = "Loop failed."
    else:
        message = f"Loop finished with status {status}."
    if summary:
        message += f" Summary: {summary}."
    validation = report.get("validation")
    if validation:
        verdict = "passed" if validation.get("ok") else "failed"
        message += f" Developer checks {verdict}: {compact_text(validation.get('summary', ''))}"
    return with_run(message, report["run_id"])


def write_report(run_dir, report: dict) -> None:
    write_json(run_dir / "run.json", report)


def finish_cycle(
    state: dict,
    report: dict,
    status: str,
    summary: str,
    used_feedback: list[dict],
    monitor: TelegramMonitor | None = None,
) -> dict:
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
    run_dir = RUNS_DIR / report["run_id"]
    emit_log(run_dir, "cycle_finished", summary, status=status)
    notify_monitor(monitor, run_dir, cycle_finished_message(report), "cycle_finished")
    return report


def step_payload(step: dict) -> dict:
    return step.get("payload") or {}


def poki_steps_enabled(config: dict) -> bool:
    return bool(config.get("poki", {}).get("enabled", True))


def skipped_poki_feedback_step() -> dict:
    summary = "Poki steps disabled by config"
    return {
        "role": "poki_feedback",
        "ok": True,
        "returncode": None,
        "timed_out": False,
        "duration_seconds": 0,
        "prompt_path": None,
        "stdout_path": None,
        "stderr_path": None,
        "last_message_path": None,
        "payload": {
            "status": "skipped",
            "summary": summary,
            "feedback": [],
            "details": summary,
        },
        "error": None,
    }


def run_once(config: dict) -> dict:
    run_id = stamp()
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    state = load_state()
    revision = git_revision()
    monitor = TelegramMonitor.from_env()
    emit_log(run_dir, "cycle_started", "cycle started", revision=revision)
    notify_monitor(monitor, run_dir, with_run(f"Deck of Cats loop started. Revision: {revision}.", run_id), "cycle_started")
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

    def run_role(role: str, context: dict) -> dict:
        notify_monitor(monitor, run_dir, role_started_message(role, run_id), f"{role}_started")
        step = add_step(run_codex(role, context, config, run_dir))
        notify_monitor(monitor, run_dir, role_result_message(role, step, run_id), f"{role}_result")
        return step

    context = base_context(config, state, run_id)
    if poki_steps_enabled(config):
        feedback_step = run_role("poki_feedback", context)
    else:
        feedback_step = add_step(skipped_poki_feedback_step())
        emit_log(run_dir, "poki_feedback_skipped", "Poki feedback skipped by config")
        notify_monitor(
            monitor,
            run_dir,
            with_run("Poki steps disabled by config; skipping feedback check.", run_id),
            "poki_feedback_skipped",
        )
    feedback_payload = step_payload(feedback_step)
    if feedback_step["ok"] and feedback_payload.get("status") == "ok":
        used_feedback = new_feedback_items(feedback_payload, state)
    emit_log(
        run_dir,
        "feedback_checked",
        "feedback checked",
        status=feedback_payload.get("status", "failed") if feedback_payload else "failed",
        new_feedback_count=len(used_feedback),
    )

    if used_feedback:
        emit_log(run_dir, "design_input_selected", "using new Poki feedback", kind="poki_feedback")
        notify_monitor(
            monitor,
            run_dir,
            with_run(f"Using {len(used_feedback)} new Poki feedback item(s) for this cycle.", run_id),
            "design_input_selected",
        )
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
            run_role,
            used_feedback,
            monitor,
        )
        if "failed_report" in design_input:
            return design_input["failed_report"]

    designer_payload = run_designer_lane(config, state, run_id, run_dir, report, design_input, run_role, used_feedback, monitor)
    if "failed_report" in designer_payload:
        return designer_payload["failed_report"]

    developer_context = base_context(config, state, run_id)
    developer_context["design_input"] = design_input
    developer_context["designer_proposal"] = designer_payload
    developer_step = run_role("developer", developer_context)
    developer_payload = step_payload(developer_step)
    if not developer_step["ok"] or developer_payload.get("status") != "ok":
        report = finish_cycle(
            state,
            report,
            "failed",
            developer_payload.get("summary") or developer_step.get("error") or "developer failed",
            used_feedback,
            monitor,
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
    validation_status = "passed" if report["validation"]["ok"] else "failed"
    notify_monitor(
        monitor,
        run_dir,
        with_run(f"Developer checks {validation_status}. {compact_text(report['validation']['summary'])}", run_id),
        "developer_validation_reported",
    )
    write_report(run_dir, report)

    status = "passed" if report["validation"]["ok"] else "failed"
    summary = "cycle completed" if report["validation"]["ok"] else "developer reported incomplete validation"
    report = finish_cycle(state, report, status, summary, used_feedback, monitor)
    write_report(run_dir, report)
    save_state(state)
    return report


def run_local_tester_lane(
    config,
    state,
    run_id,
    run_dir,
    report,
    feedback_step,
    feedback_payload,
    run_role,
    used_feedback,
    monitor,
):
    emit_log(run_dir, "design_input_needed", "no new feedback; running local tester")
    notify_monitor(
        monitor,
        run_dir,
        with_run("No new Poki feedback. Running the local tester for design input.", run_id),
        "design_input_needed",
    )
    tester_context = base_context(config, state, run_id)
    tester_context["feedback_check"] = feedback_payload or {
        "status": "blocked" if not feedback_step["ok"] else "ok",
        "summary": feedback_step.get("error") or "no new feedback",
    }
    tester_step = run_role("tester", tester_context)
    tester_payload = step_payload(tester_step)
    if not tester_step["ok"] or tester_payload.get("status") != "ok":
        report = finish_cycle(
            state,
            report,
            "failed",
            tester_payload.get("summary") or tester_step.get("error") or "tester failed",
            used_feedback,
            monitor,
        )
        write_report(run_dir, report)
        save_state(state)
        return {"failed_report": report}

    submission_payload = maybe_submit_external(config, state, run_id, run_dir, tester_payload, run_role, monitor)
    emit_log(run_dir, "design_input_selected", "using local tester summary", kind="local_ai_test")
    notify_monitor(
        monitor,
        run_dir,
        with_run(f"Using the local tester summary for design input. {compact_text(tester_payload.get('design_input_summary', tester_payload.get('summary', '')))}", run_id),
        "design_input_selected",
    )
    return {
        "kind": "local_ai_test",
        "summary": tester_payload.get("design_input_summary", tester_payload.get("summary", "")),
        "tester": tester_payload,
        "external_submission": submission_payload,
    }


def maybe_submit_external(config, state, run_id, run_dir, tester_payload, run_role, monitor):
    submission_payload = {"status": "skipped", "summary": "not requested"}
    if not (
        tester_payload.get("playable")
        and tester_payload.get("major_untested_changes")
        and tester_payload.get("send_to_external_testing")
    ):
        return submission_payload

    if not poki_steps_enabled(config):
        summary = "Poki steps disabled by config"
        emit_log(run_dir, "external_submission_skipped", summary)
        notify_monitor(
            monitor,
            run_dir,
            with_run(f"Skipped Poki submission. {summary}", run_id),
            "external_submission_skipped",
        )
        return {"status": "skipped", "summary": summary}

    revision = git_revision()
    allowed, reason = can_submit_external(state, config, revision)
    if not allowed:
        emit_log(run_dir, "external_submission_skipped", reason)
        notify_monitor(monitor, run_dir, with_run(f"Skipped Poki submission. {compact_text(reason)}", run_id), "external_submission_skipped")
        return {"status": "skipped", "summary": reason}

    emit_log(run_dir, "external_submission_started", "submitting to Poki playtest")
    submit_context = base_context(config, state, run_id)
    submit_context["tester_summary"] = tester_payload
    submit_step = run_role("poki_submit", submit_context)
    submission_payload = step_payload(submit_step) or {
        "status": "failed",
        "summary": submit_step.get("error", "poki submit failed"),
    }
    record_submission(state, run_id, revision, submission_payload)
    return submission_payload


def run_designer_lane(config, state, run_id, run_dir, report, design_input, run_role, used_feedback, monitor):
    designer_context = base_context(config, state, run_id)
    designer_context["design_input"] = design_input
    designer_step = run_role("designer", designer_context)
    designer_payload = step_payload(designer_step)
    if designer_step["ok"] and designer_payload.get("status") == "ok":
        return designer_payload

    report = finish_cycle(
        state,
        report,
        "failed",
        designer_payload.get("summary") or designer_step.get("error") or "designer failed",
        used_feedback,
        monitor,
    )
    write_report(run_dir, report)
    save_state(state)
    return {"failed_report": report}


def run_once_safe(config: dict) -> dict:
    try:
        return run_once(config)
    except Exception as exc:  # noqa: BLE001 - top-level loop guard.
        monitor = TelegramMonitor.from_env()
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
        notify_monitor(monitor, run_dir, cycle_finished_message(report), "cycle_finished")
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
