#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
LOOP_DIR = Path(__file__).resolve().parent
PROMPTS_DIR = LOOP_DIR / "prompts"
SCHEMAS_DIR = LOOP_DIR / "schemas"
STATE_PATH = LOOP_DIR / "state.json"
RUNS_DIR = LOOP_DIR / "runs"
LIVE_LOG_PATH = LOOP_DIR / "live.log"

ROLES = ("poki_feedback", "tester", "poki_submit", "designer", "developer", "repair")
SCHEMA_BY_ROLE = {
    "poki_feedback": "poki_feedback.schema.json",
    "tester": "tester.schema.json",
    "poki_submit": "poki_submit.schema.json",
    "designer": "designer.schema.json",
    "developer": "developer.schema.json",
    "repair": "developer.schema.json",
}

DEFAULT_CONFIG = {
    "loop": {
        "interval_minutes": 60,
        "external_submissions_per_day": 2,
        "repair_attempts": 1,
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
            "repair": "workspace-write",
        },
        "role_timeouts_seconds": {
            "poki_feedback": 900,
            "tester": 1800,
            "poki_submit": 1800,
            "designer": 1200,
            "developer": 2400,
            "repair": 1800,
        },
    },
    "poki": {
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


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def stamp(now: dt.datetime | None = None) -> str:
    return (now or utc_now()).strftime("%Y%m%d-%H%M%S")


def deep_merge(base: dict, override: dict) -> dict:
    out = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def read_json(path: Path, default: dict) -> dict:
    if not path.exists():
        return copy.deepcopy(default)
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    tmp.replace(path)


def short_log_value(value: object) -> str:
    if isinstance(value, str):
        text = value
    elif isinstance(value, (int, float, bool)) or value is None:
        text = str(value)
    else:
        text = json.dumps(value, ensure_ascii=False, sort_keys=True)
    text = " ".join(text.split())
    if len(text) > 240:
        return text[:237] + "..."
    return text


def emit_log(run_dir: Path, event: str, message: str, **fields: object) -> None:
    now = utc_now().isoformat()
    payload = {
        "timestamp_utc": now,
        "run_id": run_dir.name,
        "event": event,
        "message": message,
        **fields,
    }
    run_dir.mkdir(parents=True, exist_ok=True)

    with (run_dir / "events.jsonl").open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(payload, ensure_ascii=False, sort_keys=True) + "\n")

    suffix = ""
    if fields:
        parts = [f"{key}={short_log_value(value)}" for key, value in sorted(fields.items())]
        suffix = " | " + " ".join(parts)
    line = f"{now} [{run_dir.name}] {event}: {message}{suffix}\n"
    for path in (run_dir / "loop.log", LIVE_LOG_PATH):
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(line)


def read_text(path: Path, default: str = "") -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return default


def load_config(path: Path) -> dict:
    return deep_merge(DEFAULT_CONFIG, read_json(path, {}))


def load_state(path: Path = STATE_PATH) -> dict:
    return read_json(
        path,
        {
            "version": 1,
            "seen_feedback_ids": [],
            "external_submissions": [],
            "cycles": [],
        },
    )


def save_state(state: dict, path: Path = STATE_PATH) -> None:
    state["version"] = 1
    write_json(path, state)


