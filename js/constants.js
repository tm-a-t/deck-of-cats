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
const GAME_VERSION = '0.1.0';

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

const QUIET_DOCKS = {
  cost: 2,
  alertReduction: 1,
};

const SHOP_CREDIT = {
  maxMissing: 2,
  alertPerMissing: 1,
};

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
      summary: 'Front-liner. When you hit its whole row, each Shellback there takes 2 less damage.',
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
      summary: 'Ranged. Shoots your backmost armed pirate first.',
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
      summary: 'Ranged. Nets your backmost pirate and delays ranged cats much longer.',
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
      summary: 'If you hit it for 5 or more at once, its next attack comes almost immediately.',
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
      summary: 'When defeated, it explodes and hits your whole front row for 4. Wounds disarm the blast.',
      encounterDesc: 'Explosive crew aboard',
    },
  ],
};

const SCOUTED_SHIP_COUNTERS = {
  shellback: ['poisoner', 'needler', 'plagueCaptain'],
  powderBomber: ['sawbones', 'scarwright'],
  deckSniper: ['needler', 'bandmaster'],
  netter: ['drummer', 'trainer', 'flagbearer'],
  flintDuelist: ['poisoner', 'needler', 'sawbones', 'scarwright', 'plagueCaptain'],
};

const WEAPON_CATEGORY_EMOJI = '⚔️';
const WOUNDED_EMOJI = '🩹';
const BUFF_EMOJI = {
  might: '💪',
  tempo: '⚡',
};
const BUFF_LABELS = {
  might: 'Might',
  tempo: 'Tempo',
};

