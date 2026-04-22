# Deck of Cats — Game Rules

Source of truth for all gameplay mechanics currently implemented in `js/`.

## Core Premise

- Deck-builder about pirate cats.
- Base resources: `🪵 wood`, `🪨 stone`, `🪙 gold`, `☠️ enthusiasm`.
- Island actions are now deterministic. The old miss chances, treasure maps, temporary swords, and permanent cannons are gone.
- Ship actions now mostly produce `☠️` and permanent personal weapons. Those weapons stay on individual pirates until that pirate leaves the crew, and they define boarding behavior.

## Regular Run Start

- Starting deck: 10 pirates.
- Starting resources and `☠️`: `0`.
- Starting hand: up to 5 pirates.
- Starting shop: 4 random pirates from `SHOP_POOL` with `cost <= 3`.
- When the deck is empty, the whole discard pile is shuffled back into the deck. If fewer than 5 pirates remain, the new hand is simply smaller.

| Pirate | Count | Island | Ship |
|---|---:|---|---|
| Rigger | 4 | 🪵 | 4🪵 → ☠️☠️ |
| Ballaster | 4 | 🪨 | 4🪨 → ☠️☠️ |
| Armsman | 2 | 🔨 | — |

## Regular Run Flow

### 1. Map

- Runs begin in phase `map`.
- If only 1 next node is available, it is auto-selected.
- If 2+ nodes are available, the player chooses on the map.
- When a node is selected, `round` increases by 1, `☠️` resets to `0`, and resources persist.
- Outside `phase = map`, the map is preview-only; node selection works only during the map phase.

### 2. Island Round

- If the chosen node is an island, the round enters phase `sending`.
- By default the player may send up to 2 pirates.
- `Port Island` adds `+1`, so the maximum becomes 3.
- Sending is animated, but the player may send the next pirate immediately without waiting for the previous effect to finish.
- Each sent pirate resolves its island action as soon as it lands.
- The player may stop early with `End`. Once the send limit is filled, the button becomes `Work on Ship`.
- Pirates with island conversion cannot be sent unless the input resource is available.
- `Bosun` cannot go ashore at all.
- On `Siren Island`, a pirate resolves its island action first and is then permanently removed from the crew.
- Island bonuses double only matching resource outputs (`wood`, `stone`, `gold`). They do not double guaranteed effects, `☠️`, recall/exile effects, or weapon grants.

### 3. Ship Round

- After `End` or `Work on Ship`, every unsent pirate resolves its ship action in current hand order.
- A ship action may:
  - do nothing;
  - spend resources and produce resources, `☠️`, and weapons;
  - remove itself (`get lost`);
  - trigger an exile pick from the overall crew.
- If a ship action cannot pay its cost, it simply fails.
- `Cutthroat` pauses ship resolution and enters phase `removing`: the player chooses 1 pirate from `allCrew` that is not in the current hand and permanently exiles it.
- Weapon grants are assigned immediately, one by one, to any pirate from the current hand, including pirates already sent to the island. A newly assigned weapon replaces the old one.

### 4. Shop

- The shop appears only after island rounds. There is no shop after boarding.
- The shop always has 4 slots. Starters (`Rigger`, `Ballaster`, `Armsman`) are never sold there.
- `randomShopType(round)` selects from `SHOP_POOL` with `cost <= max(3, round + 1)`.
- The initial display is created as `initialShop(4, 0)`.
- Immediate refills after purchases use the current `G.round`.
- The end-of-shop refresh (`Continue`) removes the leftmost slot, shifts the rest left, and adds one new pirate using the next-round rule: `randomShopType(G.round + 1)`.
- Bought pirates go straight to discard, not to hand.
- The player may buy any number of pirates as long as enough `☠️` remains.
- On `Continue`:
  - the current hand goes to discard only for pirates still present in `allCrew`;
  - exiled and `get lost` pirates do not return;
  - `☠️` resets to `0`;
  - a new hand is drawn up to 5;
  - the run returns to `map`.

### 5. Boarding Round

- Ship nodes move the game directly into `phase = boarding`.
- The old "sum team strength against ship strength" system no longer exists.
- Ship nodes still store a numeric `strength` field, but current combat uses a generated enemy boarding party instead of a direct strength comparison.
- Before the fight, the current hand is packed into a compact 3-row formation.
- The player may drag pirates between rows and reorder them left-to-right.
- Default player setup:
  - armed ranged pirates begin in the middle row;
  - everyone else begins in the front row.