def run_process(args: list[str], *, cwd: Path, timeout: int) -> dict:
    started = time.time()
    try:
        proc = subprocess.Popen(
            args,
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except FileNotFoundError as exc:
        return {
            "ok": False,
            "returncode": 127,
            "timed_out": False,
            "stdout": "",
            "stderr": str(exc),
            "duration_seconds": round(time.time() - started, 3),
            "args": args,
        }

    try:
        stdout, stderr = proc.communicate(timeout=timeout)
        timed_out = False
    except subprocess.TimeoutExpired:
        proc.kill()
        stdout, stderr = proc.communicate()
        timed_out = True

    return {
        "ok": proc.returncode == 0 and not timed_out,
        "returncode": proc.returncode,
        "timed_out": timed_out,
        "stdout": stdout,
        "stderr": stderr,
        "duration_seconds": round(time.time() - started, 3),
        "args": args,
    }


def git_lines(args: list[str]) -> list[str]:
    result = run_process(["git", *args], cwd=ROOT, timeout=20)
    if not result["ok"]:
        return []
    return [line.strip() for line in result["stdout"].splitlines() if line.strip()]


def git_revision() -> str:
    lines = git_lines(["rev-parse", "--short", "HEAD"])
    return lines[0] if lines else "unknown"


def git_status_short() -> list[str]:
    return git_lines(["status", "--short"])


def collect_changed_files() -> list[str]:
    files = set(git_lines(["diff", "--name-only", "HEAD"]))
    for line in git_lines(["status", "--short", "--untracked-files=normal"]):
        if len(line) < 4:
            continue
        path = line[3:].strip()
        if path:
            files.add(path)
    return sorted(p for p in files if p)


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
            "needs_repair",
        ),
        "repair": (
            "status",
            "summary",
            "details",
            "changed_files",
            "validation_commands",
            "needs_repair",
        ),
    }
    missing = [key for key in required_by_role[role] if key not in payload]
    if missing:
        raise ValueError(f"{role} payload missing keys: {', '.join(missing)}")


def run_codex(role: str, context: dict, config: dict, run_dir: Path) -> dict:
    schema_path = SCHEMAS_DIR / SCHEMA_BY_ROLE[role]
    prompt = prompt_for(role, context)
    prompt_path = run_dir / f"{role}.prompt.md"
    last_path = run_dir / f"{role}.last.json"
    stdout_path = run_dir / f"{role}.stdout.txt"
    stderr_path = run_dir / f"{role}.stderr.txt"

    prompt_path.write_text(prompt, encoding="utf-8")

    codex_cfg = config["codex"]
    sandbox = codex_cfg.get("role_sandboxes", {}).get(role, codex_cfg["sandbox"])
    timeout = codex_cfg.get("role_timeouts_seconds", {}).get(role, codex_cfg["timeout_seconds"])
    args = [codex_cfg["executable"]]
    if codex_cfg.get("approval_policy"):
        args.extend(["-a", codex_cfg["approval_policy"]])
    args.extend(
        [
            "exec",
            "--sandbox",
            sandbox,
            "--output-schema",
            str(schema_path),
            "-o",
            str(last_path),
        ]
    )
    args.extend(codex_cfg.get("extra_exec_args", []))
    args.extend(codex_cfg.get("role_extra_exec_args", {}).get(role, []))
    args.append(prompt)

    emit_log(
        run_dir,
        "role_started",
        f"{role} started",
        role=role,
        sandbox=sandbox,
        timeout_seconds=timeout,
    )
    result = run_process(args, cwd=ROOT, timeout=int(timeout))
    stdout_path.write_text(result["stdout"], encoding="utf-8")
    stderr_path.write_text(result["stderr"], encoding="utf-8")
    emit_log(
        run_dir,
        "role_process_finished",
        f"{role} process finished",
        role=role,
        ok=result["ok"],
        returncode=result["returncode"],
        timed_out=result["timed_out"],
        duration_seconds=result["duration_seconds"],
    )

    step = {
        "role": role,
        "ok": result["ok"],
        "returncode": result["returncode"],
        "timed_out": result["timed_out"],
        "duration_seconds": result["duration_seconds"],
        "prompt_path": str(prompt_path.relative_to(ROOT)),
        "stdout_path": str(stdout_path.relative_to(ROOT)),
        "stderr_path": str(stderr_path.relative_to(ROOT)),
        "last_message_path": str(last_path.relative_to(ROOT)),
        "payload": None,
        "error": None,
    }
    if not result["ok"]:
        step["error"] = "codex exec failed"
        emit_log(run_dir, "role_failed", f"{role} failed", role=role, error=step["error"])
        return step

    raw = read_text(last_path, result["stdout"])
    try:
        payload = parse_json_payload(raw)
        validate_payload(role, payload)
        step["payload"] = payload
        step["ok"] = payload.get("status") not in ("failed",)
        emit_log(
            run_dir,
            "role_payload",
            f"{role} returned {payload.get('status')}",
            role=role,
            status=payload.get("status"),
            summary=payload.get("summary", ""),
        )
    except Exception as exc:  # noqa: BLE001 - this is boundary parsing.
        step["ok"] = False
        step["error"] = f"invalid {role} JSON: {exc}"
        emit_log(run_dir, "role_failed", f"{role} returned invalid JSON", role=role, error=step["error"])
    return step


