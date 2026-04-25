# Closed Game Loop

Minimal no-human agentic loop for improving Deck of Cats.

## Setup

1. Copy `loop/config.example.json` to `loop/config.json`.
2. Set `poki.developers_game_url` to the game page in Poki for Developers.
3. Make sure the configured persistent browser profile is already logged into Poki.

## Run

```bash
python3 -m loop.agent_loop self-test
python3 -m loop.agent_loop once
python3 -m loop.agent_loop forever --interval-minutes 60
```

Runtime state and per-cycle logs are written to ignored files under `loop/state.json` and `loop/runs/`.

## Process

1. `poki_feedback` looks for new Poki playtest feedback.
2. If none is found, `tester` plays/checks the current build.
3. If the tester recommends external testing, `poki_submit` sends the build to Poki.
4. `designer` chooses one focused improvement.
5. `developer` implements, validates, and fixes before returning.
6. The orchestrator records the Developer result, updates loop state, and repeats in `forever` mode.

## Code Layout

- `agent_loop/` — Python package for the loop implementation.
- `agent_loop/__main__.py` — CLI entrypoint for `python3 -m loop.agent_loop ...`.
- `agent_loop/cli.py` — argument parsing and command dispatch.
- `agent_loop/orchestrator.py` — high-level loop flow.
- `agent_loop/codex_runner.py` — `codex exec` invocation and output parsing.
- `agent_loop/validation.py` — lightweight sanity reporting for Developer results.
- `agent_loop/prompts.py` — prompt rendering and role payload validation.
- `prompts/`, `schemas/` — role prompt text and Codex output schemas.

## Logs

Tail the live loop status while it runs:

```bash
tail -f loop/live.log
```

Each run also writes:

- `loop/runs/<run_id>/loop.log` — human-readable step stream.
- `loop/runs/<run_id>/events.jsonl` — machine-readable event stream.
- `loop/runs/<run_id>/run.json` — final structured report.
