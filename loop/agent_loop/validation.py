from __future__ import annotations

from pathlib import Path
import socket
import subprocess
import time
import urllib.request

from loop.agent_loop.git_utils import collect_changed_files
from loop.agent_loop.io_utils import read_text, run_process
from loop.agent_loop.logging_utils import emit_log
from loop.agent_loop.paths import ROOT


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
    gameplay_changed = any(path.startswith("js/") or path in {"index.html", "rules.md"} for path in changed)
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
