/* ============================================================
   PIRATES — Constants & Pirate Definitions
   ============================================================ */

const BG_COLOR = '#0d1b2a';

const RES_EMOJI = { wood: '🪵', stone: '🪨', gold: '🪙', map: '🗺️' };

const ISLANDS = [
  { name: 'Forest Island',    emoji: '🌲', bonus: 'wood',  accent: 0x3a7a30 },
  { name: 'Rocky Island',     emoji: '⛰️',  bonus: 'stone', accent: 0x707070 },
  { name: 'Treasure Island',  emoji: '💎', bonus: 'gold',  accent: 0xc8a020 },
  { name: 'Port Island',      emoji: '⚓', bonus: null, extraSend: 1, accent: 0x3070a0 },
  { name: 'Skull Island',     emoji: '💀', bonus: null, bonusEnthusiasm: 2, accent: 0x8a2040 },
];

// ────────────────── PIRATE DEFINITIONS ──────────────────

const TYPES = {
  // ---- starter ----
  lumberjack: {
    name: 'Lumberjack', frame: 0, str: 1, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9 },
    ship:   { cRes: 'wood', cN: 3, pRes: 'enthusiasm', pN: 2 },
    cost: null,
    dI: '1🪵, reliable', dS: '3🪵 → 🗡️+2☠️',
  },
  miner: {
    name: 'Miner', frame: 5, str: 1, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9 },
    ship:   { cRes: 'stone', cN: 3, pRes: 'enthusiasm', pN: 2 },
    cost: null,
    dI: '1🪨, reliable', dS: '3🪨 → 💣+2☠️',
  },
  adventurer: {
    name: 'Adventurer', frame: 10, str: 1, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.5 },
    ship:   { cRes: 'gold', cN: 3, pRes: 'enthusiasm', pN: 5 },
    cost: null,
    dI: '1🪙, risky', dS: '3🪙 → 5☠️',
  },
  slacker: {
    name: 'Deck Boy', frame: 15, str: 0, canIsland: false,
    island: null,
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 1 },
    cost: null,
    dI: '—', dS: '→ 1☠️',
  },
  // ---- shop ----
  masterLumberjack: {
    name: 'Master Lumberjack', frame: 1, str: 2, canIsland: true,
    island: { res: 'wood', amt: 2, chance: 0.9 },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 4 },
    cost: 5,
    dI: '2🪵, reliable', dS: '2🪵 → 🗡️+4☠️',
  },
  masterMiner: {
    name: 'Master Miner', frame: 6, str: 2, canIsland: true,
    island: { res: 'stone', amt: 2, chance: 0.9 },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 4 },
    cost: 5,
    dI: '2🪨, reliable', dS: '2🪨 → 💣+4☠️',
  },
  masterAdventurer: {
    name: 'Treasure Hunter', frame: 11, str: 3, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.7 },
    ship:   { cRes: 'gold', cN: 2, pRes: 'enthusiasm', pN: 5 },
    cost: 7,
    dI: '1🪙, uncertain', dS: '2🪙 → 5☠️',
  },
  bosun: {
    name: 'Bosun', frame: 16, str: 2, canIsland: false,
    island: null,
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 3 },
    cost: 4,
    dI: '—', dS: '→ 3☠️',
  },
  carpenter: {
    name: 'Carpenter', frame: 2, str: 1, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.95 },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 3 },
    cost: 3,
    dI: '1🪵, safe', dS: '2🪵 → 🗡️+3☠️',
  },
  stonemason: {
    name: 'Stonemason', frame: 7, str: 1, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.95 },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 3 },
    cost: 3,
    dI: '1🪨, safe', dS: '2🪨 → 💣+3☠️',
  },
  smuggler: {
    name: 'Smuggler', frame: 3, str: 2, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.4 },
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 3 },
    cost: 4,
    dI: '1🪙, very risky', dS: '1🪙 → 3☠️',
  },
};

const SHOP_POOL = [
  'masterLumberjack', 'masterMiner', 'masterAdventurer',
  'bosun', 'carpenter', 'stonemason', 'smuggler',
];