def normalized_feedback_id(item: dict, index: int) -> str:
    raw = str(item.get("id") or "").strip()
    if raw:
        return raw
    basis = json.dumps(item, sort_keys=True, ensure_ascii=False) + f":{index}"
    return "feedback-" + hashlib.sha1(basis.encode("utf-8")).hexdigest()[:12]


def new_feedback_items(payload: dict, state: dict) -> list[dict]:
    seen = set(state.get("seen_feedback_ids", []))
    out = []
    for index, item in enumerate(payload.get("feedback", [])):
        next_item = dict(item)
        next_item["id"] = normalized_feedback_id(next_item, index)
        if next_item["id"] not in seen:
            out.append(next_item)
    return out


def todays_submissions(state: dict) -> int:
    today = utc_now().date().isoformat()
    return sum(
        1
        for item in state.get("external_submissions", [])
        if item.get("date") == today and item.get("status") == "submitted"
    )


def already_submitted_revision(state: dict, revision: str) -> bool:
    return any(
        item.get("revision") == revision and item.get("status") == "submitted"
        for item in state.get("external_submissions", [])
    )


def can_submit_external(state: dict, config: dict, revision: str) -> tuple[bool, str]:
    limit = int(config["loop"]["external_submissions_per_day"])
    if todays_submissions(state) >= limit:
        return False, f"daily external submission limit reached ({limit})"
    if already_submitted_revision(state, revision):
        return False, f"revision {revision} was already submitted"
    return True, "ok"


def record_submission(state: dict, run_id: str, revision: str, payload: dict) -> None:
    state.setdefault("external_submissions", []).append(
        {
            "run_id": run_id,
            "revision": revision,
            "date": utc_now().date().isoformat(),
            "timestamp_utc": utc_now().isoformat(),
            "status": payload.get("status", "unknown"),
            "submission_id": payload.get("submission_id", ""),
            "summary": payload.get("summary", ""),
        }
    )


def command_check(name: str, args: list[str], run_dir: Path, timeout: int) -> dict:
    emit_log(run_dir, "validation_started", f"{name} started", check=name, timeout_seconds=timeout)
    result = run_process(args, cwd=ROOT, timeout=timeout)
    slug = name.replace(" ", "-")
    stdout_path = run_dir / f"check-{slug}.stdout.txt"
    stderr_path = run_dir / f"check-{slug}.stderr.txt"
    stdout_path.write_text(result["stdout"], encoding="utf-8")
    stderr_path.write_text(result["stderr"], encoding="utf-8")
    summary = "ok" if result["ok"] else "failed"
    if result["timed_out"]:
        summary = "timed out"
    emit_log(
        run_dir,
        "validation_finished",
        f"{name} {summary}",
        check=name,
        ok=result["ok"],
        returncode=result["returncode"],
        timed_out=result["timed_out"],
        duration_seconds=result["duration_seconds"],
    )
    return {
        "name": name,
        "ok": result["ok"],
        "summary": summary,
        "returncode": result["returncode"],
        "timed_out": result["timed_out"],
        "duration_seconds": result["duration_seconds"],
        "stdout_path": str(stdout_path.relative_to(ROOT)),
        "stderr_path": str(stderr_path.relative_to(ROOT)),
        "args": args,
    }


