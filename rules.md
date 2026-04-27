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
- Starting resources, `☠️`, `Boarding Alert`, `Full Crew Discount`, and `Opening Counter Plan`: `0`.
- Starting hand: up to 5 pirates.
- Starting shop: 4 unique pirates from starter shop lanes, shuffled: by default 1 of `Poisoner`/`Drummer`, 1 of `Sawbones`/`Trainer`, always `Needler`, and 1 of `Herald`/`Survivalist`. The regular-run scouted counter shop rule can replace one newly generated starter-shop slot if the first scouted ship would otherwise have no visible counter.
- When the deck is empty, the whole discard pile is shuffled back into the deck. If fewer than 5 pirates remain, the new hand is simply smaller.

| Pirate | Count | Island | Ship |
|---|---:|---|---|
| Rigger | 4 | 🪵 | 4🪵 → ☠️☠️ |
| Ballaster | 4 | 🪨 | 4🪨 → ☠️☠️ |
| Armsman | 2 | 🔨 | 🪵 → 🔫 Rusty Pistol |

## Regular Run Flow

### 1. Map

- Runs begin in phase `map`.
- If only 1 next node is available, it is auto-selected.
- If 2+ nodes are available, the player chooses on the map.
- When a node is selected, `round` increases by 1, `☠️` resets to `0`, and resources persist.
- Outside `phase = map`, the map is preview-only; node selection works only during the map phase.
- In regular runs, each ship's immediately preceding normal island layer marks 1 `Scouted Counter Cache` tied to that ship's main scouted enemy.
- Selecting a marked cache island immediately grants `+1` of the cache resource, `+1☠️`, and `+1 Boarding Alert` before island actions resolve, then marks that cache claimed.
- The same selected cache island also arms `Cache Drill`: during that island round, the first sent pirate whose type counters the cache's main scouted enemy and remains in the crew after its island action gains `+1 💪 Might`, refunds that cache's own `+1 Boarding Alert`, and is marked to report early.
- The cache `☠️` is normal round shop currency, is granted only once, is not doubled by island bonuses, is not refunded by `Cache Drill`, and can help buy a prepared `Top deck` counter in that round's Shop.
- The `Cache Drill` Alert refund reduces pending `Boarding Alert` by the cache's stored Alert amount once, but never below the amount present before that cache was claimed and never removes the cache `☠️`.
- Cache resource map: `Shellback` → `🪵`, `Powder Bomber` → `🪨`, `Deck Sniper` → `🪙`, `Netter` → `🪵`, `Flint Duelist` → `🪵`.
- Cache placement prefers an island whose bonus matches the cache resource, then `Port Island`, then the first eligible island in that layer.
- `Cache Drill` uses the same scouted counter map as the Shop, triggers at most once per cache island, and its Might gain, Alert refund, early report, and cache `☠️` bounty are not doubled by island bonuses.
- A Cache Drill pirate marked to report early is placed on top of the draw pile on the next `Continue` after that island's Shop, before the next hand is drawn. The mark is then cleared.
- Cache Drill early report cannot duplicate a pirate; if the marked pirate is no longer in the crew at `Continue`, no card is moved and the stale mark is cleared.
- If Cache Drill early report and Shop `Top deck` purchases happen in the same Shop, Cache Drill pirates are drawn above every other returning or top-deck card.
- Caches and `Cache Drill` never appear in `Battle Test`, never apply to ship nodes, `Infirmary Island`, claimed caches, or unmarked islands, and a claimed cache cannot grant its resource, `☠️`, Alert, or drill reward again.

### 2. Island Round

