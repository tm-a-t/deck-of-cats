/* ============================================================
   PIRATES — Deck Builder
   Phaser 3 pirate crew deck-building game
   ============================================================ */

// ────────────────── CONSTANTS ──────────────────

const W = 960;
const H = 1440;
const SC = 10;         // hand/shop sprite scale  (8×10 = 80 px)
const SC_SM = 5;       // crew-bar sprite scale   (8×5 = 40 px)

const BG_COLOR = '#0d1b2a';

const RES_EMOJI = { wood: '🪵', stone: '🪨', gold: '🪙', map: '🗺️' };

const ISLANDS = [
  { name: 'Forest Island',   emoji: '🌲', bonus: 'wood',  accent: 0x3a7a30 },
  { name: 'Rocky Island',    emoji: '⛰️',  bonus: 'stone', accent: 0x707070 },
  { name: 'Treasure Island',  emoji: '💎', bonus: 'gold',  accent: 0xc8a020 },
];

// ────────────────── PIRATE DEFINITIONS ──────────────────

const TYPES = {
  // ---- starter ----
  lumberjack: {
    name: 'Lumberjack', frame: 0, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.9 },
    ship:   { cRes: 'wood', cN: 3, pRes: 'cunning', pN: 2 },
    cost: null,
    dI: '1🪵, reliable', dS: '3🪵 → 2☠️',
  },
  miner: {
    name: 'Miner', frame: 5, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.9 },
    ship:   { cRes: 'stone', cN: 3, pRes: 'cunning', pN: 2 },
    cost: null,
    dI: '1🪨, reliable', dS: '3🪨 → 2☠️',
  },
  adventurer: {
    name: 'Adventurer', frame: 10, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.5 },
    ship:   { cRes: 'gold', cN: 3, pRes: 'cunning', pN: 5 },
    cost: null,
    dI: '1🪙, risky', dS: '3🪙 → 5☠️',
  },
  slacker: {
    name: 'Deck Boy', frame: 15, canIsland: false,
    island: null,
    ship:   { cRes: null, cN: 0, pRes: 'cunning', pN: 1 },
    cost: null,
    dI: '—', dS: '→ 1☠️',
  },
  // ---- shop ----
  masterLumberjack: {
    name: 'Master Lumberjack', frame: 1, canIsland: true,
    island: { res: 'wood', amt: 2, chance: 0.9 },
    ship:   { cRes: 'wood', cN: 2, pRes: 'cunning', pN: 4 },
    cost: 5,
    dI: '2🪵, reliable', dS: '2🪵 → 4☠️',
  },
  masterMiner: {
    name: 'Master Miner', frame: 6, canIsland: true,
    island: { res: 'stone', amt: 2, chance: 0.9 },
    ship:   { cRes: 'stone', cN: 2, pRes: 'cunning', pN: 4 },
    cost: 5,
    dI: '2🪨, reliable', dS: '2🪨 → 4☠️',
  },
  masterAdventurer: {
    name: 'Treasure Hunter', frame: 11, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.7 },
    ship:   { cRes: 'gold', cN: 2, pRes: 'cunning', pN: 5 },
    cost: 7,
    dI: '1🪙, uncertain', dS: '2🪙 → 5☠️',
  },
  bosun: {
    name: 'Bosun', frame: 16, canIsland: false,
    island: null,
    ship:   { cRes: null, cN: 0, pRes: 'cunning', pN: 3 },
    cost: 4,
    dI: '—', dS: '→ 3☠️',
  },
  carpenter: {
    name: 'Carpenter', frame: 2, canIsland: true,
    island: { res: 'wood', amt: 1, chance: 0.95 },
    ship:   { cRes: 'wood', cN: 2, pRes: 'cunning', pN: 3 },
    cost: 3,
    dI: '1🪵, safe', dS: '2🪵 → 3☠️',
  },
  stonemason: {
    name: 'Stonemason', frame: 7, canIsland: true,
    island: { res: 'stone', amt: 1, chance: 0.95 },
    ship:   { cRes: 'stone', cN: 2, pRes: 'cunning', pN: 3 },
    cost: 3,
    dI: '1🪨, safe', dS: '2🪨 → 3☠️',
  },
  smuggler: {
    name: 'Smuggler', frame: 3, canIsland: true,
    island: { res: 'gold', amt: 1, chance: 0.4 },
    ship:   { cRes: 'gold', cN: 1, pRes: 'cunning', pN: 3 },
    cost: 4,
    dI: '1🪙, very risky', dS: '1🪙 → 3☠️',
  },
};

