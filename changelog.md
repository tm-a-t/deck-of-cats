# Changelog

This file records gameplay and loop-driven changes. Future loop Developer steps must append entries here whenever they change the game.

## 2026-04-27 — run 20260427-130306 — rev 0a4c19b — build 0.1.0

- Gameplay: true - Added Alarm-Rushed Route Counter: before Boarding 1, a selected route-primary counter bought at 3+ projected pending Alert now top-decks and gains Counter Watch without Opening Prep discounts/Might, Prepared gains, Route Starter Pass-Off, Cache Drill marks, Alert refunds, Full Crew coverage, or doubled Ambush Bounty. Validated with JS syntax checks, targeted alarm-rushed route counter, opening route shop, Opening Counter Prep, route starter pass-off, counter recruit, opening route prize, drilled Ambush Bounty, and Full Crew coverage sim checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-130306.log`.

## 2026-04-27 — run 20260427-124532 — rev 5c30cc3 — build 0.1.0

- Gameplay: true - Added Route Starter Pass-Off: when a Boarding 1 starter counter opens its route cache and the resulting Route Starter Cache Prep buys the matching route-primary counter, the active Cache Drill bounty mark moves from the starter to that bought specialist while the starter keeps Might, Alert refund, early report, and Counter Watch. Validated with JS syntax checks, targeted opening deckhand/pass-off, opening route shop, Opening Counter Prep, and drilled Ambush Bounty sim checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-124532.log`.

## 2026-04-27 — run 20260427-122922 — rev 4596c5b — build 0.1.0

- Gameplay: true - Added Route Starter Cache Prep: a successful Boarding 1 first-opener Cache Drill by the selected route's starter counter now arms the next Shop's normal Opening Counter Prep if the route primary has not been bought, giving full-send and skipped-buy openings a recoverable discounted top-deck counter path while preserving the stronger one-short setup. Validated with targeted opening deckhand/cache/prep/shop sim checks, JS syntax checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-122922.log`.

## 2026-04-27 — run 20260427-121151 — rev 88d5c84 — build 0.1.0

- Gameplay: true - Changed Scouted Counter Caches from route-selection payouts into first-sent cache openings: selecting a cache now only arms the island objective, the first opener claims the stored stakes, only a surviving eligible first opener can trigger Cache Drill and refund that cache Alert, later sends cannot drill, and zero-send cache islands skip the cache reward entirely. Validated with JS syntax checks, targeted scouted cache/opening route/deckhand/counter recruit/muster/prep/Short Crew/drilled bounty/map/counter ambush sim checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-121151.log`.

## 2026-04-27 — run 20260427-112625 — rev 3d5194a — build 0.1.0

- Gameplay: true - Consolidated the doubled opening Ambush Bounty onto Cache Drill: Opening Counter Prep route-primary buys still discount, top-deck, Watch, and gain +1 Might, but preview and pay normal +1 bounty unless that pirate claims the matching cache; active Cache Drill bounty counters now lead the default formation ahead of unmarked counters. Validated with JS syntax checks, `node sim/fast-sim.js --check-cache-drill-opening-payoff --json`, `node sim/fast-sim.js --check-drilled-ambusher-bounty --json`, `node sim/fast-sim.js --check-opening-route-counter-shop --json`, `node sim/fast-sim.js --check-counter-ambush --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-112625.log`.

## 2026-04-27 — run 20260427-111422 — rev 8eaf07f — build 0.1.0

- Gameplay: true - Opening Route Prize counters now lead the default Boarding 1 formation when the prep-qualified route primary is ready in hand, so pressing `Fight!` shows that bought counter, not the mustered starter, deliver the Counter Ambush and existing `+2` Ambush Bounty payoff; absent, wounded, removed, wrong-main, Battle Test, and Boarding 2+ cases keep the prior fallback. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-route-prize --json`, `node sim/fast-sim.js --check-counter-ambush --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-111422.log`.

## 2026-04-27 — run 20260427-105436 — rev 6d8a959

- Gameplay: true - Added setup-gated opening route-primary buys: pre-Boarding-1 route primaries now top-deck and gain Counter Watch only when bought through Full Crew Discount/coverage or Opening Counter Prep, cash/credit-only primary buys secure the route but go to discard without Watch or prize, and Opening Route Prize is now recorded only for prep-qualified primary buys. Validated with JS syntax checks, targeted opening route prize/shop/prep/full-crew/counter/cache/ambush sim checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-105436.log`.

## 2026-04-27 — run 20260427-103740 — rev 3702e94

- Gameplay: true - Replaced `Opening Route Contract` with `Opening Route Prize`: the bought route primary now keeps its marker into Boarding 1 and doubles that pirate's surviving Counter Ambush `Ambush Bounty` to `+2` of the mapped cache resource, without stacking above `+2` with Cache Drill and without any Cache Drill `☠️` payout. Validated with targeted route prize/cache/ambush sim checks, JS syntax checks, `git diff --check`, and the 10-run smoke sim.

## 2026-04-27 — run 20260427-102218 — rev 1b6ae88

- Gameplay: true - Added Drilled Ambusher Bounty: the pirate that claims Cache Drill is now marked for the immediately following matching scouted boarding, and if that same pirate triggers Counter Ambush, survives the winning opening combat hand, and normal Ambush Bounty applies, the bounty pays `+2` of the mapped cache resource instead of `+1`; wrong-main, later-ship, loss, defeated-ambusher, reinforcement, missing-ambush, and Battle Test cases still pay no doubled bounty. Validated with JS syntax checks, `node sim/fast-sim.js --check-drilled-ambusher-bounty --json`, related counter/cache/opening-route checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-102218.log`.

## 2026-04-27 — run 20260427-094326 — rev c55c1c0

- Gameplay: true - Added Opening Route Contract: buying the selected route's primary counter before claiming its matching Boarding 1 Scouted Counter Cache now grants a distinct one-time `+1☠️` cache bonus with no extra Alert, no island doubling, no Cache Drill refund interaction, and no Battle Test, post-Boarding-1, wrong-counter, or late-purchase payout. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-route-contract --json`, `node sim/fast-sim.js --check-scouted-counter-cache --json`, `node sim/fast-sim.js --check-opening-route-counter-shop --json`, `node sim/fast-sim.js --check-opening-counter-prep --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-094326.log`.

