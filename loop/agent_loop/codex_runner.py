from __future__ import annotations

from pathlib import Path

from loop.agent_loop.io_utils import read_text, run_process
from loop.agent_loop.logging_utils import emit_log
from loop.agent_loop.paths import ROOT, SCHEMA_BY_ROLE, SCHEMAS_DIR
from loop.agent_loop.prompts import parse_json_payload, prompt_for, validate_payload


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

    emit_log(run_dir, "role_started", f"{role} started", role=role, sandbox=sandbox, timeout_seconds=timeout)
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
    except Exception as exc:  # noqa: BLE001 - boundary parsing.
        step["ok"] = False
        step["error"] = f"invalid {role} JSON: {exc}"
        emit_log(run_dir, "role_failed", f"{role} returned invalid JSON", role=role, error=step["error"])
    return step
