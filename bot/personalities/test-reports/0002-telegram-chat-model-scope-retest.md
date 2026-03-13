# Test Report 0002: Telegram chat model scope retest
Scope: Task 2c7bb3a6-80b4-4de0-a772-f7d182fe0ab9
Date: 2026-03-13

## Verdict: FAIL

## What Was Tested
Retest of the Telegram chat-agent model override after the previous scope bug report.

Coverage in this pass:
- targeted backend unit tests for the modified chat-agent adapter and prompt builder;
- full `bot/tests/unit` regression pass;
- live Codex-backed `CodexChatAgentAdapter.plan()` calls that compare:
  - target-chat conversation before the override;
  - target-chat conversation after the override;
  - resumed target-chat conversation after the override;
  - target-chat task creation after the override;
  - conversation in another chat after the override.

Browser validation was skipped as not applicable because the change is backend-only.

## Commands
- `cd bot && ./.venv/bin/python -m pytest tests/unit/test_chat_agent_adapter.py tests/unit/test_prompt_builder.py -q`
- `cd bot && ./.venv/bin/python -m pytest tests/unit -q`
- `cd bot && ./.venv/bin/python - <<'PY' ... PY`
  The live Python harness used the real `ProcessRunner` and real `codex` CLI, while capturing the exact argv used for each scenario.

## Expected
- Conversational replies in chat `175504456` should use `gpt-5.3-codex-spark`.
- Task-creation requests in chat `175504456` should stay on the existing default chat-agent path/model.
- Other chats should keep the default chat-agent path/model.
- Relevant backend tests should pass.

## Actual
- `tests/unit/test_chat_agent_adapter.py tests/unit/test_prompt_builder.py`: `2 failed, 11 passed`.
- `tests/unit`: `2 failed, 73 passed`.
- Live Codex-backed behavior now matches the requested routing scope:
  - Before override, target-chat conversation used `codex -a never -s workspace-write exec --json ...` and returned `action=reply`.
  - After override, target-chat conversation first used the default routing call with no `-m`, then a second plain-reply call used `codex -a never -s workspace-write -m gpt-5.3-codex-spark exec --json ...`.
  - The resumed second conversational turn in target chat again used a default routing resume call plus a spark reply resume call: `... -m gpt-5.3-codex-spark exec resume --json ...`.
  - A coding-style request in target chat returned `action=create_task` and used only `codex -a never -s workspace-write exec --json ...` with no `-m`.
  - The same conversation scenario in chat `175504457` used only the default routing call with no `-m`.

## Evidence
- Failing tests:
  - `tests/unit/test_chat_agent_adapter.py::test_chat_agent_adapter_uses_model_override_for_specific_chat`
  - `tests/unit/test_chat_agent_adapter.py::test_chat_agent_adapter_keeps_model_override_when_resuming_target_chat`
- Failure mode:
  - both tests expect `runner.calls[1]`, but their fake routing payload comes from `_chat_json(...)`, which still emits `action="list_tasks"`, so `CodexChatAgentAdapter.plan()` correctly returns after the routing call and never makes the spark-reply call those assertions expect.
- Live scope checks:
  - target-chat conversation reply path uses `-m gpt-5.3-codex-spark`;
  - target-chat task creation path uses no `-m`;
  - other chat uses no `-m`.

## Notes
- The implementation appears to fix the original scope bug in runtime behavior.
- The branch still fails validation because the new unit coverage is broken and leaves `bot/tests/unit` red.