## 2026-04-27 — run 20260427-092658 — rev 535ccc5

- Gameplay: true - Opening Counter Prep now discounts the first eligible pre-Boarding-1 `Top deck` scouted-counter purchase by `-1☠️` after any `Full Crew Discount`, while still granting `+1💪`, `Counter Watch`, and top-deck placement; non-counters preserve prep, route primaries show the reduced price, and Dockside Credit only covers any remaining missing `☠️`. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-counter-prep --json`, `node sim/fast-sim.js --check-opening-route-counter-shop --json`, `node sim/fast-sim.js --check-opening-counter-subsidy --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-full-crew-coverage --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-092658.log`.

## 2026-04-27 — run 20260427-091315 — rev da38ec8

- Gameplay: true - Opening Route Muster now also grants the selected starter route counter `Counter Watch` until Boarding 1, shows the starter Watch contract in opening route cache badges, next-ship intel, and route-counter card badging, and keeps the mustered watched starter in the Opening Route Muster draw priority without duplicating it or spending its watch. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-route-muster --json`, related opening route/deckhand/cache/shop/counter/Short Crew checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-091315.log`.

## 2026-04-27 — run 20260427-090115 — rev fb8cfd0

- Gameplay: true - Made Boarding 1 route caches carry lane-specific stakes: Forest/Shellback now pays only `+1🪵`, Rocky/Powder Bomber pays `+1🪨 +1☠️ +1 Alert`, and Port/Deck Sniper pays `+1🪙 +2☠️ +2 Alert`, while Boarding 2+ caches keep the normal `+1` resource, `+1☠️`, `+1 Alert` package and Cache Drill refunds each cache's stored Alert amount. Validated with JS syntax checks, `node sim/fast-sim.js --check-scouted-counter-cache --json`, `node sim/fast-sim.js --check-opening-route-captains --json`, `node sim/fast-sim.js --check-opening-deckhand-counters --json`, related opening route muster/shop/map checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-090115.log`.

## 2026-04-27 — run 20260427-084606 — rev a4b0991

- Gameplay: true - Added Opening Route Muster: the first selected pre-Boarding-1 route now marks one matching starter counter (Forest/Rigger, Rocky/Ballaster, Port/Armsman) to return on the next Shop Continue below Cache/Short Crew reports but above Counter Watch and shop top-deck cards, without granting buffs, weapons, Alert refunds, discounts, or Battle Test behavior. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-route-muster --json`, related opening deckhand/route shop/scouted cache/counter recruit checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-084606.log`.

## 2026-04-27 — run 20260427-083709 — rev 5226ed4

- Gameplay: true - Locked the opening route lanes so layers `0` and `1` reuse one shuffled Forest/Rocky/Port order; each first visible route now connects straight into the matching Boarding 1 Scouted Counter Cache, preserving route enemy, starter counter, primary shop counter, and cache resource identity. Validated with JS syntax checks, targeted map schedule/opening route captain/scouted cache/route shop/opening deckhand counter checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-083709.log`.

## 2026-04-27 — run 20260427-082500 — rev 027b8c7

- Gameplay: true - Changed route-focused pre-Boarding-1 shops to guarantee the selected route primary counter only until the first successful purchase, then suppress `Poisoner`/`Sawbones`/`Needler` from the remaining opening shop refills in favor of distinct affordable non-counter starter options; non-counter first buys leave the primary guarantee intact, and the bought primary keeps existing top-deck, Counter Watch, Opening Counter Prep, Full Crew coverage, and Dockside Credit behavior. Validated with JS syntax checks, targeted opening route shop/opening prep/full-crew/counter-recruit/route-captain/deckhand/cache/ambush checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-082500.log`.

## 2026-04-27 — run 20260427-080840 — rev b022801

- Gameplay: true - Added route-locked pre-Boarding-1 shop curation: after the opening route is chosen, Forest/Shellback shops show only Poisoner from the opening counter trio, Rocky/Powder Bomber shops show only Sawbones, and Port/Deck Sniper shops show only Needler, with the other opening counters replaced by affordable starter non-counters while existing price, top-deck, Counter Watch, Opening Counter Prep, Full Crew coverage, Dockside Credit, Battle Test, and post-Boarding-1 behavior stay intact. Validated with JS syntax checks, targeted route-shop/opening-prep/scouted-shop/route-captain/full-crew/counter-recruit/deckhand/cache/Short-Crew/ambush/map checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-080840.log`.

## 2026-04-27 — run 20260427-071843 — rev 8dedde6

- Gameplay: true - Made round-1 `Full Crew Discount` coverage route-agnostic: full-send Rocky and Port openings can now cover the missing `1☠️` for Sawbones/Needler first-ship counters just like the Forest Shellback lane, without Dockside Credit, Alert, `Prepared`, or Opening Prep Might. Validated with JS syntax checks, `node sim/fast-sim.js --check-full-crew-coverage --json`, `node sim/fast-sim.js --check-opening-route-counter-shop --json`, `node sim/fast-sim.js --check-opening-counter-prep --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, related scouted counter/cache/route-captain checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-071843.log`.

## 2026-04-27 — run 20260427-070200 — rev ef627f3

- Gameplay: true - Added Opening Route Captains: the three Boarding 1 cache lanes now plan different first-ship enemies (`Forest` → Shellback, `Rocky` → Powder Bomber, `Port` → Deck Sniper), selecting an opening route rewrites Boarding 1 to that main enemy plus one Bilge Rat and one Cabin Boy, and the regular starter shop now always shows Poisoner, Sawbones, Needler, and one economy pirate so every route has an immediate counter candidate. Validated with JS syntax checks, targeted opening-route-captain/opening-route-shop/scouted-cache/map/shop/prep/full-crew/counter-recruit/ambush/Short-Crew/opening-commission/Alert checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-070200.log`.

