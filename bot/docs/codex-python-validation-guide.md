# Codex Python Validation Guide

Use this guide when a task changes Python/backend behavior inside `bot/`. Follow it literally. Do not improvise.

## Goal

Run deterministic Python validation for the Telegram bot/backend code without guessing interpreters or test commands.

## Canonical Rule

For tests inside `bot/`, always run from `bot/` and always use:

```bash
cd bot
./.venv/bin/python -m pytest ...
```

Never use:
- `pytest ...`
- `python3 -m pytest ...`
- any system interpreter outside `bot/.venv`

## Why This Rule Exists

The bot executes Codex inside git worktrees. The canonical interpreter is exposed inside each worktree at:

```bash
bot/.venv/bin/python
```

If that path is missing, stop immediately and return `FAIL` with the exact missing-path error. Do not guess another Python.

## Default Workflow

1. Decide whether browser validation is unnecessary because the task is backend-only.
2. `cd bot`
3. Confirm the interpreter exists:

```bash
test -x ./.venv/bin/python
```

4. Run the narrowest relevant test selection first:

```bash
./.venv/bin/python -m pytest tests/unit/test_target.py -q
```

5. If the task affects multiple backend files, expand to the relevant subset:

```bash
./.venv/bin/python -m pytest tests/unit -q
```

6. Return exact command lines and exact stderr when something fails.

## Fail-Fast Rules

Return `FAIL` immediately when:
- `./.venv/bin/python` does not exist;
- `pytest` is not installed in that interpreter;
- imports fail because project dependencies are missing;
- repeated command guessing would waste time.

## Reporting

Always include:
- whether browser validation was skipped as not applicable;
- the exact pytest command used;
- the exact error if the run failed;
- whether the failure is code-related or environment-related.
