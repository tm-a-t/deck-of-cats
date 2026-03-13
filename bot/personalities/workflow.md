# Agent Workflow — Deck of Cats

This document defines how the current multi-agent setup collaborates on Deck of Cats development. Each personality guide lives in `bot/personalities/`.

## Agents

| Agent | File | Invoke | Role |
|-------|------|--------|------|
| **Chat Agent** | `bot/personalities/chat-agent.md` | plain chat | Per-chat concierge: accepts free-form messages, rewrites new tasks into English, and routes task/status/log requests |
| **Lead** | `bot/personalities/lead.md` | `/lead` | Prioritises work, reviews proposals and implementations, decides when a feature ships |
| **Researcher** | `bot/personalities/researcher.md` | `/researcher` | Maps constraints, studies the codebase, and writes decision-support briefs before design or implementation |
| **Game Designer** | `bot/personalities/game-designer.md` | `/game-designer` | Invents mechanics, pirates, islands, captains; writes design proposals |
| **Designer** | `bot/personalities/designer.md` | `/designer` | Translates approved goals into UI flows, screen states, copy, and interaction specs |
| **Developer** | `bot/personalities/developer.md` | `/developer` | Implements approved designs in Phaser 3 code |
| **Tester** | `bot/personalities/tester.md` | `/tester` | Runs deterministic browser validation with the project Playwright CLI workflow and reports exact failures |
| **Marketing** | `bot/personalities/marketing.md` | `/marketing` | Writes release notes, store descriptions, positioning |

## Interaction Diagram

```mermaid
flowchart TD
    Chat["💬 Chat Agent\nFree-form intake · Per-chat memory"]
    Lead["🎯 Lead\nPrioritises · Reviews · Ships"]
    Research["🔎 Researcher\nFindings · Constraints · Options"]
    GD["🎨 Game Designer\nInvents mechanics & content"]
    Design["🧭 Designer\nUI flows · States · Copy"]
    Dev["💻 Developer\nImplements in Phaser 3"]
    Test["🧪 Tester\nCLI validation · Regression checks"]
    Mkt["📣 Marketing\nRelease notes & positioning"]

    Chat -- "0. Structured English tasks\n(bot chat)" --> Dev
    Lead -- "1. Questions / priorities" --> Research
    Research -- "2. Research brief\n(bot/personalities/research/)" --> Lead
    Research -- "2a. Constraints / findings" --> GD
    Research -- "2b. UX findings" --> Design
    Lead -- "3. Sprint brief\n(bot/personalities/sprints/)" --> GD
    GD -- "4. Design proposal\n(bot/personalities/proposals/)" --> Lead
    GD -- "4a. Approved mechanics" --> Design
    Lead -- "5. Approved scope" --> Design
    Design -- "6. UI spec\n(bot/personalities/ui-specs/)" --> Dev
    Lead -- "7. Approved proposal" --> Dev
    Dev -- "8. Implementation done\n(code + rules.md)" --> Test
    Test -- "9a. Validation report\n(bot/personalities/test-reports/)" --> Dev
    Test -- "9b. Release-blocking verdict" --> Lead
    Test -- "9c. UI regressions" --> Design
    Lead -- "10. Ship decision" --> Mkt
    Mkt -- "11. Release notes\n(bot/personalities/releases/)" --> Lead

    style Chat fill:#334155,stroke:#94a3b8,color:#fff
    style Lead fill:#7c3aed,stroke:#a78bfa,color:#fff
    style Research fill:#0f766e,stroke:#5eead4,color:#fff
    style GD fill:#2563eb,stroke:#60a5fa,color:#fff
    style Design fill:#0ea5e9,stroke:#7dd3fc,color:#fff
    style Dev fill:#059669,stroke:#34d399,color:#fff
    style Test fill:#d97706,stroke:#fbbf24,color:#fff
    style Mkt fill:#dc2626,stroke:#f87171,color:#fff
```

## Artifact Directories

Each agent reads and writes to specific shared directories:

| Directory | Written by | Read by |
|-----------|-----------|---------|
| `bot/personalities/research/` | Researcher | Lead, Game Designer, Designer, Developer |
| `bot/personalities/sprints/` | Lead | Researcher, Game Designer, Designer, Developer |
| `bot/personalities/proposals/` | Game Designer | Lead, Designer, Developer, Tester |
| `bot/personalities/ui-specs/` | Designer | Lead, Developer, Tester |
| `bot/personalities/test-reports/` | Tester | Lead, Developer, Game Designer, Designer |
| `bot/personalities/releases/` | Marketing | Lead |
| `rules.md` | Developer (source of truth) | Everyone |

## Feature Lifecycle

```mermaid
sequenceDiagram
    participant L as Lead
    participant R as Researcher
    participant GD as Game Designer
    participant UX as Designer
    participant D as Developer
    participant T as Tester
    participant M as Marketing

    L->>R: Investigate problem / constraints
    R->>L: Research brief (bot/personalities/research/NNNN-name.md)
    R->>GD: Findings and constraints
    R->>UX: Player-flow findings
    L->>GD: Sprint brief with priorities
    GD->>GD: Study existing mechanics & rules
    GD->>L: Design proposal (bot/personalities/proposals/NNNN-name.md)
    L->>L: Review proposal
    alt Approved
        L->>UX: UI priorities and approved scope
        GD->>UX: Mechanics that need UI
        UX->>D: UI spec (bot/personalities/ui-specs/NNNN-name.md)
        L->>D: Mark proposal APPROVED
        D->>D: Implement in js/ + update rules.md
        D->>T: Feature ready for validation
        T->>T: Run deterministic browser check
        alt Bugs found
            T->>D: Bug report (bot/personalities/test-reports/)
            D->>D: Fix bugs
            D->>T: Fixed, revalidate
        end
        alt UI clarity issues
            T->>UX: UI regression / mismatch
            UX->>D: Updated spec or clarification
            D->>T: Revalidate
        end
        T->>L: Validation verdict
        L->>M: Feature approved for release
        M->>L: Release notes (bot/personalities/releases/)
        L->>L: Ship ✅
    else Rejected / Needs rework
        L->>GD: Feedback for revision
    end
```

## Conventions

### Proposal Files

`bot/personalities/proposals/NNNN-short-name.md` where NNNN is a zero-padded sequence number.

Structure:
```
# Proposal NNNN: Title
Status: DRAFT | REVIEW | APPROVED | SHIPPED
Author: Game Designer

## Summary
One paragraph.

## Detailed Design
Mechanics, numbers, interactions.

## New Pirates / Islands / Content
Tables with stats.

## Balance Rationale
Why these numbers work.

## Open Questions
```

### Sprint Files

`bot/personalities/sprints/NNNN.md` — written by Lead.

### Research Briefs

`bot/personalities/research/NNNN-short-name.md` — written by Researcher.

### Test Reports

`bot/personalities/test-reports/NNNN-short-name.md` — written by Tester after each validation run that needs a persistent report.

### UI Specs

`bot/personalities/ui-specs/NNNN-short-name.md` — written by Designer.

Structure:
```
# Test Report NNNN: Title
Scope: proposal / task / UI spec
Date: YYYY-MM-DD

## Verdict: PASS | FAIL | BLOCKED

## Commands
- ...

## Expected
- ...

## Actual
- ...
```

### Release Notes

`bot/personalities/releases/vX.Y.md` — written by Marketing.