const WEAPON_TYPES = {
  hammer: {
    name: 'Hammer',
    emoji: '🔨',
    range: 'melee',
    targetMode: 'frontBand',
    hpBonus: 4,
    summary: 'Melee. +4 HP.',
  },
  rustyPistol: {
    name: 'Rusty Pistol',
    emoji: '🔫',
    range: 'ranged',
    targetMode: 'frontBand',
    damageOverride: 2,
    summary: 'Ranged. Deals 2 damage with normal front-band targeting.',
  },
  venomKnife: {
    name: 'Venom Knife',
    emoji: '🗡️',
    range: 'melee',
    targetMode: 'frontBand',
    poisonOnHit: 1,
    summary: 'Melee. Hit, then apply 1 poison.',
  },
  toxinPistol: {
    name: 'Toxin Pistol',
    emoji: '🧪',
    range: 'ranged',
    targetMode: 'lowestHpAny',
    poisonOnHit: 1,
    summary: 'Ranged. Hits the weakest foe, then applies 1 poison.',
  },
  barbedBlade: {
    name: 'Barbed Blade',
    emoji: '⚔️',
    range: 'melee',
    targetMode: 'frontBand',
    woundsOnHit: 1,
    summary: 'Melee. Hit, then apply 1 wound.',
  },
  scarHarpoon: {
    name: 'Scar Harpoon',
    emoji: '🪝',
    range: 'ranged',
    targetMode: 'highestHpAny',
    attackMsMultiplier: 1.35,
    woundsOnHit: 2,
    summary: 'Ranged. Slower. Hits the toughest foe and applies 2 wounds.',
  },
  officerSabre: {
    name: 'Officer Sabre',
    emoji: '⚔️',
    range: 'melee',
    targetMode: 'frontBand',
    damagePerBuff: 1,
    summary: 'Melee. Gains +1 damage for each of the owner\'s buffs.',
  },
  cadencePistols: {
    name: 'Cadence Pistols',
    emoji: '🔫',
    range: 'ranged',
    targetMode: 'lowestHpAny',
    attackMsMultiplierPerBuff: 0.9,
    summary: 'Ranged. Gains 10% attack speed for each of the owner\'s buffs.',
  },
  bannerAxe: {
    name: 'Banner Axe',
    emoji: '🪓',
    range: 'melee',
    targetMode: 'frontBand',
    frontRowAllAtBuffCount: 3,
    summary: 'Melee. If the owner has 3+ buffs, it hits the whole front row.',
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

const RES_EMOJI = { wood: '🪵', stone: '🪨', gold: '🪙', enthusiasm: '☠️' };

function normalizePirateDescText(text) {
  return String(text || '').trim();
}

function pirateDescEmoji(kind) {
  if (WEAPON_TYPES[kind]) return WEAPON_TYPES[kind].emoji;
  if (BUFF_EMOJI[kind]) return BUFF_EMOJI[kind];
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

function normalizePersonalGain(gain) {
  if (!gain || typeof gain !== 'object') return null;
  if (gain.weapon && WEAPON_TYPES[gain.weapon]) {
    return { weapon: gain.weapon, count: Math.max(1, Math.floor(Number(gain.count) || 1)) };
  }
  if (gain.buff && BUFF_EMOJI[gain.buff]) {
    return { buff: gain.buff, count: Math.max(1, Math.floor(Number(gain.count) || 1)) };
  }
  return null;
}

function normalizePersonalGains(gains) {
  return (Array.isArray(gains) ? gains : [])
    .map(normalizePersonalGain)
    .filter(Boolean);
}

function personalGainDescParts(gains) {
  return normalizePersonalGains(gains).map((gain) => (
    gain.weapon
      ? pirateDescCount(gain.weapon, gain.count)
      : pirateDescCount(gain.buff, gain.count)
  ));
}

function personalGainText(gains) {
  return pirateDescJoin(personalGainDescParts(gains));
}

function pirateBuffStatusText(pirate) {
  if (!pirate || typeof pirate !== 'object') return '';
  const might = Math.max(0, Math.floor(Number(pirate.might) || 0));
  const tempo = Math.max(0, Math.floor(Number(pirate.tempo) || 0));
  const parts = [];
  if (might > 0) parts.push(`${BUFF_LABELS.might} ${pirateDescCount('might', might)}`);
  if (tempo > 0) parts.push(`${BUFF_LABELS.tempo} ${pirateDescCount('tempo', tempo)}`);
  return parts.join('. ');
}

function pirateIslandDesc(def, opts = {}) {
  const cantLandText = opts.cantLandText != null ? opts.cantLandText : '—';
  if (!def || !def.canIsland || !def.island) return cantLandText;

  const island = def.island;
  if (island.recall) return normalizePirateDescText(`recall ${island.recall} pirate${island.recall === 1 ? '' : 's'}`);
  if (island.exileSent) return 'exile previous';

  if (island.guaranteed) {
    const gain = island.guaranteed;
    if (gain.weapon) return normalizePirateDescText(pirateDescCount(gain.weapon, gain.count || 1));
    if (gain.weapons) return normalizePirateDescText(pirateDescCount('weapons', gain.weapons));
    if (gain.res) return normalizePirateDescText(pirateDescCount(gain.res, gain.amt));
    return '—';
  }

  if (island.convert) {
    return normalizePirateDescText(
      `${pirateDescCount(island.convert.cRes, island.convert.cN)} → ${pirateDescCount(island.convert.pRes, island.convert.pN)}`
    );
  }

  if (Array.isArray(island.multi) && island.multi.length) {
    return normalizePirateDescText(pirateDescJoin(island.multi.map(item => pirateDescCount(item.res, item.amt))));
  }

  if (island.res) {
    const base = pirateDescCount(island.res, island.amt);
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
  if (Array.isArray(ship.gains) && ship.gains.length) {
    for (const gain of ship.gains) {
      if (!gain || !gain.res || gain.n <= 0) continue;
      gains.push(pirateDescCount(gain.res, gain.n));
    }
  } else if (ship.pRes && ship.pN > 0) {
    gains.push(pirateDescCount(ship.pRes, ship.pN));
  }
  if (ship.extraEnthusiasm) gains.push(pirateDescCount('enthusiasm', ship.extraEnthusiasm));
  if (ship.prodWeapon) gains.push(pirateDescCount(ship.prodWeapon, ship.prodWeaponN || 1));
  gains.push(...personalGainDescParts(ship.personalGains));
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
      `Choose a pirate to take ${weapon.emoji}.`
    );
    addWeaponTip(weaponKey);
  };

  const addShipTargetingTip = () => {
    addTip(
      'ship-target',
      'Leftmost Island Pirate',
      'Ship weapons and buffs go to the leftmost pirate already on the island. If nobody is there, those personal gains are lost.'
    );
  };

  const addBuffTip = (buffKey, count = 1) => {
    if (!BUFF_EMOJI[buffKey]) return;
    const gainText = pirateDescCount(buffKey, count);
    const label = BUFF_LABELS[buffKey] || pirateTooltipTitle(buffKey);
    const body = buffKey === 'might'
      ? `${gainText} gives +1 damage per stack.`
      : `${gainText} makes that pirate attack 20% faster per stack.`;
    addTip(
      `buff-${buffKey}`,
      `${BUFF_EMOJI[buffKey]} ${label}`,
      body
    );
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
    const shipGains = Array.isArray(ship.gains) ? ship.gains : [];
    if (
      (ship.pRes === 'enthusiasm' && ship.pN > 0)
      || shipGains.some(gain => gain && gain.res === 'enthusiasm' && gain.n > 0)
    ) addEnthusiasmTip();
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
    const personalGains = normalizePersonalGains(ship.personalGains);
    if (personalGains.length) {
      addShipTargetingTip();
      personalGains.forEach((gain) => {
        if (gain.weapon) addWeaponTip(gain.weapon);
        if (gain.buff) addBuffTip(gain.buff, gain.count);
      });
    }
  }

  const equippedWeaponKey = opts.equippedWeaponKey != null
    ? opts.equippedWeaponKey
    : (pirate && pirate.weaponKey);
  if (WEAPON_TYPES[equippedWeaponKey]) addWeaponTip(equippedWeaponKey);
  if (pirate) {
    if (pirate.wounded) {
      addTip(
        'wounded',
        `${WOUNDED_EMOJI} Wounded`,
        'This pirate can gather resources and work on the ship, but sits out boarding until healed.'
      );
    }
    const buffStatus = pirateBuffStatusText(pirate);
    if (buffStatus) addTip('current-buffs', 'Current Buffs', buffStatus);
  }

  return tips;
}

const ISLANDS = [
  { name: 'Forest Island',    emoji: '🌲', bonus: 'wood',  accent: 0x3a7a30 },
  { name: 'Rocky Island',     emoji: '⛰️',  bonus: 'stone', accent: 0x707070 },
  { name: 'Treasure Island',  emoji: '💎', bonus: 'gold',  accent: 0xc8a020 },
  { name: 'Port Island',      emoji: '⚓', bonus: null, extraSend: 1, fullSendBuff: { buff: 'tempo', count: 1 }, accent: 0x8b5e3c },
  { name: 'Skull Island',     emoji: '💀', bonus: null, bonusEnthusiasm: 2, accent: 0x8a2040 },
  { name: 'Siren Island',    emoji: '🧜', bonus: null, sacrifice: true, accent: 0x6a2080 },
  { name: 'Infirmary Island', emoji: WOUNDED_EMOJI, bonus: null, healWounded: 5, accent: 0x4e8f79 },
];

// ────────────────── PIRATE DEFINITIONS ──────────────────
// cat: [body, clothes, weapon, eyes, accessory, furIdx]
//   tail is always frame 1; accessory 0 = none
//   furIdx indexes into FUR_PALETTE (see costumesScene.js)

const TYPES = {
  // ---- starter ----
  lumberjack: {
    name: 'Rigger', cat: [2,33,44,16,0,5], canIsland: true,
    island: { res: 'wood', amt: 1 },
    ship:   { cRes: 'wood', cN: 4, pRes: 'enthusiasm', pN: 2 },
    cost: null,
  },
  miner: {
    name: 'Ballaster', cat: [7,25,43,16,0,2], canIsland: true,
    island: { res: 'stone', amt: 1 },
    ship:   { cRes: 'stone', cN: 4, pRes: 'enthusiasm', pN: 2 },
    cost: null,
  },
  armsman: {
    name: 'Armsman', cat: [1,14,39,27,16,8], canIsland: true,
    island: { guaranteed: { weapon: 'hammer', count: 1 } },
    ship:   { cRes: 'wood', cN: 1, personalGains: [{ weapon: 'rustyPistol' }] },
    cost: null,
  },
  // ---- tier 1: cheap early upgrades (2-3☠️) ----
  poisoner: {
    name: 'Poisoner', cat: [1,6,42,34,16,0], canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 2 } },
    ship:   { cRes: 'wood', cN: 1, pRes: 'enthusiasm', pN: 2, personalGains: [{ weapon: 'venomKnife' }] },
    cost: 2,
  },
  drummer: {
    name: 'Drummer', cat: [1,8,42,27,16,8], canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 1 } },
    ship:   { cRes: 'wood', cN: 1, pRes: 'enthusiasm', pN: 1, personalGains: [{ buff: 'tempo' }] },
    cost: 2,
  },
  herald: {
    name: 'Herald', cat: [1,7,39,32,16,2], canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 3 } },
    ship:   null,
    cost: 2,
  },
  sawbones: {
    name: 'Sawbones', cat: [5,23,39,16,0,2], canIsland: true,
    island: { res: 'stone', amt: 1 },
    ship:   { cRes: 'stone', cN: 1, pRes: 'enthusiasm', pN: 2, personalGains: [{ weapon: 'barbedBlade' }] },
    cost: 3,
  },
  needler: {
    name: 'Needler', cat: [1,12,45,27,16,4], canIsland: true,
    island: { res: 'gold', amt: 1 },
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 2, personalGains: [{ weapon: 'toxinPistol' }] },
    cost: 3,
  },
  trainer: {
    name: 'Trainer', cat: [4,34,40,16,0,6], canIsland: true,
    island: { res: 'stone', amt: 1 },
    ship:   { cRes: 'stone', cN: 1, pRes: 'enthusiasm', pN: 1, personalGains: [{ buff: 'might' }] },
    cost: 3,
  },
  survivalist: {
    name: 'Survivalist', cat: [1,15,45,28,16,8], canIsland: true,
    island: { res: 'wood', amt: 1, bonusEnthusiasm: 2 },
    ship:   { cRes: null, cN: 0, pRes: 'enthusiasm', pN: 2 },
    cost: 3,
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
  scarwright: {
    name: 'Scarwright', cat: [7,30,45,16,0,2], canIsland: true,
    island: { res: 'stone', amt: 1 },
    ship:   { cRes: 'stone', cN: 2, pRes: 'enthusiasm', pN: 4, personalGains: [{ weapon: 'scarHarpoon' }] },
    cost: 7,
  },
  flagbearer: {
    name: 'Flagbearer', cat: [8,34,46,16,0,5], canIsland: true,
    island: { res: 'gold', amt: 1 },
    ship:   {
      costs: [{ res: 'wood', n: 1 }, { res: 'stone', n: 1 }],
      pRes: 'enthusiasm',
      pN: 4,
      personalGains: [{ buff: 'might' }, { buff: 'tempo' }],
    },
    cost: 7,
  },
  duelMaster: {
    name: 'Duel Master', cat: [11,25,43,16,0,0], canIsland: true,
    island: { guaranteed: { weapon: 'hammer', count: 1 } },
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 3, personalGains: [{ weapon: 'officerSabre' }] },
    cost: 7,
  },
  smuggler: {
    name: 'Smuggler', cat: [7,25,46,16,0,5], canIsland: true,
    island: { res: 'gold', amt: 1 },
    ship:   { cRes: 'gold', cN: 1, gains: [{ res: 'enthusiasm', n: 6 }, { res: 'wood', n: 1 }, { res: 'stone', n: 1 }] },
    cost: 8,
  },
  bandmaster: {
    name: 'Bandmaster', cat: [15,34,43,17,0,9], canIsland: true,
    island: { guaranteed: { res: 'enthusiasm', amt: 2 } },
    ship:   { cRes: 'gold', cN: 1, pRes: 'enthusiasm', pN: 4, personalGains: [{ weapon: 'cadencePistols' }] },
    cost: 8,
  },
  plagueCaptain: {
    name: 'Plague Captain', cat: [13,23,38,17,0,2], canIsland: true,
    island: { res: 'gold', amt: 1 },
    ship:   { cRes: 'gold', cN: 2, pRes: 'enthusiasm', pN: 5, personalGains: [{ weapon: 'toxinPistol' }, { buff: 'might' }] },
    cost: 10,
  },
  // ---- tier 3: late-game powerhouses (24-32☠️) ----
  admiralsMate: {
    name: 'Admiral\'s Mate', cat: [10,28,40,16,0,8], canIsland: true,
    island: { res: 'gold', amt: 2 },
    ship:   {
      cRes: 'gold',
      cN: 2,
      pRes: 'enthusiasm',
      pN: 6,
      personalGains: [{ weapon: 'bannerAxe' }, { buff: 'might' }, { buff: 'tempo' }],
    },
    cost: 13,
  },
};

const SHOP_POOL = [
  'poisoner', 'drummer', 'herald',
  'sawbones', 'needler', 'trainer', 'survivalist',
  'bosun', 'cutthroat',
  'scarwright', 'flagbearer', 'duelMaster',
  'smuggler', 'bandmaster',
  'quartermaster', 'plagueCaptain', 'admiralsMate',
];

const STARTER_SHOP_LANES = [
  ['poisoner', 'drummer'],
  ['sawbones', 'trainer'],
  ['needler'],
  ['herald', 'survivalist'],
];
