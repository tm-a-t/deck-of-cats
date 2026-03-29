# Deck of Cats — Game Rules

Source of truth for all gameplay mechanics.

---

## Overview

Genre: deck-building with pirate cats. Player assembles a crew (deck), sails a branching map, gathers resources on islands, arms the ship, and fights enemy ships in boarding battles.

---

## Regular Run Starting Deck

10 pirates total:

| Name | Count |
|------|-------|
| Rigger | 4 |
| Ballaster | 4 |
| Armsman | 2 |

Hand size: draw up to 5. When the deck is empty, the discard pile is shuffled back into the deck. If fewer than 5 crew remain, the new hand is smaller.

---

## Regular Run Flow

### 1. Map Phase

Player picks the next node on the map.
- If only 1 available node → auto-selected.
- If 2+ available → player chooses among the available nodes.

### 2a. Island Round

If the selected node is an island:

**Sending phase**:
- Player sends 0–2 pirates from hand to the island.
- Port Island allows 3 (base 2 + 1 extra).
- Skull Island grants +2☠️ at round start (applied immediately when the node is selected).
- Siren Island: pirates sent are **permanently lost** after their island action resolves.
- Each pirate's island ability resolves on arrival (resource gathering, conversion, recall, etc.).
- Send animation/effect resolution is non-blocking: while one pirate is traveling/resolving, player may send another immediately.
- Ship phase starts only after all already-triggered island actions finish resolving and the player clicks `Work on Ship`.
- Player may stop sending early with `End`, or use all allowed sends and then click `Work on Ship` to begin ship actions.

**Ship phase**:
- Each pirate remaining on the ship (not sent to island) executes their ship action sequentially, in hand order.
- "Get lost" pirates are permanently removed when their turn comes.
- "Exile" pirates trigger selection: player picks a crew member (not from current hand) to permanently remove.
- Some pirates have no ship action.
- All others attempt to spend input resources and produce output resources, enthusiasm, and/or specific weapons.

**Shopping phase**:
- After ship effects finish, the round enters shopping.
- Player may buy pirates for ☠️; bought pirates go straight to the discard pile, not the hand.
- When the player continues from shopping:
  1. The first pirate in the shop window is removed, remaining shift left, a new random pirate enters from the right.
  2. Hand goes to discard (only pirates still in the crew; exiled pirates are gone).
  3. Enthusiasm resets to 0; resources persist.
  4. Up to 5 new pirates are drawn from deck.
  5. Return to map phase.

### 2b. Boarding Round

If the selected node is an enemy ship:
- All pirates currently in hand participate; no island phase, no shop phase.
- Boarding starts with a **setup step**:
  - All player pirates are shown immediately as compact mini cards.
  - Initial setup places melee pirates in the front row and ranged pirates in the middle row.
  - Player may drag those mini cards to rearrange pirates arbitrarily across the front, middle, and back rows, including left-to-right order within a row.
  - Player may inspect a pirate by hovering/tapping that mini card.
  - Weapons are **not** assigned here; each pirate uses their permanently equipped weapon, if any.
- Pirate combat stats in this prototype:
  - Damage = the pirate's printed ⚔️.
  - For the current prototype pass, **every pirate has 3⚔️**.
  - HP = 9 for every pirate.
  - Attack speed = one shared base speed for all pirates.
  - Pirate actions can equip these permanent weapons before boarding:
    - `🔨 Hammer`: melee, **+4 HP**.
    - `🪓 Axe`: melee, hits the whole opposing front row at once.
    - `🏹 Bow`: ranged, targets the living enemy with the **lowest current HP** in any row.
    - `🔫 Musket`: ranged, targets the living enemy with the **highest current HP** in any row, deals **+2 damage**, and attacks **60% slower**.
    - `🪝 Hookshot`: ranged, attacks **45% slower**, targets a random living enemy in the **backmost enemy row**, deals **0 damage**, and pulls that target to the front row without cycling the rest of the formation.
    - `⛓️ Chain`: melee, deals **0 damage** and delays the target's next attack by **1.0s**.
    - `🗡️ Dirk`: melee, deals normal damage and applies bleed for **1 damage three times**, once every **0.7s**.
    - `🔱 Trident`: melee, deals normal damage and then heals every living ally in the next row behind the attacker for **1 HP**.
    - `⚓ Anchor`: melee, deals **6 damage**, minus **1 damage** for each other living ally in the attacker's row.
    - `🧨 Bomb Lance`: melee, deals **8 damage** but only strikes **once** per boarding.
    - `🥏 Chakram`: ranged, deals **2 damage** on its first shot and gains **+1 damage** after each shot in that boarding.
