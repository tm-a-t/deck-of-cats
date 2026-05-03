from __future__ import annotations

import argparse
import json
from pathlib import Path
import time

from loop.agent_loop.orchestrator import run_once_safe
from loop.agent_loop.paths import LOOP_DIR
from loop.agent_loop.selftest import self_test
from loop.agent_loop.state import load_config


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
