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

const BASE_PIRATE_HP = 9;
const BASE_PIRATE_ATTACK = 3;

const COMBAT = {
  pirateHp: BASE_PIRATE_HP,
  pirateDamage: BASE_PIRATE_ATTACK,
  pirateAttackMs: 1350,
  initialDelayMin: 80,
  initialDelayMax: 260,
  attackStartGapMs: 300,
  attackFxMs: 160,
  enemyCountMin: 3,
  enemyCountMax: 5,
  enemyArchetypes: [
    {
      key: 'bilgeRat',
      name: 'Bilge Rat',
      emoji: '🐀',
      hp: 6,
      damage: 2,
      attackMs: 1100,
      color: '#8a7a60',
      tier: 'weak',
      summary: 'Scurries in fast but crumbles quickly.',
    },
    {
      key: 'cabinBoy',
      name: 'Cabin Boy',
      emoji: '🔔',
      hp: 5,
      damage: 2,
      attackMs: 1250,
      color: '#6888a0',
      tier: 'weak',
      attackRange: 'ranged',
      targetMode: 'backmostAny',
      summary: 'Pelts your back line with junk from afar.',
    },
    {
      key: 'shellback',
      name: 'Shellback',
      emoji: '🛡️',
      hp: 18,
      damage: 4,
      attackMs: 1450,
      color: '#6a8a72',
      tier: 'strong',
      unlockAt: 1,
      passiveKey: 'braceRowVsMultiTarget',
      passiveValue: 2,
      summary: 'Its row braces against sweeping hits.',
      encounterDesc: 'Heavy shields ahead',
    },
    {
      key: 'deckSniper',
      name: 'Deck Sniper',
      emoji: '🎯',
      hp: 9,
      damage: 4,
      attackMs: 950,
      color: '#8f5f99',
      tier: 'strong',
      unlockAt: 1,
      attackRange: 'ranged',
      targetMode: 'backmostArmed',
      summary: 'Shoots the backmost armed pirate first.',
      encounterDesc: 'Sharpshooters spotted',
    },
    {
      key: 'netter',
      name: 'Netter',
      emoji: '🪤',
      hp: 12,
      damage: 3,
      attackMs: 1350,
      color: '#4e8381',
      tier: 'strong',
      unlockAt: 3,
      attackRange: 'ranged',
      targetMode: 'backmostAny',
      onHitEffectKey: 'snareOnHit',
      onHitEffectValue: { delayMs: 350, rangedDelayMs: 1200 },
      summary: 'Throws nets into the back line and tangles ranged cats longer.',
      encounterDesc: 'Nets and tangles',
    },
    {
      key: 'flintDuelist',
      name: 'Flint Duelist',
      emoji: '🔥',
      hp: 11,
      damage: 5,
      attackMs: 1050,
      color: '#c85f41',
      tier: 'strong',
      unlockAt: 5,
      triggerKey: 'rushOnHeavyHit',
      triggerValue: { threshold: 5, nextAttackMs: 220 },
      summary: 'Huge hits fire it up and make it lunge sooner.',
      encounterDesc: 'Quick-draw duelists',
    },
    {
      key: 'powderBomber',
      name: 'Powder Bomber',
      emoji: '💣',
      hp: 17,
      damage: 4,
      attackMs: 1250,
      color: '#7d4a33',
      tier: 'strong',
      unlockAt: 1,
      deathEffect: 'frontRowBlast',
      deathEffectDamage: 4,
      summary: 'Blows up when brought down.',
      encounterDesc: 'Explosive crew aboard',
    },
  ],
};

const WEAPON_CATEGORY_EMOJI = '⚔️';