- If the chosen node is an island, the round enters phase `sending`.
- `Infirmary Island` is a special island: it enters phase `healing` instead of `sending`.
- By default the player may send up to 2 pirates.
- `Port Island` adds `+1`, so the maximum becomes 3.
- On a regular `Port Island`, ending with all 3 send slots filled triggers `Port Drill` before ship actions: the leftmost surviving sent pirate gains `+1 ⚡ Tempo`.
- `Port Drill` does not trigger on partial Port sends, non-Port islands, `Infirmary Island`/healing rounds, or Battle Test; it adds no `Boarding Alert`, is not doubled by island bonuses, and stacks as normal permanent `Tempo`.
- In regular runs, ending a non-`Infirmary Island` round exactly 1 send slot short with at least 1 surviving sent pirate triggers `Short Crew Drill` before ship actions: the leftmost surviving sent pirate gains `+1 💪 Might`.
- `Short Crew Drill` does not trigger on full sends, empty sends, sends with 2 or more unused slots, `Infirmary Island`/healing rounds, Battle Test, or if every sent pirate was removed by `Siren Island` or another island effect.
- `Short Crew Drill` adds no `Boarding Alert` by itself, is not doubled by island bonuses, and stacks as a normal permanent `Might` buff.
- In regular runs only, if `Short Crew Drill` triggers while the next unreached ship is `1` to `3` map turns away, that same pirate is marked to report early.
- In regular runs only, if that drilled pirate's type counters the next scouted ship's main enemy, `Short Crew Drill` refunds `1 Boarding Alert` after `Ship Wages` are paid.
- If `Short Crew Drill` both reports early and refunds Alert because the drilled pirate counters the next scouted ship's main enemy, that drilled pirate also gains `Counter Watch` until the next boarding.
- The `Short Crew Drill` counter refund is clamped to the pending `Boarding Alert` present immediately before that `End`/`Work on Ship` action paid `Ship Wages`, so it refunds only the Alert from the one unused send slot and cannot remove cache Alert, `Dockside Credit` Alert, earlier pending Alert, or Alert already snapshotted onto boarding.
- The `Short Crew Drill` counter refund and `Counter Watch` never apply in `Battle Test`.
- A Short Crew pirate marked to report early is placed on top of the draw pile on the next `Continue` after that island's Shop, before the next hand is drawn. The mark is then cleared.
- Short Crew early report cannot duplicate a pirate; if the marked pirate is no longer in the crew at `Continue`, no card is moved and the stale mark is cleared.
- If a pirate has both a Short Crew early-report marker and `Counter Watch`, the Short Crew report places it on top once on the next `Continue`, and `Counter Watch` remains active for later Shop `Continue`s before the next boarding.
- If Cache Drill early report, Short Crew early report, Counter Watch, and Shop `Top deck` purchases happen in the same Shop, Cache Drill pirates are drawn first, Short Crew pirates are drawn next, watched counters are drawn third, and ordinary Shop `Top deck` purchases are drawn after all returning pirates.
- Sending is animated, but the player may send the next pirate immediately without waiting for the previous effect to finish.
- Each sent pirate resolves its island action as soon as it lands.
- The player may stop early with `End`. Once the send limit is filled, the button becomes `Work on Ship`.
- Ending a regular island round with `End` or `Work on Ship` pays `Ship Wages` before ship actions resolve: gain a baseline `1☠️`, plus `+1☠️` per unused send slot.
- During only rounds `1` and `2` before any boarding has happened, ending a regular non-`Infirmary Island` round exactly 1 send slot short with at least 1 sent pirate adds `+1☠️ Opening Commission` to `Ship Wages`.
- `Opening Commission` does not apply in Battle Test, does not apply to full sends, empty sends, or sends with 2 or more unused slots, does not apply after round `2`, does not apply after the first boarding, and never adds Boarding Alert.
- During only rounds `1` and `2` before any boarding has happened, if `Opening Commission` is earned and at least 1 sent pirate is still in the crew after island effects, the next Shop also gains `Opening Counter Plan`.
- `Opening Counter Plan` does not apply in Battle Test, full sends, empty sends, sends with 2 or more unused slots, `Infirmary Island`/healing rounds, after round `2`, after the first boarding, or if every sent pirate was removed by `Siren Island` or another island effect.
- A normal 2-send island therefore pays `3☠️` with 0 sent pirates, `2☠️` with 1 sent pirate, and `1☠️` when both slots are filled; during eligible Opening Commission rounds, the 1-sent one-short payout is `3☠️` instead.
- `Port Island`'s extra send slot counts for `Ship Wages`, so it pays `4☠️`, `3☠️`, `2☠️`, or `1☠️` for 0, 1, 2, or 3 sent pirates; during eligible Opening Commission rounds, the 2-sent one-short payout is `3☠️` instead.
- Whenever `Ship Wages` are paid in a regular run, gain `+1 Boarding Alert` per unused send slot; the baseline `1☠️` adds no Alert. A normal 2-send island adds `2`, `1`, or `0` Alert; `Port Island` adds `3`, `2`, `1`, or `0` Alert.
- `Ship Wages` are not doubled by island bonuses, do not trigger on `Infirmary Island` or boarding rounds, and stack normally with `Skull Island` and pirate ship actions.
- Ending a regular non-`Infirmary Island` round with every available send slot filled grants `Full Crew Discount` for the next Shop phase.
- `Full Crew Discount` gives `-1☠️` on the first successful pirate purchase in that Shop, cannot reduce a price below `0☠️`, does not stack, and does not add Boarding Alert by itself.
- Pirates with island conversion cannot be sent unless the input resource is available.
- `Bosun` cannot go ashore at all.
- On `Siren Island`, a pirate resolves its island action first and is then permanently removed from the crew.
- On a selected `Scouted Counter Cache` island, `Cache Drill` checks after each sent pirate resolves its island action and after any `Siren Island` removal, so a pirate removed by the island cannot receive the `+1 💪 Might` or refund the cache Alert.
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
- Ship rewards that grant a weapon, `Might`, or `Tempo` always target the leftmost surviving pirate currently on the island.
- If a ship action grants both a weapon and buffs, all of those personal gains apply to that same leftmost island pirate in definition order.
- If no surviving pirate is currently on the island, those ship-side personal gains are lost, but any paid resource or `☠️` outputs still resolve normally.
- A newly granted ship weapon replaces the old weapon on the target pirate.
- Ship buffs stack on the target pirate.