const SHOP_POOL = [
  'masterLumberjack', 'masterMiner', 'masterAdventurer',
  'bosun', 'carpenter', 'stonemason', 'smuggler',
];

// ────────────────── STATE ──────────────────

let uid = 0;
function mkP(type) { return { id: uid++, type }; }

function randomShopType() {
  return Phaser.Utils.Array.GetRandom(SHOP_POOL);
}

function initialShop(n) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(randomShopType());
  return arr;
}

let G = {};

function initState() {
  const crew = [];
  for (let i = 0; i < 3; i++) crew.push(mkP('lumberjack'));
  for (let i = 0; i < 3; i++) crew.push(mkP('miner'));
  for (let i = 0; i < 2; i++) crew.push(mkP('adventurer'));
  for (let i = 0; i < 2; i++) crew.push(mkP('slacker'));

  G = {
    allCrew: [...crew],
    deck: Phaser.Utils.Array.Shuffle([...crew]),
    discard: [],
    hand: [],
    res: { wood: 0, stone: 0, gold: 0, map: 0 },
    cunning: 0,
    round: 0,
    phase: 'sending',
    sent: [],
    island: null,
    shop: initialShop(4),
    shopAnimating: false,
    busy: false,
  };
}

// ────────────────── LAYOUT Y-coordinates ──────────────────

const Y_ROUND   = 30;
const Y_INV     = 75;
const Y_CREW    = 130;
const Y_DIV1    = 175;
const Y_ISL_CY  = 370;
const Y_ISL_LBL = 500;
const Y_PHASE   = 555;
const Y_HAND    = 680;
const Y_HLBL    = 745;
const Y_BTN     = 890;
const Y_DIV2    = 955;
const Y_SHOP_L  = 985;
const Y_SHOP_C  = 1030;
const Y_SHOP_P  = 1130;
const Y_SHOP_PR = 1200;
const Y_SHOP_NM = 1240;
const Y_SHOP_DI = 1264;
const Y_SHOP_DS = 1290;
const Y_SHOP_BT = 1330;

// ────────────────── SCENE ──────────────────