- Enemy boarding parties are generated independently of the map node's legacy `strength` value:
  - Encounters use 3–5 enemies drawn from this roster:
    - `🛡️ Shellback`: melee, 18 HP, 4 damage, attacks slowly, and while alive its row takes **2 less damage** from row-wide attacks, to a minimum of **1**.
    - `🎯 Deck Sniper`: ranged, 9 HP, 4 damage, attacks quickly, and targets the **backmost armed pirate**; if nobody is armed, it targets the backmost pirate.
    - `🪤 Netter`: ranged, 12 HP, 3 damage, targets the **backmost pirate**, and delays that pirate's next attack by **0.35s** on hit, or **1.2s** if that pirate is ranged.
    - `🔥 Flint Duelist`: melee, 11 HP, 5 damage, and if it survives a **single hit of 5+ damage**, its next attack becomes ready in **0.22s**.
    - `💣 Powder Bomber`: melee, 17 HP, 4 damage, explodes on death and deals 4 damage to the pirate front row.
  - A random boarding usually centers on **one main enemy type**, with at most a small side group from one other type.
  - Each enemy party is distributed across up to 3 rows with a variable split.
  - Enemy rows are always filled from the **front backward**; random setup never leaves an empty front or middle row with enemies behind it.
  - Ranged enemies prefer the deeper occupied rows, especially the back row when one exists.
  - Difficulty scales by **boarding count** through party size and unlocked enemy types; enemy stats stay at their printed values.
  - Early boardings use `🛡️ Shellback`, `🎯 Deck Sniper`, and `💣 Powder Bomber`; `🪤 Netter` unlocks starting at boarding **4**, and `🔥 Flint Duelist` unlocks starting at boarding **6**.
- Combat resolution:
  - Both crews attack automatically once `Fight!` is pressed.
  - Setup already uses the compact mini-card layout; pressing `Fight!` starts the autoplay battle from that same layout.
  - Boarding formations use up to 3 centered rows per side: front, middle, and back.
  - Any number of fighters may start in a given row.
  - The current front row is always the frontmost living row.
  - If a whole row is defeated, any rows behind it slide forward to fill the gap.
  - Melee fighters can only attack while they are in the current front row.
  - Ranged fighters can attack from any living row.
  - Every fighter gets a tiny random initial delay, then keeps attacking until dead.
  - Across the whole boarding, only one attack may start every **0.3s**.
  - A fighter's own attack cooldown is still based on that fighter's attack speed from its previous attack.
  - A fighter cannot begin an attack while another attack is currently targeting them.
  - Default melee attacks target a random living enemy in the opposing front row, within that fighter's positional band.
  - Positional band rule: if a fighter is position `X` out of `N` living front-row allies and the opposing front row has `M` living enemies, the target band is the enemy indices from `floor((X-1)*M/N)` through `ceil(X*M/N)-1`, clamped to the living opposing front row.
  - `🪓 Axe` attacks hit every living enemy in the opposing front row at once.
  - `🏹 Bow` and `🔫 Musket` ignore rows and target across the whole enemy formation using lowest/highest current HP.
  - `🪝 Hookshot` deals no damage and pulls a target from the backmost enemy row to the front row before later attacks resolve, without cycling the rest of the formation.
  - `⛓️ Chain` delays the surviving target's next attack by **1.0s**.
  - `🗡️ Dirk` adds bleed, which deals **1 damage** every **0.7s** for **3 ticks**; a fresh dirk hit refreshes that bleed.
  - `🔱 Trident` heals every living ally in the next row behind the attacker for **1 HP** after each attack.
  - `⚓ Anchor` uses **6 base damage** and loses **1 damage** for each other living ally in the attacker's row.
  - `🧨 Bomb Lance` uses the normal front-row band target rule, deals **8 damage**, and then cannot attack again that boarding.
  - `🥏 Chakram` uses the normal front-row band target rule, starts at **2 damage**, and gains **+1 damage** after each shot.
  - `🛡️ Shellback` reduces row-wide hit damage by **2** for every living enemy in its row, to a minimum of **1** damage.
  - `🎯 Deck Sniper` targets the backmost armed pirate first.
  - `🪤 Netter` targets the backmost pirate and delays ranged targets longer than melee targets.
  - `🔥 Flint Duelist` reacts only to **single-target** hits of **5+ damage** that it survives; row-wide hits do not trigger it.
  - Enemy death effects resolve immediately after the attack that killed them. A `💣 Powder Bomber` explosion hits every pirate in the current front row for 4 damage.
  - Bleed ticks resolve during autoplay and can kill fighters between attacks.
- **Victory**:
  - Equipped weapons persist.
  - No combat casualties persist.
  - Hand discarded, draw up to 5 new pirates, proceed to map phase.
  - If this was the final map node → **Victory screen**.
- **Defeat**:
  - **Game Over** screen.