### 4. Shop

- The shop appears only after island rounds. There is no shop after boarding.
- The shop always has 4 slots. Starters (`Rigger`, `Ballaster`, `Armsman`) are never sold there.
- `randomShopType(round, excludeTypes = [])` selects from `SHOP_POOL` with `cost <= max(3, round + 1)`, first avoiding any excluded visible shop types when the eligible pool has an unused type.
- The initial display is created as `initialShop(4, 0)`, which uses the curated starter shop lanes instead of full random selection.
- Non-curated random shop generation avoids duplicate visible types whenever the eligible pool can support it, falling back to the normal eligible pool only if every eligible type is already visible.
- In regular runs, while a next ship is scouted, each initial shop, immediate purchase refill, and end-of-shop `Continue` refill tries to show at least 1 counter pirate for that ship's main scouted enemy.
- The scouted counter rule checks the 4 visible slots after the new slot is generated. If no visible pirate counters the main scouted enemy and the current cost-gated shop pool contains an eligible non-duplicate counter, only the newly generated slot is replaced by one counter.
- The scouted counter rule does not apply in `Battle Test`, never sells starter pirates, and does nothing when no eligible non-duplicate counter exists.
- Scouted counter map:
  - `Shellback` → `Poisoner`, `Needler`, `Plague Captain`
  - `Powder Bomber` → `Sawbones`, `Scarwright`
  - `Deck Sniper` → `Needler`, `Bandmaster`
  - `Netter` → `Drummer`, `Trainer`, `Flagbearer`
  - `Flint Duelist` → `Poisoner`, `Needler`, `Sawbones`, `Scarwright`, `Plague Captain`
