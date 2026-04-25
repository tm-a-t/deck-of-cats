from __future__ import annotations

import json
from pathlib import Path

from loop.agent_loop.io_utils import utc_now
from loop.agent_loop.paths import LIVE_LOG_PATH


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