class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  preload() {
    this.load.spritesheet('pirates', 'assets/pirates.png', {
      frameWidth: 8, frameHeight: 8, spacing: 2, margin: 0,
    });
  }

  create() {
    this.cameras.main.setBackgroundColor(BG_COLOR);

    this.ct = {};
    ['top', 'island', 'phase', 'hand', 'btn', 'shop', 'tip', 'fx'].forEach(k => {
      this.ct[k] = this.add.container(0, 0);
    });
    this.ct.tip.setDepth(100).setVisible(false);
    this.ct.fx.setDepth(50);

    this._tipRect = null;
    this._tipJustOpened = false;
    this.input.on('pointerdown', (ptr) => {
      if (this._tipJustOpened) {
        this._tipJustOpened = false;
        return;
      }
      if (this.ct.tip.visible) {
        if (!this._tipRect || !this._tipRect.contains(ptr.x, ptr.y)) {
          this.ct.tip.setVisible(false);
        }
      }
    });

    initState();
    this.startRound();
  }

  // ──────────── GAME FLOW ────────────

  startRound() {
    G.round++;
    G.phase = 'sending';
    G.sent = [];
    G.cunning = 0;
    G.busy = false;
    G.island = Phaser.Utils.Array.GetRandom(ISLANDS);
    G.hand = this.drawCards(5);

    if (G.round > 1) {
      const oldShop = [...G.shop];
      G.shop.shift();
      G.shop.push(randomShopType());
      G.shopAnimating = true;
      this.renderAll();
      this.animateShopTransition(oldShop, 0, 'round');
    } else {
      this.renderAll();
    }
  }

  drawCards(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      if (G.deck.length === 0) {
        if (G.discard.length === 0) break;
        G.deck = Phaser.Utils.Array.Shuffle([...G.discard]);
        G.discard = [];
      }
      out.push(G.deck.pop());
    }
    return out;
  }

  sendToIsland(idx) {
    if (G.phase !== 'sending' || G.busy) return;
    if (G.sent.includes(idx) || G.sent.length >= 2) return;

    this.ct.tip.setVisible(false);
    const p = G.hand[idx];
    const def = TYPES[p.type];

    if (!def.canIsland) {
      this.float(this.handX(idx), Y_HAND - 40, "Can't go!", '#ff8a80');
      return;
    }

    G.busy = true;
    G.sent.push(idx);

    const fromX = this.handX(idx);
    const fromY = Y_HAND;
    const toX = W / 2 + (G.sent.length === 1 ? -50 : 50);
    const toY = Y_ISL_CY;

    const ghost = this.add.sprite(fromX, fromY, 'pirates', def.frame)
      .setScale(SC).setDepth(60);

    this.tweens.add({
      targets: ghost, x: toX, y: toY,
      duration: 350, ease: 'Power2',
      onComplete: () => {
        ghost.destroy();
        const result = this.resolveIsland(p);
        this.showIslandResult(result, toX);
        this.renderAll();

        this.time.delayedCall(500, () => {
          G.busy = false;
          if (G.sent.length >= 2) {
            this.endSending();
          } else {
            this.renderAll();
          }
        });
      },
    });
  }

  resolveIsland(pirate) {
    const def = TYPES[pirate.type];
    const isl = G.island;
    let chance = def.island.chance;
    let amt = def.island.amt;
    const tgt = def.island.res;

    if (tgt === 'gold' && G.res.map > 0) {
      chance = Math.min(chance + 0.30, 0.95);
      G.res.map--;
    }
    if (isl.bonus === tgt) amt *= 2;

    if (Math.random() < chance) {
      G.res[tgt] += amt;
      return { ok: true, res: tgt, n: amt };
    }

    if (Math.random() < 0.01) {
      G.res.map++;
      return { ok: false, res: 'map', n: 1 };
    }
    const others = ['wood', 'stone', 'gold'].filter(r => r !== tgt);
    const alt = Phaser.Utils.Array.GetRandom(others);
    let altAmt = 1;
    if (isl.bonus === alt) altAmt *= 2;
    G.res[alt] += altAmt;
    return { ok: false, res: alt, n: altAmt };
  }

  showIslandResult(r, x) {
    const em = RES_EMOJI[r.res] || '🗺️';
    if (r.ok) {
      this.float(x, Y_ISL_CY - 80, '+' + r.n + em, '#66bb6a');
    } else if (r.res === 'map') {
      this.float(x, Y_ISL_CY - 80, '+🗺️!', '#ffd54f');
    } else {
      this.float(x, Y_ISL_CY - 80, 'Miss +' + r.n + em, '#ffa726');
    }
  }

  endSending() {
    if (G.phase !== 'sending') return;
    G.phase = 'ship';
    G.busy = true;
    this.ct.tip.setVisible(false);
    this.renderAll();

    const shipIdx = [];
    for (let i = 0; i < G.hand.length; i++) {
      if (!G.sent.includes(i)) shipIdx.push(i);
    }

    const delay = 450;
    shipIdx.forEach((hi, si) => {
      this.time.delayedCall(delay * (si + 1), () => {
        const r = this.resolveShip(G.hand[hi]);
        const x = this.handX(hi);
        if (r.ok) {
          const em = r.pRes === 'cunning' ? '☠️' : RES_EMOJI[r.pRes];
          this.float(x, Y_HAND - 40, '+' + r.pN + em, '#80cbc4');
        } else {
          this.float(x, Y_HAND - 40, '—', '#546e7a');
        }
        this.renderAll();
      });
    });

    this.time.delayedCall(delay * (shipIdx.length + 1) + 200, () => {
      G.phase = 'shopping';
      G.busy = false;
      this.renderAll();
    });
  }

  resolveShip(pirate) {
    const s = TYPES[pirate.type].ship;
    if (!s.cRes) {
      if (s.pRes === 'cunning') G.cunning += s.pN;
      else G.res[s.pRes] += s.pN;
      return { ok: true, pRes: s.pRes, pN: s.pN };
    }
    if ((G.res[s.cRes] || 0) >= s.cN) {
      G.res[s.cRes] -= s.cN;
      if (s.pRes === 'cunning') G.cunning += s.pN;
      else G.res[s.pRes] += s.pN;
      return { ok: true, pRes: s.pRes, pN: s.pN };
    }
    return { ok: false };
  }

  buyPirate(si) {
    if (G.phase !== 'shopping' || G.busy || G.shopAnimating) return;
    if (si >= G.shop.length) return;
    const type = G.shop[si];
    const def = TYPES[type];
    if (G.cunning < def.cost) {
      this.float(W / 2, Y_SHOP_P - 40, 'Not enough ☠️', '#ef5350');
      return;
    }
    G.cunning -= def.cost;
    const p = mkP(type);
    G.allCrew.push(p);
    G.discard.push(p);
    const oldShop = [...G.shop];
    G.shop.splice(si, 1);
    G.shop.push(randomShopType());
    this.float(W / 2, Y_SHOP_P - 40, '+ ' + def.name + '!', '#66bb6a');
    this.ct.tip.setVisible(false);
    G.shopAnimating = true;
    this.renderAll();
    this.animateShopTransition(oldShop, si, 'buy');
  }

  endRound() {
    if (G.phase !== 'shopping') return;
    G.discard.push(...G.hand);
    G.hand = [];
    G.sent = [];
    G.cunning = 0;
    this.ct.tip.setVisible(false);
    this.startRound();
  }

  // ──────────── HELPERS ────────────

  handX(idx) {
    const n = G.hand.length;
    const sp = 190;
    return W / 2 - ((n - 1) * sp) / 2 + idx * sp;
  }

  shopX(idx, n) {
    const sp = 220;
    return W / 2 - ((n - 1) * sp) / 2 + idx * sp;
  }

  clearCt(k) { this.ct[k].removeAll(true); }

  addTo(k, obj) { this.ct[k].add(obj); return obj; }

  txt(k, x, y, str, style) {
    const base = { fontFamily: 'monospace', fontSize: '24px', color: '#b0b8c8' };
    const t = this.add.text(x, y, str, Object.assign(base, style)).setOrigin(0.5, 0);
    return this.addTo(k, t);
  }

  // ──────────── RENDERING ────────────

  renderAll() {
    this.renderTop();
    this.renderIsland();
    this.renderPhase();
    this.renderHand();
    this.renderBtn();
    this.renderShop();
  }

  renderTop() {
    this.clearCt('top');

    this.txt('top', W / 2, Y_ROUND,
      `Round ${G.round}`,
      { fontSize: '26px' });

    let inv = '';
    ['wood', 'stone', 'gold', 'map'].forEach(r => {
      for (let i = 0; i < Math.min(G.res[r], 30); i++) inv += RES_EMOJI[r];
    });
    if (G.cunning > 0) for (let i = 0; i < Math.min(G.cunning, 20); i++) inv += '☠️';
    if (!inv) inv = '—';
    this.txt('top', W / 2, Y_INV, inv,
      { fontSize: '24px', color: '#d0d0d0', wordWrap: { width: W - 40 } });

    const crew = G.allCrew;
    const maxSp = 44;
    const sp = Math.min(maxSp, (W - 80) / Math.max(crew.length, 1));
    const sx = W / 2 - ((crew.length - 1) * sp) / 2;

    const handIds = new Set(G.hand.map(p => p.id));
    const deckIds = new Set(G.deck.map(p => p.id));

    crew.forEach((p, i) => {
      const cx = sx + i * sp;
      const spr = this.add.sprite(cx, Y_CREW, 'pirates', TYPES[p.type].frame)
        .setScale(SC_SM);
      if (!handIds.has(p.id) && !deckIds.has(p.id)) spr.setTint(0x333333);
      spr.setInteractive({ useHandCursor: true });
      spr.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        this.showTip(p.type, cx, Y_CREW + 30, { fromClick: true });
      });
      spr.on('pointerover', () => {
        if (this.ct.tip.visible) this.showTip(p.type, cx, Y_CREW + 30);
      });
      this.addTo('top', spr);
    });

    const dv = this.add.graphics();
    dv.lineStyle(2, 0x1e3040);
    dv.lineBetween(40, Y_DIV1, W - 40, Y_DIV1);
    this.addTo('top', dv);
  }

  renderIsland() {
    this.clearCt('island');
    const cx = W / 2, cy = Y_ISL_CY;

    const g = this.add.graphics();
    g.fillStyle(0x0f2a40, 0.6);
    g.fillEllipse(cx, cy, 600, 340);
    g.fillStyle(0xe8c840, 1);
    g.fillEllipse(cx, cy, 440, 220);
    g.fillStyle(G.island.accent, 0.25);
    g.fillEllipse(cx - 50, cy - 16, 140, 80);
    this.addTo('island', g);

    this.txt('island', cx, cy - 136, G.island.emoji, { fontSize: '48px' });

    const bm = { wood: '2x 🪵', stone: '2x 🪨', gold: '2x 🪙' };
    this.txt('island', cx, Y_ISL_LBL, `${G.island.name}: ${bm[G.island.bonus]}`,
      { fontSize: '22px', color: '#ffe082' });

    G.sent.forEach((hi, si) => {
      const p = G.hand[hi];
      const px = cx + (si === 0 ? -50 : 50);
      const spr = this.add.sprite(px, cy, 'pirates', TYPES[p.type].frame).setScale(SC);
      spr.setInteractive({ useHandCursor: true });
      spr.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        this.showTip(p.type, px, cy - 100, { fromClick: true });
      });
      spr.on('pointerover', () => {
        if (this.ct.tip.visible) this.showTip(p.type, px, cy - 100);
      });
      this.addTo('island', spr);
    });
  }

  renderPhase() {
    this.clearCt('phase');
    let str = '', col = '#8090a0';
    if (G.phase === 'sending') {
      const r = 2 - G.sent.length;
      str = `Tap a pirate to send ashore (${r} left)`;
    } else if (G.phase === 'ship') {
      str = '⛵ Ship at work…';
      col = '#80cbc4';
    } else {
      str = `Shop  ·  cunning: ☠️ ${G.cunning}`;
      col = '#ce93d8';
    }
    this.txt('phase', W / 2, Y_PHASE, str, { fontSize: '22px', color: col });
  }

  renderHand() {
    this.clearCt('hand');

    G.hand.forEach((p, i) => {
      if (G.sent.includes(i)) return;
      const def = TYPES[p.type];
      const x = this.handX(i);

      const spr = this.add.sprite(x, Y_HAND, 'pirates', def.frame).setScale(SC);

      if (G.phase === 'sending' && !G.busy) {
        spr.setInteractive({ useHandCursor: true });
        if (!def.canIsland) spr.setAlpha(0.55);
        spr.on('pointerover', () => spr.setScale(SC + 1));
        spr.on('pointerout', () => spr.setScale(SC));
        spr.on('pointerdown', (ptr) => {
          ptr.event.stopPropagation();
          this.sendToIsland(i);
        });
      }

      this.addTo('hand', spr);

      // name + stats under each pirate
      this.txt('hand', x, Y_HLBL, def.name,
        { fontSize: '20px', color: '#a0b0c0' });
      this.txt('hand', x, Y_HLBL + 28, '🏝️' + def.dI,
        { fontSize: '18px', color: '#7a9a6a' });
      this.txt('hand', x, Y_HLBL + 54, '⛵' + def.dS,
        { fontSize: '18px', color: '#6a8a9a' });
    });
  }

  renderBtn() {
    this.clearCt('btn');
    if (G.busy) return;

    if (G.phase === 'sending') {
      this.mkBtn('btn', W / 2, Y_BTN, 'End landing ⛵', () => this.endSending());
    } else if (G.phase === 'shopping') {
      this.mkBtn('btn', W / 2, Y_BTN, 'Next round →', () => this.endRound());
    }
  }

  mkBtn(k, x, y, label, cb) {
    const t = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: '24px', color: '#c0d8c0',
      backgroundColor: '#1e4535', padding: { x: 32, y: 16 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setStyle({ backgroundColor: '#2a6545' }));
    t.on('pointerout', () => t.setStyle({ backgroundColor: '#1e4535' }));
    t.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); cb(); });
    this.addTo(k, t);
  }

  renderShop() {
    this.clearCt('shop');

    const dv = this.add.graphics();
    dv.lineStyle(2, 0x1e3040);
    dv.lineBetween(40, Y_DIV2, W - 40, Y_DIV2);
    this.addTo('shop', dv);

    this.txt('shop', W / 2, Y_SHOP_L, 'Pirate Shop',
      { fontSize: '24px', color: '#9070a0' });
    this.txt('shop', W / 2, Y_SHOP_C, `Cunning: ☠️ ${G.cunning}`,
      { fontSize: '22px', color: '#ce93d8' });

    if (G.shopAnimating) return;

    if (G.shop.length === 0) {
      this.txt('shop', W / 2, Y_SHOP_P, '( empty )', { color: '#404858' });
      return;
    }

    const sp = 220;
    const sx = W / 2 - ((G.shop.length - 1) * sp) / 2;

    G.shop.forEach((type, i) => {
      const def = TYPES[type];
      const x = sx + i * sp;

      const spr = this.add.sprite(x, Y_SHOP_P, 'pirates', def.frame).setScale(SC);
      spr.setInteractive({ useHandCursor: true });

      const canBuy = G.phase === 'shopping' && G.cunning >= def.cost;

      this.txt('shop', x, Y_SHOP_PR, `☠️${def.cost}`,
        { fontSize: '22px', color: canBuy ? '#ce93d8' : '#504858' });

      this.txt('shop', x, Y_SHOP_NM, def.name,
        { fontSize: '20px', color: '#a0b0c0' });
      this.txt('shop', x, Y_SHOP_DI, '🏝️' + def.dI,
        { fontSize: '18px', color: '#7a9a6a' });
      this.txt('shop', x, Y_SHOP_DS, '⛵' + def.dS,
        { fontSize: '18px', color: '#6a8a9a' });

      if (!canBuy) spr.setAlpha(G.phase === 'shopping' ? 0.45 : 0.75);

      const shopTipOpts = { shopIdx: i, canBuy };
      spr.on('pointerover', () => {
        spr.setScale(SC + 1);
        if (this.ct.tip.visible) this.showTip(type, x, Y_SHOP_P - 100, shopTipOpts);
      });
      spr.on('pointerout', () => spr.setScale(SC));
      spr.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        this.showTip(type, x, Y_SHOP_P - 100, Object.assign({ fromClick: true }, shopTipOpts));
      });

      this.addTo('shop', spr);

      if (G.phase === 'shopping' && canBuy) {
        const bb = this.add.text(x, Y_SHOP_BT, '[ buy ]', {
          fontFamily: 'monospace', fontSize: '20px', color: '#a0d0a0',
          backgroundColor: '#1a3a28', padding: { x: 12, y: 6 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        bb.on('pointerover', () => bb.setStyle({ backgroundColor: '#2a5a38' }));
        bb.on('pointerout', () => bb.setStyle({ backgroundColor: '#1a3a28' }));
        bb.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this.buyPirate(i); });
        this.addTo('shop', bb);
      }
    });
  }

  // ──────────── SHOP ANIMATION ────────────

  animateShopTransition(oldShop, removedIdx, mode) {
    G.shopAnimating = true;
    const n = oldShop.length;
    const newN = G.shop.length;
    const dur = 350;
    const ghosts = [];

    oldShop.forEach((type, i) => {
      const def = TYPES[type];
      const x = this.shopX(i, n);
      const spr = this.add.sprite(x, Y_SHOP_P, 'pirates', def.frame)
        .setScale(SC).setDepth(55);
      this.ct.fx.add(spr);
      ghosts.push(spr);
    });

    const removed = ghosts[removedIdx];
    if (mode === 'round') {
      this.tweens.add({
        targets: removed,
        x: removed.x - 180, alpha: 0,
        duration: dur, ease: 'Power2',
      });
    } else {
      this.tweens.add({
        targets: removed,
        y: removed.y - 100, alpha: 0,
        duration: dur, ease: 'Power2',
      });
    }

    let ni = 0;
    for (let i = 0; i < n; i++) {
      if (i === removedIdx) continue;
      const targetX = this.shopX(ni, newN);
      if (Math.abs(ghosts[i].x - targetX) > 1) {
        this.tweens.add({
          targets: ghosts[i],
          x: targetX,
          duration: dur, ease: 'Power2',
        });
      }
      ni++;
    }

    const newType = G.shop[G.shop.length - 1];
    const newDef = TYPES[newType];
    const targetX = this.shopX(newN - 1, newN);
    const newGhost = this.add.sprite(W + 80, Y_SHOP_P, 'pirates', newDef.frame)
      .setScale(SC).setDepth(55);
    this.ct.fx.add(newGhost);
    this.tweens.add({
      targets: newGhost,
      x: targetX,
      duration: dur, ease: 'Power2',
      delay: 60,
    });

    this.time.delayedCall(dur + 120, () => {
      ghosts.forEach(g => g.destroy());
      newGhost.destroy();
      G.shopAnimating = false;
      this.renderShop();
    });
  }

  // ──────────── TOOLTIP ────────────

  showTip(type, tx, ty, opts = {}) {
    if (opts.fromClick) this._tipJustOpened = true;
    this.clearCt('tip');
    const def = TYPES[type];
    const lines = [];
    lines.push(def.name);
    lines.push('─────────────');
    lines.push('🏝️ ' + def.dI);
    lines.push('⛵ ' + def.dS);
    if (def.cost !== null) {
      lines.push('');
      lines.push('Cost: ☠️' + def.cost);
    }
    if (type === 'adventurer' || type === 'masterAdventurer' || type === 'smuggler') {
      if (G.res.map > 0) {
        lines.push('🗺️ Map: +30% gold chance');
      }
    }
    const body = lines.join('\n');

    const tmp = this.add.text(0, -999, body, {
      fontFamily: 'monospace', fontSize: '22px', lineSpacing: 6,
    });
    const tw = tmp.width, th = tmp.height;
    tmp.destroy();

    const pad = 20;
    const bw = tw + pad * 2, bh = th + pad * 2;
    let bx = tx - bw / 2;
    let by = ty - bh - 16;
    if (bx < 8) bx = 8;
    if (bx + bw > W - 8) bx = W - bw - 8;
    if (by < 8) by = ty + 60;

    const bg = this.add.graphics();
    bg.fillStyle(0x101828, 0.95);
    bg.fillRoundedRect(bx, by, bw, bh, 10);
    bg.lineStyle(2, 0x304860);
    bg.strokeRoundedRect(bx, by, bw, bh, 10);
    this.addTo('tip', bg);

    const txt = this.add.text(bx + pad, by + pad, body, {
      fontFamily: 'monospace', fontSize: '22px', color: '#d0d8e0', lineSpacing: 6,
    });
    this.addTo('tip', txt);

    let extraH = 0;

    if (opts.canSend && G.phase === 'sending' && !G.busy) {
      const btnY = by + bh + 8;
      const sb = this.add.text(bx + bw / 2, btnY, '🏝️ To island', {
        fontFamily: 'monospace', fontSize: '22px', color: '#ffe0a0',
        backgroundColor: '#4a3a10', padding: { x: 20, y: 10 },
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      sb.on('pointerover', () => sb.setStyle({ backgroundColor: '#6a5a20' }));
      sb.on('pointerout', () => sb.setStyle({ backgroundColor: '#4a3a10' }));
      sb.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        this.ct.tip.setVisible(false);
        this.sendToIsland(opts.handIdx);
      });
      this.addTo('tip', sb);
      extraH = 60;
    }

    if (opts.canBuy && G.phase === 'shopping') {
      const btnY = by + bh + 8 + extraH;
      const bb = this.add.text(bx + bw / 2, btnY, 'Buy', {
        fontFamily: 'monospace', fontSize: '22px', color: '#a0d8a0',
        backgroundColor: '#1a3a28', padding: { x: 20, y: 10 },
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      bb.on('pointerover', () => bb.setStyle({ backgroundColor: '#2a5a38' }));
      bb.on('pointerout', () => bb.setStyle({ backgroundColor: '#1a3a28' }));
      bb.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        this.buyPirate(opts.shopIdx);
      });
      this.addTo('tip', bb);
      extraH += 60;
    }

    this._tipRect = new Phaser.Geom.Rectangle(bx, by, bw, bh + extraH);

    this.ct.tip.setVisible(true);
  }

  // ──────────── FLOATING TEXT ────────────

  float(x, y, str, col) {
    const t = this.add.text(x, y, str, {
      fontFamily: 'monospace', fontSize: '28px', color: col || '#fff',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({
      targets: t, y: y - 70, alpha: 0,
      duration: 1400, ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }
}

// ────────────────── BOOT ──────────────────

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: GameScene,
});
