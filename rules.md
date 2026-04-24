# Deck of Cats — Game Rules

Source of truth for all gameplay mechanics currently implemented in `js/`.

## Core Premise

- Deck-builder about pirate cats.
- Base resources: `🪵 wood`, `🪨 stone`, `🪙 gold`, `☠️ enthusiasm`.
- Island actions are deterministic. The old miss chances, treasure maps, temporary swords, and permanent cannons are gone.
- Ship actions now mostly produce `☠️`, permanent personal weapons, and permanent personal buffs.
- Weapons stay on individual pirates until that pirate leaves the crew.
- Personal buffs also stay on that pirate until that pirate leaves the crew.
- Pirates defeated during regular boarding become `🩹 Wounded` instead of being lost.

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
- `Infirmary Island` is a special island: it enters phase `healing` instead of `sending`.
- By default the player may send up to 2 pirates.
- `Port Island` adds `+1`, so the maximum becomes 3.
- Sending is animated, but the player may send the next pirate immediately without waiting for the previous effect to finish.
- Each sent pirate resolves its island action as soon as it lands.
- The player may stop early with `End`. Once the send limit is filled, the button becomes `Work on Ship`.
- Pirates with island conversion cannot be sent unless the input resource is available.
- `Bosun` cannot go ashore at all.
- On `Siren Island`, a pirate resolves its island action first and is then permanently removed from the crew.
- Island bonuses double only matching resource outputs (`wood`, `stone`, `gold`). They do not double guaranteed effects, `☠️`, recall/exile effects, buffs, or weapon grants.
- If an island action grants a weapon, the player chooses which pirate from the current hand gets it.

### 3. Ship Round

- After `End` or `Work on Ship`, every unsent pirate resolves its ship action in current hand order.
- A ship action may:
  - do nothing;
  - spend resources and produce resources or `☠️`;
  - grant a weapon or permanent buff;
  - remove itself (`get lost`);
  - trigger an exile pick from the overall crew.
- If a ship action cannot pay its cost, it simply fails.
- `Cutthroat` pauses ship resolution and enters phase `removing`: the player chooses 1 pirate from `allCrew` that is not in the current hand and permanently exiles it.
- Ship rewards that grant a weapon do not auto-target. The player chooses which pirate from the current hand gets that weapon.
- Ship rewards that grant `Might` or `Tempo` always target the leftmost surviving pirate currently on the island.
- If no surviving pirate is currently on the island, those ship buffs are lost.
- A newly granted weapon replaces the old weapon on the chosen pirate.
- Buffs stack on the target pirate.

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
- Before the fight, the current hand is automatically packed into a 3-row formation.
- Wounded pirates in hand sit out and do not become combat fighters.
- Default player setup puts armed ranged pirates in the back row and everyone else in the front row.
- The player cannot manually drag or reorder the boarding formation.
- `Fight!` starts autoplay combat.
- All pirates share the same base combat stats before weapon and buff modifiers: `9 HP`, `3 damage`, `1350 ms attack`, melee/front-row behavior.
- In regular runs, defeated player pirates become `🩹 Wounded`.
- After a win, the whole current hand goes to discard, a new hand is drawn, and the player returns to the map.
- After a loss, the run goes to `Game Over`.
- Winning the final ship on layer 29 ends the run with the `Victory` screen.

## Pirate Injury And Healing

- `🩹 Wounded` is a persistent pirate status in regular runs.
- Wounded pirates still stay in the deck, hand, discard, and crew.
- Wounded pirates can still be sent to islands and can still resolve normal ship actions.
- Wounded pirates do not participate in boarding while wounded.
- A wounded pirate card shows a `🩹` badge.
- `Infirmary Island` heals up to 5 wounded pirates chosen by the player from the whole crew.
- Healing removes the `🩹 Wounded` status immediately.

## Islands

| Island | Effect |
|---|---|
| Forest Island 🌲 | Doubles island output of `🪵` |
| Rocky Island ⛰️ | Doubles island output of `🪨` |
| Treasure Island 💎 | Doubles island output of `🪙` |
| Port Island ⚓ | Lets the player send 3 pirates instead of 2 |
| Skull Island 💀 | Grants `☠️☠️` immediately when the node is selected |
| Siren Island 🧜 | Every sent pirate is permanently lost after its island effect |
| Infirmary Island 🩹 | Heals up to 5 wounded pirates chosen by the player |

## Pirates

| Pirate | Cost | Island | Ship |
|---|---:|---|---|
| Rigger | — | 🪵 | 4🪵 → ☠️☠️ |
| Ballaster | — | 🪨 | 4🪨 → ☠️☠️ |
| Armsman | — | 🔨 | — |
| Poisoner | 2 | ☠️☠️ | 🪵 → ☠️☠️+🗡️ |
| Drummer | 2 | ☠️ | 🪵 → ☠️+⚡ |
| Herald | 2 | ☠️☠️☠️ | — |
| Sawbones | 3 | 🪨 | 🪨 → ☠️☠️+⚔️ |
| Needler | 3 | 🪙 | 🪙 → ☠️☠️+🧪 |
| Trainer | 3 | 🪨 | 🪨 → ☠️+💪 |
| Survivalist | 3 | 🪵+☠️☠️ | ☠️☠️ |
| Bosun | 5 | — | ☠️☠️☠️ |
| Cutthroat | 5 | ☠️ | 🪙🪙 → exile pirate |
| Scarwright | 7 | 🪨 | 🪨🪨 → 4☠️+🪝 |
| Flagbearer | 7 | 🪙 | 🪵+🪨 → 4☠️+💪+⚡ |
| Duel Master | 7 | 🔨 | 🪙 → 3☠️+⚔️ |
| Smuggler | 8 | 🪙 | 🪙 → 6☠️+🪵+🪨 |
| Bandmaster | 8 | ☠️☠️ | 🪙 → 4☠️+🔫 |
| Quartermaster | 10 | recall 1 pirate | ☠️☠️ |
| Plague Captain | 10 | 🪙 | 🪙🪙 → 5☠️+🧪+💪 |
| Admiral's Mate | 13 | 🪙🪙 | 🪙🪙 → 6☠️+🪓+💪+⚡ |

