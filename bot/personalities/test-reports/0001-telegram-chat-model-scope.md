# Test Report 0001: Telegram chat model scope
Scope: Task 2c7bb3a6-80b4-4de0-a772-f7d182fe0ab9
Date: 2026-03-13

## Verdict: FAIL

## What Was Tested
Validation of the Telegram chat-agent model override for chat `175504456`, including:
- targeted unit coverage for the modified adapter;
- full `bot/tests/unit` regression pass;
- live Codex-backed `CodexChatAgentAdapter.plan()` calls for:
  - target-chat free-form conversation before the override config;
  - target-chat free-form conversation after the override config;
  - target-chat coding-style message after the override config;
  - another chat after the override config.

Browser validation was skipped as not applicable because the change is backend-only.

## Commands
- `cd bot && ./.venv/bin/python -m pytest tests/unit/test_chat_agent_adapter.py -q`
- `cd bot && ./.venv/bin/python -m pytest tests/unit -q`
- `cd bot && ./.venv/bin/python - <<'PY' ... PY`
  The Python harness instantiated `CodexChatAgentAdapter` with a real `ProcessRunner`, captured the exact `codex` args, and executed live chat-agent requests against Codex for the scenarios listed above.

## Expected
- Free-form conversation in chat `175504456` should use `gpt-5.3-codex-spark`.
- Other chats should keep the default chat-agent model.
- Requests that create tasks or trigger code work should not be moved onto the spark override just because they originate from chat `175504456`.

## Actual
- `tests/unit/test_chat_agent_adapter.py`: `5 passed`.
- `tests/unit`: `73 passed`.
- Live before/after conversation evidence:
  - Before override, target-chat conversation call used `codex -a never -s workspace-write exec --json ...` with no `-m`, and returned `action=reply`.
  - After override, target-chat conversation call used `codex -a never -s workspace-write -m gpt-5.3-codex-spark exec --json ...` and returned `action=reply`.
  - After override, the resumed second conversation turn in the same target chat also used `-m gpt-5.3-codex-spark` with `exec resume --json ...`.
- Live scope failure evidence:
  - After override, a coding-style message in target chat `175504456` also used `codex -a never -s workspace-write -m gpt-5.3-codex-spark exec --json ...` and returned `action=create_task` with title `Add Reset button to main screen with mobile-safe layout`.
  - After override, the same conversation scenario in chat `175504457` used no `-m`, so other chats remained on the default model.

## Evidence
- The override is injected globally for the chat-agent instance in `bot/app/di.py`.
- Every non-command Telegram text message goes through `chat_agent.plan()` first in `bot/app/interface/telegram/handlers/chat_agent_handler.py`.
- The adapter applies the model override before it knows whether the message is conversational or a task request in `bot/app/infrastructure/codex/chat_agent_adapter.py`.

## Notes
- This implementation satisfies only part of the request: it changes target-chat conversational replies to `gpt-5.3-codex-spark` and leaves other chats alone.
- It does not satisfy the scope restriction "only to free-form chat communication" because task-creation requests in that same chat also hit the spark model at the chat-agent routing layer.
