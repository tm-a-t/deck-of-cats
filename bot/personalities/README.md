# Personalities

This directory stores English role guides and shared handoff artifacts for the bot's multi-agent setup.

Core guides:
- `workflow.md`
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
- `developer` is a persistent personality. The bot stores its Codex session id and resumes it on later implementation tasks so it can keep repository memory.
- `tester` is a disposable personality. The bot starts a fresh Codex session for validation tasks so the tester always re-reads the guide and works from a clean state.
- Personality sessions are stored in `bot/runtime/agent_personalities.json` when the personality is configured to keep memory.