## 2026-04-27 — run 20260427-065333 — rev ee8de63

- Gameplay: true - Boarding 1 Shellback Scouted Counter Cache lanes now pay route-specific prep resources: Forest grants `+1🪵`, Rocky grants `+1🪨`, and Port grants `+1🪙`, while all three still keep Shellback as the cache enemy for counter-shop, Cache Drill, Alert refund, and Counter Watch behavior; Boarding 2+ cache resources and Ambush Bounty still use the normal scouted enemy resource map. Validated with JS syntax checks, targeted scouted-cache/first-Shellback/map-schedule/opening-Shellback checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-065333.log`.

## 2026-04-27 — run 20260427-064347 — rev c37deb3

- Gameplay: true - Boarding 1 now marks every eligible pre-ship island lane as a Shellback Scouted Counter Cache while Boarding 2+ still marks exactly one preferred cache, so any opening route can claim the existing +1 resource, +1☠️, +1 Alert, and Cache Drill package. Validated with JS syntax checks, targeted scouted-cache/first-Shellback/map-schedule/opening-Shellback/shop checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-064347.log`.

## 2026-04-27 — run 20260427-063512 — rev 6100059

- Gameplay: true - Moved Boarding 1 to layer `2` by changing the early map pacing from `3/5` island layers to `2/6`, keeping Boarding 2 on layer `9`, total map length at `40`, and the later ship schedule unchanged so Opening Counter Prep has a hard two-turn deadline before Shellback. Validated with JS syntax checks, targeted map/first-Shellback/cache/shop/opening checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-063512.log`.

## 2026-04-27 — run 20260427-062400 — rev 9b48008

- Gameplay: true - Removed the opening non-counter report exceptions: round-1/2 pre-boarding non-counter buys now discard normally, never consume `Opening Counter Prep`, and no longer top-deck from `Full Crew Discount`; the prep persists through non-counter buys, `Full Crew Discount`, Dockside Credit, and `Quiet Docks` until an eligible scouted-counter top-deck buy consumes it for `+1💪` and `Counter Watch`, or until Shop `Continue` expires it. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-counter-prep --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-full-crew-coverage --json`, `node sim/fast-sim.js --check-opening-shellback-counter --json`, `node sim/fast-sim.js --check-scouted-counter-shop --json`, `node sim/fast-sim.js --check-counter-ambush --json`, `node sim/fast-sim.js --check-short-crew-drill --json`, `node sim/fast-sim.js --check-opening-commission --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-062400.log`.

## 2026-04-27 — run 20260427-060834 — rev d85cd85

- Gameplay: true - Added `Opening Commission Report`: during round-1/2 pre-boarding Shops, the first successful non-counter buy while `Opening Counter Prep` is active now consumes the prep and top-decks once without `Counter Watch`, `Watch Ready`, `Prepared`, prep Might, or counter payoff perks; normal `Full Crew Discount` and `Dockside Credit` still apply, while eligible scouted-counter prep buys keep `+1💪`, `Counter Watch`, and top-deck placement. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-counter-prep --json`, `node sim/fast-sim.js --check-opening-commission --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-opening-shellback-counter --json`, `node sim/fast-sim.js --check-full-crew-coverage --json`, `node sim/fast-sim.js --check-scouted-counter-shop --json`, `node sim/fast-sim.js --check-counter-ambush --json`, `node sim/fast-sim.js --check-short-crew-drill --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-060834.log`; local browser harness was blocked by sandbox HTTP server permission.

## 2026-04-27 — run 20260427-055756 — rev d041ebd

- Gameplay: true - Banked `Opening Counter Prep` through non-counter buys and `Quiet Docks` so it is consumed only by a successful eligible `Top deck` scouted-counter purchase, preserving normal `Full Crew Discount` and `Dockside Credit` behavior while the later counter gets `+1💪`, `Counter Watch`, and top-deck placement. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-counter-prep --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-full-crew-coverage --json`, `node sim/fast-sim.js --check-opening-shellback-counter --json`, `node sim/fast-sim.js --check-scouted-counter-shop --json`, `node sim/fast-sim.js --check-counter-ambush --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-055756.log`.

## 2026-04-27 — run 20260427-054949 — rev b1a6fcf

- Gameplay: true - Enabled `Watch Ready` to trigger regular Boarding 1 `Opening Counter Break` when its armed counter ambush removes zero Alert guards, preserving no permanent weapon/Might/Tempo mutation while Alert-guard ambushes, Battle Test, reinforcements, and Boarding 2+ remain excluded; added fast-sim coverage for no-Alert Watch Ready routing support and Alert Watch Ready only cutting guards. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-ambush --json`, `node sim/fast-sim.js --check-alert-tiers --json`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-054949.log`.

## 2026-04-27 — run 20260427-053743 — rev 2cc3182

