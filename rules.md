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
- Starting resources, `☠️`, `Boarding Alert`, `Full Crew Discount`, `Opening Counter Prep`, `Counter Watch`, the opening route counter secured marker, bought-pirate marker, `Opening Deckhand Scout Pay`, `Opening Route Muster`, and Cache Drill bounty marks: `0`/empty.
- Starting hand: up to 5 pirates.
- Starting shop in regular runs: 4 unique pirates, shuffled: always `Poisoner`, `Sawbones`, `Needler`, and 1 of `Herald`/`Survivalist`.
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
- In regular runs, Boarding 1 marks every non-`Infirmary Island` node in its immediately preceding normal island layer as a route-defined `Scouted Counter Cache`.
- Before Boarding 1, the first two island layers share one shuffled Forest/Rocky/Port lane order, so the layer-0 route choice visibly commits to the matching layer-1 `Scouted Counter Cache`.
- The three normal Boarding 1 cache routes define the first ship's main enemy and route-specific cache stakes: `Forest Island` → `Shellback`, `+1🪵`, `+0☠️`, and `+0 Boarding Alert`; `Rocky Island` → `Powder Bomber`, `+1🪨`, `+1☠️`, and `+1 Boarding Alert`; `Port Island` → `Deck Sniper`, `+1🪙`, `+2☠️`, and `+2 Boarding Alert`. If an unexpected eligible opening island appears, it uses the first ship's current main enemy and the normal `+1` cache resource, `+1☠️`, and `+1 Boarding Alert` stakes.
- Selecting an opening path before Boarding 1 updates the first ship encounter to that route's main enemy with exactly 1 `Bilge Rat` and 1 `Cabin Boy` as support. The route enemy is then used for Cache Drill, scouted counter shop rules, Top deck eligibility, Counter Watch, Counter Ambush, Counter Trophy, and Ambush Bounty.
- During regular-run Boarding 1 only, the selected opening route also makes one starter pirate type an `Opening Deckhand Counter`: `Forest Island`/`Shellback` → `Rigger`, `Rocky Island`/`Powder Bomber` → `Ballaster`, and `Port Island`/`Deck Sniper` → `Armsman`.
- The first selected opening route before Boarding 1 also creates `Opening Route Muster`: one still-owned matching `Opening Deckhand Counter` starter is marked to report on the next Shop `Continue` and gains `Counter Watch` until Boarding 1, preferring a matching pirate currently in hand, then the draw pile, then discard.
- `Opening Route Muster` happens once per regular run, never duplicates a pirate, grants no weapon, `Might`, `Tempo`, Alert refund, shop discount, or reward other than that starter's `Counter Watch`, never applies in `Battle Test`, and clears when Boarding 1 starts.
- If the Opening Route Muster starter is sent before Boarding 1, that `Counter Watch` is spent normally unless an eligible `Short Crew Drill` refreshes it; `Cache Drill` early report alone does not preserve the watch.
- `Opening Deckhand Counter` types count for Cache Drill, Short Crew counter Alert refunds and `Counter Watch`, `Counter Watch` readiness, `Counter Ambush`, `Counter Edge`, `Counter Trophy`, and `Ambush Bounty` eligibility.
- `Opening Deckhand Counter` types do not count for shop generation, shop counter purchase quotes, `Top deck` purchases, `Opening Counter Prep` purchases, `Prepared` counter purchases, or `Full Crew Discount` coverage, because starter pirates are never sold in the shop.
- `Opening Deckhand Counter` never applies in `Battle Test` or Boarding 2+.
- `Opening Deckhand Scout Pay` happens once per regular run: on round `1`, on the layer-0 selected opening island, before Boarding 1, if the first sent pirate is the selected route's matching `Opening Deckhand Counter` starter and is still in the crew after its island action and any island removal, gain `+1☠️`.
- `Opening Deckhand Scout Pay` is normal Shop currency only. It adds no `Boarding Alert`, grants no weapon, `Might`, `Tempo`, `Counter Watch`, `Opening Counter Prep`, `Prepared` gains, `Full Crew Discount`, route-secured marker, Cache Drill reward, Cache Drill bounty mark, Route Starter Pass-Off, or cache claim.
- `Opening Deckhand Scout Pay` never applies in `Battle Test`, on layer-1 cache islands, after Boarding 1, after round `1`, to nonmatching starters, to matching starters sent second or later, to zero-send openings, or to starters removed by the island before the pay check.
- Before the opening path is selected, Boarding 1 scouting is shown as route-decided rather than locking a specific enemy preview.
- Boarding 2 and later each mark 1 `Scouted Counter Cache` in the immediately preceding normal island layer, tied to that ship's main scouted enemy.
- Selecting a marked cache island does not immediately grant that cache's stored resource, stored `☠️`, or stored `Boarding Alert`.
- On a selected `Scouted Counter Cache` island, the first sent pirate opens the cache after resolving its island action and after any island removal. The cache then grants its stored resource amount, stored `☠️`, and stored `Boarding Alert` once, and the map cache is marked claimed.
- If that same first opener is still in the crew and its type counters the cache's main scouted enemy, `Cache Drill` triggers: the opener gains `+1 💪 Might`, refunds that cache's stored `Boarding Alert` amount, and is marked to report early.
- During regular-run Boarding 1 only, if that successful first cache opener is the selected route's `Opening Deckhand Counter` starter and that route's primary opening counter has not yet been secured, `Route Starter Cache Prep` also gives the immediately following Shop normal `Opening Counter Prep`.
- `Route Starter Cache Prep` follows the normal `Opening Counter Prep` purchase rules: the first eligible top-deck scouted-counter buy gets `-1☠️`, `+1 💪 Might`, top-deck placement, and `Counter Watch`; non-counters and `Quiet Docks` do not consume it; and unused prep expires on Shop `Continue`.
- `Route Starter Cache Prep` does not apply in `Battle Test`, Boarding 2+, non-cache islands, failed `Cache Drill` cases, non-counter openers, bought shop-counter openers, removed openers, wrong starters, or routes whose primary opening counter is already secured.
- If the first opener is not a surviving eligible counter, the cache is claimed without `Cache Drill`; the stored `Boarding Alert` remains pending and later sent pirates cannot drill that cache.
- Ending a cache island with zero sent pirates grants no cache resource, no cache `☠️`, and no cache `Boarding Alert`. Because the node is already visited, that skipped cache cannot be claimed later.
- Boarding 2+ `Scouted Counter Cache` islands use the normal stakes: `+1` mapped cache resource, `+1☠️`, and `+1 Boarding Alert`.
- That same `Cache Drill` also marks the drilled pirate for the immediately following scouted boarding, unless `Route Starter Pass-Off` later transfers that mark. If the current holder of that matching active mark triggers `Counter Ambush` against that boarding's matching main scouted enemy, survives the final winning opening combat hand, and `Ambush Bounty` would already be granted, that Ambush Bounty pays `+2` of the mapped cache resource instead of `+1`.
- Cache Drill bounty marks expire after that immediately following boarding, are cleared if the next boarding's main enemy does not match, never carry to later ships, and never apply in `Battle Test`, losses, defeated ambushers, wrong-main encounters, missing `Counter Ambush`, reinforcement-hand wins, or any case where normal `Ambush Bounty` would not be granted.
- The cache `☠️`, if present, is normal round shop currency, is granted only once by the first cache opener, is not doubled by island bonuses, is not refunded by `Cache Drill`, and can help buy a `Top deck` counter in that round's Shop.
- During regular runs before Boarding 1, buying the selected route's primary opening counter marks that route counter as secured only when that same purchase goes on top of the draw pile and gains `Counter Watch` by spending `Full Crew Discount`, using `Full Crew Discount` coverage, consuming `Opening Counter Prep`, or qualifying as a `Dockside Rush Route Counter`.
- A route-primary buy that meets none of those setup gates still adds that pirate to discard, but does not mark the route secured, does not suppress the route-primary shop guarantee, does not block `Route Starter Cache Prep`, gains no `Counter Watch`, and gains no prep `Might`.
- Before Boarding 1 in regular runs, a `Dockside Rush Route Counter` is the selected route's primary opening counter bought with same-purchase `Dockside Credit` while the pending `Boarding Alert` after that purchase is at least `4`.
- Existing pending `Boarding Alert` alone never creates a `Dockside Rush Route Counter`; an affordable cash buy without `Full Crew Discount`, `Full Crew Discount` coverage, or `Opening Counter Prep` goes to discard even at 4+ pending Alert.
- `Dockside Rush Route Counter` applies only if that purchase is not already top-decked by `Full Crew Discount`, `Full Crew Discount` coverage, or `Opening Counter Prep`; it grants only top-deck placement, `Counter Watch`, and the normal route counter secured marker.
- `Dockside Rush Route Counter` does not grant `Opening Counter Prep` discount, prep `Might`, `Prepared` ship gains, `Route Starter Pass-Off`, `Cache Drill` bounty marks, Alert refunds, `Full Crew Discount` coverage, doubled `Ambush Bounty`, or any other cache reward.
- `Dockside Rush Route Counter` never applies to non-primary counters, non-counters, cash buys, `Battle Test`, Boarding 2+, or purchases whose post-purchase pending Alert is below `4`.
- If `Route Starter Cache Prep` is spent on the selected route's primary opening counter in that immediately following Shop, `Route Starter Pass-Off` transfers the matching active Cache Drill bounty mark from the starter opener to the bought primary counter. The starter keeps its `Cache Drill` `+1 💪 Might`, Alert refund, early-report marker, and any `Counter Watch`; only the doubled-bounty mark moves.
- After `Route Starter Pass-Off`, the bought primary counter counts as the Cache Drill bounty pirate for matching Boarding 1 `Ambush Bounty` and for the default front-left counter slot. If the starter ambushes after the mark moved away, it gets normal counter benefits but not the doubled bounty.
- `Route Starter Pass-Off` does not happen for non-primary buys, route-primary buys that do not consume `Opening Counter Prep`, `Battle Test`, Boarding 2+, wrong-main marks, expired prep, missing/removed starter marks, missing/removed bought pirates, or any buy that does not spend the starter-opened route cache's prep.
- `Opening Counter Prep` on a route-primary buy still grants its normal `-1☠️`, top-deck placement, `Counter Watch`, and `+1 💪 Might`, but does not by itself double `Ambush Bounty`; only a matching active Cache Drill bounty mark, including one received by `Route Starter Pass-Off`, does that.
- A matching active `Cache Drill` bounty mark is the only way to make `Ambush Bounty` pay `+2` of the mapped cache resource instead of `+1`.
- The `Cache Drill` Alert refund reduces pending `Boarding Alert` by the cache's stored Alert amount once, but never below the amount present before that cache was claimed and never removes the cache `☠️`.
- Normal cache resource map for Boarding 2+ caches and `Ambush Bounty`: `Shellback` → `🪵`, `Powder Bomber` → `🪨`, `Deck Sniper` → `🪙`, `Netter` → `🪵`, `Flint Duelist` → `🪵`.
- Boarding 2+ cache placement prefers an island whose bonus matches the cache resource, then `Port Island`, then the first eligible island in that layer.
- `Cache Drill` uses gameplay counter types: the shop scouted counter map, plus `Opening Deckhand Counter` during regular-run Boarding 1 only. It can trigger only from the first cache opener, at most once per cache island, and its Might gain, Alert refund, early report, and cache `☠️` bounty are not doubled by island bonuses.
- A Cache Drill pirate marked to report early is placed on top of the draw pile on the next `Continue` after that island's Shop, before the next hand is drawn. The mark is then cleared.
- Cache Drill early report cannot duplicate a pirate; if the marked pirate is no longer in the crew at `Continue`, no card is moved and the stale mark is cleared.
- If Cache Drill early report and Shop `Top deck` purchases happen in the same Shop, Cache Drill pirates are drawn above every other returning, mustered, watched, or top-deck card.
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
- If Cache Drill early report, Short Crew early report, Opening Route Muster, Counter Watch, and Shop `Top deck` purchases happen in the same Shop, Cache Drill pirates are drawn first, Short Crew pirates are drawn next, the Opening Route Muster pirate is drawn third, watched counters are drawn fourth, and ordinary Shop `Top deck` purchases are drawn after all returning pirates. If the same pirate is both Opening Route Muster and watched, it uses the Opening Route Muster placement once and its `Counter Watch` remains active.
- Sending is animated, but the player may send the next pirate immediately without waiting for the previous effect to finish.
- Each sent pirate resolves its island action as soon as it lands.
- The player may stop early with `End`. Once the send limit is filled, the button becomes `Work on Ship`.
- Ending a regular island round with `End` or `Work on Ship` pays `Ship Wages` before ship actions resolve: gain a baseline `1☠️`, plus `+1☠️` per unused send slot.
- During only rounds `1` and `2` before any boarding has happened, ending a regular non-`Infirmary Island` round exactly 1 send slot short with at least 1 sent pirate adds `+1☠️ Opening Commission` to `Ship Wages`.
- `Opening Commission` does not apply in Battle Test, does not apply to full sends, empty sends, or sends with 2 or more unused slots, does not apply after round `2`, does not apply after the first boarding, and never adds Boarding Alert.
- During only rounds `1` and `2` before any boarding has happened, if `Opening Commission` is earned and at least 1 sent pirate is still in the crew after island effects, the next Shop also gains `Opening Counter Prep`.
- The `Opening Commission` source of `Opening Counter Prep` does not apply in Battle Test, full sends, empty sends, sends with 2 or more unused slots, `Infirmary Island`/healing rounds, after round `2`, after the first boarding, or if every sent pirate was removed by `Siren Island` or another island effect.
- A normal 2-send island therefore pays `3☠️` with 0 sent pirates, `2☠️` with 1 sent pirate, and `1☠️` when both slots are filled; during eligible Opening Commission rounds, the 1-sent one-short payout is `3☠️` instead.
- `Port Island`'s extra send slot counts for `Ship Wages`, so it pays `4☠️`, `3☠️`, `2☠️`, or `1☠️` for 0, 1, 2, or 3 sent pirates; during eligible Opening Commission rounds, the 2-sent one-short payout is `3☠️` instead.
- Whenever `Ship Wages` are paid in a regular run, gain `+1 Boarding Alert` per unused send slot; the baseline `1☠️` adds no Alert. A normal 2-send island adds `2`, `1`, or `0` Alert; `Port Island` adds `3`, `2`, `1`, or `0` Alert.
- `Ship Wages` are not doubled by island bonuses, do not trigger on `Infirmary Island` or boarding rounds, and stack normally with `Skull Island` and pirate ship actions.
- Ending a regular non-`Infirmary Island` round with every available send slot filled grants `Full Crew Discount` for the next Shop phase.
- `Full Crew Discount` gives `-1☠️` on the first successful pirate purchase in that Shop, cannot reduce a price below `0☠️`, does not stack, and does not add Boarding Alert by itself.
- Pirates with island conversion cannot be sent unless the input resource is available.
- `Bosun` cannot go ashore at all.
- On `Siren Island`, a pirate resolves its island action first and is then permanently removed from the crew.
- On a selected `Scouted Counter Cache` island, the first sent pirate opens the cache and checks `Cache Drill` after resolving its island action and after any `Siren Island` removal, so a pirate removed by the island can open and claim the cache but cannot receive the `+1 💪 Might` or refund the cache Alert.
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
- The initial display before an opening route is selected is created as `initialShop(4, 0)`, which in regular runs includes `Poisoner`, `Sawbones`, `Needler`, and 1 economy pirate from `Herald`/`Survivalist`, shuffled.
- Non-curated random shop generation avoids duplicate visible types whenever the eligible pool can support it, falling back to the normal eligible pool only if every eligible type is already visible.
- In regular runs, after the opening route is selected and until Boarding 1 starts, shops are route-focused. The route-selected first ship sets exactly 1 primary opening counter offer: `Forest Island`/`Shellback` → `Poisoner`, `Rocky Island`/`Powder Bomber` → `Sawbones`, and `Port Island`/`Deck Sniper` → `Needler`.
- Until that route's primary opening counter is secured by a qualifying top-deck `Counter Watch` purchase, the visible 4-slot shop contains exactly 1 of `Poisoner`/`Sawbones`/`Needler`, and it must be the route primary. The other opening counter candidates are replaced by distinct affordable non-counter starter shop options from `Drummer`, `Herald`, `Trainer`, and `Survivalist`, falling back to normal unique eligible generation only if needed.
- Once the route primary is secured before Boarding 1, remaining pre-Boarding-1 route-focused shop refills suppress all three opening counter candidates (`Poisoner`, `Sawbones`, `Needler`) and fill with distinct affordable non-counter starter shop options from `Drummer`, `Herald`, `Trainer`, and `Survivalist` where possible, falling back to normal unique eligible non-opening pirates only if needed.
- Buying a non-counter or a discard-only route primary before the route primary is secured does not mark the route counter as secured; the primary remains guaranteed until secured or until Boarding 1 starts.
- Route-focused normalization applies when the route is selected, when the Shop phase opens, after immediate purchase refills, and after end-of-shop `Continue` refills. It does not change prices, setup-gated route-primary `Top deck` eligibility, `Counter Watch`, `Opening Counter Prep`, `Full Crew Discount` coverage, `Dockside Credit`, or counter payoff logic, and a bought route primary keeps those purchase effects when it qualifies for them.
- Route-focused opening shops never apply in `Battle Test` and stop after Boarding 1 starts.
- Outside the route-focused opening window, in regular runs while a next ship is scouted, each initial shop, immediate purchase refill, and end-of-shop `Continue` refill tries to show at least 1 counter pirate for that ship's main scouted enemy.
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
- Before Boarding 1, the selected route's primary opening counter uses that `Top deck` exception only when the purchase spends `Full Crew Discount`, uses Full Crew coverage, consumes `Opening Counter Prep`, or qualifies as a `Dockside Rush Route Counter`; without one of those setup gates, the bought primary goes to discard even though it still counts as a scouted counter, and it does not secure the route shop slot.
- A bought pirate that qualifies for that `Top deck` scouted counter exception also gains `Counter Watch` until the next boarding.
- During rounds `1` and `2` before any boarding has happened, opening non-counter purchases still use the normal discard destination.
- Opening non-counter purchases never consume `Opening Counter Prep`, never become `Top deck` from `Full Crew Discount`, never gain `Counter Watch`, never become `Watch Ready`, never create `Prepared`, never gain prep `Might`, never show counter payoff text, and never receive counter ambush benefits.
- On each Shop `Continue` before that boarding, a watched pirate that is still owned, currently in hand, and was not sent to the island is separated from the discard step and placed on top of the draw pile so it returns in the next hand.
- Sending a watched pirate spends `Counter Watch` unless that same sent pirate earns a new eligible counter `Short Crew Drill` that re-marks `Counter Watch`; Cache Drill and non-counter Short Crew report markers still work normally but do not preserve the watch.
- When a regular-run boarding starts, `Counter Watch` clears. Any watched pirate that is still owned, in the current hand, not `🩹 Wounded`, and whose type counters that boarding's main scouted enemy becomes `Watch Ready` for that boarding.
- `Watch Ready` counts as armed only for `Counter Ambush` damage, `Boarding Alert` guard removal, and regular Boarding 1 `Opening Counter Break` eligibility when the ambush removes zero Alert guards: if that pirate is the front-row ambusher, its `Counter Ambush` deals `5` damage and removes up to 2 Alert guards even without a permanent weapon, `Might`, or `Tempo`.
- `Watch Ready` does not grant or mutate a weapon, `Might`, or `Tempo`; does not create `Prepared`; does not affect `Counter Edge`, `Boarding Trophy`, `Counter Trophy`, or `Ambush Bounty`; and never applies in `Battle Test`.
- A watched pirate that was sent earlier, is absent from the current hand, is `🩹 Wounded`, does not counter the main scouted enemy, or is moved out of the front row before `Fight!` gets no `Watch Ready` ambush benefit.
- A bought pirate that qualifies for that `Top deck` scouted counter exception is also `Prepared` only if at least 1 boarding has already started and that same successful purchase spends `Full Crew Discount`: immediately after purchase, the new pirate itself receives that type's ship-side personal gains (`weapon`, `Might`, and/or `Tempo`).
- Before Boarding 1, `Full Crew Discount` alone does not make `Top deck` scouted counter purchases `Prepared`; those purchases still use the discount, go on top of the draw pile, and gain `Counter Watch`.
- `Opening Counter Prep` is consumed by the first successful eligible `Top deck` scouted-counter purchase in that Shop.
- The `Top deck` scouted counter that consumes `Opening Counter Prep` gets `-1☠️` after any `Full Crew Discount`, cannot be reduced below `0☠️`, goes on top of the draw pile, gains `Counter Watch`, and gains permanent `+1 💪 Might`.
- If that `Opening Counter Prep` purchase is the selected route's primary opening counter before Boarding 1, it still only gets the normal prep purchase effects; it needs a matching active Cache Drill bounty mark, either by claiming the matching `Cache Drill` itself or receiving `Route Starter Pass-Off`, to double `Ambush Bounty`.
- `Opening Counter Prep` never creates `Prepared`: it does not grant the bought pirate's ship-side weapon, ship-side `Might`, ship-side `Tempo`, ship resource output, or ship `☠️`.
- `Opening Counter Prep` does not add or remove `Boarding Alert`, does not affect `Quiet Docks`, and does not stack beyond one `-1☠️` prep discount.
- If `Opening Counter Prep` and `Full Crew Discount` are both present, `Full Crew Discount` applies first, then the prep `-1☠️` applies to the same eligible counter purchase. If that purchase is an eligible `Top deck` scouted counter, both shop flags are consumed and the counter gets prep `+1 💪 Might`; if that purchase is a non-counter, only `Full Crew Discount` is consumed and `Opening Counter Prep` remains available for a later eligible counter in the same Shop.
- A prep or `Prepared` counter purchase may still use `Dockside Credit` for any remaining missing `☠️` after all discounts are applied.
- `Top deck` scouted counter purchases without `Opening Counter Prep` or a post-Boarding-1 `Prepared` trigger still go on top of the draw pile, but are not `Prepared` and gain no prep `Might`; the pre-Boarding-1 selected route primary is the exception and needs `Full Crew Discount`, Full Crew coverage, `Opening Counter Prep`, or `Dockside Rush Route Counter` to be `Top deck`.
- If `Full Crew Discount` is spent on a non-counter first while `Opening Counter Prep` is not active, a later `Top deck` counter purchase in the same Shop is not `Prepared`.
- `Prepared` does not pay ship costs, grant ship resource or `☠️` outputs, target the leftmost island pirate, consume a ship action, or apply in `Battle Test`.
- Prepared weapons and buffs are permanent and use the normal weapon replacement and buff stacking rules.
- The draw pile top is the next card drawn. If multiple Shop `Top deck` pirates are bought, each is placed on top using the normal draw pile order, so the most recent eligible purchase is drawn first.
- Non-counter purchases, purchases when no ship is scouted, purchases when the scouted ship is more than `3` turns away, and all `Battle Test` purchases still go to discard.
- The player may buy any number of pirates as long as enough `☠️` remains.
- `Full Crew Discount`, if earned by filling every island send slot, reduces the effective cost of the first pirate bought in the next Shop by `1☠️`.
- The discount applies before `Dockside Credit` checks missing `☠️`; for example, a cost-`3` pirate with `1☠️` and `Full Crew Discount` is missing only `1☠️`.
- During the regular-run round-1 Shop before any boarding, `Full Crew Discount` coverage pays exactly `1☠️` for a `Top deck` counter to the route-selected first ship, whether that first ship is `Shellback`, `Powder Bomber`, or `Deck Sniper`, if that first purchase spends `Full Crew Discount` and is short exactly `1☠️` after the normal discount.
- `Full Crew Discount` coverage is not spendable currency, does not use `Dockside Credit`, does not mark `shopCreditUsed`, and adds no `Boarding Alert`; the purchase spends the player's current `☠️`, consumes `Full Crew Discount`, goes on top of the draw pile, and gains `Counter Watch`, but the coverage and pre-Boarding-1 discount do not make it `Prepared`, do not grant prep `Might`, and do not double the route primary's `Ambush Bounty`.
- `Full Crew Discount` coverage does not apply without `Full Crew Discount`, from `Opening Counter Prep`, to already-affordable purchases, purchases that do not counter the route-selected first ship, purchases missing `2+☠️`, round `2+`, after the first boarding, after `Dockside Credit` was already used in that Shop, or in `Battle Test`.
- `Full Crew Discount` is consumed only by a successful pirate purchase, never by `Quiet Docks`, and expires on `Continue` if unused.
- `Opening Counter Prep` is consumed only by a successful eligible `Top deck` scouted-counter purchase, never by non-counter purchases or `Quiet Docks`, and expires on `Continue` if unused.
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
  - any still-owned Opening Route Muster pirate that is not already returned by Cache Drill or Short Crew is separated from that discard step and placed below those early reports but above watched counters, using this placement instead of a separate watched-counter placement if it also has `Counter Watch`;
  - any still-owned, held Counter Watch pirate is separated from that discard step and placed below Cache Drill reports, Short Crew reports, and Opening Route Muster but above ordinary Shop `Top deck` purchases;
  - exiled and `get lost` pirates do not return;
  - `☠️` resets to `0`;
  - unused `Full Crew Discount` and `Opening Counter Prep` expire;
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
- `Counter Trophy` uses gameplay counter types: the shop scouted counter map, plus `Opening Deckhand Counter` during regular-run Boarding 1 only. It triggers once per won regular boarding, never on losses, never in Battle Test, and grants nothing if no matching counter pirate survives.
- If a boarding is won by a reinforcement hand, only a matching survivor from that final winning combat hand can receive the `Counter Trophy`.
- `Boarding Trophy`, `Counter Trophy`, Alert guard plunder, Opening plunder, and Ambush Bounty can all stack on the same win when their own conditions are met.
- The old "sum team strength against ship strength" system no longer exists.
- Ship nodes still store a numeric `strength` field, but current combat uses a generated enemy boarding party instead of a direct strength comparison.
- Before the fight, the current ready pirates are automatically packed into a 3-row formation, then the player may drag ready pirates between front, middle, and back rows and reorder them within a row before pressing `Fight!`.
- Wounded pirates in hand sit out and do not become combat fighters.
- Default player setup puts armed ranged pirates in the deepest occupied row behind any melee front and everyone else in the front row.
- In regular-run boarding with a scouted main enemy, the first ready pirate in hand whose type counters that main enemy is placed at the front of the front row by default, even if that pirate has a ranged weapon.
- During regular-run boarding, an active matching `Cache Drill` bounty pirate takes priority for that default front-left counter slot if that exact pirate is still owned, in the current hand, not `🩹 Wounded`, and counters the boarding's main enemy. This puts the cache-drilled counter ahead of unmarked counters, including the `Opening Deckhand Counter` starter during Boarding 1.
- `Cache Drill` default priority never applies in `Battle Test`, wrong-main encounters, absent/wounded/removed pirates, stale markers, or after the bounty mark has cleared.
- The player may still move that defaulted counter before `Fight!`; `Counter Ambush` only triggers if a matching counter is still in the compacted front row when the fight starts.
- Occupied player setup rows compact toward the front whenever the formation is normalized; no ready pirate remains behind an empty row at fight start.
- Enemy setup is fixed before the fight and can be inspected while the player arranges their formation.
- `Fight!` starts autoplay combat using the chosen player formation.
- In regular-run boarding only, `Counter Ambush` checks once when `Fight!` starts for the opening combat hand.
- If the player's compacted front row has at least 1 ready pirate whose type counters that boarding's main scouted enemy, the frontmost then leftmost matching pirate ambushes before normal attack timers begin.
- `Counter Ambush` targets the frontmost then leftmost living enemy with that main archetype, deals `3` damage, and applies `+1 Wound`.
- `Armed Counter Ambush`: if the ambushing counter pirate has any permanent personal upgrade at fight start, meaning a weapon, `1+ 💪 Might`, or `1+ ⚡ Tempo`, that `Counter Ambush` deals `5` damage instead of `3`.
- A `Watch Ready` ambusher also uses the `Armed Counter Ambush` damage and Alert guard-removal limits for that boarding only, without gaining a permanent upgrade; during Boarding 1, it can enable `Opening Counter Break` only if it removes zero Alert guards.
- After damaging and wounding the main scouted enemy, normal `Counter Ambush` also removes up to 1 frontmost then leftmost living `Boarding Alert` guard if any are present.
- `Armed Counter Ambush` removes up to 2 frontmost then leftmost living `Boarding Alert` guards instead of 1.
- Guards removed by `Counter Ambush` do not fight, but still count for normal Alert guard plunder if the boarding is won.
- During regular-run Boarding 1 only, if `Armed Counter Ambush`, including a `Watch Ready` armed ambush, removes zero `Boarding Alert` guards, `Opening Counter Break` also removes 1 frontmost then leftmost living non-Alert weak support enemy, either `Bilge Rat` or `Cabin Boy`, after damaging and wounding the scouted main enemy and before normal combat timers begin.
- A support routed by `Opening Counter Break` is not an Alert guard, grants no Alert guard plunder, and does not trigger in `Battle Test`, reinforcement hands, or Boarding 2+.
- If that Boarding 1 is won, the support routed by `Opening Counter Break` grants separate `Opening plunder` once: `Cabin Boy` grants `+1🪵`, and `Bilge Rat` grants `+1🪨`.
- `Opening plunder` is not Alert guard plunder, does not change Alert guard plunder totals, never triggers on losses, and never triggers in `Battle Test`, reinforcement hands, Boarding 2+, unarmed `Counter Ambush`, or `Armed Counter Ambush` that removes Alert guards instead of routing support.
- After a regular-run boarding is won, if `Counter Ambush` triggered in the opening combat hand and that same ambushing pirate is still alive in the final winning combat hand, grant `Ambush Bounty`: normally `+1` of that main enemy's Scouted Counter Cache resource.
- If that surviving ambusher has a matching active Cache Drill bounty mark from the immediately preceding cache, `Ambush Bounty` pays `+2` of that resource instead of `+1`. Cache Drill bounty marks are then gone with the resolved boarding.
- `Ambush Bounty` uses the cache resource map: `Shellback` → `🪵`, `Powder Bomber` → `🪨`, `Deck Sniper` → `🪙`, `Netter` → `🪵`, `Flint Duelist` → `🪵`.
- `Ambush Bounty` is granted once per boarding, never on losses, never in `Battle Test`, never if the ambusher was defeated, and never if the win comes from a reinforcement hand; those exclusions also prevent the doubled Cache Drill bounty.
- `Ambush Bounty` is separate from Alert guard plunder, Opening plunder, `Boarding Trophy`, and `Counter Trophy`.
- After winning any non-final regular-run boarding, if `Counter Ambush` triggered in the opening combat hand and that same ambushing pirate is still alive in the final winning combat hand, `Counter Ambusher Report` makes that pirate `report next`: on post-boarding `Continue`, it is separated from normal hand discard and placed on top of the draw pile before the next hand is drawn.
- `Counter Ambusher Report` applies to the surviving ambusher, including bought counters and the `Opening Deckhand Counter` starter while that starter is eligible on Boarding 1, preserves any weapon, `Might`, `Tempo`, `Boarding Trophy`, `Counter Trophy`, Cache Drill, Opening Prep, or other personal upgrades already on that pirate, and cannot duplicate the pirate.
- `Counter Ambusher Report` never applies on losses, `Battle Test`, reinforcement-hand wins, final victory boardings, missing `Counter Ambush`, defeated ambushers, or if the ambusher is no longer in the crew at report time.
- `Armed Counter Ambush` is not `Counter Edge`, does not mutate permanent buffs, does not count as an attack, and does not trigger weapon on-hit effects or enemy hit reactions.
- `Counter Ambush` does not grant `Might` or `Tempo`, does not apply in `Battle Test`, and does not trigger for reinforcement hands.
- All pirates share the same base combat stats before weapon and buff modifiers: `9 HP`, `3 damage`, `1350 ms attack`, melee/front-row behavior.
- During a regular-run boarding, each ready player fighter whose pirate type counters that boarding's main scouted enemy has `Counter Edge`: `+1` temporary attack damage for that boarding only.
- `Counter Edge` uses gameplay counter types: the shop scouted counter map, plus `Opening Deckhand Counter` during regular-run Boarding 1 only. It applies to reinforcement hands during the same boarding and does not apply to wounded pirates sitting out.
- `Counter Edge` is not `Might`, is not a permanent buff, does not change stored `Might` or `Tempo`, does not count toward buff count, and does not affect Officer Sabre, Cadence Pistols, or Banner Axe buff-count thresholds.
- `Counter Edge` never applies in `Battle Test`.
- In regular runs, defeated player pirates become `🩹 Wounded`.
- If all current player fighters fall while enemies remain, the run does not immediately end.
- The defeated current hand goes to discard and a new combat hand is drawn from the deck/discard using only pirates that are not `🩹 Wounded`.
- The replacement combat hand draws up to 5 ready pirates; if fewer than 5 ready pirates remain, it draws all of them.
- A regular run is lost only when the crew has no ready pirates left, meaning every pirate in `allCrew` is `🩹 Wounded`.
- After a win, the whole current hand goes to discard except any eligible `Counter Ambusher Report` pirate, a new hand is drawn, and the player returns to the map.
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
- `Boarding 1`: exactly 3 enemies before Alert guards: the selected opening route's main enemy (`Shellback`, `Powder Bomber`, or `Deck Sniper`), exactly 1 `Bilge Rat`, and exactly 1 `Cabin Boy`.
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
  - `layers 0–1`: three parallel non-crossing island paths
  - `layer 2`: first ship node
  - `layers 3–8`: three parallel non-crossing island paths
  - `layer 9`: second ship node
- Each three-node early island layer deals `Forest Island`, `Rocky Island`, and `Port Island` once in shuffled order.
- During the opening block before `Boarding 1`, `layers 0–1` reuse the same shuffled `Forest Island`/`Rocky Island`/`Port Island` lane order, so each straight opening path keeps its island identity from the first visible island into the `layer 1` cache.
- The three islands on `layer 1` are the Boarding 1 route caches: Forest plans for `Shellback`, Rocky plans for `Powder Bomber`, and Port plans for `Deck Sniper`.
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
