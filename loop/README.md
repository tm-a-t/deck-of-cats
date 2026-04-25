# Closed Game Loop

Minimal no-human agentic loop for improving Deck of Cats.

## Setup

1. Copy `loop/config.example.json` to `loop/config.json`.
2. Set `poki.developers_game_url` to the game page in Poki for Developers.
3. Make sure the configured persistent browser profile is already logged into Poki.

## Run

```bash
python3 loop/run.py self-test
python3 loop/run.py once
python3 loop/run.py forever --interval-minutes 60
```

Runtime state and per-cycle logs are written to ignored files under `loop/state.json` and `loop/runs/`.

## Logs

Tail the live loop status while it runs:

```bash
tail -f loop/live.log
```

Each run also writes:

- `loop/runs/<run_id>/loop.log` — human-readable step stream.
- `loop/runs/<run_id>/events.jsonl` — machine-readable event stream.
- `loop/runs/<run_id>/run.json` — final structured report.
