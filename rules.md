# Deck of Cats — Game Rules

Source of truth for all gameplay mechanics.

---

## Overview

Genre: deck-building with pirate cats. Player assembles a crew (deck), sails a branching map, gathers resources on islands, arms the ship, and fights enemy ships in boarding battles.

---

## Starting Deck

10 pirates total:

| Name | Count |
|------|-------|
| Rigger | 5 |
| Ballaster | 5 |

Hand size: always draw 5. When the deck is empty, the discard pile is shuffled back into the deck.

---

## Round Flow

### 1. Map Phase

Player picks the next node on the map.
- If only 1 available node → auto-selected (no map modal).
- If 2+ available → map modal opens for manual selection.
- The **Map** button is always visible; outside the map phase it opens the map in read-only preview mode.

### 2a. Island Round

If the selected node is an island:

**Sending phase**:
- The hand is displayed as a fan of cards. Each card shows the pirate's portrait, name, and strength badge.
- Hover (desktop) or tap (mobile) a card to lift it and see its full stats tooltip.
- **Drag** a card upward toward the island to send that pirate ashore (replaces the old one-click-to-send).
- Cards that can be sent to the island have a green glow outline.
- Player sends 0–2 pirates from hand to the island.
- Port Island allows 3 (base 2 + 1 extra).
- Skull Island grants +2☠️ at round start (applied immediately when the node is selected).
- Siren Island: pirates sent are **permanently lost** after their island action resolves.
- Each pirate's island ability resolves on arrival (resource gathering, conversion, recall, etc.).
- Player ends the phase by pressing **End landing**, or it ends automatically when the maximum number of pirates have been sent.

**Ship phase**:
- Each pirate remaining on the ship (not sent to island) executes their ship action sequentially, in hand order.
- "Get lost" pirates are permanently removed when their turn comes.
- "Exile" pirates trigger selection: player picks a crew member (not from current hand) to permanently remove.
- Some pirates have no ship action.
- All others attempt to spend input resources and produce output resources/enthusiasm/weapons/cannons.

**Shopping phase**:
- Player may open the Shop modal to buy pirates for ☠️.
- When **Next round** is pressed:
  1. The first pirate in the shop window is removed, remaining shift left, a new random pirate enters from the right.
  2. Hand goes to discard (only pirates still in the crew; exiled pirates are gone).
  3. Enthusiasm resets to 0; resources persist.
  4. 5 new pirates drawn from deck.
  5. Return to map phase.

### 2b. Boarding Round

If the selected node is an enemy ship:
- All 5 pirates in hand participate; no island phase, no shop phase.
- **Crew strength** = sum of all hand pirates' ⚔️.
- **Ship bonus** = 🗡️ weapons + 💣 cannons.
- **Total strength** = crew strength + ship bonus.
- **Victory** (total ≥ enemy strength):
  - 🗡️ weapons reset to 0; 💣 cannons persist.
  - Hand discarded, draw 5 new, proceed to map phase.
  - If this was the final map node → **Victory screen**.
- **Defeat** (total < enemy strength):
  - **Game Over** screen.

---

## Map Generation

Total: **50 layers**, yielding **10 enemy ships** total.

### Early Game (layers 0–14): 3 segments

Each segment = 4 island layers + 1 battle layer = 5 layers. 3 segments = 15 layers.

- 3 parallel non-intersecting paths through each segment.
- All 3 paths converge at the battle node at the end of each segment.
- After a battle, paths fan back out to 3 for the next segment.

**Island restrictions in early game:**
- Layers 0–8: no Treasure Island, no Skull Island, no Siren Island.
- Layers 9–14: no Siren Island (Treasure and Skull are allowed).

**Early ship strength:**

| Ship # | Layer | Strength |
|--------|-------|----------|
| 1 | 4 | 6 |
| 2 | 9 | 12 |
| 3 | 14 | 19 |

### Mid/Late Game (layers 15–49)

- Non-ship layers have 2–3 island nodes (random).
- Ship nodes at layers 19, 24, 29, 34, 39, 44, 49 (every 5th layer).
- Siren Island can appear starting at layer 15 (50% chance per layer of being included in the island pool).
- Connections between layers: each node connects to 1–2 nodes in the next layer; every node in the next layer is reachable by at least one node in the current layer.

**Ship strength** (general formula): `trunc(shipNumber ^ 1.39 × 4 + 2)`

| Ship # | Layer | Approx. Strength |
|--------|-------|------------------|
| 4 | 19 | 28 |
| 5 | 24 | 37 |
| 6 | 29 | 48 |
| 7 | 34 | 59 |
| 8 | 39 | 71 |
| 9 | 44 | 84 |
| 10 | 49 | 97 |

