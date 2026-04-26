# Closed Game Loop

Minimal no-human agentic loop for improving Deck of Cats.

## Setup

1. Copy `loop/config.example.json` to `loop/config.json`.
2. If leaving `poki.enabled` as `true`, set `poki.developers_game_url` to the game page in Poki for Developers.
3. If leaving `poki.enabled` as `true`, make sure the configured persistent browser profile is already logged into Poki.
4. Set `poki.enabled` to `false` to skip Poki feedback checks and Poki submissions while still running the local tester, designer, and developer.
5. By default, each cycle commits any checkout changes with a `loop: changes from loop iteration <run_id>` message, including failed cycles that leave changes behind. These automatic commits are unsigned by default so the unattended loop is not blocked by local signing agents; set `loop.commit.sign` to `true` if the loop environment can sign commits.
6. Optional Telegram monitoring: set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID` in the environment before running the loop.

## Run

```bash
python3 -m loop.agent_loop self-test
python3 -m loop.agent_loop once
python3 -m loop.agent_loop forever --interval-minutes 60
```

Runtime state and per-cycle logs are written to ignored files under `loop/state.json` and `loop/runs/`.

Codex roles, Git status/revision checks, validation, Poki build context, runtime state, logs, and automatic iteration commits all run against the current checkout.

## Telegram Monitoring

When both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID` are set, the loop sends concise status updates to the configured admin chat through the Telegram Bot API. The monitor is outbound-only: it does not poll Telegram, accept commands, or pause the loop for approvals.

Example:

```bash
export TELEGRAM_BOT_TOKEN="123456:bot-token"
export TELEGRAM_ADMIN_CHAT_ID="-1001234567890"
python3 -m loop.agent_loop forever --interval-minutes 60
```

Messages are sent for cycle start/finish, role starts/results, selected design input, external Poki submission decisions, designer proposals, developer results, and validation. If Telegram is unavailable or the env vars are missing, the loop continues normally. Notification failures are recorded locally as `telegram_notification_failed` events without logging the bot token.

## Process

1. `poki_feedback` looks for new Poki playtest feedback unless `poki.enabled` is `false`.
2. If none is found, `tester` plays/checks the current build.
3. If the tester recommends external testing and `poki.enabled` is `true`, `poki_submit` sends the build to Poki.
4. `designer` chooses one focused improvement.
5. `developer` implements, validates, and fixes before returning.
6. The orchestrator records the Developer result, commits any checkout changes for the iteration, updates loop state, and repeats in `forever` mode.

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