- Gameplay: true - Added `Opening Full Crew Report`: during round-1/2 pre-boarding Shops, the first successful non-counter purchase that spends `Full Crew Discount` now top-decks once, including Dockside Credit buys with normal Alert, without gaining `Counter Watch`, `Watch Ready`, `Prepared`, Opening Prep Might, counter payoff text, or ambush perks; scouted counters still watch, and non-discount/post-boarding/Battle Test non-counters still discard. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-opening-counter-prep --json`, `node sim/fast-sim.js --check-full-crew-coverage --json`, `node sim/fast-sim.js --check-opening-shellback-counter --json`, `node sim/fast-sim.js --check-scouted-counter-shop --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-053743.log`.

## 2026-04-27 — run 20260427-052011 — rev d2795af

- Gameplay: true - Replaced the opening counter setup with `Opening Counter Prep`: eligible round-1/2 one-short pre-boarding Shops now spend the prep on the first successful purchase, giving a first `Top deck` scouted counter `+1💪`, `Counter Watch`, and top-deck placement without `Prepared` ship gains, while non-counter first buys consume it with no benefit; round-1 `Full Crew Discount` coverage now covers a one-short Shellback counter without Dockside Credit, Alert, Might, or `Prepared`, and post-Boarding-1 `Full Crew Discount` preparation is unchanged. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-counter-prep --json`, `node sim/fast-sim.js --check-full-crew-coverage --json`, `node sim/fast-sim.js --check-opening-shellback-counter --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, related counter/cache/shop/Short Crew/ambush checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-052011.log`.

## 2026-04-27 — run 20260427-050754 — rev 3691074

- Gameplay: true - Before Boarding 1, `Full Crew Discount` and `Opening Counter Subsidy` no longer make `Top deck` scouted-counter buys `Prepared`; they still apply discount/subsidy affordability, top-deck placement, and `Counter Watch`, while `Opening Counter Plan` remains the pre-Boarding-1 `Prepared` route and post-boarding `Full Crew Discount` preparation is unchanged. Validated with JS syntax checks, opening counter subsidy/plan/Shellback targeted checks, scouted counter recruit/cache/shop targeted checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-050754.log`.

## 2026-04-27 — run 20260427-045829 — rev 0381b5d

- Gameplay: true - Opening regular shops for the guaranteed Boarding 1 `Shellback` now lock the `Poisoner`/`Drummer` starter lane to `Poisoner`, keeping the guaranteed `Needler` lane and preserving non-Shellback/Battle Test starter behavior; a round-1 full-send can now buy prepared `Poisoner` for `1☠️` with `Full Crew Discount` and no Dockside Credit, Opening Counter Subsidy, or Alert. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-shellback-counter --json`, `node sim/fast-sim.js --check-scouted-counter-shop --json`, `node sim/fast-sim.js --check-first-shellback --json`, `node sim/fast-sim.js --check-opening-counter-subsidy --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-045829.log`.

## 2026-04-27 — run 20260427-045142 — rev a4f0d9f

- Gameplay: true - Guaranteed regular Boarding 1 now scouts `Shellback` with exactly one `Bilge Rat` and one `Cabin Boy`, preserving the Shellback wood cache and leaving Boarding 2+ random blueprint generation unchanged. Validated with JS syntax checks, `node sim/fast-sim.js --check-first-shellback --json`, `node sim/fast-sim.js --check-map-schedule --json`, `node sim/fast-sim.js --check-scouted-counter-cache --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-045142.log`.

## 2026-04-27 — run 20260427-042146 — rev 9da3b63

- Gameplay: true - Added Opening Counter Subsidy: in the round-1 regular Shop before any boarding, a Full Crew Discount top-deck scouted counter that is short exactly `1☠️` after discount is covered without Dockside Credit, `shopCreditUsed`, or Boarding Alert while still becoming Prepared. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-counter-subsidy --json`, counter recruit/shop/cache/opening commission/Short Crew targeted checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-042146.log`.

## 2026-04-27 — run 20260427-040929 — rev 4979701

- Gameplay: false - Added Counter Payoff Preview copy for visible scouted-counter shop pirates and sending-plan best buys, showing the target enemy, 3/1 vs 5/2 ambush payoff, and the mapped surviving-ambusher bounty resource without changing combat math, prices, resources, or draw order. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-counter-ambush --json`, `node sim/fast-sim.js --check-scouted-counter-cache --json`, `node sim/fast-sim.js --check-short-crew-drill --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-040929.log`.

## 2026-04-27 — run 20260427-035540 — rev 79471ca

- Gameplay: true - Counter Watch now arms eligible held scouted counters as `Watch Ready` for the watched boarding's `Counter Ambush` only, giving the 5-damage and up-to-2 Alert-guard Armed Ambush payoff without permanent weapon, Might, or Tempo changes and without Battle Test or Opening Counter Break effects. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-ambush --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-short-crew-drill --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-035540.log`.

## 2026-04-27 — run 20260427-034521 — rev 4c3a11b

- Gameplay: true - Counter Short Crew Drill now grants `Counter Watch` when the drilled pirate reports early and counters the next scouted ship, so the first report top-decks it once and the watch keeps returning it on later Shop Continues until it is sent without a refreshed eligible drill or the boarding starts. Validated with JS syntax checks, `node sim/fast-sim.js --check-short-crew-drill --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-scouted-counter-cache --json`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-034521.log`.

## 2026-04-27 — run 20260427-033639 — rev 12766f8

- Gameplay: true - Moved Opening Commission from full sends to exactly-one-short early island sends: normal 1-of-2 and Port 2-of-3 sends now get the `+1☠️` commission, while full sends keep `Full Crew Discount` without the extra wage. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-commission --json`, counter recruit/cache/Short Crew targeted checks, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-033639.log`.

## 2026-04-27 — run 20260427-032628 — rev 92e0257

- Gameplay: true - Added Ambush Bounty: winning a regular boarding with a surviving opening `Counter Ambush` pirate now grants `+1` of the scouted enemy's cache resource, while defeated ambushers, reinforcement wins/losses, losses, and Battle Test grant none; it stacks with Alert guard plunder, Opening plunder, Boarding Trophy, and Counter Trophy. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-ambush --json`, `node sim/fast-sim.js --check-alert-tiers --json`, `node sim/fast-sim.js --check-boarding-trophy --json`, `node sim/fast-sim.js --check-counter-trophy --json`, `node sim/fast-sim.js --check-counter-edge --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-032628.log`.

