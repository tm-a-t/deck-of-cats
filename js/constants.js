/* ============================================================
   PIRATES — Constants & Pirate Definitions
   ============================================================ */

const UI_THEME = {
  colors: {
    gameBg: '#220e09',
    sand: '#e5c9ae',
    sandEdge: '#d6ab7d',
    sandBorder: '#b3895d',
    cocoa: '#734f38',
    cocoaDark: '#5b3d2b',
    ink: '#482919',
    paper: '#efe9e4',
    mutedPaper: '#dcccbf',
    outline: '#8e6346',
    disabled: '#bfa68e',
    shadow: '#170804',
  },
  fonts: {
    heading: '"Amarante", Georgia, serif',
    headingMinPx: 16,
    body: '"Lora", Georgia, serif',
    bodyPx: 14,
  },
};

const BG_COLOR = UI_THEME.colors.gameBg;

const CARD_MOTION = {
  handAppearDelay: 80,
  handAppearStagger: 90,
  handAppearDuration: 560,
  handReflowDuration: 420,
  sendToIslandDuration: 520,
  ghostDuration: 500,
  discardStagger: 70,
  discardDuration: 560,
  reshuffleStagger: 60,
  reshuffleDuration: 460,
  reshuffleSettleDelay: 90,
  sequenceGap: 70,
  betweenTurnsDelay: 120,
  hoverInDuration: 240,
  hoverOutDuration: 300,
};