- Immediate refills after purchases use the current `G.round` and exclude the remaining visible shop types.
- The end-of-shop refresh (`Continue`) removes the leftmost slot, shifts the rest left, and adds one new pirate using the next-round rule while excluding the remaining visible shop types: `randomShopType(G.round + 1, G.shop)`.
- Bought pirates normally go straight to discard, not to hand.
- Exception: in regular runs, if the bought pirate is a scouted counter for the next unreached ship and that ship is `3` or fewer map turns away, the new pirate goes on top of the draw pile instead of discard.
- A bought pirate that qualifies for that `Top deck` scouted counter exception also gains `Counter Watch` until the next boarding.
- On each Shop `Continue` before that boarding, a watched pirate that is still owned, currently in hand, and was not sent to the island is separated from the discard step and placed on top of the draw pile so it returns in the next hand.
- Sending a watched pirate spends `Counter Watch` unless that same sent pirate earns a new eligible counter `Short Crew Drill` that re-marks `Counter Watch`; Cache Drill and non-counter Short Crew report markers still work normally but do not preserve the watch.
- When a regular-run boarding starts, `Counter Watch` clears. Any watched pirate that is still owned, in the current hand, not `🩹 Wounded`, and whose type counters that boarding's main scouted enemy becomes `Watch Ready` for that boarding.
- `Watch Ready` counts as armed only for `Counter Ambush` damage and `Boarding Alert` guard removal: if that pirate is the front-row ambusher, its `Counter Ambush` deals `5` damage and removes up to 2 Alert guards even without a permanent weapon, `Might`, or `Tempo`.
- `Watch Ready` does not grant or mutate a weapon, `Might`, or `Tempo`; does not create `Prepared`; does not affect `Counter Edge`, `Boarding Trophy`, `Counter Trophy`, `Ambush Bounty`, or `Opening Counter Break`; and never applies in `Battle Test`.
- A watched pirate that was sent earlier, is absent from the current hand, is `🩹 Wounded`, does not counter the main scouted enemy, or is moved out of the front row before `Fight!` gets no `Watch Ready` ambush benefit.
- A bought pirate that qualifies for that `Top deck` scouted counter exception is also `Prepared` only if that same successful purchase spends `Full Crew Discount` or `Opening Counter Plan`: immediately after purchase, the new pirate itself receives that type's ship-side personal gains (`weapon`, `Might`, and/or `Tempo`).
- `Opening Counter Plan` is consumed by the first successful pirate purchase in that Shop. If that first purchase is a `Top deck` scouted counter with ship-side personal gains, it becomes `Prepared` even without `Full Crew Discount`; otherwise the plan is lost.
- `Opening Counter Plan` does not change prices, does not grant a discount, does not trigger `Opening Counter Subsidy`, does not add or remove `Boarding Alert`, does not affect `Quiet Docks`, and does not stack with `Full Crew Discount`.
- If `Opening Counter Plan` and `Full Crew Discount` are both present, the discount still changes the price as normal, the plan adds no extra discount or preparation, and both shop flags are consumed by the first successful pirate purchase.
- A `Prepared` counter purchase may still use `Dockside Credit` for any remaining missing `☠️` after the discount is applied.
- `Top deck` scouted counter purchases without `Full Crew Discount` or `Opening Counter Plan` still go on top of the draw pile, but are not `Prepared`.
- If `Full Crew Discount` or `Opening Counter Plan` is spent on a non-counter first, a later `Top deck` counter purchase in the same Shop is not `Prepared`.
- `Prepared` does not pay ship costs, grant ship resource or `☠️` outputs, target the leftmost island pirate, consume a ship action, or apply in `Battle Test`.
- Prepared weapons and buffs are permanent and use the normal weapon replacement and buff stacking rules.
- The draw pile top is the next card drawn. If multiple eligible counter pirates are bought, each is placed on top using the normal draw pile order, so the most recent eligible counter is drawn first.
- Non-counter purchases, purchases when no ship is scouted, purchases when the scouted ship is more than `3` turns away, and all `Battle Test` purchases still go to discard.
- The player may buy any number of pirates as long as enough `☠️` remains.
- `Full Crew Discount`, if earned by filling every island send slot, reduces the effective cost of the first pirate bought in the next Shop by `1☠️`.
- The discount applies before `Dockside Credit` checks missing `☠️`; for example, a cost-`3` pirate with `1☠️` and `Full Crew Discount` is missing only `1☠️`.
- During the regular-run round-1 Shop, before any boarding, `Opening Counter Subsidy` covers exactly `1☠️` for a `Top deck` scouted-counter pirate if that purchase spends `Full Crew Discount` and is short exactly `1☠️` after the normal discount.
- `Opening Counter Subsidy` is not spendable currency, does not use `Dockside Credit`, does not mark `shopCreditUsed`, and adds no `Boarding Alert`; the purchase spends the player's current `☠️`, consumes `Full Crew Discount`, and still counts as `Prepared` because that purchase spent the discount.
- `Opening Counter Subsidy` does not apply without `Full Crew Discount`, from `Opening Counter Plan`, to already-affordable purchases, non-counter purchases, purchases missing `2+☠️`, round `2+`, after the first boarding, after `Dockside Credit` was already used in that Shop, or in `Battle Test`.
- `Full Crew Discount` is consumed only by a successful pirate purchase, never by `Quiet Docks`, and expires on `Continue` if unused.
- `Opening Counter Plan` is consumed only by a successful pirate purchase, never by `Quiet Docks`, and expires on `Continue` if unused.
- Once per regular-run Shop phase, the player may use `Dockside Credit` to buy 1 pirate whose cost exceeds current `☠️` by 1 or 2.
- A `Dockside Credit` purchase spends all current `☠️`, adds pending `Boarding Alert` equal to the missing `☠️`, buys the pirate using the normal purchase destination rules, and refills that shop slot normally.
- Affordable purchases do not use `Dockside Credit`, do not add Alert, and do not prevent a later credit purchase in the same Shop phase.
- `Dockside Credit` cannot cover 3+ missing `☠️`, cannot be used more than once in the same Shop phase, is unavailable in Battle Test, and resets when the next Shop phase begins.
- `Dockside Credit` affects only pending `Boarding Alert`; it never changes Alert already snapshotted onto an active boarding.
- During the Shop phase in regular runs, the player may use `Quiet Docks` while pending `Boarding Alert` is above `0`.
- `Quiet Docks` costs `2☠️` and reduces pending `Boarding Alert` by `1`.
- `Quiet Docks` may be bought repeatedly as long as the player has at least `2☠️` and pending Alert remains, can be used before or after pirate purchases, and does not occupy or refill a pirate shop slot.
- `Quiet Docks` affects only pending Alert before the next ship node; it cannot reduce Alert already snapshotted onto an active boarding.
- Battle Test has no `Quiet Docks` service because it ignores `Boarding Alert`.
- On `Continue`:
  - the current hand goes to discard only for pirates still present in `allCrew`;
  - any still-owned Cache Drill or Short Crew early-report pirate is separated from that discard step and placed on top of the draw pile, with Cache Drill reports above Short Crew reports;
  - any still-owned, held Counter Watch pirate is separated from that discard step and placed below Cache Drill and Short Crew reports but above ordinary Shop `Top deck` purchases;
  - exiled and `get lost` pirates do not return;
  - `☠️` resets to `0`;
  - unused `Full Crew Discount` and `Opening Counter Plan` expire;
  - a new hand is drawn up to 5;
  - the run returns to `map`.