## 2026-04-27 — run 20260427-031502 — rev b81c2e3

- Gameplay: true - Added Opening Break Plunder: winning regular Boarding 1 after `Opening Counter Break` now grants separate `+1🪵` from a routed `Cabin Boy` or `+1🪨` from a routed `Bilge Rat`, without changing Alert guard plunder and with no payout on losses, Battle Test, reinforcements, later boardings, unarmed ambushes, or Alert-guard ambushes. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-ambush --json`, `node sim/fast-sim.js --check-alert-tiers --json`, `node sim/fast-sim.js --check-boarding-trophy --json`, `node sim/fast-sim.js --check-counter-trophy --json`, `node sim/fast-sim.js --check-counter-edge --json`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-031502.log`.

## 2026-04-27 — run 20260427-030600 — rev 7fe1851

- Gameplay: true - Added Opening Counter Break: Boarding 1 Armed Counter Ambushes with no Alert guards now route one front-left non-Alert `Bilge Rat` or `Cabin Boy` support without creating Alert plunder, while Alert guards, Battle Test, reinforcement hands, and later boardings keep their existing behavior. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-ambush --json`, `node sim/fast-sim.js --check-alert-tiers --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-030600.log`.

## 2026-04-27 — run 20260427-025208 — rev c9b5dba

- Gameplay: true - Counter Short Crew now refunds the one unused-slot `Boarding Alert` when the drilled pirate counters the next scouted ship, with a three-row sending planner showing `End now`, `One short`, and `Fill crew` plus the conditional refund. Validated with local syntax checks, targeted Short Crew/scouted counter checks, `git diff --check`, and the 10-run fast sim smoke.

## 2026-04-27 — run 20260427-014704 — rev 5b11c2f

- Gameplay: true - Scouted Counter Cache islands now pay a `+1☠️` counter bounty in addition to their mapped resource and `+1 Boarding Alert`, with map/floating labels showing the bounty; Cache Drill still only refunds the cache Alert and leaves the bounty available for prepared top-deck counter buys. Validated with JS syntax checks, `node sim/fast-sim.js --check-scouted-counter-cache --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-scouted-counter-shop --json`, `node sim/fast-sim.js --check-map-schedule --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-014704.log`.

## 2026-04-27 — run 20260427-012701 — rev 14f48e0

- Gameplay: true - Counter Ambush now cuts the alarm: after a front-row matching counter wounds and damages the scouted main enemy, it removes the frontmost then leftmost living Boarding Alert guard before combat starts, and that removed guard is excluded from win plunder while remaining guards still pay normally. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-ambush --json`, `node sim/fast-sim.js --check-alert-tiers --json`, `node sim/fast-sim.js --check-boarding-trophy --json`, `node sim/fast-sim.js --check-counter-trophy --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-012701.log`.

## 2026-04-27 — run 20260427-005931 — rev 5d598df

- Gameplay: true - Added Counter Edge for scouted boardings: during regular-run boarding combat, ready pirate fighters whose type counters the ship's main scouted enemy get `+1` temporary damage for that boarding, including reinforcement hands, without mutating Might/Tempo or buff-count weapon thresholds; matching fighters show the edge in combat details and on their combat mini-card. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-edge --json`, `node sim/fast-sim.js --check-counter-trophy --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-005931.log`.

## 2026-04-27 — run 20260427-004528 — rev 17e8458

- Gameplay: true - Cache Drill now musters the drilled counter for the scouted fight: the first surviving matching counter that claims Cache Drill is marked, then on the next Shop `Continue` it is placed on top of the draw pile above any shop `Top deck` buys, without duplicating the card or mustering removed pirates. Validated with JS syntax checks, `node sim/fast-sim.js --check-scouted-counter-cache --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-map-schedule --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-004528.log`.

## 2026-04-27 — run 20260426-232438 — rev 17e8458

- Gameplay: true - Prepared counter recruits now require the same purchase to spend `Full Crew Discount`: no-discount and credit-only scouted counters still go `Top deck` but gain no personal weapon or buffs, discount-plus-credit counters still prepare, and spending the discount on a non-counter prevents later preparation in that Shop. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-232438.log`.

## 2026-04-27 — run 20260426-230253 — rev ea04d19

- Gameplay: true - Cache Drill now disarms its Scouted Counter Cache alarm: the first surviving matching counter still gains `+1💪` and also refunds that cache's own pending `Boarding Alert` once, clamped to the pre-cache Alert floor, while non-counters, Battle Test, unmarked/claimed caches, ship/Infirmary nodes, and Siren-removed pirates do not qualify. Validated with JS syntax checks, `node sim/fast-sim.js --check-scouted-counter-cache --json`, `node sim/fast-sim.js --check-port-drill --json`, `node sim/fast-sim.js --check-scouted-counter-shop --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-map-schedule --json`, `node sim/fast-sim.js --check-alert-tiers --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-230253.log`.

## 2026-04-26 — run 20260426-224644 — rev 1eaf590

- Gameplay: true - Added Cache Drill to Scouted Counter Cache islands: the first surviving sent pirate that counters the cache's scouted enemy gains `+1💪` Might immediately after its island action, once per cache, while non-counters, Battle Test, unmarked/claimed caches, ship/Infirmary nodes, and Siren-removed pirates do not qualify. Validated with JS syntax checks, `node sim/fast-sim.js --check-scouted-counter-cache --json`, `node sim/fast-sim.js --check-port-drill --json`, `node sim/fast-sim.js --check-scouted-counter-shop --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-map-schedule --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-224644.log`.

## 2026-04-26 — run 20260426-223423 — rev 95c8ba5

- Gameplay: true - Added Scouted Counter Cache route nodes before each scouted ship: one preceding island now offers `+1` mapped counter resource for `+1 Boarding Alert`, marks itself claimed on selection, and displays a compact map badge. Validated with JS syntax checks, `node sim/fast-sim.js --check-scouted-counter-cache --json`, `node sim/fast-sim.js --check-map-schedule --json`, `node sim/fast-sim.js --check-scouted-counter-shop --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-223423.log`.

## 2026-04-26 — run 20260426-222115 — rev 1d3722f

- Gameplay: true - Added Counter Trophy: winning a regular-run boarding now gives `+1⚡` Tempo to the frontmost then leftmost surviving pirate that counters the ship's main scouted enemy, while losses, Battle Test, and wins without surviving counters grant none. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-trophy --json`, `node sim/fast-sim.js --check-boarding-trophy --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-222115.log`.