### Special Island Notes

- `Quartermaster`: recalls the most recently sent earlier pirate.
- `Cutthroat`: the exile target must be outside the current hand.

## Permanent Buffs

- `💪 Might`: `+1 damage` per stack.
- `⚡ Tempo`: attacks `20%` faster per stack.
- `Buff count` means `Might + Tempo` together.
- Buffs stay on that pirate until that pirate leaves the crew.

## Weapons

- Weapon grants never enter a shared inventory.
- Each pirate can hold only 1 weapon at a time.
- Whenever a weapon is granted, the player picks the receiving pirate from the current hand.
- If a pirate gets a new weapon, the old weapon is replaced.
- Weapons stay on that pirate until that pirate leaves the crew.

| Weapon | Effect |
|---|---|
| 🔨 Hammer | Melee. `+4 HP` |
| 🗡️ Venom Knife | Melee. Normal hit, then apply `1 poison` |
| 🧪 Toxin Pistol | Ranged. Targets the living enemy with the lowest HP, then applies `1 poison` |
| ⚔️ Barbed Blade | Melee. Normal hit, then apply `1 wound` |
| 🪝 Scar Harpoon | Ranged. Targets the living enemy with the highest HP, attacks `1.35x` slower, and applies `2 wounds` |
| ⚔️ Officer Sabre | Melee. `+1 damage` for each buff on the owner |
| 🔫 Cadence Pistols | Ranged. Targets the living enemy with the lowest HP and attacks `10%` faster for each buff on the owner |
| 🪓 Banner Axe | Melee. Normal hit by default. If the owner has `3+ buffs`, it hits the whole opposing front row |

## Poison And Wounds

- `Poison` and `Wounds` last for the whole boarding. They do not decay.
- When poison is applied, the target immediately takes damage equal to the poison already on it, then gains `+1 poison`.
- Example:
  - at `0 poison`, applying poison deals `0`, then goes to `1 poison`
  - at `1 poison`, applying poison deals `1`, then goes to `2 poison`
  - at `2 poison`, applying poison deals `2`, then goes to `3 poison`
- `Wounds` do nothing by themselves.
- If a target has `k wounds` and receives poison, that poison application repeats `k + 1` times.
- Example:
  - target has `2 wounds` and `1 poison`
  - one poison application repeats `3` times
  - damage sequence is `1`, then `2`, then `3`
  - target ends at `4 poison`

## Boarding Combat

- Each side can occupy up to 3 rows: front, middle, back.
- The front row is always the first living row. If an entire row dies, rows behind it automatically become the new front.
- Melee fighters can attack only from the current front row.
- Ranged fighters can attack from any living row.
- Every fighter gets a random initial delay of `80–260 ms`.
- Across the whole boarding, only one new attack may begin every `300 ms`.
- A fighter cannot begin its own attack while another attack is currently resolving against it.
- Player attack speed is also clamped to a minimum of `250 ms`.
- Default `frontBand` targeting:
  - if the attacker is position `X` among `N` living allies in its front row and the opposing front row has `M` living targets, then it randomly picks within `floor((X-1)*M/N)` through `ceil(X*M/N)-1`
- Multi-target row hits lose `2 damage` per target if a living `Shellback` is present in that row. Damage never drops below `1`.
- `Powder Bomber` explodes immediately on death and deals `4 damage` to the player's current front row.
- Poison damage happens immediately when poison is applied and can finish fighters during an attack.

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

## Map Generation And Victory

- A run has `30` layers total and `6` ship nodes.
- Early block:
  - `layers 0–3`: one linear path of island nodes
  - `layer 4`: first ship node
  - `layers 5–8`: three parallel non-crossing island paths
  - `layer 9`: second ship node
- Early island layers use only `Forest Island`, `Rocky Island`, and `Port Island`. `Treasure`, `Skull`, and `Siren` do not appear there.
- `layer 10` and `layer 20` are mandatory single-node `Infirmary Island` layers.
- From `layer 10` onward, normal non-infirmary island layers contain `2–3` nodes.
- From `layer 10` onward, `Siren Island` is added to that layer's pool with `50%` chance; the other islands may always appear.
- After `layer 9`, ship nodes are placed at `layers 14, 19, 24, 29`.
- `Infirmary Island` does not appear randomly; it appears only on its mandatory layers.
- On later map layers, each normal node connects to `1–2` nodes in the next layer; the code guarantees every next-layer node is reachable and tries to avoid crossing paths.
- Ship nodes still receive numeric `strength` values: `6`, `8`, `11`, `14`, `17`, `21`, but current boarding combat does not directly use those values.
- Normal-run victory happens by winning `Boarding 6` on `layer 29`.

## Battle Test

- `Battle Test` from the menu does not use the map, shop, deck, or discard pile.
- It starts with 5 random pirates from the full `TYPES` list.
- `round` and boarding number are rolled randomly from `1` to `6`.
- The crew receives `1–5` random weapons via `rollWeaponKeys(..., { ensureDistinct: true })`.
- Battle Test does not persist `🩹 Wounded` injuries after combat.
- After combat:
  - `Repeat` reruns the exact same crew, enemy party, and pre-fight setup rows
  - `Another Battle` rerolls everything