const WEAPON_TYPES = {
  hammer: {
    name: 'Hammer',
    emoji: '🔨',
    range: 'melee',
    targetMode: 'frontBand',
    hpBonus: 4,
    summary: 'Melee. +4 HP.',
  },
  axe: {
    name: 'Axe',
    emoji: '🪓',
    range: 'melee',
    targetMode: 'frontRowAll',
    summary: 'Melee. Hits the whole front row.',
  },
  bow: {
    name: 'Bow',
    emoji: '🏹',
    range: 'ranged',
    targetMode: 'lowestHpAny',
    summary: 'Ranged. Targets the lowest-HP foe.',
  },
  musket: {
    name: 'Musket',
    emoji: '🔫',
    range: 'ranged',
    targetMode: 'highestHpAny',
    damageBonus: 2,
    attackMsMultiplier: 1.6,
    summary: 'Ranged. Slower, +2 dmg, targets the toughest foe.',
  },
  hookshot: {
    name: 'Hookshot',
    emoji: '🪝',
    range: 'ranged',
    targetMode: 'lastRowPull',
    attackMsMultiplier: 1.45,
    damageOverride: 0,
    summary: 'Ranged. Slower, no damage, pulls a back-row foe forward.',
  },
  chain: {
    name: 'Chain',
    emoji: '⛓️',
    range: 'melee',
    targetMode: 'frontBand',
    damageOverride: 0,
    nextAttackDelayMsOnHit: 1000,
    summary: 'Melee. No damage, delays the target by 1s.',
  },
  dirk: {
    name: 'Dirk',
    emoji: '🗡️',
    range: 'melee',
    targetMode: 'frontBand',
    bleed: { damage: 1, ticks: 3, intervalMs: 700 },
    summary: 'Melee. Normal hit, then 3 bleed ticks.',
  },
  trident: {
    name: 'Trident',
    emoji: '🔱',
    range: 'melee',
    targetMode: 'frontBand',
    healRowBehindOnHit: 1,
    summary: 'Melee. After each hit, heals the row behind for 1.',
  },
  anchor: {
    name: 'Anchor',
    emoji: '⚓',
    range: 'melee',
    targetMode: 'frontBand',
    damageOverride: 6,
    damagePerOtherAllyInRow: 1,
    summary: 'Melee. 6 dmg, -1 per other ally in the row.',
  },
  blunderbuss: {
    name: 'Bomb Lance',
    emoji: '🧨',
    range: 'melee',
    targetMode: 'frontBand',
    damageOverride: 8,
    maxAttacks: 1,
    summary: 'Melee. 8 dmg, but only strikes once.',
  },
  chakram: {
    name: 'Chakram',
    emoji: '🥏',
    range: 'ranged',
    targetMode: 'frontBand',
    damageOverride: 2,
    damageGrowthPerAttack: 1,
    summary: 'Ranged. Starts at 2 dmg and gains +1 each shot.',
  },
};

const WEAPON_ORDER = Object.keys(WEAPON_TYPES);

function weaponCountText(weaponKey, count = 1) {
  const weapon = WEAPON_TYPES[weaponKey];
  const emoji = weapon ? weapon.emoji : WEAPON_CATEGORY_EMOJI;
  const n = Number(count) || 0;
  if (!emoji || n <= 0) return '';
  if (n <= 3) return emoji.repeat(n);
  return `${n}${emoji}`;
}

function createWeaponGrant(weaponKey, count = 1) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (!WEAPON_TYPES[weaponKey] || n <= 0) return null;
  return { key: weaponKey, count: n };
}

function weaponGrantQueue(grant) {
  const normalized = createWeaponGrant(grant && grant.key, grant && grant.count);
  if (!normalized) return [];
  return Array.from({ length: normalized.count }, () => normalized.key);
}

function weaponGrantText(grant) {
  const normalized = createWeaponGrant(grant && grant.key, grant && grant.count);
  if (!normalized) return '';
  return weaponCountText(normalized.key, normalized.count);
}

function randomWeaponKey() {
  return Phaser.Utils.Array.GetRandom(WEAPON_ORDER);
}