## 2026-04-26 — run 20260426-220804 — rev a8ce505

- Gameplay: true - Added Prepared Counter Recruits: regular-run `Top deck` scouted counter purchases now immediately receive their own ship-side personal weapon and/or buffs without paying ship costs, producing ship outputs, or targeting island pirates. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-scouted-counter-shop --json`, `node sim/fast-sim.js --check-alert-tiers --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-220804.log`.

## 2026-04-26 — run 20260426-215611 — rev 908def7

- Gameplay: true - Added Counter Recruits Report Early: regular-run scouted counter pirates bought within 3 map turns of the next ship now go to the top of the draw pile, including Dockside Credit and Full Crew Discount buys, while other purchases still go to discard; eligible shop slots are labeled `Top deck`. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-recruits-report-early`, `node sim/fast-sim.js --check-scouted-counter-shop`, `node sim/fast-sim.js --check-alert-tiers`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-215611.log`.

## 2026-04-26 — run 20260426-214509 — rev 234051e

- Gameplay: true - Added Boarding Trophy: winning a regular-run boarding now gives `+1💪` Might to the frontmost then leftmost surviving pirate in the final combat hand, once per win, while losses and Battle Test grant none. Validated with JS syntax checks, `node sim/fast-sim.js --check-boarding-trophy`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-214509.log`.

## 2026-04-26 — run 20260426-213630 — rev d07181f

- Gameplay: true - Moved the first boarding one island earlier: early map segments are now 3 island layers into ship 1 on layer `3`, then 5 island layers into ship 2 on layer `9`, with later ships unchanged. Validated with JS syntax checks, `node sim/fast-sim.js --check-map-schedule`, existing targeted gameplay checks, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-213630.log`.

## 2026-04-26 — run 20260426-211930 — rev 34e9c64

- Gameplay: true - Added the Scouted Counter Shop Slot: regular-run shops now force an eligible visible counter for the next scouted ship's main enemy when the cost-gated pool can support one, and shop/sending recommendations label same-tier counter buys. Validated with JS syntax checks, `node sim/fast-sim.js --check-scouted-counter-shop`, `node sim/fast-sim.js --check-alert-tiers`, `node sim/fast-sim.js --check-opening-commission`, `node sim/fast-sim.js --check-port-drill`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-211930.log`.

## 2026-04-26 — run 20260426-210722 — rev 196e54e

- Gameplay: true - Added scouted next-ship boarding intel: the top HUD, Shop panel, and nearest unreached ship node now show the next ship's pre-generated base enemy roster while keeping Boarding Alert guards/plunder as a separate suffix; validated with JS syntax checks, a targeted no-mutation/scouted-roster check, `node sim/fast-sim.js --check-alert-tiers`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-210722.log`.

## 2026-04-26 — run 20260426-201641 — rev 451e99a

