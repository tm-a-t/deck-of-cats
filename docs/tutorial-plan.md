# Tutorial Plan (Mixed Guidance, 5 Turns)

## High-Level Goals

- Keep gameplay deterministic for the tutorial path.
- Teach core loop: `sending -> ship -> shopping -> next turn`.
- Teach resource HUD timing on Turn 1:
  - after first send, show where gained loot appears (top bar);
  - after first `End landing`, explain ship-side (bottom) effects.
- Show x2 island modifiers in the first two turns.
- Buy featured pirate on Turn 3.
- Play featured pirate on Turn 4.
- Show forced mismatch on Turn 4 (`expected wood`, `actual coin`) while clearly explaining this can happen on **any** island.
- Defeat first boss on Turn 5.

## UX Rule Change

- Tutorial explanation text uses two formats:
  - one blocking popup at tutorial start;
  - non-blocking informer cards for most later reminders.
- Regular in-game phase text should remain normal gameplay text (no tutorial-only replacement in the phase line).
- Popups are instructional overlays that appear at key tutorial moments and must be dismissible with a clear `Got it` button.

## Non-Blocking Informer

- A compact top card that does **not** pause gameplay.
- Player can keep interacting while the card is visible.
- Includes close button `✕` and auto-hide timeout.

## Popup Visual Direction

- Paper-card popup with darkened backdrop.
- Header + body copy + short footer hint.
- Rounded corners, warm border, readable monospace body.
- Single clear action button: `Got it`.

## Featured Pirate

- Name: **Admiral Blackpowder**
- Cost: `5☠️`
- Strength: `3⚔️`
- Ship effect: `1🪙 -> +3💣`

## Deterministic Deck Setup

- Lumberjacks: `L1, L2, L3`
- Miners: `M1, M2, M3`
- Swabbies: `S1, S2, S3`
- Featured reference slot: `FEATURED` (filled after purchase on Turn 3)

## Popup Script (Exact Intent)

## Slide 1 (Turn 1, phase `sending`, blocking)

Title:
- `Captain's Log`

Body:
- `A rich run begins with brave landings.`
- `Send pirates ashore to gather loot and strengthen your crew.`
- `All gained resources appear in the top bar.`
- `Send 2 pirates.`

## Informer (Turn 1, after first sent pirate)

Title:
- `Loot Added`

Body:
- `Your pirate brought back loot.`
- `All gained resources are tracked in the top bar.`
- `Watch 🪵 🪨 🪙 and ☠️ there.`

## Informer (Turn 1, after first manual `End landing`)

Title:
- `Ship Effects`

Body:
- `Now ship pirates start acting.`
- `Pirates left on ship use their bottom effect.`

## Informer (Turn 3, phase `shopping`)

Title:
- `Shop = Stronger Deck`

Body:
- `Buying pirates is your long-term power.`
- `Stronger deck means easier resource turns and fights.`
- `Buy the pirate in shop.`

## Informer (Triggered right after forced mismatch on Turn 4)

Title:
- `Mismatch Happened`

Body:
- `Expected 🪵, got 🪙.`
- `This is normal on any island.`
- `Now use that 🪙 on ship.`

## Informer (Turn 5, phase `boarding`)

Title:
- `Final Boarding`

Body:
- `Power = crew ⚔️ + cannons 💣.`
- `If your power is at least enemy power, you win.`
- `Tap Board.`

## Turn-by-Turn Deterministic Script

## Turn 1/5

- Island: `Forest Island` (`x2 🪵`)
- Hand: `L1, M1, L2, M2, S1`
- Island sends: `L1`, `M1`
- Result after turn: `wood 2, stone 1, gold 0, cannons 0`

## Turn 2/5

- Island: `Rocky Island` (`x2 🪨`)
- Hand: `L2, M2, L3, M3, S2`
- Island sends: `L2`, `M2`
- Result after turn: `wood 3, stone 3, gold 0, cannons 0`

## Turn 3/5

- Island: `Calm Atoll` (no bonus)
- Hand: `L1, M1, L3, M3, S3`
- Island sends: `L1`, `M1`
- Ship resolves to exactly `5☠️`
- Shop: one item only (`Admiral Blackpowder`)
- Buy is mandatory before next turn
- Result after turn: `wood 0, stone 0, gold 0, cannons 0`

## Turn 4/5

- Island: `Calm Atoll` (normal island, no special mismatch rules)
- Hand: `FEATURED, S3, L3, M3, S1`
- `FEATURED` is blocked from island and must stay for ship phase
- Forced tutorial mismatch on `L3`:
  - expected `+1🪵`
  - actual `+1🪙`
- `M3` gives `+1🪨`
- Ship phase:
  - Admiral spends `1🪙` -> `+3💣`
- Result after turn: `wood 0, stone 1, gold 0, cannons 3`

## Turn 5/5

- Boarding phase
- Enemy strength: `9⚔️`
- Hand: `FEATURED, L1, L2, M1, M2`
- Power check: `7 crew + 3 cannon = 10⚔️`
- Tutorial ends with victory (`tutorialOutro`)

## Notes

- Forced mismatch is scripted only for tutorial clarity.
- Explanatory copy must state that unexpected loot can happen on any island in normal play.
- Small leftover resources after tutorial are allowed.