function uiColorInt(hex) {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

function uiLineSpacingPx(L, fontPx, lineHeightPx) {
  return Math.round(Math.max(0, lineHeightPx - fontPx) * L.k);
}

function uiHeadingStyle(L, px, color = UI_THEME.colors.paper, extra = {}) {
  const headingPx = Math.max(UI_THEME.fonts.headingMinPx, px);
  return Object.assign({
    fontFamily: UI_THEME.fonts.heading,
    fontSize: L.fs(headingPx),
    color,
    lineSpacing: uiLineSpacingPx(L, headingPx, headingPx),
  }, extra);
}

function uiBodyStyle(L, color = UI_THEME.colors.paper, extra = {}) {
  return Object.assign({
    fontFamily: UI_THEME.fonts.body,
    fontSize: L.fs(UI_THEME.fonts.bodyPx),
    color,
    lineSpacing: uiLineSpacingPx(L, UI_THEME.fonts.bodyPx, 16),
  }, extra);
}

function handCardsTopY(L) {
  return L.Y_HAND_CENTER - 198 * L.k * 0.45;
}

function makeUiPill(scene, cfg = {}) {
  const L = cfg.L || scene.L;
  const style = Object.assign(
    {},
    uiHeadingStyle(L, cfg.textPx || 16, cfg.textColor || UI_THEME.colors.paper),
    cfg.textStyle || {}
  );
  const label = scene.add.text(0, cfg.textOffsetY || 0, cfg.label || '', style).setOrigin(0.5);
  const padX = cfg.padX != null ? cfg.padX : 20 * L.k;
  const padY = cfg.padY != null ? cfg.padY : 12 * L.k;
  const width = Math.max(cfg.minW || 0, label.width + padX * 2);
  const height = Math.max(cfg.minH || 0, label.height + padY * 2);
  const radius = cfg.radius != null ? cfg.radius : height / 2;
  const fillAlpha = cfg.fillAlpha != null ? cfg.fillAlpha : 1;
  const strokeAlpha = cfg.strokeAlpha != null ? cfg.strokeAlpha : 1;
  const strokeWidth = cfg.strokeWidth != null ? cfg.strokeWidth : Math.max(1, Math.round(2 * L.k));

  const bg = scene.add.graphics();
  const draw = (fill, stroke) => {
    bg.clear();
    if (fill) {
      bg.fillStyle(uiColorInt(fill), fillAlpha);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    }
    if (stroke) {
      bg.lineStyle(strokeWidth, uiColorInt(stroke), strokeAlpha);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
    }
  };

  draw(cfg.fill || UI_THEME.colors.cocoa, cfg.stroke || null);

  const ct = scene.add.container(cfg.x || 0, cfg.y || 0, [bg, label]);
  ct.setSize(width, height);
  ct.width = width;
  ct.height = height;
  ct.uiBg = bg;
  ct.uiLabel = label;
  ct.setPillStyle = ({ fill, stroke, textColor }) => {
    draw(fill || null, stroke || null);
    if (textColor) label.setColor(textColor);
  };

  if (cfg.container) cfg.container.add(ct);
  return ct;
}

const RES_EMOJI = { wood: '🪵', stone: '🪨', gold: '🪙', map: '🗺️', enthusiasm: '☠️' };

function normalizePirateDescText(text) {
  return String(text || '').replace(/,\s+(?=(?:very risky|decent odds|reliable|safe|risky)\b)/gi, ' ');
}

function pirateDescWithSuffix(text, suffix) {
  const base = String(text || '').trim();
  const extra = String(suffix || '').trim();
  if (!base) return extra;
  if (!extra) return base;
  return `${base} ${extra}`;
}

function pirateDescEmoji(kind) {
  if (kind === 'weapons') return '🗡️';
  if (kind === 'cannons') return '💣';
  if (kind === 'enthusiasm') return '☠️';
  return RES_EMOJI[kind] || '';
}

function pirateDescCount(kind, count = 1) {
  const emoji = pirateDescEmoji(kind);
  const n = Number(count) || 0;
  if (!emoji || n <= 0) return '';
  if (n <= 3) return emoji.repeat(n);
  return `${n}${emoji}`;
}

function pirateDescJoin(parts, joiner = '+') {
  return parts.filter(Boolean).join(joiner);
}

function pirateIslandDescSuffix(island) {
  if (!island) return '';
  if (island.descSuffix) return island.descSuffix;
  if (island.chance == null) return '';
  if (island.chance >= 0.95) return 'safe';
  if (island.chance >= 0.9) return 'reliable';
  if (island.chance >= 0.65) return 'decent odds';
  return 'very risky';
}

function pirateIslandDesc(def, opts = {}) {
  const cantLandText = opts.cantLandText != null ? opts.cantLandText : '—';
  if (!def || !def.canIsland || !def.island) return cantLandText;

  const island = def.island;
  if (island.recall) return normalizePirateDescText(`recall ${island.recall} pirate${island.recall === 1 ? '' : 's'}`);
  if (island.exileSent) return 'exile previous';

  if (island.guaranteed) {
    const gain = island.guaranteed;
    if (gain.weapons) return normalizePirateDescText(pirateDescWithSuffix(pirateDescCount('weapons', gain.weapons), pirateIslandDescSuffix(island)));
    if (gain.cannons) return normalizePirateDescText(pirateDescWithSuffix(pirateDescCount('cannons', gain.cannons), pirateIslandDescSuffix(island)));
    if (gain.res) return normalizePirateDescText(pirateDescWithSuffix(pirateDescCount(gain.res, gain.amt), pirateIslandDescSuffix(island)));
    return '—';
  }

  if (island.convert) {
    return normalizePirateDescText(
      pirateDescWithSuffix(
        `${pirateDescCount(island.convert.cRes, island.convert.cN)} → ${pirateDescCount(island.convert.pRes, island.convert.pN)}`,
        pirateIslandDescSuffix(island)
      )
    );
  }

  if (Array.isArray(island.multi) && island.multi.length) {
    return normalizePirateDescText(
      pirateDescWithSuffix(
        pirateDescJoin(island.multi.map(item => pirateDescCount(item.res, item.amt))),
        pirateIslandDescSuffix(island)
      )
    );
  }

  if (island.res) {
    const base = pirateDescWithSuffix(pirateDescCount(island.res, island.amt), pirateIslandDescSuffix(island));
    const bonusPart = island.bonusEnthusiasm ? ` +${pirateDescCount('enthusiasm', island.bonusEnthusiasm)}` : '';
    return normalizePirateDescText(`${base}${bonusPart}`);
  }

  return '—';
}

function pirateShipCostDesc(ship) {
  if (!ship) return '';
  if (Array.isArray(ship.costs) && ship.costs.length) {
    return pirateDescJoin(ship.costs.map(cost => pirateDescCount(cost.res, cost.n)));
  }
  if (ship.costWeapons) return pirateDescCount('weapons', ship.costWeapons);
  if (ship.costCannons) return pirateDescCount('cannons', ship.costCannons);
  if (ship.cRes && ship.cN > 0) return pirateDescCount(ship.cRes, ship.cN);
  return '';
}

function pirateShipGainDesc(ship) {
  if (!ship) return '';
  const gains = [];
  if (ship.pRes && ship.pN > 0) gains.push(pirateDescCount(ship.pRes, ship.pN));
  if (ship.extraEnthusiasm) gains.push(pirateDescCount('enthusiasm', ship.extraEnthusiasm));
  if (ship.prodWeapons) gains.push(pirateDescCount('weapons', ship.prodWeapons));
  if (ship.prodCannons) gains.push(pirateDescCount('cannons', ship.prodCannons));
  return pirateDescJoin(gains);
}

function pirateShipDesc(def) {
  const ship = def && def.ship;
  if (!ship) return '—';
  if (ship.removeSelf) return 'get lost';

  const cost = pirateShipCostDesc(ship);
  if (ship.removeFromDeck) {
    return normalizePirateDescText(cost ? `${cost} → exile pirate` : 'exile pirate');
  }

  const gain = pirateShipGainDesc(ship);
  if (cost && gain) return normalizePirateDescText(`${cost} → ${gain}`);
  if (gain) return normalizePirateDescText(gain);
  return '—';
}

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
    island: { res: 'wood', amt: 1, chance: 0.9, descSuffix: 'reliable' },
    ship:   { cRes: 'wood', cN: 4, pRes: 'enthusiasm', pN: 2 },
    cost: null,
  },
  miner: {
    name: 'Ballaster', cat: [7,25,43,16,0,2], str: 1, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9, descSuffix: 'reliable' },
    ship:   { cRes: 'stone', cN: 4, pRes: 'enthusiasm', pN: 2 },
    cost: null,
  },
  armsman: {
    name: 'Armsman', cat: [1,14,39,27,16,8], str: 1, canIsland: true,
    island: { guaranteed: { weapons: 1 } },
    ship:   null,
    cost: null,
  },
  // ---- tutorial-only pirates ----
  tutorialForager: {
    name: 'Trail Forager', cat: [6,36,42,16,0,5], str: 1, canIsland: true,
    island: { guaranteed: { res: 'wood', amt: 1 } },
    ship:   { cRes: 'wood', cN: 1, pRes: 'enthusiasm', pN: 1 },
    cost: null,
  },
  tutorialSwabbie: {
    name: 'Deck Swabbie', cat: [10,27,45,17,0,1], str: 1, canIsland: false,
    island: null,
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 1 },
    cost: null,
  },
  tutorialAdmiralBlackpowder: {
    name: 'Admiral Blackpowder', cat: [9,33,46,16,0,7], str: 3, canIsland: false,
    island: null,
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 0, prodCannons: 3 },
    cost: 5,
  },
  // ---- tier 1: cheap early upgrades (2-3☠️) ----
  carpenter: {
    name: 'Carpenter', cat: [3,30,45,16,0,0], str: 1, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.95, descSuffix: 'safe' },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 2, prodWeapons: 3 },
    cost: 3,
  },
  stonemason: {
    name: 'Stonemason', cat: [5,23,39,16,0,2], str: 1, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.95, descSuffix: 'safe' },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 2, prodCannons: 1 },
    cost: 3,
  },
  brute: {
    name: 'Brute', cat: [3,26,39,19,0,3], str: 2, canIsland: true,
    island: { guaranteed: { weapons: 1 } },
    ship:   { cRes: 'stone', cN: 1, pRes: 'enthusiasm', pN: 3 },
    cost: 2,
  },
  whittler: {
    name: 'Whittler', cat: [1,6,42,34,16,0], str: 1, canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 2 } },
    ship:   { cRes: 'wood', cN: 1, pRes: 'enthusiasm', pN: 0, prodWeapons: 3 },
    cost: 2,
  },
  corsair: {
    name: 'Corsair', cat: [1,8,42,27,16,8], str: 1, canIsland: true,
    island: { guaranteed: { weapons: 2 } },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 2 },
    cost: 2,
  },
  privateer: {
    name: 'Privateer', cat: [1,12,45,27,16,4], str: 2, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.45, descSuffix: 'very risky' },
    ship:   { cRes: 'gold', cN: 2, pRes: 'enthusiasm', pN: 4, prodWeapons: 6 },
    cost: 3,
  },
  herald: {
    name: 'Herald', cat: [1,7,39,32,16,2], str: 2, canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 3 } },
    ship:   null,
    cost: 2,
  },
  scrapper: {
    name: 'Scrapper', cat: [15,27,46,16,0,6], str: 2, canIsland: true,
    island: { guaranteed: { weapons: 2 } },
    ship:   { costCannons: 1, pRes: 'stone', pN: 4, extraEnthusiasm: 3 },
    cost: 4,
  },
  deckhand: {
    name: 'Deckhand', cat: [4,34,40,16,0,6], str: 1, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9, descSuffix: 'risky' },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 1, prodWeapons: 1 },
    cost: 2,
  },
  blacksmith: {
    name: 'Blacksmith', cat: [15,37,38,16,0,9], str: 2, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9, descSuffix: 'risky' },
    ship:   { costWeapons: 2, prodCannons: 1, extraEnthusiasm: 3 },
    cost: 4,
  },
  bosun: {
    name: 'Bosun', cat: [3,27,46,16,20,6], str: 1, canIsland: false,
    island: null,
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 3 },
    cost: 5,
  },
  cutthroat: {
    name: 'Cutthroat', cat: [4,25,38,17,0,2], customSkin: 0, str: 3, canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 1 } },
    ship:   { cRes: 'gold', cN: 2, removeFromDeck: true },
    cost: 5,
  },
  quartermaster: {
    name: 'Quartermaster', cat: [12,35,39,16,0,0], str: 4, canIsland: true,
    island: { recall: 1 },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 2 },
    cost: 10,
  },
  // ---- tier 2: solid mid-game (12-16☠️) ----
  trader: {
    name: 'Trader', cat: [8,34,46,16,0,5], str: 1, canIsland: true,
    island: { convert: { cRes: 'wood', cN: 3, pRes: 'stone', pN: 3 }, descSuffix: 'safe' },
    ship:   { cRes: 'stone', cN: 1, pRes: 'enthusiasm', pN: 4 },
    cost: 7,
  },
  woodsman: {
    name: 'Woodsman', cat: [11,25,43,16,0,0], str: 2, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9, descSuffix: 'reliable' },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 4, prodWeapons: 6 },
    cost: 7,
  },
  prospector: {
    name: 'Prospector', cat: [7,30,45,16,0,2], str: 2, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9, descSuffix: 'reliable' },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 4, prodCannons: 2 },
    cost: 7,
  },
  smuggler: {
    name: 'Smuggler', cat: [7,25,46,16,0,5], str: 2, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.45, descSuffix: 'very risky' },
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 5 },
    cost: 8,
  },
  explorer: {
    name: 'Explorer', cat: [13,23,38,17,0,2], str: 1, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.65, descSuffix: 'decent odds' },
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 6 },
    cost: 9,
  },
  // ---- tier 3: late-game powerhouses (24-32☠️) ----
  masterLumberjack: {
    name: 'Master Rigger', cat: [10,28,40,16,0,8], str: 3, canIsland: true,
    island: { res: 'wood', amt: 2, chance: 0.9, descSuffix: 'reliable' },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 4, prodWeapons: 9 },
    cost: 13,
  },
  masterMiner: {
    name: 'Master Ballaster', cat: [15,34,43,17,0,9], str: 3, canIsland: true,
    island: { res: 'stone', amt: 2, chance: 0.9, descSuffix: 'reliable' },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 4, prodCannons: 3 },
    cost: 13,
  },
  // ---- special: get-lost pirates (removeSelf on ship) ----
  raider: {
    name: 'Raider', cat: [1,15,44,26,19,3], str: 2, canIsland: true,
    island: { guaranteed: { weapons: 3 } },
    ship:   { removeSelf: true },
    cost: 4,
  },
  profiteer: {
    name: 'Profiteer', cat: [9,33,46,16,0,7], str: 1, canIsland: true,
    island: { convert: { cRes: 'gold', cN: 1, pRes: 'gold', pN: 2 } },
    ship:   { removeSelf: true },
    cost: 5,
  },
  drifter: {
    name: 'Drifter', cat: [14,37,42,16,0,0], str: 0, canIsland: true,
    island: { res: 'wood', amt: 2, chance: 0.9, descSuffix: 'reliable' },
    ship:   { removeSelf: true },
    cost: 6,
  },
  // ---- special: utility ----
  marooner: {
    name: 'Marooner', cat: [6,28,43,17,20,4], str: 0, canIsland: true,
    island: { exileSent: true },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 0, prodWeapons: 3 },
    cost: 6,
  },
  survivalist: {
    name: 'Survivalist', cat: [1,15,45,28,16,8], str: 2, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9, bonusEnthusiasm: 2, descSuffix: 'risky' },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 2 },
    cost: 3,
  },
};

const SHOP_POOL = [
  'woodsman', 'prospector', 'explorer',
  'masterLumberjack', 'masterMiner',
  'bosun', 'carpenter', 'stonemason', 'smuggler', 'quartermaster', 'cutthroat',
  'brute', 'deckhand', 'blacksmith', 'trader', 'scrapper',
  'whittler', 'corsair', 'privateer', 'herald',
  'raider', 'profiteer', 'drifter', 'marooner', 'survivalist',
];