### 5. Boarding Round

- Ship nodes move the game directly into `phase = boarding`.
- In regular runs, the next unreached ship is scouted before the player reaches it.
- Scouting shows that ship's pre-generated base boarding party from its encounter blueprint before any `Boarding Alert` guards are added.
- Scouting is limited to the next unreached ship; later ship rosters stay hidden until they become the next ship.
- Pending or projected `Boarding Alert` guards are previewed separately from the scouted base roster.
- When the ship is reached, the actual boarding uses the same pre-generated base blueprint plus any consumed `Boarding Alert` guards.
- Pending `Boarding Alert` persists through islands, shops, and map choices until the next ship node.
- When a regular-run boarding starts, the current `Boarding Alert` is snapshotted on that boarding and the pending Alert is cleared.
- The snapshotted Alert adds visible guard reinforcements after the normal boarding party is generated:
  - Alert `1–2`: add 1 extra `Cabin Boy`.
  - Alert `3–5`: add 1 extra `Cabin Boy` and 1 extra `Bilge Rat`.
  - Alert `6+`: add 2 extra `Cabin Boys` and 1 extra `Bilge Rat`.
- Alert guards use normal enemy stats and normal late-run `Veteran`/`Elite` scaling. Alert no longer gives enemies bonus HP.
- Alert previews show the resulting guard tier and any guard plunder available on a win. Battle Test ignores `Boarding Alert`.
- After a regular-run boarding is won, the consumed Alert guards grant plunder once:
  - each Alert `Cabin Boy` grants `+1🪵`;
  - each Alert `Bilge Rat` grants `+1🪨`;
  - Alert `1–2` therefore pays `+1🪵`;
  - Alert `3–5` pays `+1🪵 +1🪨`;
  - Alert `6+` pays `+2🪵 +1🪨`.