- **Battle Test**:
  - Always starts with 5 pirates so the row-rearranging setup is fully available.
  - Some pirates begin pre-equipped so the weapon behaviors are visible immediately.
  - After the result screen, `Repeat` reruns the exact same crew, enemy party, and pre-fight formation. `Another Battle` rolls a fresh random test.

---

## Map Generation

Total: **50 layers**, yielding **10 enemy ships** total.

### Early Game (layers 0–14): 3 segments

Each segment = 4 island layers + 1 battle layer = 5 layers. 3 segments = 15 layers.

- Segment 1 (layers 0–3) is a single mandatory path with no route choice before the first battle.
- Segments 2 and 3 use 3 parallel non-intersecting paths.
- All available paths converge at the battle node at the end of each segment.
- After a battle, paths fan back out to 3 for the next segment.

**Island restrictions in early game:**
- Layers 0–8: no Treasure Island, no Skull Island, no Siren Island.
- Layers 9–14: no Siren Island (Treasure and Skull are allowed).

**Boarding difficulty note:**
- Ship nodes still appear at the same layers.
- The old map `strength` values are currently ignored by boarding resolution.
- Prototype boarding difficulty scales with **boarding count** through party size and unlocked enemy types.

### Mid/Late Game (layers 15–49)

- Non-ship layers have 2–3 island nodes (random).
- Ship nodes at layers 19, 24, 29, 34, 39, 44, 49 (every 5th layer).
- Siren Island can appear starting at layer 15 (50% chance per layer of being included in the island pool).
- Connections between layers: each node connects to 1–2 nodes in the next layer; every node in the next layer is reachable by at least one node in the current layer.

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

**Island bonus doubling**: applies to chance-based gathering, conversion outputs, and multi-resource outputs that match the island's bonus resource.

---

## Island Action Types

1. **Recall** (Quartermaster): returns the last-sent pirate from the island back to the hand.
2. **Exile Sent** (Marooner): permanently removes the previously-sent pirate on the island from the game. No effect if no one was sent before.
3. **Guaranteed**: produces fixed resources or weapons with no chance of failure.
4. **Convert** (Trader, Profiteer): spends input resources, produces output resources. Output doubled by island bonus. Can only go ashore if the player has enough input resources.
5. **Chance-based**: standard resource gathering.
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
4. **Free production** (Bosun, Corsair, etc.): generates enthusiasm and/or specific weapons with no input cost.
5. **Resource conversion**: spend N of a resource, produce resources, enthusiasm, and/or specific weapons. Fails silently if insufficient resources.

---

## Weapons

| Type | Emoji | Effect | Persistence |
|------|-------|--------|-------------|
| Weapon gain | `🔨` / `🪓` / `🏹` / `🔫` / `🪝` / `⛓️` / `🗡️` / `🔱` / `⚓` / `🧨` / `🥏` | When a pirate action produces a weapon, it creates that exact weapon. During the same round, the player may assign it to any unarmed pirate from the current hand, including pirates already sent to the island. If skipped, the weapon is lost | Never enters inventory |
| Hammer | 🔨 | Melee weapon; keeps the pirate's attack unchanged and gives **+4 HP** in every boarding while equipped | Stays on that pirate until that pirate leaves the crew |
| Axe | 🪓 | Melee weapon; each swing hits the whole opposing front row | Stays on that pirate until that pirate leaves the crew |
| Bow | 🏹 | Ranged weapon; targets the living enemy with the **lowest current HP** in any row | Stays on that pirate until that pirate leaves the crew |
| Musket | 🔫 | Ranged weapon; targets the living enemy with the **highest current HP**, deals **+2 damage**, and attacks **60% slower** | Stays on that pirate until that pirate leaves the crew |
| Hookshot | 🪝 | Ranged weapon; attacks **45% slower**, targets a random living enemy in the backmost enemy row, deals **0 damage**, and pulls that target to the front row without cycling the rest of the formation | Stays on that pirate until that pirate leaves the crew |
| Chain | ⛓️ | Melee weapon; deals **0 damage** and delays the target's next attack by **1.0s** | Stays on that pirate until that pirate leaves the crew |
| Dirk | 🗡️ | Melee weapon; deals normal damage and applies bleed for **1 damage three times**, once every **0.7s**; a fresh dirk hit refreshes that bleed | Stays on that pirate until that pirate leaves the crew |
| Trident | 🔱 | Melee weapon; deals normal damage and then heals every living ally in the next row behind the attacker for **1 HP** | Stays on that pirate until that pirate leaves the crew |
| Anchor | ⚓ | Melee weapon; deals **6 damage**, minus **1 damage** for each other living ally in the attacker's row | Stays on that pirate until that pirate leaves the crew |
| Bomb Lance | 🧨 | Melee weapon; uses the normal front-row band target rule, deals **8 damage**, and only strikes **once** per boarding | Stays on that pirate until that pirate leaves the crew |
| Chakram | 🥏 | Ranged weapon; uses the normal front-row band target rule, starts at **2 damage**, and gains **+1 damage** after each shot in that boarding | Stays on that pirate until that pirate leaves the crew |

