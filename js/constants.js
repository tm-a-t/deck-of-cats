/* ============================================================
   PIRATES — Constants & Pirate Definitions
   ============================================================ */

const BG_COLOR = '#0d1b2a';

const RES_EMOJI = { wood: '🪵', stone: '🪨', gold: '🪙', map: '🗺️', enthusiasm: '☠️' };

const ISLANDS = [
  { name: 'Forest Island',    emoji: '🌲', bonus: 'wood',  accent: 0x3a7a30 },
  { name: 'Rocky Island',     emoji: '⛰️',  bonus: 'stone', accent: 0x707070 },
  { name: 'Treasure Island',  emoji: '💎', bonus: 'gold',  accent: 0xc8a020 },
  { name: 'Port Island',      emoji: '⚓', bonus: null, extraSend: 1, accent: 0x8b5e3c },
  { name: 'Skull Island',     emoji: '💀', bonus: null, bonusEnthusiasm: 2, accent: 0x8a2040 },
  { name: 'Siren Island',    emoji: '🧜', bonus: null, sacrifice: true, accent: 0x6a2080 },
];

// ────────────────── PIRATE DEFINITIONS ──────────────────
// cat: [body, clothes, weapon, eyes, accessory, furIdx]
//   tail is always frame 1; accessory 0 = none
//   furIdx indexes into FUR_PALETTE (see costumesScene.js)