- `Fight!` starts autoplay combat.
- All pirates share the same base combat stats before weapon modifiers: `9 HP`, `3 damage`, `1350 ms attack`, melee/front-row behavior.
- Combat casualties are not permanent.
- After a win, the whole current hand goes to discard, a new hand is drawn, and the player returns to the map.
- After a loss, the run goes to `Game Over`.
- Winning the final ship on layer 29 ends the run with the `Victory` screen.

## Islands

| Island | Effect |
|---|---|
| Forest Island 🌲 | Doubles island output of `🪵` |
| Rocky Island ⛰️ | Doubles island output of `🪨` |
| Treasure Island 💎 | Doubles island output of `🪙` |
| Port Island ⚓ | Lets the player send 3 pirates instead of 2 |
| Skull Island 💀 | Grants `☠️☠️` immediately when the node is selected |
| Siren Island 🧜 | Every sent pirate is permanently lost after its island effect |

## Pirates

| Pirate | Cost | Island | Ship |
|---|---:|---|---|
| Rigger | — | 🪵 | 4🪵 → ☠️☠️ |
| Ballaster | — | 🪨 | 4🪨 → ☠️☠️ |
| Armsman | — | 🔨 | — |
| Carpenter | 3 | 🪵 | 🪵🪵 → ☠️☠️+🪓 |
| Stonemason | 3 | 🪨 | 🪨🪨 → ☠️☠️+⛓️ |
| Brute | 2 | 🔨 | 🪨 → ☠️☠️☠️ |
| Whittler | 2 | ☠️☠️ | 🪵 → 🥏 |
| Corsair | 2 | 🔨🔨 | ☠️☠️ |
| Privateer | 3 | 🪙 | 🪙🪙 → 4☠️+🔫🔫 |
| Herald | 2 | ☠️☠️☠️ | — |
| Deckhand | 2 | 🪨 | ☠️+🔨 |
| Bosun | 5 | — | ☠️☠️☠️ |
| Cutthroat | 5 | ☠️ | 🪙🪙 → exile pirate |
| Quartermaster | 10 | recall 1 pirate | ☠️☠️ |
| Trader | 7 | 3🪵 → 3🪨 | 🪨 → ☠️☠️+⚓ |
| Woodsman | 7 | 🪵 | 🪵🪵 → 4☠️+🏹🏹 |
| Prospector | 7 | 🪨 | 🪨🪨 → 4☠️+🧨🧨 |
| Smuggler | 8 | 🪙 | 🪙 → 6☠️+🪵+🪨 |
| Explorer | 9 | 🪙 | 🪙 → 5☠️+🔱 |
| Master Rigger | 13 | 🪵🪵 | 🪵🪵 → 4☠️+🪝🪝 |
| Master Ballaster | 13 | 🪨🪨 | 🪨🪨 → 4☠️+🔫🔫 |
| Raider | 4 | 🪓🪓 | get lost |
| Profiteer | 5 | 🪙 → 🪙🪙 | get lost |
| Drifter | 6 | 🪵🪵 | get lost |
| Marooner | 6 | exile previous | 🗡️ |
| Survivalist | 3 | 🪵+☠️☠️ | ☠️☠️ |

### Special Island Notes

- `Quartermaster`: recalls the most recently sent earlier pirate.
- `Marooner`: permanently exiles the pirate sent immediately before it.
- `Profiteer`: on `Treasure Island`, its gold output is doubled, so `🪙 → 4🪙`.

## Weapons

- Weapon grants never enter a shared inventory.
- Each granted weapon must be assigned immediately to one pirate in the current hand.
- If that pirate already had a weapon, the old weapon is replaced.
- Weapons stay on that pirate until that pirate leaves the crew.

| Weapon | Effect |
|---|---|
| 🔨 Hammer | Melee. `+4 HP` |
| 🪓 Axe | Melee. Hits the whole opposing front row |
| 🏹 Bow | Ranged. Targets the living enemy with the lowest HP |
| 🔫 Musket | Ranged. Targets the living enemy with the highest HP, gives `+2 damage`, attacks `1.6x` slower |
| 🪝 Hookshot | Ranged. Deals `0 damage`, attacks `1.45x` slower, and pulls a random target from the enemy back row into the front row |
| ⛓️ Chain | Melee. Deals `0 damage` and delays the target's next attack by `1000 ms` |
| 🗡️ Dirk | Melee. Normal hit plus bleed: `1 damage` three times every `700 ms` |
| 🔱 Trident | Melee. After hitting, heals the row behind the attacker for `1 HP` |
| ⚓ Anchor | Melee. Base `6 damage`, then `-1 damage` for each other living ally in the same row |
| 🧨 Bomb Lance | Melee. `8 damage`, but only 1 attack for the whole boarding |
| 🥏 Chakram | Ranged. Starts at `2 damage`, then gains `+1 damage` after each of its own attacks in that boarding |

