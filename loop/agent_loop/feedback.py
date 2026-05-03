from __future__ import annotations

import hashlib
import json

from loop.agent_loop.io_utils import utc_now


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