const TYPES = {
  // ---- starter ----
  lumberjack: {
    name: 'Rigger', cat: [2,33,44,16,0,5], str: 1, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9 },
    ship:   { cRes: 'wood', cN: 4, pRes: 'enthusiasm', pN: 2 },
    cost: null,
    dI: '1🪵, reliable', dS: '4🪵 → 2☠️',
  },
  miner: {
    name: 'Ballaster', cat: [7,25,43,16,0,2], str: 1, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9 },
    ship:   { cRes: 'stone', cN: 4, pRes: 'enthusiasm', pN: 2 },
    cost: null,
    dI: '1🪨, reliable', dS: '4🪨 → 2☠️',
  },
  // ---- tutorial-only pirates ----
  tutorialForager: {
    name: 'Trail Forager', cat: [6,36,42,16,0,5], str: 1, canIsland: true,
    island: { guaranteed: { res: 'wood', amt: 1 } },
    ship:   { cRes: 'wood', cN: 1, pRes: 'enthusiasm', pN: 1 },
    cost: null,
    dI: '→ 1🪵', dS: '1🪵 → 1☠️',
  },
  tutorialSwabbie: {
    name: 'Deck Swabbie', cat: [10,27,45,17,0,1], str: 1, canIsland: false,
    island: null,
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 1 },
    cost: null,
    dI: '—', dS: '→ 1☠️',
  },
  // ---- tier 1: cheap early upgrades (2-3☠️) ----
  carpenter: {
    name: 'Carpenter', cat: [3,30,45,16,0,0], str: 1, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.95 },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 2, prodWeapons: 3 },
    cost: 3,
    dI: '1🪵, safe', dS: '2🪵 → 3🗡️+2☠️',
  },
  stonemason: {
    name: 'Stonemason', cat: [5,23,39,16,0,2], str: 1, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.95 },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 2, prodCannons: 1 },
    cost: 3,
    dI: '1🪨, safe', dS: '2🪨 → 💣+2☠️',
  },
  brute: {
    name: 'Brute', cat: [3,26,39,19,0,3], str: 2, canIsland: true,
    island: { guaranteed: { weapons: 1 } },
    ship:   { cRes: 'stone', cN: 1, pRes: 'enthusiasm', pN: 3 },
    cost: 2,
    dI: '→ 1🗡️', dS: '1🪨 → 3☠️',
  },
  whittler: {
    name: 'Whittler', cat: [1,6,42,34,16,0], str: 1, canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 2 } },
    ship:   { cRes: 'wood', cN: 1, pRes: 'enthusiasm', pN: 0, prodWeapons: 3 },
    cost: 2,
    dI: '→ 2☠️', dS: '1🪵 → 3🗡️',
  },
  corsair: {
    name: 'Corsair', cat: [1,8,42,27,16,8], str: 1, canIsland: true,
    island: { guaranteed: { weapons: 2 } },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 2 },
    cost: 2,
    dI: '→ 2🗡️', dS: '→ 2☠️',
  },
  privateer: {
    name: 'Privateer', cat: [1,12,45,27,16,4], str: 2, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.45 },
    ship:   { cRes: 'gold', cN: 2, pRes: 'enthusiasm', pN: 4, prodWeapons: 6 },
    cost: 3,
    dI: '1🪙, very risky', dS: '2🪙 → 6🗡️+4☠️',
  },
  herald: {
    name: 'Herald', cat: [1,7,39,32,16,2], str: 2, canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 3 } },
    ship:   null,
    cost: 2,
    dI: '→ 3☠️', dS: '—',
  },
  scrapper: {
    name: 'Scrapper', cat: [15,27,46,16,0,6], str: 2, canIsland: true,
    island: { guaranteed: { weapons: 2 } },
    ship:   { costCannons: 1, pRes: 'stone', pN: 4, extraEnthusiasm: 3 },
    cost: 4,
    dI: '2🗡️', dS: '1💣 → 4🪨+3☠️',
  },
  deckhand: {
    name: 'Deckhand', cat: [4,34,40,16,0,6], str: 1, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9 },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 1, prodWeapons: 1 },
    cost: 2,
    dI: '1🪨, risky', dS: '→ 1🗡️+1☠️',
  },
  blacksmith: {
    name: 'Blacksmith', cat: [15,37,38,16,0,9], str: 2, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9 },
    ship:   { costWeapons: 2, prodCannons: 1, extraEnthusiasm: 3 },
    cost: 4,
    dI: '1🪵, risky', dS: '2🗡️ → 1💣+3☠️',
  },
  bosun: {
    name: 'Bosun', cat: [3,27,46,16,20,6], str: 1, canIsland: false,
    island: null,
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 3 },
    cost: 5,
    dI: '—', dS: '→ 3☠️',
  },
  cutthroat: {
    name: 'Cutthroat', cat: [4,25,38,17,0,2], customSkin: 0, str: 3, canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 1 } },
    ship:   { cRes: 'gold', cN: 2, removeFromDeck: true },
    cost: 5,
    dI: '→ 1☠️', dS: '2🪙 → exile pirate',
  },
  quartermaster: {
    name: 'Quartermaster', cat: [12,35,39,16,0,0], str: 4, canIsland: true,
    island: { recall: 1 },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 2 },
    cost: 10,
    dI: 'recall 1 pirate', dS: '→ 2☠️',
  },
  // ---- tier 2: solid mid-game (12-16☠️) ----
  trader: {
    name: 'Trader', cat: [8,34,46,16,0,5], str: 1, canIsland: true,
    island: { convert: { cRes: 'wood', cN: 3, pRes: 'stone', pN: 3 } },
    ship:   { cRes: 'stone', cN: 1, pRes: 'enthusiasm', pN: 4 },
    cost: 7,
    dI: '3🪵 → 3🪨, safe', dS: '1🪨 → 4☠️',
  },
  woodsman: {
    name: 'Woodsman', cat: [11,25,43,16,0,0], str: 2, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9 },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 4, prodWeapons: 6 },
    cost: 7,
    dI: '1🪵, reliable', dS: '2🪵 → 6🗡️+4☠️',
  },
  prospector: {
    name: 'Prospector', cat: [7,30,45,16,0,2], str: 2, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9 },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 4, prodCannons: 2 },
    cost: 7,
    dI: '1🪨, reliable', dS: '2🪨 → 2💣+4☠️',
  },
  smuggler: {
    name: 'Smuggler', cat: [7,25,46,16,0,5], str: 2, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.45 },
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 5 },
    cost: 8,
    dI: '1🪙, very risky', dS: '1🪙 → 5☠️',
  },
  explorer: {
    name: 'Explorer', cat: [13,23,38,17,0,2], str: 1, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.65 },
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 6 },
    cost: 9,
    dI: '1🪙, decent odds', dS: '1🪙 → 6☠️',
  },
  // ---- tier 3: late-game powerhouses (24-32☠️) ----
  masterLumberjack: {
    name: 'Master Rigger', cat: [10,28,40,16,0,8], str: 3, canIsland: true,
    island: { res: 'wood', amt: 2, chance: 0.9 },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 4, prodWeapons: 9 },
    cost: 13,
    dI: '2🪵, reliable', dS: '2🪵 → 9🗡️+4☠️',
  },
  masterMiner: {
    name: 'Master Ballaster', cat: [15,34,43,17,0,9], str: 3, canIsland: true,
    island: { res: 'stone', amt: 2, chance: 0.9 },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 4, prodCannons: 3 },
    cost: 13,
    dI: '2🪨, reliable', dS: '2🪨 → 3💣+4☠️',
  },
  // ---- special: get-lost pirates (removeSelf on ship) ----
  raider: {
    name: 'Raider', cat: [0,31,38,19,0,3], str: 2, canIsland: true,
    island: { guaranteed: { weapons: 3 } },
    ship:   { removeSelf: true },
    cost: 4,
    dI: '→ 3🗡️', dS: 'get lost',
  },
  profiteer: {
    name: 'Profiteer', cat: [9,33,46,16,0,7], str: 1, canIsland: true,
    island: { convert: { cRes: 'gold', cN: 1, pRes: 'gold', pN: 2 } },
    ship:   { removeSelf: true },
    cost: 5,
    dI: '1🪙 → 2🪙', dS: 'get lost',
  },
  drifter: {
    name: 'Drifter', cat: [14,37,42,16,0,0], str: 0, canIsland: true,
    island: { guaranteed: { res: 'wood', amt: 2 } },
    ship:   { removeSelf: true },
    cost: 6,
    dI: '→ 2🪵', dS: 'get lost',
  },
  // ---- special: utility ----
  marooner: {
    name: 'Marooner', cat: [6,28,43,17,20,4], str: 0, canIsland: true,
    island: { exileSent: true },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 0, prodWeapons: 3 },
    cost: 6,
    dI: 'exile previous', dS: '→ 3🗡️',
  },
  lookout: {
    name: 'Lookout', cat: [2,35,40,32,16,1], str: 0, canIsland: true,
    island: { draw: 1 },
    ship:   { cRes: 'wood', cN: 1, pRes: 'enthusiasm', pN: 0, prodWeapons: 3 },
    cost: 4,
    dI: 'draw 1 pirate', dS: '1🪵 → 3🗡️',
  },
  survivalist: {
    name: 'Survivalist', cat: [0,23,44,16,0,8], str: 2, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9, bonusEnthusiasm: 2 },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 2 },
    cost: 3,
    dI: '1🪵 risky +2☠️', dS: '→ 2☠️',
  },
};

const SHOP_POOL = [
  'woodsman', 'prospector', 'explorer',
  'masterLumberjack', 'masterMiner',
  'bosun', 'carpenter', 'stonemason', 'smuggler', 'quartermaster', 'cutthroat',
  'brute', 'deckhand', 'blacksmith', 'trader', 'scrapper',
  'whittler', 'corsair', 'privateer', 'herald',
  'raider', 'profiteer', 'drifter', 'marooner', 'lookout', 'survivalist',
];
