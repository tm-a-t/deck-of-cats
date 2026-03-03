# Agent Workflow — Deck of Cats

This document defines how the five agents collaborate on game development. Each agent is a Cursor subagent defined in `.cursor/agents/`.

## Agents

| Agent | File | Invoke | Role |
|-------|------|--------|------|
| **Lead** | `.cursor/agents/lead.md` | `/lead` | Prioritises work, reviews proposals and implementations, decides when a feature ships |
| **Game Designer** | `.cursor/agents/game-designer.md` | `/game-designer` | Invents mechanics, pirates, islands, captains; writes design proposals |
| **Developer** | `.cursor/agents/developer.md` | `/developer` | Implements approved designs in Phaser 3 code |
| **Tester** | `.cursor/agents/tester.md` | `/tester` | Plays the game in-browser, verifies correctness and fun factor |
| **Marketing** | `.cursor/agents/marketing.md` | `/marketing` | Writes release notes, store descriptions, positioning |

## Interaction Diagram

```mermaid
flowchart TD
    Lead["🎯 Lead\nPrioritises · Reviews · Ships"]
    GD["🎨 Game Designer\nInvents mechanics & content"]
    Dev["💻 Developer\nImplements in Phaser 3"]
    Test["🧪 Tester\nPlays & validates"]
    Mkt["📣 Marketing\nRelease notes & positioning"]

    Lead -- "1. Sprint brief\n(docs/sprints/)" --> GD
    GD -- "2. Design proposal\n(docs/proposals/)" --> Lead
    Lead -- "3. Approved proposal\n(stamp in proposal)" --> Dev
    Dev -- "4. Implementation done\n(code + game-rules.md)" --> Test
    Test -- "5a. Bug report\n(docs/test-reports/)" --> Dev
    Test -- "5b. Balance feedback\n(docs/test-reports/)" --> GD
    Test -- "5c. Ship-ready verdict" --> Lead
    Lead -- "6. Ship decision" --> Mkt
    Mkt -- "7. Release notes\n(docs/releases/)" --> Lead

    style Lead fill:#7c3aed,stroke:#a78bfa,color:#fff
    style GD fill:#2563eb,stroke:#60a5fa,color:#fff
    style Dev fill:#059669,stroke:#34d399,color:#fff
    style Test fill:#d97706,stroke:#fbbf24,color:#fff
    style Mkt fill:#dc2626,stroke:#f87171,color:#fff
```

## Artifact Directories

Each agent reads and writes to specific shared directories:

| Directory | Written by | Read by |
|-----------|-----------|---------|
| `docs/sprints/` | Lead | Game Designer, Developer |
| `docs/proposals/` | Game Designer | Lead, Developer |
| `docs/test-reports/` | Tester | Lead, Developer, Game Designer |
| `docs/releases/` | Marketing | Lead |
| `docs/game-rules.md` | Developer (source of truth) | Everyone |

## Feature Lifecycle

```mermaid
sequenceDiagram
    participant L as Lead
    participant GD as Game Designer
    participant D as Developer
    participant T as Tester
    participant M as Marketing

    L->>GD: Sprint brief with priorities
    GD->>GD: Research existing mechanics & rules
    GD->>L: Design proposal (docs/proposals/NNNN-name.md)
    L->>L: Review proposal
    alt Approved
        L->>D: Mark proposal APPROVED
        D->>D: Implement in js/ + update game-rules.md
        D->>T: Feature ready for testing
        T->>T: Play the game in browser
        alt Bugs found
            T->>D: Bug report (docs/test-reports/)
            D->>D: Fix bugs
            D->>T: Fixed, retest
        end
        alt Balance issues
            T->>GD: Balance feedback
            GD->>D: Adjusted numbers
            D->>D: Apply balance changes
            D->>T: Retest
        end
        T->>L: Ship-ready verdict
        L->>M: Feature approved for release
        M->>L: Release notes (docs/releases/)
        L->>L: Ship ✅
    else Rejected / Needs rework
        L->>GD: Feedback for revision
    end
```

## Conventions

### Proposal Files

`docs/proposals/NNNN-short-name.md` where NNNN is a zero-padded sequence number.

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

`docs/sprints/NNNN.md` — written by Lead.

### Test Reports

`docs/test-reports/NNNN-short-name.md` — written by Tester after each play session.

Structure:
```
# Test Report NNNN: Title
Proposal: NNNN
Date: YYYY-MM-DD

## Verdict: PASS | BUGS | BALANCE

## Bugs Found
- ...

## Balance Notes
- ...

## Fun Factor
Rating 1-5, commentary.
```

### Release Notes

`docs/releases/vX.Y.md` — written by Marketing.