- Gameplay: false - Added a sending-phase `End now` vs `Fill crew` planning strip that projects Ship Wages, added Boarding Alert guards, Full Crew Discount, and the best visible shop buy including Dockside Credit Alert; exposed the same projections in local test state. Validated with JS syntax checks, targeted projection/no-mutation checks, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-201641.log`.

## 2026-04-25 — run 20260425-230532 — rev 9c26e14

- Gameplay: Added Ship Wages so unused island send slots pay early `☠️` before ship actions, including Port Island's third slot.

## 2026-04-25 — run 20260425-233008 — rev 9c26e14

- Gameplay: Ship Wages now add persistent Boarding Alert equal to unused send slots; the next regular boarding consumes the Alert and gives all enemies capped bonus HP.

## 2026-04-26 — run 20260425-235650 — rev 9c26e14

- Gameplay: Boarding setup now lets the player drag ready pirates to choose row placement and order before `Fight!`; wounded pirates still sit out, formation rows compact forward, and enemy/player combat cards scale to keep setup parties visible.

## 2026-04-26 — run 20260426-010435 — rev 9c26e14

- Gameplay: Boarding Alert now consumes into visible guard reinforcements: Alert `1–3` adds a `Cabin Boy`, while Alert `4+` adds a `Cabin Boy` plus a `Bilge Rat`, with no Alert HP bonus.

## 2026-04-26 — run 20260426-014629 — rev 93098e4

- Gameplay: Armsman now has a ship-side `🪵 → 🔫 Rusty Pistol` craft, creating an early ranged formation branch while keeping its island Hammer grant unchanged.

## 2026-04-26 — run 20260426-030234 — rev 93098e4

- Gameplay: Boarding Alert guard pressure now has a third tier: Alert `7+` adds 2 `Cabin Boys` and 1 `Bilge Rat`, while Alert `1–3` and `4–6` retain their lower guard tiers.

## 2026-04-26 — run 20260426-041947 — rev 93098e4

- Gameplay: Added the `Quiet Docks` shop service: spend `2☠️` during regular-run shopping to reduce pending Boarding Alert by `1` without changing pirate shop slots.

## 2026-04-26 — run 20260426-054604 — rev 93098e4

- Gameplay: Replaced the fully random opening shop with curated starter lanes: one wood combat hook, one stone combat hook, guaranteed `Needler`, and one early economy hook, shuffled into the initial 4 slots.

## 2026-04-26 — run 20260426-070904 — rev 93098e4

- Gameplay: Changed the opening map from a single forced lane to three parallel non-crossing island routes on layers `0–3`, converging into the first ship on layer `4`; early three-node island layers now deal `Forest`, `Rocky`, and `Port` once each. The headless sim now no-ops the map panel UI so it can exercise opening route choices directly.

## 2026-04-26 — run 20260426-083310 — rev 93098e4

- Gameplay: Winning a regular boarding now plunders the consumed Boarding Alert guards once: Alert `1–3` grants `+1🪵`, Alert `4–6` grants `+1🪵 +1🪨`, and Alert `7+` grants `+2🪵 +1🪨`; losses and Battle Test grant no Alert plunder.

## 2026-04-26 — run 20260426-095810 — rev 93098e4

- Gameplay: Boarding 1 now always generates one random eligible strong enemy plus exactly one `Bilge Rat` and one `Cabin Boy` before any Boarding Alert guards are appended.

## 2026-04-26 — run 20260426-111817 — rev 93098e4

- Gameplay: true - Shop windows now avoid duplicate visible pirate types for non-curated random generation, immediate purchase refills, and Continue refills whenever the cost-gated eligible pool has an unused type.

## 2026-04-26 — run 20260426-123317 — rev 93098e4

- Gameplay: true - Powder Bombers now fizzle instead of death-blasting when defeated with `1+ Wounds`; validated with targeted death-effect checks and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-123317.log`.

## 2026-04-26 — run 20260426-191311 — rev 025d87d

- Gameplay: true - Ship-side weapon and buff rewards now apply directly to the leftmost surviving island pirate, with no-target personal gains lost while paid outputs still resolve; validated with `node --check js/scene.js`, `node --check js/constants.js`, targeted ship-gain checks, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-191311.log`.

## 2026-04-26 — run 20260426-193832 — rev bb2e45b

- Gameplay: true - Added Dockside Credit: once per regular-run Shop phase, one pirate missing up to `2☠️` can be bought by converting the shortfall into pending Boarding Alert; validated with JS syntax checks, targeted Dockside Credit checks, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-193832.log`.

## 2026-04-26 — run 20260426-195206 — rev 3fafbec

- Gameplay: true - Ship Wages now pay a baseline `1☠️` on completed regular island rounds, so full sends still reach the shop with a small stake while unused slots remain the only source of Boarding Alert; validated with `node --check js/scene.js`, targeted baseline Ship Wages checks, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-195206.log`. Local browser harness was attempted but blocked by sandbox HTTP server permissions.

## 2026-04-26 — run 20260426-200255 — rev 89a06c4

- Gameplay: true - Added Full Crew Discount: filling every regular island send slot gives `-1☠️` on the first pirate bought in the next Shop, before Dockside Credit and without affecting Quiet Docks; validated with JS syntax checks, targeted Full Crew Discount checks, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-200255.log`.

## 2026-04-26 — run 20260426-203159 — rev 7e5591d

- Gameplay: true - Added Opening Commission: full sends on the first two regular pre-boarding island rounds add `+1☠️` to Ship Wages without adding Boarding Alert, making the first shop buyable while preserving the End-now Alert tradeoff; validated with JS syntax checks, `node sim/fast-sim.js --check-opening-commission`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-203159.log`.

## 2026-04-26 — run 20260426-204440 — rev abcea30

- Gameplay: true - Added Port Drill: full regular Port Island sends grant `+1⚡` Tempo to the leftmost surviving sent pirate before ship actions, with island and plan preview text; validated with JS syntax checks, `node sim/fast-sim.js --check-port-drill`, `node sim/fast-sim.js --check-opening-commission`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-204440.log`.

## 2026-04-26 — run 20260426-205716 — rev ccac8ab

- Gameplay: true - Moved Boarding Alert guard thresholds to `1-2`, `3-5`, and `6+`, surfaced projected guard plunder in Alert summaries and sending/shop previews, and aligned Quiet Docks sim risk with the new `3/6` breakpoints; validated with JS syntax checks, `node sim/fast-sim.js --check-alert-tiers`, `node sim/fast-sim.js --check-opening-commission`, `node sim/fast-sim.js --check-port-drill`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-205716.log`.

## 2026-04-26 — run 20260426-231237 — rev 66e069a

- Gameplay: true - Added Short Crew Drill: ending a regular non-Infirmary island exactly one send slot short now gives the leftmost surviving sent pirate `+1💪` Might before ship actions, creating a partial-send growth line that still pays normal Ship Wages and Alert. Validated with JS syntax checks, `node sim/fast-sim.js --check-short-crew-drill --json`, `node sim/fast-sim.js --check-port-drill --json`, `node sim/fast-sim.js --check-opening-commission --json`, `node sim/fast-sim.js --check-scouted-counter-cache --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260426-231237.log`.

## 2026-04-27 — run 20260427-011446 — rev bfb9ba3

- Gameplay: true - Added Counter Ambush: the opening regular-run boarding hand now lets the front-row counter pirate ambush the scouted main enemy for `3` damage and `+1 Wound` before normal attacks, excluding Battle Test and reinforcement hands. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-ambush --json`, existing counter/trophy/cache/shop targeted checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-011446.log`.

## 2026-04-27 — run 20260427-013652 — rev 493ba39

- Gameplay: true - Added Armed Counter Ambush: front-row counters with a permanent weapon, Might, or Tempo now ambush the scouted main enemy for `5` damage instead of `3`, without triggering weapon on-hit effects, Counter Edge damage, or enemy hit reactions. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-ambush --json`, `node sim/fast-sim.js --check-counter-edge --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-013652.log`.