- Alert guard plunder is granted only on a win, never on a loss, never in Battle Test, never for normal enemies, and cannot be duplicated after the boarding is resolved. Alert guards removed by `Counter Ambush` still count for this plunder if the boarding is won.
- After a regular-run boarding is won, before the winning hand is discarded, the frontmost then leftmost surviving player fighter in the final combat hand gains `+1 💪 Might` as a `Boarding Trophy`.
- `Boarding Trophy` triggers once per won regular boarding, never on losses, never in Battle Test, and grants nothing if no player fighter survives.
- If a boarding is won by a reinforcement hand, only a survivor from that final winning combat hand can receive the `Boarding Trophy`.
- After a regular-run boarding is won, if the final winning combat hand has at least 1 surviving pirate whose type counters that boarding's main scouted enemy, the frontmost then leftmost matching survivor gains `+1 ⚡ Tempo` as a `Counter Trophy`.
- `Counter Trophy` uses the same scouted counter map as the Shop, triggers once per won regular boarding, never on losses, never in Battle Test, and grants nothing if no matching counter pirate survives.
- If a boarding is won by a reinforcement hand, only a matching survivor from that final winning combat hand can receive the `Counter Trophy`.
- `Boarding Trophy`, `Counter Trophy`, Alert guard plunder, Opening plunder, and Ambush Bounty can all stack on the same win when their own conditions are met.
- The old "sum team strength against ship strength" system no longer exists.
- Ship nodes still store a numeric `strength` field, but current combat uses a generated enemy boarding party instead of a direct strength comparison.
- Before the fight, the current ready pirates are automatically packed into a 3-row formation, then the player may drag ready pirates between front, middle, and back rows and reorder them within a row before pressing `Fight!`.
- Wounded pirates in hand sit out and do not become combat fighters.
- Default player setup puts armed ranged pirates in the deepest occupied row behind any melee front and everyone else in the front row.
- In regular-run boarding with a scouted main enemy, the first ready pirate in hand whose type counters that main enemy is placed at the front of the front row by default, even if that pirate has a ranged weapon.
- The player may still move that defaulted counter before `Fight!`; `Counter Ambush` only triggers if a matching counter is still in the compacted front row when the fight starts.
- Occupied player setup rows compact toward the front whenever the formation is normalized; no ready pirate remains behind an empty row at fight start.
- Enemy setup is fixed before the fight and can be inspected while the player arranges their formation.
- `Fight!` starts autoplay combat using the chosen player formation.
- In regular-run boarding only, `Counter Ambush` checks once when `Fight!` starts for the opening combat hand.
- If the player's compacted front row has at least 1 ready pirate whose type counters that boarding's main scouted enemy, the frontmost then leftmost matching pirate ambushes before normal attack timers begin.
- `Counter Ambush` targets the frontmost then leftmost living enemy with that main archetype, deals `3` damage, and applies `+1 Wound`.
- `Armed Counter Ambush`: if the ambushing counter pirate has any permanent personal upgrade at fight start, meaning a weapon, `1+ 💪 Might`, or `1+ ⚡ Tempo`, that `Counter Ambush` deals `5` damage instead of `3`.
- A `Watch Ready` ambusher also uses the `Armed Counter Ambush` damage and Alert guard-removal limits for that boarding only, without gaining a permanent upgrade and without enabling `Opening Counter Break` by itself.
- After damaging and wounding the main scouted enemy, normal `Counter Ambush` also removes up to 1 frontmost then leftmost living `Boarding Alert` guard if any are present.
- `Armed Counter Ambush` removes up to 2 frontmost then leftmost living `Boarding Alert` guards instead of 1.
- Guards removed by `Counter Ambush` do not fight, but still count for normal Alert guard plunder if the boarding is won.
- During regular-run Boarding 1 only, if `Armed Counter Ambush` removes zero `Boarding Alert` guards, `Opening Counter Break` also removes 1 frontmost then leftmost living non-Alert weak support enemy, either `Bilge Rat` or `Cabin Boy`, after damaging and wounding the scouted main enemy and before normal combat timers begin.
- A support routed by `Opening Counter Break` is not an Alert guard, grants no Alert guard plunder, and does not trigger in `Battle Test`, reinforcement hands, or Boarding 2+.
- If that Boarding 1 is won, the support routed by `Opening Counter Break` grants separate `Opening plunder` once: `Cabin Boy` grants `+1🪵`, and `Bilge Rat` grants `+1🪨`.
- `Opening plunder` is not Alert guard plunder, does not change Alert guard plunder totals, never triggers on losses, and never triggers in `Battle Test`, reinforcement hands, Boarding 2+, unarmed `Counter Ambush`, or `Armed Counter Ambush` that removes Alert guards instead of routing support.
- After a regular-run boarding is won, if `Counter Ambush` triggered in the opening combat hand and that same ambushing pirate is still alive in the final winning combat hand, grant `Ambush Bounty`: `+1` of that main enemy's Scouted Counter Cache resource.
- `Ambush Bounty` uses the cache resource map: `Shellback` → `🪵`, `Powder Bomber` → `🪨`, `Deck Sniper` → `🪙`, `Netter` → `🪵`, `Flint Duelist` → `🪵`.
- `Ambush Bounty` is granted once per boarding, never on losses, never in `Battle Test`, never if the ambusher was defeated, and never if the win comes from a reinforcement hand.
- `Ambush Bounty` is separate from Alert guard plunder, Opening plunder, `Boarding Trophy`, and `Counter Trophy`.
- `Armed Counter Ambush` is not `Counter Edge`, does not mutate permanent buffs, does not count as an attack, and does not trigger weapon on-hit effects or enemy hit reactions.
- `Counter Ambush` does not grant `Might` or `Tempo`, does not apply in `Battle Test`, and does not trigger for reinforcement hands.
- All pirates share the same base combat stats before weapon and buff modifiers: `9 HP`, `3 damage`, `1350 ms attack`, melee/front-row behavior.
- During a regular-run boarding, each ready player fighter whose pirate type counters that boarding's main scouted enemy has `Counter Edge`: `+1` temporary attack damage for that boarding only.
- `Counter Edge` uses the same scouted counter map as the Shop and `Counter Trophy`, applies to reinforcement hands during the same boarding, and does not apply to wounded pirates sitting out.
- `Counter Edge` is not `Might`, is not a permanent buff, does not change stored `Might` or `Tempo`, does not count toward buff count, and does not affect Officer Sabre, Cadence Pistols, or Banner Axe buff-count thresholds.
- `Counter Edge` never applies in `Battle Test`.
- In regular runs, defeated player pirates become `🩹 Wounded`.
- If all current player fighters fall while enemies remain, the run does not immediately end.
- The defeated current hand goes to discard and a new combat hand is drawn from the deck/discard using only pirates that are not `🩹 Wounded`.
- The replacement combat hand draws up to 5 ready pirates; if fewer than 5 ready pirates remain, it draws all of them.
- A regular run is lost only when the crew has no ready pirates left, meaning every pirate in `allCrew` is `🩹 Wounded`.
- After a win, the whole current hand goes to discard, a new hand is drawn, and the player returns to the map.
- After that all-wounded loss, the run goes to `Game Over`.
- Winning the final ship on layer 39 ends the run with the `Victory` screen.