---

## Shop

- Shop uses a 4-slot window.
- Pool: all non-starter pirates (23 types).
- **Regular-run cost filtering**: max offered cost = max(3, round + 1). Only pirates within that cost appear. Falls back to full pool if none qualify.
- **Buying**: costs ☠️ equal to the pirate's cost. New pirate goes directly into the discard pile (not hand). The bought slot is refilled with a new random pirate from the pool.
- **Next round rotation**: the first pirate in the window is removed, remaining pirates shift left, and a new random pirate enters at the end.

---

## Pirate Types

### Starters

| Name | ⚔️ | Island | Ship |
|------|-----|--------|------|
| Rigger | 3 | 1🪵 (90%) | 4🪵 → 2☠️ |
| Ballaster | 3 | 1🪨 (90%) | 4🪨 → 2☠️ |
| Armsman | 3 | → 🔨 | — |

### Tier 1: Early Upgrades (cost 2–5)

| Name | ☠️ | ⚔️ | Island | Ship |
|------|-----|-----|--------|------|
| Brute | 2 | 3 | → 🔨 | 1🪨 → 3☠️ |
| Whittler | 2 | 3 | → 2☠️ | 1🪵 → 🥏 |
| Corsair | 2 | 3 | → 🪓🪓 | → 2☠️ |
| Herald | 2 | 3 | → 3☠️ | — (no ship action) |
| Deckhand | 2 | 3 | 1🪨 (90%) | → 🔨+1☠️ |
| Carpenter | 3 | 3 | 1🪵 (95%) | 2🪵 → 🪓+2☠️ |
| Stonemason | 3 | 3 | 1🪨 (95%) | 2🪨 → ⛓️+2☠️ |
| Privateer | 3 | 3 | 1🪙 (45%) | 2🪙 → 🔫🔫+4☠️ |
| Survivalist | 3 | 3 | 1🪵 (90%) +2☠️ | → 🔱+1☠️ |
| Raider | 4 | 3 | → 🪓🪓 | 💀 get lost |
| Bosun | 5 | 3 | Can't land | → 3☠️ |
| Cutthroat | 5 | 3 | → 1☠️ | 2🪙 → exile pirate |
| Profiteer | 5 | 3 | 1🪙 → 2🪙 | 💀 get lost |

### Tier 2: Mid-Game (cost 6–10)

| Name | ☠️ | ⚔️ | Island | Ship |
|------|-----|-----|--------|------|
| Marooner | 6 | 3 | Exile previous pirate on island | → 🗡️ |
| Drifter | 6 | 3 | 2🪵 (90%) | 💀 get lost |
| Trader | 7 | 3 | 3🪵 → 3🪨 | 1🪨 → ⚓+2☠️ |
| Woodsman | 7 | 3 | 1🪵 (90%) | 2🪵 → 🏹🏹+4☠️ |
| Prospector | 7 | 3 | 1🪨 (90%) | 2🪨 → 🧨🧨+4☠️ |
| Smuggler | 8 | 3 | 1🪙 (45%) | 1🪙 → 5☠️ |
| Explorer | 9 | 3 | 1🪙 (65%) | 1🪙 → 6☠️ |
| Quartermaster | 10 | 3 | Recall 1 pirate from island | → 2☠️ |

### Tier 3: Late-Game (cost 13)

| Name | ☠️ | ⚔️ | Island | Ship |
|------|-----|-----|--------|------|
| Master Rigger | 13 | 3 | 2🪵 (90%) | 2🪵 → 🪝🪝+4☠️ |
| Master Ballaster | 13 | 3 | 2🪨 (90%) | 2🪨 → 🔫🔫+4☠️ |

### Special Abilities Detail

**Recall** (Quartermaster): when sent to island, returns the last-sent pirate from the island back to the hand.

**Exile Sent** (Marooner): when sent to island, permanently removes the previously-sent pirate on the island from the game. No effect if no one was sent before.

**Convert** (Trader: 3🪵→3🪨; Profiteer: 1🪙→2🪙): converts resources. Output doubled by matching island bonus. Can only go ashore if the player has enough input resources.

**Chance-based gatherers** (including Drifter: 2🪵 at 90%): follow the standard gather roll. On a miss, they may still bring back a different resource or a 🗺️.

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
| 🪨 | Stone | Ship actions input; weapon production |
| 🪙 | Gold | Ship actions input; high-tier conversions |
| 🗺️ | Treasure Map | Auto-consumed for +30% gold chance |
| ☠️ | Enthusiasm | Buy pirates in shop (resets each round) |

## Streak

Tracks consecutive days played. Displayed on the main menu. Purely cosmetic.
