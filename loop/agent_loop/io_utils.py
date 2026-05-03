from __future__ import annotations

import copy
import datetime as dt
import json
from pathlib import Path
import subprocess
import time


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


def read_text(path: Path, default: str = "") -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return default


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
    except OSError as exc:
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