function rollWeaponKeys(count, opts = {}) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const out = [];
  if (total === 0) return out;

  let remaining = total;
  if (opts.ensureDistinct) {
    const distinctKeys = Phaser.Utils.Array.Shuffle([...WEAPON_ORDER]);
    const distinctCount = Math.min(remaining, distinctKeys.length);
    for (let i = 0; i < distinctCount; i++) {
      out.push(distinctKeys[i]);
      remaining -= 1;
    }
  }

  while (remaining > 0) {
    const key = randomWeaponKey();
    if (!key) break;
    out.push(key);
    remaining -= 1;
  }
  return out;
}

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

const PANEL_MOTION = {
  openDuration: 220,
  closeDuration: 180,
  openEase: 'Cubic.easeOut',
  closeEase: 'Cubic.easeIn',
  minScale: 0.06,
  collapsedAlpha: 0.16,
};

function normalizePanelMotionRect(rect, panelRect, L) {
  if (rect && Number.isFinite(rect.x) && Number.isFinite(rect.y)
    && Number.isFinite(rect.w) && Number.isFinite(rect.h)
    && rect.w > 0 && rect.h > 0) {
    return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  }
  const k = (L && L.k) || 1;
  const size = 54 * k;
  return {
    x: panelRect.x + panelRect.w / 2 - size / 2,
    y: panelRect.y + 28 * k,
    w: size,
    h: size,
  };
}

function snapshotPanelTargets(targets) {
  return (targets || [])
    .filter(Boolean)
    .map((target) => ({
      target,
      x: target.x || 0,
      y: target.y || 0,
      scaleX: target.scaleX == null ? 1 : target.scaleX,
      scaleY: target.scaleY == null ? 1 : target.scaleY,
      alpha: target.alpha == null ? 1 : target.alpha,
    }));
}

function collapsedPanelState(baseState, panelRect, collapseRect, opts = {}) {
  const rect = normalizePanelMotionRect(collapseRect, panelRect, opts.L);
  const scaleX = Phaser.Math.Clamp(rect.w / Math.max(1, panelRect.w), PANEL_MOTION.minScale, 1);
  const scaleY = Phaser.Math.Clamp(rect.h / Math.max(1, panelRect.h), PANEL_MOTION.minScale, 1);
  const left = rect.x + (rect.w - panelRect.w * scaleX) / 2;
  const top = rect.y + (rect.h - panelRect.h * scaleY) / 2;
  const alphaFactor = opts.alphaFactor != null ? opts.alphaFactor : PANEL_MOTION.collapsedAlpha;
  return {
    target: baseState.target,
    x: left + baseState.x * scaleX,
    y: top + baseState.y * scaleY,
    scaleX: baseState.scaleX * scaleX,
    scaleY: baseState.scaleY * scaleY,
    alpha: Phaser.Math.Clamp(baseState.alpha * alphaFactor, 0, 1),
  };
}

function applyPanelTweenState(state) {
  if (!state || !state.target || !state.target.scene) return;
  state.target.setPosition(state.x, state.y);
  state.target.setScale(state.scaleX, state.scaleY);
  state.target.setAlpha(state.alpha);
}

function tweenPanelStates(scene, fromStates, toStates, opts = {}) {
  if (!scene || !scene.tweens || !Array.isArray(fromStates) || !Array.isArray(toStates) || fromStates.length === 0) {
    if (opts.onComplete) opts.onComplete();
    return null;
  }

  fromStates.forEach(applyPanelTweenState);

  return scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: opts.duration || 200,
    ease: opts.ease || 'Cubic.easeOut',
    onUpdate: (tw) => {
      const p = tw.getValue();
      for (let i = 0; i < fromStates.length; i++) {
        const from = fromStates[i];
        const to = toStates[i];
        if (!from || !to || !from.target || !from.target.scene) continue;
        from.target.setPosition(
          Phaser.Math.Linear(from.x, to.x, p),
          Phaser.Math.Linear(from.y, to.y, p)
        );
        from.target.setScale(
          Phaser.Math.Linear(from.scaleX, to.scaleX, p),
          Phaser.Math.Linear(from.scaleY, to.scaleY, p)
        );
        from.target.setAlpha(Phaser.Math.Linear(from.alpha, to.alpha, p));
      }
    },
    onComplete: () => {
      toStates.forEach(applyPanelTweenState);
      if (opts.onComplete) opts.onComplete();
    },
  });
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
  if (WEAPON_TYPES[kind]) return WEAPON_TYPES[kind].emoji;
  if (kind === 'weapons') return WEAPON_CATEGORY_EMOJI;
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
    if (gain.weapon) return normalizePirateDescText(pirateDescWithSuffix(pirateDescCount(gain.weapon, gain.count || 1), pirateIslandDescSuffix(island)));
    if (gain.weapons) return normalizePirateDescText(pirateDescWithSuffix(pirateDescCount('weapons', gain.weapons), pirateIslandDescSuffix(island)));
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
  if (ship.cRes && ship.cN > 0) return pirateDescCount(ship.cRes, ship.cN);
  return '';
}