## Pirate Injury And Healing

- `🩹 Wounded` is a persistent pirate status in regular runs.
- Wounded pirates still stay in the deck, hand, discard, and crew.
- Wounded pirates can still be sent to islands and can still resolve normal ship actions.
- Wounded pirates do not participate in boarding while wounded.
- During an ongoing boarding, wounded pirates are skipped when drawing replacement combat hands.
- A wounded pirate card shows a `🩹` badge.
- `Infirmary Island` heals up to 5 wounded pirates chosen by the player from the whole crew.
- Healing removes the `🩹 Wounded` status immediately.

## Islands

| Island | Effect |
|---|---|
| Forest Island 🌲 | Doubles island output of `🪵` |
| Rocky Island ⛰️ | Doubles island output of `🪨` |
| Treasure Island 💎 | Doubles island output of `🪙` |
| Port Island ⚓ | Lets the player send 3 pirates instead of 2. Full 3-pirate sends grant `Port Drill`: leftmost surviving sent pirate gains `+1 ⚡ Tempo` before ship actions |
| Skull Island 💀 | Grants `☠️☠️` immediately when the node is selected |
| Siren Island 🧜 | Every sent pirate is permanently lost after its island effect |
| Infirmary Island 🩹 | Heals up to 5 wounded pirates chosen by the player |

## Pirates

| Pirate | Cost | Island | Ship |
|---|---:|---|---|
| Rigger | — | 🪵 | 4🪵 → ☠️☠️ |
| Ballaster | — | 🪨 | 4🪨 → ☠️☠️ |
| Armsman | — | 🔨 | 🪵 → 🔫 Rusty Pistol |
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
- Island weapon grants make the player pick the receiving pirate from the current hand.
- Ship-side weapon gains target the leftmost surviving pirate currently on the island; if no island pirate is available, the weapon is lost.
- If a pirate gets a new weapon, the old weapon is replaced.
- Weapons stay on that pirate until that pirate leaves the crew.

