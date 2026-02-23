/* ============================================================
   PIRATES — Constants & Pirate Definitions
   ============================================================ */

const BG_COLOR = '#0d1b2a';

const RES_EMOJI = { wood: '🪵', stone: '🪨', gold: '🪙', map: '🗺️', enthusiasm: '☠️' };

const ISLANDS = [
  { name: 'Forest Island',    emoji: '🌲', bonus: 'wood',  accent: 0x3a7a30 },
  { name: 'Rocky Island',     emoji: '⛰️',  bonus: 'stone', accent: 0x707070 },
  { name: 'Treasure Island',  emoji: '💎', bonus: 'gold',  accent: 0xc8a020 },
  { name: 'Port Island',      emoji: '⚓', bonus: null, extraSend: 1, accent: 0x3070a0 },
  { name: 'Skull Island',     emoji: '💀', bonus: null, bonusEnthusiasm: 2, accent: 0x8a2040 },
];

// ────────────────── PIRATE DEFINITIONS ──────────────────

const DEFAULT_FRAME = 15; // Deck Boy texture — fallback for pirates without unique art

const TYPES = {
  // ---- starter ----
  lumberjack: {
    name: 'Lumberjack', frame: 0, str: 1, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9 },
    ship:   { cRes: 'wood', cN: 3, pRes: 'enthusiasm', pN: 2 },
    cost: null,
    dI: '1🪵, reliable', dS: '3🪵 → 2☠️',
  },
  miner: {
    name: 'Miner', frame: 5, str: 1, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9 },
    ship:   { cRes: 'stone', cN: 3, pRes: 'enthusiasm', pN: 0, prodCannons: 1 },
    cost: null,
    dI: '1🪨, reliable', dS: '3🪨 → 1💣',
  },
  adventurer: {
    name: 'Adventurer', frame: 10, str: 1, canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 1 } },
    ship:   { costs: [{ res: 'wood', n: 2 }, { res: 'stone', n: 2 }], pRes: 'enthusiasm', pN: 4 },
    cost: null,
    dI: '→ 1☠️', dS: '2🪵+2🪨 → 4☠️',
  },
  slacker: {
    name: 'Deck Boy', frame: 15, str: 0, canIsland: false,
    island: null,
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 1 },
    cost: null,
    dI: '—', dS: '→ 1☠️',
  },
  // ---- tier 1: cheap early upgrades (2-3☠️) ----
  carpenter: {
    name: 'Carpenter', frame: 2, str: 1, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.95 },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 3, prodWeapons: 3 },
    cost: 4,
    dI: '1🪵, safe', dS: '2🪵 → 3🗡️+3☠️',
  },
  stonemason: {
    name: 'Stonemason', frame: 7, str: 1, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.95 },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 3, prodCannons: 1 },
    cost: 4,
    dI: '1🪨, safe', dS: '2🪨 → 💣+3☠️',
  },
  brute: {
    name: 'Brute', frame: 9, str: 2, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9 },
    ship:   { cRes: 'stone', cN: 1, pRes: 'enthusiasm', pN: 2 },
    cost: 3,
    dI: '1🪵, risky', dS: '1🪨 → 2☠️',
  },
  scrapper: {
    name: 'Scrapper', frame: DEFAULT_FRAME, str: 2, canIsland: true,
    island: { guaranteed: { weapons: 1 } },
    ship:   { costCannons: 1, pRes: 'stone', pN: 3 },
    cost: 3,
    dI: '1🗡️, safe', dS: '1💣 → 3🪨',
  },
  deckhand: {
    name: 'Deckhand', frame: DEFAULT_FRAME, str: 1, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9 },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 1, prodWeapons: 1 },
    cost: 3,
    dI: '1🪨, risky', dS: '→ 1🗡️+1☠️',
  },
  blacksmith: {
    name: 'Blacksmith', frame: 18, str: 2, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9 },
    ship:   { costWeapons: 2, prodCannons: 1 },
    cost: 4,
    dI: '1🪵, risky', dS: '2🗡️ → 1💣',
  },
  bosun: {
    name: 'Bosun', frame: 16, str: 1, canIsland: false,
    island: null,
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 3 },
    cost: 5,
    dI: '—', dS: '→ 3☠️',
  },
  cutthroat: {
    name: 'Cutthroat', frame: 14, str: 3, canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 1 } },
    ship:   { cRes: 'gold', cN: 2, removeFromDeck: true },
    cost: 5,
    dI: '→ 1☠️', dS: '2🪙 → exile pirate',
  },
  quartermaster: {
    name: 'Quartermaster', frame: 13, str: 4, canIsland: true,
    island: { recall: 1 },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 2 },
    cost: 10,
    dI: 'recall 1 pirate', dS: '→ 2☠️',
  },
  // ---- tier 2: solid mid-game (12-16☠️) ----
  trader: {
    name: 'Trader', frame: DEFAULT_FRAME, str: 1, canIsland: true,
    island: { convert: { cRes: 'wood', cN: 3, pRes: 'stone', pN: 3 } },
    ship:   { cRes: 'stone', cN: 1, pRes: 'enthusiasm', pN: 4 },
    cost: 7,
    dI: '3🪵 → 3🪨, safe', dS: '1🪨 → 4☠️',
  },
  woodsman: {
    name: 'Woodsman', frame: 4, str: 2, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9 },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 4, prodWeapons: 6 },
    cost: 7,
    dI: '1🪵, reliable', dS: '2🪵 → 6🗡️+4☠️',
  },
  prospector: {
    name: 'Prospector', frame: 8, str: 2, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9 },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 4, prodCannons: 2 },
    cost: 7,
    dI: '1🪨, reliable', dS: '2🪨 → 2💣+4☠️',
  },
  smuggler: {
    name: 'Smuggler', frame: 3, str: 2, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.45 },
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 5 },
    cost: 8,
    dI: '1🪙, very risky', dS: '1🪙 → 5☠️',
  },
  explorer: {
    name: 'Explorer', frame: 12, str: 1, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.65 },
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 6 },
    cost: 9,
    dI: '1🪙, decent odds', dS: '1🪙 → 6☠️',
  },
  // ---- tier 3: late-game powerhouses (24-32☠️) ----
  masterLumberjack: {
    name: 'Master Lumberjack', frame: 1, str: 3, canIsland: true,
    island: { res: 'wood', amt: 2, chance: 0.9 },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 4, prodWeapons: 9 },
    cost: 13,
    dI: '2🪵, reliable', dS: '2🪵 → 9🗡️+4☠️',
  },
  masterMiner: {
    name: 'Master Miner', frame: 6, str: 3, canIsland: true,
    island: { res: 'stone', amt: 2, chance: 0.9 },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 4, prodCannons: 3 },
    cost: 13,
    dI: '2🪨, reliable', dS: '2🪨 → 3💣+4☠️',
  },
  masterAdventurer: {
    name: 'Treasure Hunter', frame: 11, str: 4, canIsland: true,
    island: { res: 'gold', amt: 2, chance: 0.8 },
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 7 },
    cost: 17,
    dI: '2🪙, good odds', dS: '1🪙 → 7☠️',
  },
};

const SHOP_POOL = [
  'woodsman', 'prospector', 'explorer',
  'masterLumberjack', 'masterMiner', 'masterAdventurer',
  'bosun', 'carpenter', 'stonemason', 'smuggler', 'quartermaster', 'cutthroat',
  'brute', 'deckhand', 'blacksmith', 'trader', 'scrapper',
];