function pirateShipGainDesc(ship) {
  if (!ship) return '';
  const gains = [];
  if (ship.pRes && ship.pN > 0) gains.push(pirateDescCount(ship.pRes, ship.pN));
  if (ship.extraEnthusiasm) gains.push(pirateDescCount('enthusiasm', ship.extraEnthusiasm));
  if (ship.prodWeapon) gains.push(pirateDescCount(ship.prodWeapon, ship.prodWeaponN || 1));
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

function pirateTooltipTitle(text, fallback = 'Effect') {
  const src = String(text || fallback).trim();
  if (!src) return fallback;
  return src
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function pirateCardEffectTips(typeOrPirate, opts = {}) {
  const pirate = typeOrPirate && typeof typeOrPirate === 'object' ? typeOrPirate : null;
  const typeKey = typeof typeOrPirate === 'string' ? typeOrPirate : (pirate && pirate.type);
  const def = TYPES[typeKey];
  if (!def) return [];

  const tips = [];
  const seen = new Set();
  const island = def.island;
  const ship = def.ship;

  const addTip = (key, title, body) => {
    const cleanTitle = String(title || '').trim();
    const cleanBody = String(body || '').trim();
    if (!key || seen.has(key) || !cleanTitle || !cleanBody) return;
    seen.add(key);
    tips.push({ key, title: cleanTitle, body: cleanBody });
  };

  const addEnthusiasmTip = () => {
    addTip(
      'enthusiasm',
      '☠️ Enthusiasm',
      'Shop currency for this round.'
    );
  };

  const addWeaponTip = (weaponKey) => {
    const weapon = WEAPON_TYPES[weaponKey];
    if (!weapon) return;
    addTip(
      `weapon-${weaponKey}`,
      `${weapon.emoji} ${weapon.name}`,
      weapon.summary
    );
  };

  const addWeaponGrantTips = (weaponKey) => {
    const weapon = WEAPON_TYPES[weaponKey];
    if (!weapon) return;
    addTip(
      'weapon-grant',
      'Weapon Gain',
      `Assign ${weapon.emoji} to one pirate.`
    );
    addWeaponTip(weaponKey);
  };

  if (island) {
    if (island.recall) {
      addTip(
        'recall',
        'Recall',
        `Return the last ${island.recall} sent pirate${island.recall === 1 ? '' : 's'} to your hand.`
      );
    }
    if (island.exileSent) {
      addTip(
        'exile-sent',
        'Exile Previous',
        'Exile the pirate sent right before this one.'
      );
    }
    if (island.guaranteed) {
      const gain = island.guaranteed;
      if (gain.res === 'enthusiasm' && gain.amt > 0) addEnthusiasmTip();
      if (gain.weapon) addWeaponGrantTips(gain.weapon);
    }
    if (island.bonusEnthusiasm) addEnthusiasmTip();
  }

  if (ship) {
    if (ship.pRes === 'enthusiasm' && ship.pN > 0) addEnthusiasmTip();
    if (ship.extraEnthusiasm) addEnthusiasmTip();
    if (ship.removeSelf) {
      addTip(
        'remove-self',
        'Get Lost',
        'After this ship action, exile this pirate.'
      );
    }
    if (ship.removeFromDeck) {
      addTip(
        'remove-from-deck',
        'Exile Pirate',
        'Pay the cost, then exile one crew pirate not in your hand.'
      );
    }
    if (ship.prodWeapon) addWeaponGrantTips(ship.prodWeapon);
  }

  const equippedWeaponKey = opts.equippedWeaponKey != null
    ? opts.equippedWeaponKey
    : (pirate && pirate.weaponKey);
  if (WEAPON_TYPES[equippedWeaponKey]) addWeaponTip(equippedWeaponKey);

  return tips;
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
    name: 'Rigger', cat: [2,33,44,16,0,5], canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9, descSuffix: 'reliable' },
    ship:   { cRes: 'wood', cN: 4, pRes: 'enthusiasm', pN: 2 },
    cost: null,
  },
  miner: {
    name: 'Ballaster', cat: [7,25,43,16,0,2], canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9, descSuffix: 'reliable' },
    ship:   { cRes: 'stone', cN: 4, pRes: 'enthusiasm', pN: 2 },
    cost: null,
  },
  armsman: {
    name: 'Armsman', cat: [1,14,39,27,16,8], canIsland: true,
    island: { guaranteed: { weapon: 'hammer', count: 1 } },
    ship:   null,
    cost: null,
  },
  // ---- tier 1: cheap early upgrades (2-3☠️) ----
  carpenter: {
    name: 'Carpenter', cat: [3,30,45,16,0,0], canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.95, descSuffix: 'safe' },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 2, prodWeapon: 'axe', prodWeaponN: 1 },
    cost: 3,
  },
  stonemason: {
    name: 'Stonemason', cat: [5,23,39,16,0,2], canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.95, descSuffix: 'safe' },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 2, prodWeapon: 'chain', prodWeaponN: 1 },
    cost: 3,
  },
  brute: {
    name: 'Brute', cat: [3,26,39,19,0,3], canIsland: true,
    island: { guaranteed: { weapon: 'hammer', count: 1 } },
    ship:   { cRes: 'stone', cN: 1, pRes: 'enthusiasm', pN: 3 },
    cost: 2,
  },
  whittler: {
    name: 'Whittler', cat: [1,6,42,34,16,0], canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 2 } },
    ship:   { cRes: 'wood', cN: 1, pRes: 'enthusiasm', pN: 0, prodWeapon: 'chakram', prodWeaponN: 1 },
    cost: 2,
  },
  corsair: {
    name: 'Corsair', cat: [1,8,42,27,16,8], canIsland: true,
    island: { guaranteed: { weapon: 'axe', count: 2 } },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 2 },
    cost: 2,
  },
  privateer: {
    name: 'Privateer', cat: [1,12,45,27,16,4], canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.45, descSuffix: 'very risky' },
    ship:   { cRes: 'gold', cN: 2, pRes: 'enthusiasm', pN: 4, prodWeapon: 'musket', prodWeaponN: 2 },
    cost: 3,
  },
  herald: {
    name: 'Herald', cat: [1,7,39,32,16,2], canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 3 } },
    ship:   null,
    cost: 2,
  },
  deckhand: {
    name: 'Deckhand', cat: [4,34,40,16,0,6], canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9, descSuffix: 'risky' },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 1, prodWeapon: 'hammer', prodWeaponN: 1 },
    cost: 2,
  },
  bosun: {
    name: 'Bosun', cat: [3,27,46,16,20,6], canIsland: false,
    island: null,
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 3 },
    cost: 5,
  },
  cutthroat: {
    name: 'Cutthroat', cat: [4,25,38,17,0,2], customSkin: 0, canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 1 } },
    ship:   { cRes: 'gold', cN: 2, removeFromDeck: true },
    cost: 5,
  },
  quartermaster: {
    name: 'Quartermaster', cat: [12,35,39,16,0,0], canIsland: true,
    island: { recall: 1 },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 2 },
    cost: 10,
  },
  // ---- tier 2: solid mid-game (12-16☠️) ----
  trader: {
    name: 'Trader', cat: [8,34,46,16,0,5], canIsland: true,
    island: { convert: { cRes: 'wood', cN: 3, pRes: 'stone', pN: 3 }, descSuffix: 'safe' },
    ship:   { cRes: 'stone', cN: 1, pRes: 'enthusiasm', pN: 2, prodWeapon: 'anchor', prodWeaponN: 1 },
    cost: 7,
  },
  woodsman: {
    name: 'Woodsman', cat: [11,25,43,16,0,0], canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9, descSuffix: 'reliable' },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 4, prodWeapon: 'bow', prodWeaponN: 2 },
    cost: 7,
  },
  prospector: {
    name: 'Prospector', cat: [7,30,45,16,0,2], canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9, descSuffix: 'reliable' },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 4, prodWeapon: 'blunderbuss', prodWeaponN: 2 },
    cost: 7,
  },
  smuggler: {
    name: 'Smuggler', cat: [7,25,46,16,0,5], canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.45, descSuffix: 'very risky' },
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 5 },
    cost: 8,
  },
  explorer: {
    name: 'Explorer', cat: [13,23,38,17,0,2], canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.65, descSuffix: 'decent odds' },
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 6 },
    cost: 9,
  },
  // ---- tier 3: late-game powerhouses (24-32☠️) ----
  masterLumberjack: {
    name: 'Master Rigger', cat: [10,28,40,16,0,8], canIsland: true,
    island: { res: 'wood', amt: 2, chance: 0.9, descSuffix: 'reliable' },
    ship:   { cRes: 'wood', cN: 2, pRes: 'enthusiasm', pN: 4, prodWeapon: 'hookshot', prodWeaponN: 2 },
    cost: 13,
  },
  masterMiner: {
    name: 'Master Ballaster', cat: [15,34,43,17,0,9], canIsland: true,
    island: { res: 'stone', amt: 2, chance: 0.9, descSuffix: 'reliable' },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 4, prodWeapon: 'musket', prodWeaponN: 2 },
    cost: 13,
  },
  // ---- special: get-lost pirates (removeSelf on ship) ----
  raider: {
    name: 'Raider', cat: [1,15,44,26,19,3], canIsland: true,
    island: { guaranteed: { weapon: 'axe', count: 2 } },
    ship:   { removeSelf: true },
    cost: 4,
  },
  profiteer: {
    name: 'Profiteer', cat: [9,33,46,16,0,7], canIsland: true,
    island: { convert: { cRes: 'gold', cN: 1, pRes: 'gold', pN: 2 } },
    ship:   { removeSelf: true },
    cost: 5,
  },
  drifter: {
    name: 'Drifter', cat: [14,37,42,16,0,0], canIsland: true,
    island: { res: 'wood', amt: 2, chance: 0.9, descSuffix: 'reliable' },
    ship:   { removeSelf: true },
    cost: 6,
  },
  // ---- special: utility ----
  marooner: {
    name: 'Marooner', cat: [6,28,43,17,20,4], canIsland: true,
    island: { exileSent: true },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 0, prodWeapon: 'dirk', prodWeaponN: 1 },
    cost: 6,
  },
  survivalist: {
    name: 'Survivalist', cat: [1,15,45,28,16,8], canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9, bonusEnthusiasm: 2, descSuffix: 'risky' },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 1, prodWeapon: 'trident', prodWeaponN: 1 },
    cost: 3,
  },
};

const SHOP_POOL = [
  'woodsman', 'prospector', 'explorer',
  'masterLumberjack', 'masterMiner',
  'bosun', 'carpenter', 'stonemason', 'smuggler', 'quartermaster', 'cutthroat',
  'brute', 'deckhand', 'trader',
  'whittler', 'corsair', 'privateer', 'herald',
  'raider', 'profiteer', 'drifter', 'marooner', 'survivalist',
];
