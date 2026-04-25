from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LOOP_DIR = ROOT / "loop"
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
