# Personalities

This directory stores English role guides and shared handoff artifacts for the bot's multi-agent setup.

Core guides:
- `workflow.md`
- `chat-agent.md`
- `lead.md`
- `researcher.md`
- `game-designer.md`
- `designer.md`
- `developer.md`
- `tester.md`
- `marketing.md`

Shared artifact folders:
- `research/`
- `sprints/`
- `proposals/`
- `ui-specs/`
- `test-reports/`
- `releases/`

Runtime behavior:
- `chat-agent` is persistent per Telegram chat. The bot stores a dedicated Codex session id for each `chat_id`, so the concierge keeps chat-local memory and can keep accepting free-form requests in that conversation.
- `developer` is a persistent personality. The bot stores its Codex session id and resumes it on later implementation tasks so it can keep repository memory.
- `tester` is a disposable personality. The bot starts a fresh Codex session for validation tasks so the tester always re-reads the guide and works from a clean state.
- Personality sessions are stored in `bot/runtime/agent_personalities.json` when the personality is configured to keep memory.