## 2026-04-27 — run 20260427-015807 — rev 9a1ab29

- Gameplay: true - Regular-run boarding setup now defaults the first ready pirate that counters the scouted main enemy to the front row, so prepared ranged counters like Needler visibly trigger Counter Ambush unless the player moves them back. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-ambush --json`, `node sim/fast-sim.js --check-counter-edge --json`, `node sim/fast-sim.js --check-counter-trophy --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-015807.log`.

## 2026-04-27 — run 20260427-020634 — rev 67558ba

- Gameplay: true - Counter Ambush now preserves the removed Alert guard's win plunder: removed guards still do not fight, but Alert 1/3/6 boarding wins pay the full guard plunder tier. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-ambush --json`, `node sim/fast-sim.js --check-alert-tiers --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-020634.log`.

## 2026-04-27 — run 20260427-021604 — rev 427cd6a

- Gameplay: true - Short Crew Drill pirates now report early when drilled within 3 map turns of the next ship, drawing above shop `Top deck` buys but below Cache Drill reports without duplicating removed or stale cards. Validated with JS syntax checks, `node sim/fast-sim.js --check-short-crew-drill --json`, `node sim/fast-sim.js --check-scouted-counter-cache --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-scouted-counter-shop --json`, `node sim/fast-sim.js --check-port-drill --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-021604.log`.

## 2026-04-27 — run 20260427-023006 — rev 6f44cf7

- Gameplay: true - Armed Counter Ambush now cuts up to two Boarding Alert guards before combat while unarmed Counter Ambush still cuts only one, and all removed guards still pay normal Alert plunder on a win. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-ambush --json`, `node sim/fast-sim.js --check-alert-tiers --json`, `node sim/fast-sim.js --check-counter-edge --json`, `node sim/fast-sim.js --check-counter-trophy --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-023006.log`.

## 2026-04-27 — run 20260427-023831 — rev a72f98a

- Gameplay: true - Added Counter Watch for eligible top-deck scouted counter recruits: held watched counters skip discard and return next hand below Cache/Short Crew reports but above ordinary top-deck buys, while sent or boarding-started watches clear. Validated with JS syntax checks, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, `node sim/fast-sim.js --check-short-crew-drill --json`, `node sim/fast-sim.js --check-scouted-counter-cache --json`, `node sim/fast-sim.js --check-counter-ambush --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-023831.log`.

## 2026-04-27 — run 20260427-043426 — rev 9f7a831

- Gameplay: true - Added Opening Counter Plan: eligible round-1/2 one-short Opening Commission shops now let the first bought top-deck scouted counter become Prepared without changing price, while any first pirate purchase consumes the plan. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-counter-plan --json`, `node sim/fast-sim.js --check-opening-counter-subsidy --json`, `node sim/fast-sim.js --check-counter-recruits-report-early --json`, related counter/cache/ambush checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-043426.log`.

## 2026-04-27 — run 20260427-073312 — rev bf634ae

- Gameplay: true - Added Opening Deckhand Counters: during regular-run Boarding 1, the selected opening route's starter pirate now counts as a gameplay counter for route-facing drills, watch, ambush, edge, trophies, and bounty while staying out of shop-only counter logic. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-deckhand-counters --json`, related counter/cache/shop targeted checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-073312.log`.

## 2026-04-27 — run 20260427-075349 — rev a60c800

- Gameplay: false - Added Opening Route Orders as a sending-phase aid: matching starter cards are badged as route counters before Boarding 1, and one-short/Cache Drill text now names that starter alongside the existing report, Watch, and Alert-refund payoff without changing mechanics. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-deckhand-counters --json`, related counter/cache/shop targeted checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-075349.log`.

## 2026-04-27 — run 20260427-095457 — rev 8332599 — build 0.1.0

- Gameplay: true - Added Opening Ambusher Report: a surviving Boarding 1 Counter Ambush pirate now reports into the next drawn hand without duplication, preserving its trophies and upgrades. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-ambusher-report --json`, related counter/report targeted checks, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-095457.log`.

## 2026-04-27 — run 20260427-100833 — rev 2978a85 — build 0.1.0

- Gameplay: true - Changed Opening Route Contract into an active Cache Drill mission: the bought route primary is recorded by pirate id, matching caches no longer pay passive contract ☠️, and the recorded bought primary earns exactly `+1☠️` only by personally claiming the matching Boarding 1 Cache Drill before any starter/other counter does. Validated with JS syntax checks, `node sim/fast-sim.js --check-opening-route-contract --json`, `node sim/fast-sim.js --check-scouted-counter-cache --json`, `node sim/fast-sim.js --check-opening-route-counter-shop --json`, `node sim/fast-sim.js --check-opening-counter-prep --json`, `node sim/fast-sim.js --check-opening-deckhand-counters --json`, `node sim/fast-sim.js --check-opening-route-muster --json`, `node sim/fast-sim.js --check-opening-ambusher-report --json`, `git diff --check`, and `node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000 --json --best-log /tmp/deck-of-cats-best-20260427-100833.log`.