### Victory Condition

Win the boarding at the final layer (layer 49, ship #10).

---

## Islands

| Name | Emoji | Effect |
|------|-------|--------|
| Forest Island | 🌲 | x2 🪵 yield |
| Rocky Island | ⛰️ | x2 🪨 yield |
| Treasure Island | 💎 | x2 🪙 yield |
| Port Island | ⚓ | Can send 3 pirates instead of 2 |
| Skull Island | 💀 | +2☠️ at round start |
| Siren Island | 🧜 | Pirates sent are permanently lost after their action |

**Island bonus doubling**: applies to any pirate's island yield that matches the island's bonus resource. Affects standard gathering, conversion outputs, and multi-resource outputs.

---

## Island Action Types

1. **Recall** (Quartermaster): returns the last-sent pirate from the island back to the hand.
2. **Exile Sent** (Marooner): permanently removes the previously-sent pirate on the island from the game. No effect if no one was sent before.
3. **Draw** (Lookout): draws 1 pirate from the deck into the hand.
4. **Guaranteed**: produces fixed resources or weapons with no chance of failure.
5. **Convert** (Trader, Profiteer): spends input resources, produces output resources. Output doubled by island bonus. Can only go ashore if the player has enough input resources.
6. **Chance-based**: standard resource gathering.
   - If target is gold and player has 🗺️: chance increases by +30% (capped at 95%), consumes 1 🗺️.
   - Island bonus doubles yield amount.
   - Bonus enthusiasm (e.g. Survivalist) is always granted regardless of success.
   - **On success**: gain target resource.
   - **On miss**: 1% chance to get 🗺️; otherwise get 1 of a random other resource (doubled by island bonus if matching).

---

## Ship Action Types

1. **Get Lost**: pirate is permanently removed from the game. No other effect.
2. **Exile from Deck** (Cutthroat): spend resources, then player picks a crew member (not from current hand) to permanently exile. No effect if resources insufficient or no valid targets.
3. **No action** (Herald): does nothing on ship.
4. **Free production** (Bosun, Corsair, etc.): generates enthusiasm, weapons, and/or cannons with no input cost.
5. **Resource conversion**: spend N of a resource (or weapons/cannons), produce enthusiasm + weapons/cannons. Fails silently if insufficient resources.

---

## Weapons & Cannons

| Type | Emoji | Effect | Persistence |
|------|-------|--------|-------------|
| Weapons | 🗡️ | +1⚔️ per weapon in next boarding | Reset to 0 after boarding (win or lose) |
| Cannons | 💣 | +1⚔️ per cannon in every boarding | Permanent |

Both are summed with crew strength during boarding.

---

## Shop

- **Window size**: 4 slots.
- **Pool**: all non-starter, non-tutorial pirate types (26 types).
- **Cost filtering**: max affordable cost = max(3, round + 1). Only pirates within that cost appear. Falls back to full pool if none qualify.
- **Buying**: costs ☠️ equal to the pirate's cost. New pirate goes directly into the deck (not hand). The bought slot is refilled with a new random pirate from the pool.
- **Next round rotation**: first pirate in the window is removed, remaining shift left, a new random pirate enters at the end.

---

## Pirate Types

### Starters

| Name | ⚔️ | Island | Ship |
|------|-----|--------|------|
| Rigger | 1 | 1🪵 (90%) | 4🪵 → 2☠️ |
| Ballaster | 1 | 1🪨 (90%) | 4🪨 → 2☠️ |

### Tutorial-Only

| Name | ⚔️ | Island | Ship |
|------|-----|--------|------|
| Trail Forager | 1 | → 1🪵 (guaranteed) | 1🪵 → 1☠️ |
| Deck Swabbie | 1 | Can't land | → 1☠️ |

### Tier 1: Early Upgrades (cost 2–5)

| Name | ☠️ | ⚔️ | Island | Ship |
|------|-----|-----|--------|------|
| Brute | 2 | 2 | → 1🗡️ | 1🪨 → 3☠️ |
| Whittler | 2 | 1 | → 2☠️ | 1🪵 → 3🗡️ |
| Corsair | 2 | 1 | → 2🗡️ | → 2☠️ |
| Herald | 2 | 2 | → 3☠️ | — (no ship action) |
| Deckhand | 2 | 1 | 1🪨 (90%) | → 1🗡️+1☠️ |
| Carpenter | 3 | 1 | 1🪵 (95%) | 2🪵 → 3🗡️+2☠️ |
| Stonemason | 3 | 1 | 1🪨 (95%) | 2🪨 → 1💣+2☠️ |
| Privateer | 3 | 2 | 1🪙 (45%) | 2🪙 → 6🗡️+4☠️ |
| Survivalist | 3 | 2 | 1🪵 (90%) +2☠️ | → 2☠️ |
| Raider | 4 | 2 | → 3🗡️ | 💀 get lost |
| Scrapper | 4 | 2 | → 2🗡️ | 1💣 → 4🪨+3☠️ |
| Blacksmith | 4 | 2 | 1🪵 (90%) | 2🗡️ → 1💣+3☠️ |
| Lookout | 4 | 0 | Draw 1 pirate | 1🪵 → 3🗡️ |
| Bosun | 5 | 1 | Can't land | → 3☠️ |
| Cutthroat | 5 | 3 | → 1☠️ | 2🪙 → exile pirate |
| Profiteer | 5 | 1 | 1🪙 → 2🪙 | 💀 get lost |

### Tier 2: Mid-Game (cost 6–10)

| Name | ☠️ | ⚔️ | Island | Ship |
|------|-----|-----|--------|------|
| Marooner | 6 | 0 | Exile previous pirate on island | → 3🗡️ |
| Drifter | 6 | 0 | → 2🪵 | 💀 get lost |
| Trader | 7 | 1 | 3🪵 → 3🪨 | 1🪨 → 4☠️ |
| Woodsman | 7 | 2 | 1🪵 (90%) | 2🪵 → 6🗡️+4☠️ |
| Prospector | 7 | 2 | 1🪨 (90%) | 2🪨 → 2💣+4☠️ |
| Smuggler | 8 | 2 | 1🪙 (45%) | 1🪙 → 5☠️ |
| Explorer | 9 | 1 | 1🪙 (65%) | 1🪙 → 6☠️ |
| Quartermaster | 10 | 4 | Recall 1 pirate from island | → 2☠️ |

### Tier 3: Late-Game (cost 13)

| Name | ☠️ | ⚔️ | Island | Ship |
|------|-----|-----|--------|------|
| Master Rigger | 13 | 3 | 2🪵 (90%) | 2🪵 → 9🗡️+4☠️ |
| Master Ballaster | 13 | 3 | 2🪨 (90%) | 2🪨 → 3💣+4☠️ |

### Special Abilities Detail

**Recall** (Quartermaster): when sent to island, returns the last-sent pirate from the island back to the hand.

**Exile Sent** (Marooner): when sent to island, permanently removes the previously-sent pirate on the island from the game. No effect if no one was sent before.

**Draw** (Lookout): when sent to island, draws 1 pirate from the deck into the hand.

**Convert** (Trader: 3🪵→3🪨; Profiteer: 1🪙→2🪙): converts resources. Output doubled by matching island bonus. Can only go ashore if the player has enough input resources.

**Get Lost** (Raider, Profiteer, Drifter): ship action permanently removes them from the game. Their island action works normally.

**Exile from Deck** (Cutthroat): ship action spends 2🪙, then player selects any crew member not in the current hand to permanently remove from the game.

**Siren Island interaction**: any pirate sent to Siren Island executes their island action normally, then is permanently removed from the game afterward.

**Survivalist bonus**: island action grants 1🪵 (90% chance) **plus** a guaranteed +2☠️ regardless of success.

---

## Treasure Map (🗺️)

- Obtained: 1% chance on a missed island gathering roll.
- Effect: when a pirate targeting gold goes ashore, if the player has 🗺️, gold chance increases by +30% (capped at 95%), consuming 1 🗺️.

---

## Resources

| Emoji | Name | Use |
|-------|------|-----|
| 🪵 | Wood | Ship actions input; weapon production |
| 🪨 | Stone | Ship actions input; cannon production |
| 🪙 | Gold | Ship actions input; high-tier conversions |
| 🗺️ | Treasure Map | Auto-consumed for +30% gold chance |
| ☠️ | Enthusiasm | Buy pirates in shop (resets each round) |
| 🗡️ | Weapons | Temporary ⚔️ bonus (resets after boarding) |
| 💣 | Cannons | Permanent ⚔️ bonus |

---

## Tutorial

Activated from the menu:
- Crew: 1 Trail Forager + 4 Deck Swabbies.
- Fixed island: Training Cove (max 1 pirate ashore).
- Fixed shop: Carpenter, Quartermaster, Master Rigger, Master Ballaster.
- Steps: landing → shop → boss #1 (winnable) → boss #2 (unwinnable) → outro.
- Boss 1 strength is set so the player wins; Boss 2 is set so they lose.
- After outro, player can start a real game.

No map in tutorial mode.

---

## Streak

Tracks consecutive days played. Displayed on the main menu. Purely cosmetic.
