/* ============================================================
   PIRATES — GameScene
   ============================================================ */

class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  preload() {
    this.load.spritesheet('pirates', 'assets/pirates.png', {
      frameWidth: 8, frameHeight: 8, spacing: 2, margin: 0,
    });
  }

  create() {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.L = computeLayout(this.scale.width, this.scale.height);

    this.ct = {};
    ['top', 'island', 'phase', 'hand', 'btn', 'shop', 'tip', 'fx', 'gameover'].forEach(k => {
      this.ct[k] = this.add.container(0, 0);
    });
    this.ct.tip.setDepth(100).setVisible(false);
    this.ct.fx.setDepth(50);
    this.ct.gameover.setDepth(200);

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

    this.scale.on('resize', (gameSize) => {
      this.L = computeLayout(gameSize.width, gameSize.height);
      if (G.round > 0 && !G.shopAnimating) this.renderAll();
    });

    initState();
    this.startRound();
  }

  // ──────────── GAME FLOW ────────────

  startRound() {
    G.round++;
    G.sent = [];
    G.enthusiasm = 0;
    G.busy = false;

    const isBoarding = G.round % 5 === 0;
    if (isBoarding) {
      G.boardingCount++;
      G.phase = 'boarding';
      G.island = null;
      G.enemyShip = { strength: 5 * G.boardingCount };
    } else {
      G.phase = 'sending';
      G.island = Phaser.Utils.Array.GetRandom(ISLANDS);
      G.enemyShip = null;
      if (G.island.bonusEnthusiasm) G.enthusiasm += G.island.bonusEnthusiasm;
    }

    G.hand = this.drawCards(5);

    if (G.round > 1) {
      const oldShop = [...G.shop];
      G.shop.shift();
      G.shop.push(randomShopType(G.round));
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

  maxSend() {
    if (!G.island) return 0;
    return 2 + (G.island.extraSend || 0);
  }

  sentOffsetX(si) {
    const m = this.maxSend();
    const sp = 100;
    return (si - (m - 1) / 2) * sp;
  }

  sendToIsland(idx) {
    if (G.phase !== 'sending' || G.busy) return;
    if (G.sent.includes(idx) || G.sent.length >= this.maxSend()) return;

    this.ct.tip.setVisible(false);
    const p = G.hand[idx];
    const def = TYPES[p.type];
    const L = this.L;

    if (!def.canIsland) {
      this.float(this.handX(idx), L.Y_HAND - 40 * L.k, "Can't go!", '#ff8a80');
      return;
    }

    G.busy = true;
    G.sent.push(idx);

    const fromX = this.handX(idx);
    const fromY = L.Y_HAND;
    const toX = L.cx + this.sentOffsetX(G.sent.length - 1) * L.k;
    const toY = L.Y_ISL_CY;

    const ghost = this.add.sprite(fromX, fromY, 'pirates', def.frame)
      .setScale(L.SC).setDepth(60);

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
          if (G.sent.length >= this.maxSend()) {
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

    if (def.island.recall) {
      const currentIdx = G.sent[G.sent.length - 1];
      const candidates = G.sent.filter(idx => idx !== currentIdx);
      const n = Math.min(def.island.recall, candidates.length);
      for (let i = 0; i < n; i++) {
        const recIdx = candidates[candidates.length - 1 - i];
        G.sent = G.sent.filter(idx => idx !== recIdx);
      }
      return { ok: n > 0, recall: n };
    }

    if (def.island.guaranteed) {
      const g = def.island.guaranteed;
      if (g.res === 'enthusiasm') G.enthusiasm += g.amt;
      else G.res[g.res] = (G.res[g.res] || 0) + g.amt;
      return { ok: true, res: g.res, n: g.amt };
    }

    if (def.island.multi) {
      const items = [];
      for (const m of def.island.multi) {
        let amt = m.amt;
        if (isl.bonus === m.res) amt *= 2;
        G.res[m.res] += amt;
        items.push({ res: m.res, n: amt });
      }
      return { ok: true, items };
    }

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
    const L = this.L;
    if (r.recall !== undefined) {
      if (r.ok) {
        this.float(x, L.Y_ISL_CY - 80 * L.k, '↩ Recalled!', '#80cbc4');
      } else {
        this.float(x, L.Y_ISL_CY - 80 * L.k, 'No one to recall', '#ffa726');
      }
      return;
    }
    if (r.items) {
      const msg = r.items.map(i => '+' + i.n + RES_EMOJI[i.res]).join(' ');
      this.float(x, L.Y_ISL_CY - 80 * L.k, msg, '#66bb6a');
      return;
    }
    const em = RES_EMOJI[r.res] || '🗺️';
    if (r.ok) {
      this.float(x, L.Y_ISL_CY - 80 * L.k, '+' + r.n + em, '#66bb6a');
    } else if (r.res === 'map') {
      this.float(x, L.Y_ISL_CY - 80 * L.k, '+🗺️!', '#ffd54f');
    } else {
      this.float(x, L.Y_ISL_CY - 80 * L.k, 'Miss +' + r.n + em, '#ffa726');
    }
  }

  endSending() {
    if (G.phase !== 'sending') return;
    G.phase = 'ship';
    G.busy = true;
    this.ct.tip.setVisible(false);
    this.renderAll();

    this._shipQueue = [];
    for (let i = 0; i < G.hand.length; i++) {
      if (!G.sent.includes(i)) this._shipQueue.push(i);
    }
    this._shipQueuePos = 0;
    this.processNextShip();
  }

  processNextShip() {
    if (this._shipQueuePos >= this._shipQueue.length) {
      this.time.delayedCall(200, () => {
        G.phase = 'shopping';
        G.busy = false;
        this.renderAll();
      });
      return;
    }
    const hi = this._shipQueue[this._shipQueuePos];
    this._shipQueuePos++;

    this.time.delayedCall(450, () => {
      const pirate = G.hand[hi];
      const def = TYPES[pirate.type];
      const L = this.L;
      const x = this.handX(hi);

      if (def.ship.removeFromDeck) {
        if (def.ship.cRes && (G.res[def.ship.cRes] || 0) < def.ship.cN) {
          this.float(x, L.Y_HAND - 40 * L.k, '—', '#546e7a');
          this.renderAll();
          this.processNextShip();
          return;
        }
        const handIds = new Set(G.hand.map(p => p.id));
        const targets = G.allCrew.filter(p => !handIds.has(p.id));
        if (targets.length === 0) {
          this.float(x, L.Y_HAND - 40 * L.k, 'No one to exile', '#ffa726');
          this.renderAll();
          this.processNextShip();
          return;
        }
        if (def.ship.cRes) G.res[def.ship.cRes] -= def.ship.cN;
        this.float(x, L.Y_HAND - 40 * L.k, 'Exile a pirate!', '#ff8a80');
        G.phase = 'removing';
        G.busy = false;
        this.renderAll();
        return;
      }

      const r = this.resolveShip(pirate);
      if (r.ok) {
        let msg = '';
        if (r.pN > 0) {
          const em = r.pRes === 'enthusiasm' ? '☠️' : RES_EMOJI[r.pRes];
          msg = '+' + r.pN + em;
        }
        if (r.weaponN) msg += (msg ? ' ' : '') + '+' + (r.weaponN > 1 ? r.weaponN : '') + '🗡️';
        if (r.cannonN) msg += (msg ? ' ' : '') + '+' + (r.cannonN > 1 ? r.cannonN : '') + '💣';
        if (!msg) msg = '✓';
        this.float(x, L.Y_HAND - 40 * L.k, msg, '#80cbc4');
      } else {
        this.float(x, L.Y_HAND - 40 * L.k, '—', '#546e7a');
      }
      this.renderAll();
      this.processNextShip();
    });
  }

  completeRemoval(pirateId) {
    G.allCrew = G.allCrew.filter(p => p.id !== pirateId);
    G.deck = G.deck.filter(p => p.id !== pirateId);
    G.discard = G.discard.filter(p => p.id !== pirateId);

    const L = this.L;
    this.float(L.cx, L.Y_CREW - 20 * L.k, '💀 Exiled!', '#ff8a80');

    G.phase = 'ship';
    G.busy = true;
    this.ct.tip.setVisible(false);
    this.renderAll();
    this.processNextShip();
  }

  resolveShip(pirate) {
    const s = TYPES[pirate.type].ship;
    if (s.costs) {
      for (const c of s.costs) {
        if ((G.res[c.res] || 0) < c.n) return { ok: false };
      }
      for (const c of s.costs) G.res[c.res] -= c.n;
      const weaponN = s.prodWeapons || 0;
      const cannonN = s.prodCannons || 0;
      G.weapons += weaponN;
      G.cannons += cannonN;
      if (s.pRes === 'enthusiasm') G.enthusiasm += (s.pN || 0);
      else if (s.pRes) G.res[s.pRes] += (s.pN || 0);
      return { ok: true, pRes: s.pRes || null, pN: s.pN || 0, weaponN, cannonN };
    }
    if (!s.cRes) {
      if (s.pRes === 'enthusiasm') G.enthusiasm += s.pN;
      else G.res[s.pRes] += s.pN;
      return { ok: true, pRes: s.pRes, pN: s.pN, weaponN: 0, cannonN: 0 };
    }
    if ((G.res[s.cRes] || 0) >= s.cN) {
      G.res[s.cRes] -= s.cN;
      if (s.pRes === 'enthusiasm') G.enthusiasm += s.pN;
      else G.res[s.pRes] += s.pN;
      const weaponN = s.prodWeapons || 0;
      const cannonN = s.prodCannons || 0;
      G.weapons += weaponN;
      G.cannons += cannonN;
      return { ok: true, pRes: s.pRes, pN: s.pN, weaponN, cannonN };
    }
    return { ok: false };
  }

  buyPirate(si) {
    if (G.phase !== 'shopping' || G.busy || G.shopAnimating) return;
    if (si >= G.shop.length) return;
    const L = this.L;
    const type = G.shop[si];
    const def = TYPES[type];
    if (G.enthusiasm < def.cost) {
      this.float(L.cx, L.Y_SHOP_P - 40 * L.k, 'Not enough ☠️', '#ef5350');
      return;
    }
    G.enthusiasm -= def.cost;
    const p = mkP(type);
    G.allCrew.push(p);
    G.discard.push(p);
    const oldShop = [...G.shop];
    G.shop.splice(si, 1);
    G.shop.push(randomShopType(G.round));
    this.float(L.cx, L.Y_SHOP_P - 40 * L.k, '+ ' + def.name + '!', '#66bb6a');
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
    G.enthusiasm = 0;
    this.ct.tip.setVisible(false);
    this.startRound();
  }

  shipBonusStr() {
    return G.weapons + G.cannons;
  }

  resolveBoarding() {
    if (G.phase !== 'boarding' || G.busy) return;
    G.busy = true;
    this.ct.tip.setVisible(false);

    const crewStr = G.hand.reduce((s, p) => s + (TYPES[p.type].str || 0), 0);
    const totalStr = crewStr + this.shipBonusStr();
    const shipStr = G.enemyShip.strength;
    const L = this.L;

    if (totalStr >= shipStr) {
      this.float(L.cx, L.Y_ISL_CY - 80 * L.k, '⚔️ Victory!', '#66bb6a');
      this.time.delayedCall(1000, () => {
        G.weapons = 0;
        G.busy = false;
        G.discard.push(...G.hand);
        G.hand = [];
        this.ct.tip.setVisible(false);
        this.startRound();
      });
    } else {
      this.float(L.cx, L.Y_ISL_CY - 80 * L.k, '💀 Defeated…', '#ff5252');
      this.time.delayedCall(1200, () => {
        G.weapons = 0;
        G.busy = false;
        this.renderAll();
        this.showGameOver();
      });
    }
  }

  showGameOver() {
    this.clearCt('gameover');
    const L = this.L;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.82);
    overlay.fillRect(0, 0, L.W, L.H);
    this.addTo('gameover', overlay);

    this.txt('gameover', L.cx, L.H * 0.32, '☠️ DEFEATED ☠️',
      { fontSize: L.fs(48), color: '#ff5252' });
    this.txt('gameover', L.cx, L.H * 0.40,
      `Survived ${G.round} rounds  ·  ${G.boardingCount} boarding${G.boardingCount !== 1 ? 's' : ''}`,
      { fontSize: L.fs(26), color: '#b0b8c8' });

    const crewStr = G.hand.reduce((s, p) => s + (TYPES[p.type].str || 0), 0);
    const totalStr = crewStr + this.shipBonusStr();
    this.txt('gameover', L.cx, L.H * 0.46,
      `Your crew ${totalStr}⚔️  vs  Enemy ${G.enemyShip.strength}⚔️`,
      { fontSize: L.fs(24), color: '#ff8a80' });

    const btn = this.add.text(L.cx, L.H * 0.56, '[ Try Again ]', {
      fontFamily: 'monospace', fontSize: L.fs(32), color: '#a0d0a0',
      backgroundColor: '#1e4535', padding: { x: 40, y: 20 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#2a6545' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#1e4535' }));
    btn.on('pointerdown', () => {
      this.clearCt('gameover');
      initState();
      this.startRound();
    });
    this.addTo('gameover', btn);
  }

  // ──────────── HELPERS ────────────

  handX(idx) {
    const L = this.L;
    const n = G.hand.length;
    const sp = Math.min(180 * L.k, (L.W - 80) / Math.max(n - 1, 1));
    return L.cx - ((n - 1) * sp) / 2 + idx * sp;
  }

  shopX(idx, n) {
    const L = this.L;
    const sp = Math.min(190 * L.k, (L.W - 80) / Math.max(n - 1, 1));
    return L.cx - ((n - 1) * sp) / 2 + idx * sp;
  }

  clearCt(k) { this.ct[k].removeAll(true); }

  addTo(k, obj) { this.ct[k].add(obj); return obj; }

  txt(k, x, y, str, style) {
    const L = this.L;
    const base = { fontFamily: 'monospace', fontSize: L.fs(24), color: '#b0b8c8' };
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
    const L = this.L;

    this.txt('top', L.cx, L.Y_ROUND,
      `Round ${G.round}`,
      { fontSize: L.fs(26) });

    let inv = '';
    ['wood', 'stone', 'gold', 'map'].forEach(r => {
      for (let i = 0; i < Math.min(G.res[r], 30); i++) inv += RES_EMOJI[r];
    });
    if (G.enthusiasm > 0) for (let i = 0; i < Math.min(G.enthusiasm, 20); i++) inv += '☠️';
    if (G.weapons > 0) inv += `  🗡️${G.weapons}`;
    if (G.cannons > 0) inv += `  💣${G.cannons}`;
    if (!inv) inv = '—';
    this.txt('top', L.cx, L.Y_INV, inv,
      { fontSize: L.fs(24), color: '#d0d0d0', wordWrap: { width: L.W - 40 } });

    const crew = G.allCrew;
    const maxSp = 44 * L.k;
    const sp = Math.min(maxSp, (L.W - 80) / Math.max(crew.length, 1));
    const sx = L.cx - ((crew.length - 1) * sp) / 2;

    const handIds = new Set(G.hand.map(p => p.id));
    const deckIds = new Set(G.deck.map(p => p.id));

    crew.forEach((p, i) => {
      const cx = sx + i * sp;
      const spr = this.add.sprite(cx, L.Y_CREW, 'pirates', TYPES[p.type].frame)
        .setScale(L.SC_SM);

      if (G.phase === 'removing') {
        if (handIds.has(p.id)) {
          spr.setAlpha(0.3);
        } else {
          spr.setTint(0xff6666);
          spr.setInteractive({ useHandCursor: true });
          spr.on('pointerover', () => spr.setScale(L.SC_SM + 1));
          spr.on('pointerout', () => spr.setScale(L.SC_SM));
          spr.on('pointerdown', (ptr) => {
            ptr.event.stopPropagation();
            this.completeRemoval(p.id);
          });
        }
      } else {
        if (!handIds.has(p.id) && !deckIds.has(p.id)) spr.setTint(0x333333);
        spr.setInteractive({ useHandCursor: true });
        spr.on('pointerdown', (ptr) => {
          ptr.event.stopPropagation();
          this.showTip(p.type, cx, L.Y_CREW + 30 * L.k, { fromClick: true });
        });
        spr.on('pointerover', () => {
          if (this.ct.tip.visible) this.showTip(p.type, cx, L.Y_CREW + 30 * L.k);
        });
      }

      this.addTo('top', spr);
    });

    const dv = this.add.graphics();
    dv.lineStyle(2, 0x1e3040);
    dv.lineBetween(40, L.Y_DIV1, L.W - 40, L.Y_DIV1);
    this.addTo('top', dv);
  }

  renderIsland() {
    this.clearCt('island');
    const L = this.L;
    const cx = L.cx, cy = L.Y_ISL_CY;

    if (G.enemyShip) {
      const g = this.add.graphics();
      g.fillStyle(0x1a0808, 0.6);
      g.fillEllipse(cx, cy, 600 * L.k, 340 * L.k);
      g.fillStyle(0x3a1010, 1);
      g.fillEllipse(cx, cy, 440 * L.k, 220 * L.k);
      g.fillStyle(0x8a2020, 0.2);
      g.fillEllipse(cx - 50 * L.k, cy - 16 * L.k, 140 * L.k, 80 * L.k);
      this.addTo('island', g);

      this.txt('island', cx, cy - 136 * L.k, '🏴‍☠️', { fontSize: L.fs(48) });
      this.txt('island', cx, cy - 30 * L.k, `${G.enemyShip.strength}⚔️`,
        { fontSize: L.fs(40), color: '#ff6b6b' });

      const crewStr = G.hand.reduce((s, p) => s + (TYPES[p.type].str || 0), 0);
      const bonusStr = this.shipBonusStr();
      const totalStr = crewStr + bonusStr;
      const winning = totalStr >= G.enemyShip.strength;
      let strLabel = `Crew ${crewStr}⚔️`;
      if (G.weapons > 0) strLabel += ` +🗡️${G.weapons}`;
      if (G.cannons > 0) strLabel += ` +💣${G.cannons}`;
      strLabel += ` = ${totalStr}⚔️ vs ${G.enemyShip.strength}⚔️`;
      this.txt('island', cx, L.Y_ISL_LBL, strLabel,
        { fontSize: L.fs(22), color: winning ? '#66bb6a' : '#ff8a80' });
      return;
    }

    const g = this.add.graphics();
    g.fillStyle(0x0f2a40, 0.6);
    g.fillEllipse(cx, cy, 600 * L.k, 340 * L.k);
    g.fillStyle(0xe8c840, 1);
    g.fillEllipse(cx, cy, 440 * L.k, 220 * L.k);
    g.fillStyle(G.island.accent, 0.25);
    g.fillEllipse(cx - 50 * L.k, cy - 16 * L.k, 140 * L.k, 80 * L.k);
    this.addTo('island', g);

    this.txt('island', cx, cy - 136 * L.k, G.island.emoji, { fontSize: L.fs(48) });

    let islDesc;
    if (G.island.bonus) {
      const bm = { wood: '2x 🪵', stone: '2x 🪨', gold: '2x 🪙' };
      islDesc = bm[G.island.bonus];
    } else if (G.island.extraSend) {
      islDesc = '+1 pirate ashore';
    } else if (G.island.bonusEnthusiasm) {
      islDesc = '+' + G.island.bonusEnthusiasm + '☠️';
    }
    this.txt('island', cx, L.Y_ISL_LBL, `${G.island.name}: ${islDesc}`,
      { fontSize: L.fs(22), color: '#ffe082' });

    G.sent.forEach((hi, si) => {
      const p = G.hand[hi];
      const px = cx + this.sentOffsetX(si) * L.k;
      const spr = this.add.sprite(px, cy, 'pirates', TYPES[p.type].frame).setScale(L.SC);
      spr.setInteractive({ useHandCursor: true });
      spr.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        this.showTip(p.type, px, cy - 100 * L.k, { fromClick: true });
      });
      spr.on('pointerover', () => {
        if (this.ct.tip.visible) this.showTip(p.type, px, cy - 100 * L.k);
      });
      this.addTo('island', spr);
    });
  }

  renderPhase() {
    this.clearCt('phase');
    const L = this.L;
    let str = '', col = '#8090a0';
    if (G.phase === 'boarding') {
      str = '⚔️ Boarding! Prepare for battle!';
      col = '#ff8a80';
    } else if (G.phase === 'sending') {
      const r = this.maxSend() - G.sent.length;
      str = `Tap a pirate to send ashore (${r} left)`;
    } else if (G.phase === 'ship') {
      str = '⛵ Ship at work…';
      col = '#80cbc4';
    } else if (G.phase === 'removing') {
      str = '💀 Click a pirate above to exile';
      col = '#ff8a80';
    } else {
      str = `Shop  ·  enthusiasm: ☠️ ${G.enthusiasm}`;
      col = '#ce93d8';
    }
    this.txt('phase', L.cx, L.Y_PHASE, str, { fontSize: L.fs(22), color: col });
  }

  renderHand() {
    this.clearCt('hand');
    const L = this.L;

    G.hand.forEach((p, i) => {
      if (G.sent.includes(i)) return;
      const def = TYPES[p.type];
      const x = this.handX(i);

      const spr = this.add.sprite(x, L.Y_HAND, 'pirates', def.frame).setScale(L.SC);

      if (G.phase === 'sending' && !G.busy) {
        spr.setInteractive({ useHandCursor: true });
        if (!def.canIsland) spr.setAlpha(0.55);
        spr.on('pointerover', () => spr.setScale(L.SC + 1));
        spr.on('pointerout', () => spr.setScale(L.SC));
        spr.on('pointerdown', (ptr) => {
          ptr.event.stopPropagation();
          this.sendToIsland(i);
        });
      }

      this.addTo('hand', spr);

      this.txt('hand', x, L.Y_HLBL, def.name,
        { fontSize: L.fs(20), color: '#a0b0c0' });
      if (G.phase === 'boarding') {
        this.txt('hand', x, L.Y_HLBL + 28 * L.k, (def.str || 0) + '⚔️',
          { fontSize: L.fs(18), color: '#e57373' });
      } else {
        this.txt('hand', x, L.Y_HLBL + 28 * L.k, def.dI,
          { fontSize: L.fs(18), color: '#7a9a6a' });
        this.txt('hand', x, L.Y_HLBL + 54 * L.k, def.dS,
          { fontSize: L.fs(18), color: '#6a8a9a' });
      }
    });
  }

  renderBtn() {
    this.clearCt('btn');
    const L = this.L;
    if (G.busy) return;

    if (G.phase === 'boarding') {
      this.mkBtn('btn', L.cx, L.Y_BTN, 'Board! ⚔️', () => this.resolveBoarding());
    } else if (G.phase === 'sending') {
      this.mkBtn('btn', L.cx, L.Y_BTN, 'End landing ⛵', () => this.endSending());
    } else if (G.phase === 'shopping') {
      this.mkBtn('btn', L.cx, L.Y_BTN, 'Next round →', () => this.endRound());
    }
  }

  mkBtn(k, x, y, label, cb) {
    const L = this.L;
    const t = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: L.fs(24), color: '#c0d8c0',
      backgroundColor: '#1e4535', padding: { x: 32, y: 16 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setStyle({ backgroundColor: '#2a6545' }));
    t.on('pointerout', () => t.setStyle({ backgroundColor: '#1e4535' }));
    t.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); cb(); });
    this.addTo(k, t);
  }

  renderShop() {
    this.clearCt('shop');
    const L = this.L;

    const dv = this.add.graphics();
    dv.lineStyle(2, 0x1e3040);
    dv.lineBetween(40, L.Y_DIV2, L.W - 40, L.Y_DIV2);
    this.addTo('shop', dv);

    this.txt('shop', L.cx, L.Y_SHOP_L, 'Pirate Shop',
      { fontSize: L.fs(24), color: '#9070a0' });
    this.txt('shop', L.cx, L.Y_SHOP_C, `Enthusiasm: ☠️ ${G.enthusiasm}`,
      { fontSize: L.fs(22), color: '#ce93d8' });

    if (G.shopAnimating) return;

    if (G.shop.length === 0) {
      this.txt('shop', L.cx, L.Y_SHOP_P, '( empty )', { color: '#404858' });
      return;
    }

    G.shop.forEach((type, i) => {
      const def = TYPES[type];
      const x = this.shopX(i, G.shop.length);

      const spr = this.add.sprite(x, L.Y_SHOP_P, 'pirates', def.frame).setScale(L.SC);
      spr.setInteractive({ useHandCursor: true });

      const canBuy = G.phase === 'shopping' && G.enthusiasm >= def.cost;

      this.txt('shop', x, L.Y_SHOP_PR, `☠️${def.cost}`,
        { fontSize: L.fs(22), color: canBuy ? '#ce93d8' : '#504858' });

      this.txt('shop', x, L.Y_SHOP_NM, def.name,
        { fontSize: L.fs(20), color: '#a0b0c0' });
      this.txt('shop', x, L.Y_SHOP_DI, def.dI,
        { fontSize: L.fs(18), color: '#7a9a6a' });
      this.txt('shop', x, L.Y_SHOP_DS, def.dS,
        { fontSize: L.fs(18), color: '#6a8a9a' });
      this.txt('shop', x, L.Y_SHOP_ST, (def.str || 0) + '⚔️',
        { fontSize: L.fs(18), color: '#e57373' });

      if (!canBuy) spr.setAlpha(G.phase === 'shopping' ? 0.45 : 0.75);

      const shopTipOpts = { shopIdx: i, canBuy };
      spr.on('pointerover', () => {
        spr.setScale(L.SC + 1);
        if (this.ct.tip.visible) this.showTip(type, x, L.Y_SHOP_P - 100 * L.k, shopTipOpts);
      });
      spr.on('pointerout', () => spr.setScale(L.SC));
      spr.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        this.showTip(type, x, L.Y_SHOP_P - 100 * L.k, Object.assign({ fromClick: true }, shopTipOpts));
      });

      this.addTo('shop', spr);

      if (G.phase === 'shopping' && canBuy) {
        const bb = this.add.text(x, L.Y_SHOP_BT, '[ buy ]', {
          fontFamily: 'monospace', fontSize: L.fs(20), color: '#a0d0a0',
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
    const L = this.L;
    G.shopAnimating = true;
    const n = oldShop.length;
    const newN = G.shop.length;
    const dur = 350;
    const ghosts = [];

    oldShop.forEach((type, i) => {
      const def = TYPES[type];
      const x = this.shopX(i, n);
      const spr = this.add.sprite(x, L.Y_SHOP_P, 'pirates', def.frame)
        .setScale(L.SC).setDepth(55);
      this.ct.fx.add(spr);
      ghosts.push(spr);
    });

    const removed = ghosts[removedIdx];
    if (mode === 'round') {
      this.tweens.add({
        targets: removed,
        x: removed.x - 180 * L.k, alpha: 0,
        duration: dur, ease: 'Power2',
      });
    } else {
      this.tweens.add({
        targets: removed,
        y: removed.y - 100 * L.k, alpha: 0,
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
    const newGhost = this.add.sprite(L.W + 80, L.Y_SHOP_P, 'pirates', newDef.frame)
      .setScale(L.SC).setDepth(55);
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
    const L = this.L;
    if (opts.fromClick) this._tipJustOpened = true;
    this.clearCt('tip');
    const def = TYPES[type];
    const lines = [];
    lines.push(def.name);
    lines.push('─────────────');
    lines.push('🏝️ ' + def.dI);
    lines.push('⛵ ' + def.dS);
    lines.push((def.str || 0) + '⚔️');
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

    const tipFs = L.fs(22);
    const tmp = this.add.text(0, -999, body, {
      fontFamily: 'monospace', fontSize: tipFs, lineSpacing: 6,
    });
    const tw = tmp.width, th = tmp.height;
    tmp.destroy();

    const pad = 20;
    const bw = tw + pad * 2, bh = th + pad * 2;
    let bx = tx - bw / 2;
    let by = ty - bh - 16;
    if (bx < 8) bx = 8;
    if (bx + bw > L.W - 8) bx = L.W - bw - 8;
    if (by < 8) by = ty + 60;

    const bg = this.add.graphics();
    bg.fillStyle(0x101828, 0.95);
    bg.fillRoundedRect(bx, by, bw, bh, 10);
    bg.lineStyle(2, 0x304860);
    bg.strokeRoundedRect(bx, by, bw, bh, 10);
    this.addTo('tip', bg);

    const txt = this.add.text(bx + pad, by + pad, body, {
      fontFamily: 'monospace', fontSize: tipFs, color: '#d0d8e0', lineSpacing: 6,
    });
    this.addTo('tip', txt);

    let extraH = 0;

    if (opts.canSend && G.phase === 'sending' && !G.busy) {
      const btnY = by + bh + 8;
      const sb = this.add.text(bx + bw / 2, btnY, '🏝️ To island', {
        fontFamily: 'monospace', fontSize: L.fs(22), color: '#ffe0a0',
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
        fontFamily: 'monospace', fontSize: L.fs(22), color: '#a0d8a0',
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
    const L = this.L;
    const t = this.add.text(x, y, str, {
      fontFamily: 'monospace', fontSize: L.fs(28), color: col || '#fff',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({
      targets: t, y: y - 70 * L.k, alpha: 0,
      duration: 1400, ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }
}
