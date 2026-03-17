# Deck of Cats — Agent Instructions

Web game on Phaser 3, pixel-art. `index.html` + scripts in `js/`.

## Rules

All gameplay rules are in [rules.md](rules.md). This is the source of truth.

- Check [rules.md](rules.md) first for any gameplay questions.
- When changing gameplay (pirate stats, islands, phases, resources, boarding, shop, map, etc.), **always** update [rules.md](rules.md) in the same change.
- A gameplay change is incomplete until the corresponding rule is documented in [rules.md](rules.md).

## Architecture

- No build step; plain JS files loaded via `<script>` tags in `index.html`.
- Phaser runs in `Phaser.Scale.NONE`; `js/main.js` manually syncs canvas size/zoom for HiDPI viewports.
- Global mutable state in object `G`, initialized by `initState()` or `initTutorialState()`.
- `GameScene` redraws its main UI via `renderAll()` after state changes; overlay panels live in separate scenes.
- The active hand is rendered by `CardHand`, which owns the fan layout, hover, drag-to-island, and ship-effect overlays.

### Scenes

| Scene | Key | Role |
|-------|-----|------|
| `MenuScene` | `menu` | Start menu: Play, Tutorial, Costumes, All Pirates |
| `GameScene` | `game` | Main gameplay loop and HUD |
| `MapScene` | `map` | Top parchment panel for route selection or preview |
| `ShopScene` | `shopModal` | Top parchment panel for pirate buying and round advance |
| `DrawPileScene` | `drawPileModal` | Top parchment panel for current draw pile |
| `DiscardPileScene` | `discardPileModal` | Top parchment panel for current discard pile |
| `CostumesScene` | `costumes` | Gallery of random cat costumes |
| `AllPiratesScene` | `allPirates` | Scrollable list of all pirate types |

### Files

| File | Contents |
|------|----------|
| `js/constants.js` | `UI_THEME`, UI text/pill helpers, `RES_EMOJI`, `ISLANDS`, `TYPES`, `SHOP_POOL` |
| `js/state.js` | `G`, `mkP`, `initState`, `initTutorialState`, `randomShopType`, `initialShop`, `drawCards` |
| `js/map.js` | Map generation: `generateMap`, `getAvailableNodes`, `mapNodeById`, connection logic |
| `js/layout.js` | Viewport helpers and `computeLayout` — dynamic layout calculations |
| `js/menuScene.js` | `MenuScene` — start menu with streak display and gallery links |
| `js/mapScene.js` | `MapScene` — scrollable route panel with node selection |
| `js/shopScene.js` | `ShopScene` — shop panel, featured ticker, buy animations |
| `js/pileScene.js` | `DrawPileScene` and `DiscardPileScene` — scrollable pile panels |
| `js/cardHand.js` | Pirate card texture builder, `createPirateCard`, `CardHand` |
| `js/costumesScene.js` | Cat sprite compositor (`ensureCatTextures`, `addCatSprite`, `FUR_PALETTE`) + `CostumesScene` |
| `js/allPiratesScene.js` | `AllPiratesScene` — scrollable pirate gallery |
| `js/scene.js` | `GameScene` — phases, tutorial flow, island/ship resolution, rendering, panel toggles |
| `js/main.js` | Font wait, HiDPI text/canvas sync, `Phaser.Game` initialization |
| `js/pokiBridge.js` | Poki SDK bridge used by the web build |

### Global State (`G`) Fields

| Field | Type | Description |
|-------|------|-------------|
| `allCrew` | `Array<{id, type}>` | Every pirate the player owns (deck + discard + hand) |
| `deck` | `Array` | Draw pile |
| `discard` | `Array` | Discard pile |
| `hand` | `Array` | Current hand (up to 5) |
| `res` | `{wood, stone, gold, map}` | Resource counts |
| `weapons` | `int` | 🗡️ temporary attack bonus |
| `cannons` | `int` | 💣 permanent attack bonus |
| `enthusiasm` | `int` | ☠️ currency for buying pirates |
| `round` | `int` | Current round number |
| `phase` | `string` | `map`, `sending`, `ship`, `shopping`, `boarding`, `removing`, `tutorialOutro` |
| `sent` | `Array<int>` | Indices of hand pirates sent to island |
| `island` | `object\|null` | Current island definition |
| `enemyShip` | `{strength}\|null` | Enemy ship if boarding round |
| `boardingCount` | `int` | Total boardings fought |
| `gameOver` | `bool` | Lose-state flag used by overlays |
| `shop` | `Array<string>` | 4 type-keys in the shop window |
| `shopAnimating` | `bool` | Lock during buy animation |
| `busy` | `bool` | Lock during phase transitions |
| `map` | `object\|null` | `{layers, visited, currentNodeId, currentLayer}` in regular runs, `null` in tutorial |
| `tutorial` | `object\|null` | Tutorial state when active |

### GameScene Containers

`top`, `island`, `phase`, `hand`, `btn`, `nav`, `fx` (depth 50), `tutorialHint` (depth 170), `tutorial` (depth 180), `gameover` (depth 200).

### Main Screen Layout

- Top: current total strength on the left and the current strategic goal on the right.
- Center: current island, enemy ship, or open sea; pirates already sent ashore are shown here.
- Around the center: context actions such as `Board!`, `Continue`, and floating combat/resource feedback.
- Lower: pirate hand rendered as a fanned row of cards; during the sending phase cards drag upward onto the island.
- Top-right: `🗺️` map and `🛒` shop buttons.
- Bottom: `Draw Pile` and `Discard` buttons framing the live resource inventory.
- Panels (`Map`, `Shop`, `Draw Pile`, `Discard`): only one can be open at a time; they slide down from the top and close on outside click or `×`.

### Cat Sprite System

Each pirate type has a `cat` array: `[body, clothes, weapon, eyes, accessory, furIdx]`.

- `assets/cats.png` — 10×10 px tiles, 7-column grid.
- `assets/notcats.png` — 10×10 px tiles, 2-column grid. Used via `customSkin` field.
- `FUR_PALETTE` (10 colors): primary/secondary fur pixels recolored at runtime.
- Accessories: frame 0 = none; frames 20–22 are rare (~5% in random generation).
- Textures composited per type at runtime via `ensureCatTextures()`, cached as canvas textures.
