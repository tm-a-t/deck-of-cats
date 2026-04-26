# Changelog

This file records gameplay and loop-driven changes. Future loop Developer steps must append entries here whenever they change the game.

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
