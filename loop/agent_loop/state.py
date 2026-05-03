from __future__ import annotations

from pathlib import Path

from loop.agent_loop.defaults import DEFAULT_CONFIG
from loop.agent_loop.io_utils import deep_merge, read_json, write_json
from loop.agent_loop.paths import STATE_PATH


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
