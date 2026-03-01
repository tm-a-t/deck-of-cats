# Codex Playwright Validation Guide

Use this guide when a task requires browser validation. Follow it in order. Do not improvise.

## Goal

Run a short, deterministic browser check and return result quickly.
Avoid long exploratory loops (`--help`, reading unrelated docs, repeated `run-code` attempts).

## Quick checklist

1. Decide if browser check is actually needed.
2. Prepare `PWCLI`.
3. Start local server and remember PID.
4. Open page and take fresh snapshot.
5. Validate required condition.
6. Close browser and stop server.
7. Return strict `RESULT/SUMMARY/DETAILS`.

## 1) When browser check is needed

Run Playwright only when request or changed files indicate UI/HTML/JS behavior.
If task is backend-only or docs-only, skip browser automation and state why in `DETAILS`.

## 2) Prepare Playwright CLI

Run from repository root.

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
command -v playwright-cli >/dev/null 2>&1 || true
command -v npx >/dev/null 2>&1
"$PWCLI" --help >/dev/null
```

Rules:
- Prefer wrapper: `"$PWCLI" ...`
- Use global `playwright-cli` directly only if explicitly required.
- Do not read `--help` repeatedly. One check is enough.

## 3) Start local server (deterministic pattern)

```bash
python3 -m http.server 4173 >/tmp/codex_validate_server.log 2>&1 &
SERVER_PID=$!
sleep 1
curl --max-time 4 -I http://127.0.0.1:4173/index.html
```

If `curl` fails, stop and return `FAIL` with that error.

## 4) Standard Playwright interaction loop

```bash
"$PWCLI" --session validate open http://127.0.0.1:4173/index.html
"$PWCLI" --session validate snapshot
```

Then use snapshot refs for interactions:

```bash
"$PWCLI" --session validate click e3
"$PWCLI" --session validate snapshot
```

Rules:
- Always snapshot before using `e*` refs.
- Re-snapshot after navigation or major DOM change.
- Prefer `click/fill/type/press` commands over `run-code`.

## 5) Title check (preferred)

Use direct evaluation for title:

```bash
"$PWCLI" --session validate eval "document.title"
```

Compare with expected string exactly.

## 6) `run-code` usage (only if CLI commands are insufficient)

`run-code` expects a JavaScript function invoked with a single `page` argument.

Correct:

```bash
"$PWCLI" --session validate run-code "async function (page) { const t = await page.title(); return t; }"
```

Also valid:

```bash
"$PWCLI" --session validate run-code "async (page) => { return await page.title(); }"
```

Wrong patterns:
- Top-level statements like `const x = ...` without function wrapper.
- Immediate IIFE strings that do not match expected function signature.

Retry policy for `run-code`:
- Maximum 2 attempts.
- If both fail, stop and return `FAIL` with exact error.

## 7) Cleanup (always)

```bash
"$PWCLI" --session validate close || true
kill "$SERVER_PID" || true
```

Never leave server or browser running.

## 8) Fail-fast policy

Stop early and return `FAIL` when:
- network/DNS is unavailable;
- required tool is missing (`npx`, wrapper, browser startup failure);
- repeated syntax/tool errors indicate misuse.

Do not spend time on:
- repeated `--help`/docs reading;
- multiple alternative command strategies for the same step.

## 9) Response format (strict)

Return exactly:

```text
RESULT: PASS|FAIL
SUMMARY: <one line>
DETAILS: <short text with exact commands/errors used>
```