def gameplay_docs_check(changed_files: list[str], developer_payload: dict) -> dict:
    changed = set(changed_files)
    declared = {str(path).strip() for path in developer_payload.get("changed_files", []) if str(path).strip()}
    gameplay_changed = any(
        path.startswith("js/") or path in {"index.html", "rules.md"} for path in changed
    )
    errors = []
    if declared:
        undeclared_missing = sorted(declared - changed)
        if undeclared_missing:
            errors.append("declared changed files not found in git status: " + ", ".join(undeclared_missing))
    if gameplay_changed and "rules.md" not in changed:
        errors.append("gameplay files changed without rules.md")
    if "changelog.md" not in changed:
        errors.append("developer step did not change changelog.md")
    return {
        "name": "docs and changed-files guard",
        "ok": not errors,
        "summary": "ok" if not errors else "; ".join(errors),
        "changed_files": changed_files,
        "declared_changed_files": sorted(declared),
    }


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def static_server_smoke(config: dict, run_dir: Path) -> dict:
    timeout = int(config["validation"]["timeout_seconds"])
    expected_title = config["validation"]["expected_title"]
    emit_log(run_dir, "validation_started", "static smoke started", check="static smoke")
    try:
        port = free_port()
    except OSError as exc:
        result = static_file_smoke(config, f"localhost bind unavailable: {exc}")
        emit_log(run_dir, "validation_finished", result["summary"], check=result["name"], ok=result["ok"])
        return result

    log_path = run_dir / "check-static-server.log"
    with log_path.open("w", encoding="utf-8") as log:
        try:
            proc = subprocess.Popen(
                ["python3", "-m", "http.server", str(port), "--bind", "127.0.0.1"],
                cwd=str(ROOT),
                stdout=log,
                stderr=log,
                text=True,
            )
        except OSError as exc:
            result = static_file_smoke(config, f"static server unavailable: {exc}")
            emit_log(run_dir, "validation_finished", result["summary"], check=result["name"], ok=result["ok"])
            return result
        try:
            url = f"http://127.0.0.1:{port}/index.html"
            html = ""
            last_error = ""
            deadline = time.time() + min(timeout, 15)
            while time.time() < deadline:
                try:
                    with urllib.request.urlopen(url, timeout=3) as response:
                        html = response.read().decode("utf-8", errors="replace")
                    break
                except Exception as exc:  # noqa: BLE001 - retry until server is ready.
                    last_error = str(exc)
                    time.sleep(0.25)

            ok = expected_title in html
            summary = "ok" if ok else f"expected title not found; last_error={last_error}"
            result = {
                "name": "static server smoke",
                "ok": ok,
                "summary": summary,
                "url": url,
                "log_path": str(log_path.relative_to(ROOT)),
            }
            emit_log(run_dir, "validation_finished", summary, check="static server smoke", ok=ok)
            return result
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)


def static_file_smoke(config: dict, reason: str) -> dict:
    expected_title = config["validation"]["expected_title"]
    html = read_text(ROOT / "index.html")
    ok = expected_title in html
    return {
        "name": "static file smoke",
        "ok": ok,
        "summary": "ok" if ok else f"expected title not found; fallback_reason={reason}",
        "fallback_reason": reason,
        "path": "index.html",
    }


def validate_after_developer(config: dict, run_dir: Path, developer_payload: dict) -> dict:
    emit_log(run_dir, "validation_started", "post-developer validation started", check="post-developer")
    changed_files = collect_changed_files()
    checks = [gameplay_docs_check(changed_files, developer_payload)]
    emit_log(
        run_dir,
        "validation_finished",
        checks[0]["summary"],
        check=checks[0]["name"],
        ok=checks[0]["ok"],
    )

    best_log = run_dir / "sim-best-purchases.log"
    sim_args = [
        "node",
        "sim/fast-sim.js",
        "--runs",
        str(config["validation"]["sim_runs"]),
        "--seed",
        str(config["validation"]["sim_seed"]),
        "--max-steps",
        str(config["validation"]["sim_max_steps"]),
        "--best-log",
        str(best_log),
        "--json",
    ]
    checks.append(command_check("headless simulator", sim_args, run_dir, int(config["validation"]["timeout_seconds"])))
    checks.append(static_server_smoke(config, run_dir))

    ok = all(check.get("ok") for check in checks)
    emit_log(
        run_dir,
        "validation_finished",
        "post-developer validation finished",
        check="post-developer",
        ok=ok,
        summary="all checks passed" if ok else "one or more checks failed",
    )
    return {
        "ok": ok,
        "summary": "all checks passed" if ok else "one or more checks failed",
        "checks": checks,
    }