| Weapon | Effect |
|---|---|
| 🔨 Hammer | Melee. `+4 HP` |
| 🔫 Rusty Pistol | Ranged. Deals `2 damage` with normal front-band targeting. No poison, wounds, or buff scaling. |
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
- Outside the `Powder Bomber` death-blast exception, `Wounds` do nothing by themselves.
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
- `Powder Bomber` explodes immediately on death and deals `4 damage` to the player's current front row unless it has `1+ Wounds`; wounded bombers fizzle and deal no death-blast damage.
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
| 💣 Powder Bomber | 17 HP, 4 damage, 1250 ms | Strong melee; explodes on death for `4 damage` to the player's front row unless it has `1+ Wounds` |

### Encounter Scaling

- Counts below describe the normal generated party before any `Boarding Alert` guard reinforcements are added.
- `Boarding 1`: exactly 3 enemies before Alert guards: always 1 `Shellback`, exactly 1 `Bilge Rat`, and exactly 1 `Cabin Boy`.
- `Boarding 2`: exactly 3 enemies, 2 strong and 1 weak.
- `Boarding 3`: exactly 4 enemies, typically 2 strong and 2 weak. `Netter` unlocks here.
- `Boarding 4`: exactly 4 enemies, typically 3 strong and 1 weak.
- `Boarding 5` and `Boarding 6`: exactly 5 enemies, all strong. `Flint Duelist` unlocks at `Boarding 5`.
- `Boarding 7`: exactly 5 enemies, all strong, upgraded to `Veteran`: `+4 HP`, `+1 damage`, and `6%` faster attacks.
- `Boarding 8`: exactly 5 enemies, all strong, upgraded to `Elite`: `+8 HP`, `+1 damage`, and `12%` faster attacks.
- Boardings `2+` continue to use the normal random blueprint rules and unlock timing.
- Each ship node stores a pre-generated blueprint with one main archetype and a short `encounterDesc` hint shown before the fight.
- Enemy setup generation prefers melee in front and ranged deeper; the formation never leaves living enemies behind an empty front row.

## Map Generation And Victory

- A run has `40` layers total and `8` ship nodes.
- Early block:
  - `layers 0–2`: three parallel non-crossing island paths
  - `layer 3`: first ship node
  - `layers 4–8`: three parallel non-crossing island paths
  - `layer 9`: second ship node
- Each three-node early island layer deals `Forest Island`, `Rocky Island`, and `Port Island` once in shuffled order.
- Early island layers use only `Forest Island`, `Rocky Island`, and `Port Island`. `Treasure`, `Skull`, `Siren`, and `Infirmary` do not appear there.
- `layer 10`, `layer 20`, and `layer 30` are mandatory single-node `Infirmary Island` layers.
- From `layer 10` onward, normal non-infirmary island layers contain `2–3` nodes.
- From `layer 10` onward, `Siren Island` is added to that layer's pool with `50%` chance; the other islands may always appear.
- After `layer 9`, ship nodes are placed at `layers 14, 19, 24, 29, 34, 39`.
- `Infirmary Island` does not appear randomly; it appears only on its mandatory layers.
- On later map layers, each normal node connects to `1–2` nodes in the next layer; the code guarantees every next-layer node is reachable and tries to avoid crossing paths.
- Ship nodes still receive numeric `strength` values: `6`, `8`, `11`, `14`, `17`, `21`, `24`, `28`, but current boarding combat does not directly use those values.
- Normal-run victory happens by winning `Boarding 8` on `layer 39`.

## Battle Test

- `Battle Test` from the menu does not use the map, shop, deck, or discard pile.
- It starts with 5 random pirates from the full `TYPES` list.
- `round` and boarding number are rolled randomly from `1` to `8`.
- The crew receives `1–5` random weapons via `rollWeaponKeys(..., { ensureDistinct: true })`.
- Battle Test does not persist `🩹 Wounded` injuries after combat.
- After combat:
  - `Repeat` reruns the exact same crew, enemy party, and pre-fight setup rows
  - `Another Battle` rerolls everything