## Boarding Combat

- Each side can occupy up to 3 rows: front, middle, back.
- The front row is always the first living row. If an entire row dies, rows behind it automatically become the new front.
- Melee fighters can attack only from the current front row.
- Ranged fighters can attack from any living row.
- Every fighter gets a random initial delay of `80–260 ms`.
- Across the whole boarding, only one new attack may begin every `300 ms`.
- A fighter cannot begin its own attack while another attack is currently resolving against it.
- Default `frontBand` targeting:
  - if the attacker is position `X` among `N` living allies in its front row and the opposing front row has `M` living targets, then it randomly picks within `floor((X-1)*M/N)` through `ceil(X*M/N)-1`.
- Multi-target row hits lose `2 damage` per target if a living `Shellback` is present in that row. Damage never drops below `1`.
- `Powder Bomber` explodes immediately on death and deals `4 damage` to the player's current front row.
- Bleed ticks during autoplay and can kill fighters between normal attacks.

## Enemy Boarding Parties

| Enemy | Stats | Behavior |
|---|---|---|
| 🐀 Bilge Rat | 6 HP, 2 damage, 1100 ms | Fast weak melee |
| 🔔 Cabin Boy | 5 HP, 2 damage, 1250 ms | Weak ranged; hits the backmost pirate |
| 🛡️ Shellback | 18 HP, 4 damage, 1450 ms | Strong melee; reduces row-wide damage taken by its row by 2 |
| 🎯 Deck Sniper | 9 HP, 4 damage, 950 ms | Strong ranged; targets the backmost armed pirate, otherwise the backmost pirate |
| 🪤 Netter | 12 HP, 3 damage, 1350 ms | Strong ranged; targets the backmost pirate and delays the next attack by `350 ms`, or `1200 ms` if that target is ranged |
| 🔥 Flint Duelist | 11 HP, 5 damage, 1050 ms | Strong melee; if it survives a single-target hit of `5+ damage`, its next attack comes up in `220 ms` |
| 💣 Powder Bomber | 17 HP, 4 damage, 1250 ms | Strong melee; explodes on death for `4 damage` to the player's front row |

### Encounter Scaling

- `Boarding 1`: exactly 3 enemies, 1 strong and 2 weak.
- `Boarding 2`: exactly 3 enemies, 2 strong and 1 weak.
- `Boarding 3`: exactly 4 enemies, typically 2 strong and 2 weak. `Netter` unlocks here.
- `Boarding 4`: exactly 4 enemies, typically 3 strong and 1 weak.
- `Boarding 5` and `Boarding 6`: exactly 5 enemies, all strong. `Flint Duelist` unlocks at `Boarding 5`.
- Each ship node stores a pre-generated blueprint with one main archetype and a short `encounterDesc` hint shown before the fight.
- Enemy setup generation prefers melee in front and ranged deeper; the formation never leaves living enemies behind an empty front row.

## Map Generation and Victory

- A run has `30` layers total and `6` ship nodes.
- Early block:
  - `layers 0–3`: one linear path of island nodes;
  - `layer 4`: first ship node;
  - `layers 5–8`: three parallel non-crossing island paths;
  - `layer 9`: second ship node.
- Early island layers use only `Forest Island`, `Rocky Island`, and `Port Island`. `Treasure`, `Skull`, and `Siren` do not appear there.
- From `layer 10` onward, normal island layers contain `2–3` nodes.
- From `layer 10` onward, `Siren Island` is added to that layer's pool with `50%` chance; the other islands may always appear.
- After `layer 9`, ship nodes are placed at `layers 14, 19, 24, 29`.
- On later map layers, each normal node connects to `1–2` nodes in the next layer; the code guarantees every next-layer node is reachable and tries to avoid crossing paths.
- Ship nodes still receive numeric `strength` values: `6`, `8`, `11`, `14`, `17`, `21`, but current boarding combat does not directly use those values.
- Normal-run victory happens by winning `Boarding 6` on `layer 29`.

## Battle Test

- `Battle Test` from the menu does not use the map, shop, deck, or discard pile.
- It starts with 5 random pirates from the full `TYPES` list.
- `round` and boarding number are rolled randomly from `1` to `6`.
- The crew receives `1–5` random weapons via `rollWeaponKeys(..., { ensureDistinct: true })`.
- After combat:
  - `Repeat` reruns the exact same crew, enemy party, and pre-fight setup rows;
  - `Another Battle` rerolls everything.