def write_report(run_dir: Path, report: dict) -> None:
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
            return report

        submission_payload = {"status": "skipped", "summary": "not requested"}
        if (
            tester_payload.get("playable")
            and tester_payload.get("major_untested_changes")
            and tester_payload.get("send_to_external_testing")
        ):
            revision = git_revision()
            allowed, reason = can_submit_external(state, config, revision)
            if allowed:
                emit_log(run_dir, "external_submission_started", "submitting build to Poki playtest")
                submit_context = base_context(config, state, run_id)
                submit_context["tester_summary"] = tester_payload
                submit_step = add_step(run_codex("poki_submit", submit_context, config, run_dir))
                submission_payload = step_payload(submit_step) or {
                    "status": "failed",
                    "summary": submit_step.get("error", "poki submit failed"),
                }
                record_submission(state, run_id, revision, submission_payload)
            else:
                submission_payload = {"status": "skipped", "summary": reason}
                emit_log(run_dir, "external_submission_skipped", reason)

        emit_log(run_dir, "design_input_selected", "using local AI tester summary", kind="local_ai_test")
        design_input = {
            "kind": "local_ai_test",
            "summary": tester_payload.get("design_input_summary", tester_payload.get("summary", "")),
            "tester": tester_payload,
            "external_submission": submission_payload,
        }

    designer_context = base_context(config, state, run_id)
    designer_context["design_input"] = design_input
    designer_step = add_step(run_codex("designer", designer_context, config, run_dir))
    designer_payload = step_payload(designer_step)
    if not designer_step["ok"] or designer_payload.get("status") != "ok":
        report = finish_cycle(
            state,
            report,
            "failed",
            designer_payload.get("summary") or designer_step.get("error") or "designer failed",
            used_feedback,
        )
        write_report(run_dir, report)
        save_state(state)
        return report

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

    validation = validate_after_developer(config, run_dir, developer_payload)
    report["validation"] = validation
    write_report(run_dir, report)

    repair_attempts = int(config["loop"].get("repair_attempts", 0))
    for attempt in range(repair_attempts):
        if validation["ok"]:
            break
        repair_context = base_context(config, state, run_id)
        repair_context["design_input"] = design_input
        repair_context["designer_proposal"] = designer_payload
        repair_context["developer_result"] = developer_payload
        repair_context["validation_failure"] = validation
        repair_context["repair_attempt"] = attempt + 1
        repair_step = add_step(run_codex("repair", repair_context, config, run_dir))
        repair_payload = step_payload(repair_step)
        if not repair_step["ok"] or repair_payload.get("status") != "ok":
            break
        validation = validate_after_developer(config, run_dir, repair_payload)
        report["validation"] = validation
        write_report(run_dir, report)

    status = "passed" if validation["ok"] else "failed"
    summary = "cycle completed" if validation["ok"] else "developer validation failed"
    report = finish_cycle(state, report, status, summary, used_feedback)
    write_report(run_dir, report)
    save_state(state)
    return report


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

    fixtures = {
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
    for role, payload in fixtures.items():
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


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Run the Deck of Cats closed agentic improvement loop.")
    parser.add_argument("--config", default=str(LOOP_DIR / "config.json"), help="Path to loop config JSON.")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("once", help="Run one loop cycle.")
    forever = sub.add_parser("forever", help="Run loop cycles forever.")
    forever.add_argument("--interval-minutes", type=float, default=None)
    sub.add_parser("self-test", help="Validate loop files without calling Codex or Poki.")

    args = parser.parse_args(argv)
    if args.command == "self-test":
        result = self_test()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    config = load_config(Path(args.config))
    if args.command == "once":
        report = run_once_safe(config)
        print(json.dumps({"status": report["status"], "summary": report["summary"], "run_id": report["run_id"]}, indent=2))
        return 0 if report["status"] == "passed" else 1

    interval = args.interval_minutes
    if interval is None:
        interval = float(config["loop"]["interval_minutes"])
    while True:
        report = run_once_safe(config)
        print(json.dumps({"status": report["status"], "summary": report["summary"], "run_id": report["run_id"]}, indent=2))
        time.sleep(max(1.0, interval * 60.0))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
