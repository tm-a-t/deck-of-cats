# Deck of Cats — Agent Instructions

Web game on Phaser 3, pixel-art. `index.html` + scripts in `js/`.

## Rules

All gameplay rules are in [rules.md](rules.md). This is the source of truth.

- Check [rules.md](rules.md) first for any gameplay questions.
- When changing gameplay (pirate stats, islands, phases, resources, boarding, shop, map, etc.), **always** update [rules.md](rules.md) in the same change.
- A gameplay change is incomplete until the corresponding rule is documented in [rules.md](rules.md).

## Architecture

- No build step; plain JS files loaded via `<script>` tags in `index.html`.
- Resolution adapts to viewport via `Phaser.Scale.RESIZE`.
- Global mutable state in object `G`, initialized by `initState()` or `initTutorialState()`.
- UI redraws entirely via `renderAll()` on every state change.

### Scenes

| Scene | Key | Role |
|-------|-----|------|
| `MenuScene` | `menu` | Start menu: Start, Tutorial, Costumes, All Pirates |
| `GameScene` | `game` | Main gameplay loop |
| `MapScene` | `map` | Modal: route map (selection or preview) |
| `ShopScene` | `shopModal` | Modal: pirate shop |
| `CostumesScene` | `costumes` | Gallery of random cat costumes |
| `AllPiratesScene` | `allPirates` | Scrollable list of all pirate types |

### Files

| File | Contents |
|------|----------|
| `js/constants.js` | `BG_COLOR`, `RES_EMOJI`, `ISLANDS`, `TYPES`, `SHOP_POOL` |
| `js/state.js` | `G`, `mkP`, `initState`, `initTutorialState`, `randomShopType`, `initialShop`, `drawCards` |
| `js/map.js` | Map generation: `generateMap`, `getAvailableNodes`, `mapNodeById`, connection logic |
| `js/layout.js` | `REF_H`, `computeLayout` — dynamic layout calculations |
| `js/scene.js` | `GameScene` — game loop, phases, island/ship resolution, boarding, rendering |
| `js/mapScene.js` | `MapScene` — map modal with scrolling, node selection |
| `js/shopScene.js` | `ShopScene` — shop modal, buy animations |
| `js/menuScene.js` | `MenuScene` — start menu with streak display |
| `js/costumesScene.js` | Cat sprite compositor (`ensureCatTextures`, `addCatSprite`, `FUR_PALETTE`) + `CostumesScene` |
| `js/allPiratesScene.js` | `AllPiratesScene` — scrollable pirate gallery |
| `js/main.js` | `Phaser.Game` initialization |

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
| `shop` | `Array<string>` | 4 type-keys in the shop window |
| `shopAnimating` | `bool` | Lock during buy animation |
| `busy` | `bool` | Lock during phase transitions |
| `map` | `object` | `{layers, visited, currentNodeId, currentLayer}` |
| `tutorial` | `object\|null` | Tutorial state when active |

### GameScene Containers

`top`, `island`, `phase`, `hand`, `btn`, `nav`, `tip` (depth 100), `fx` (depth 50), `gameover` (depth 200).

### Layout

- Top: round number, resource inventory, full crew display, shop preview.
- Center: current island / enemy ship / open sea.
- Below center: phase status text.
- Lower: pirate hand displayed as a fan of cards; hover/tap to lift and see tooltip; drag to send to island.
- Bottom: Map and Shop buttons (left), action button (right).
- Modals (Map, Shop): close by clicking outside the paper area or ✕.

### Cat Sprite System

Each pirate type has a `cat` array: `[body, clothes, weapon, eyes, accessory, furIdx]`.

- `assets/cats.png` — 10×10 px tiles, 7-column grid.
- `assets/notcats.png` — 10×10 px tiles, 2-column grid. Used via `customSkin` field.
- `FUR_PALETTE` (10 colors): primary/secondary fur pixels recolored at runtime.
- Accessories: frame 0 = none; frames 20–22 are rare (~5% in random generation).
- Textures composited per type at runtime via `ensureCatTextures()`, cached as canvas textures.
