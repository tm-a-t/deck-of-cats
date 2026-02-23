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
    this.textures.get('pirates').setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.L = computeLayout(this.scale.width, this.scale.height);
    if (!G.map) initState();

    this.ct = {};
    ['top', 'island', 'phase', 'hand', 'btn', 'nav', 'tip', 'fx', 'gameover'].forEach(k => {
      this.ct[k] = this.add.container(0, 0);
    });
    this.ct.tip.setDepth(100).setVisible(false);
    this.ct.fx.setDepth(50);
    this.ct.gameover.setDepth(200);
    this._sendingToIsland = new Set();

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

    this.startRound();
    if (G.phase === 'map') this.enterMapPhase();
  }

  // ──────────── GAME FLOW ────────────

  startRound() {
    // G.round, G.phase, G.island, G.enemyShip, G.hand, G.sent, G.enthusiasm
    // are all set by MapScene.selectMapNode() before transitioning here.
    this.renderAll();
  }

  applyMapNodeSelection(nodeId) {
    const map = G.map;
    const node = mapNodeById(map, nodeId);
    if (!node) return false;

    let layerIdx = -1;
    for (let li = 0; li < map.layers.length; li++) {
      if (map.layers[li].some(n => n.id === nodeId)) {
        layerIdx = li;
        break;
      }
    }
    if (layerIdx < 0) return false;

    map.currentNodeId = nodeId;
    map.currentLayer = layerIdx;
    map.visited.push(nodeId);

    G.round++;
    G.sent = [];
    G.enthusiasm = 0;
    G.busy = false;
    this._sendingToIsland.clear();
    this.ct.tip.setVisible(false);

    if (node.type === 'ship') {
      G.boardingCount++;
      G.phase = 'boarding';
      G.island = null;
      G.enemyShip = { strength: node.strength };
    } else {
      G.phase = 'sending';
      G.island = ISLANDS[node.islandIdx];
      G.enemyShip = null;
      if (G.island.bonusEnthusiasm) G.enthusiasm += G.island.bonusEnthusiasm;
    }

    this.renderAll();
    return true;
  }

  enterMapPhase() {
    G.phase = 'map';
    G.island = null;
    G.enemyShip = null;
    this.renderAll();

    const available = getAvailableNodes(G.map);
    if (available.length === 1) {
      this.applyMapNodeSelection(available[0]);
      return;
    }
    if (available.length > 1) {
      this.time.delayedCall(20, () => this.openMapModal());
    }
  }

  openMapModal() {
    if (this.scene.isActive('map')) return;
    this.scene.launch('map');
    this.scene.bringToTop('map');
  }

  openShopModal() {
    if (this.scene.isActive('shopModal')) return;
    this.scene.launch('shopModal');
    this.scene.bringToTop('shopModal');
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

    const handPos = this.handPos(idx);
    if (!def.canIsland) {
      this.float(handPos.x, handPos.y - 40 * L.k, "Can't go!", '#ff8a80');
      return;
    }

    if (def.island.convert) {
      const c = def.island.convert;
      if ((G.res[c.cRes] || 0) < c.cN) {
        this.float(handPos.x, handPos.y - 40 * L.k, "Can't go!", '#ff8a80');
        return;
      }
    }

    G.busy = true;
    G.sent.push(idx);
    this._sendingToIsland.add(idx);
    this.renderAll();

    const fromX = handPos.x;
    const fromY = handPos.y;
    const toX = L.cx + this.sentOffsetX(G.sent.length - 1) * L.k;
    const toY = L.Y_ISL_CY;

    const ghost = this.add.sprite(fromX, fromY, 'pirates', def.frame)
      .setScale(L.SC).setDepth(60);

    this.tweens.add({
      targets: ghost, x: toX, y: toY,
      duration: 350, ease: 'Power2',
      onComplete: () => {
        ghost.destroy();
        this._sendingToIsland.delete(idx);
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
      if (g.weapons) {
        G.weapons += g.weapons;
        return { ok: true, weapons: g.weapons };
      }
      if (g.res === 'enthusiasm') G.enthusiasm += g.amt;
      else G.res[g.res] = (G.res[g.res] || 0) + g.amt;
      return { ok: true, res: g.res, n: g.amt };
    }

    if (def.island.convert) {
      const c = def.island.convert;
      G.res[c.cRes] -= c.cN;
      let amt = c.pN;
      if (isl.bonus === c.pRes) amt *= 2;
      G.res[c.pRes] += amt;
      return { ok: true, convert: true, cRes: c.cRes, cN: c.cN, res: c.pRes, n: amt };
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
    if (r.convert) {
      this.float(x, L.Y_ISL_CY - 80 * L.k,
        '-' + r.cN + RES_EMOJI[r.cRes] + ' +' + r.n + RES_EMOJI[r.res], '#66bb6a');
      return;
    }
    if (r.weapons) {
      this.float(x, L.Y_ISL_CY - 80 * L.k, '+' + r.weapons + '🗡️', '#66bb6a');
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
      const handPos = this.handPos(hi);
      const x = handPos.x;

      if (def.ship.removeFromDeck) {
        if (def.ship.cRes && (G.res[def.ship.cRes] || 0) < def.ship.cN) {
          this.float(x, handPos.y - 40 * L.k, '—', '#546e7a');
          this.renderAll();
          this.processNextShip();
          return;
        }
        const handIds = new Set(G.hand.map(p => p.id));
        const targets = G.allCrew.filter(p => !handIds.has(p.id));
        if (targets.length === 0) {
          this.float(x, handPos.y - 40 * L.k, 'No one to exile', '#ffa726');
          this.renderAll();
          this.processNextShip();
          return;
        }
        if (def.ship.cRes) G.res[def.ship.cRes] -= def.ship.cN;
        this.float(x, handPos.y - 40 * L.k, 'Exile a pirate!', '#ff8a80');
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
        if (r.extraEnthusiasm) msg += (msg ? ' ' : '') + '+' + r.extraEnthusiasm + '☠️';
        if (r.weaponN) msg += (msg ? ' ' : '') + '+' + (r.weaponN > 1 ? r.weaponN : '') + '🗡️';
        if (r.cannonN) msg += (msg ? ' ' : '') + '+' + (r.cannonN > 1 ? r.cannonN : '') + '💣';
        if (!msg) msg = '✓';
        this.float(x, handPos.y - 40 * L.k, msg, '#80cbc4');
      } else {
        this.float(x, handPos.y - 40 * L.k, '—', '#546e7a');
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
    if (s.costWeapons) {
      if (G.weapons < s.costWeapons) return { ok: false };
      G.weapons -= s.costWeapons;
      const cannonN = s.prodCannons || 0;
      G.cannons += cannonN;
      if (s.pRes === 'enthusiasm') G.enthusiasm += (s.pN || 0);
      else if (s.pRes) G.res[s.pRes] += (s.pN || 0);
      if (s.extraEnthusiasm) G.enthusiasm += s.extraEnthusiasm;
      return { ok: true, pRes: s.pRes || null, pN: s.pN || 0, extraEnthusiasm: s.extraEnthusiasm || 0, weaponN: 0, cannonN };
    }
    if (s.costCannons) {
      if (G.cannons < s.costCannons) return { ok: false };
      G.cannons -= s.costCannons;
      if (s.pRes === 'enthusiasm') G.enthusiasm += (s.pN || 0);
      else if (s.pRes) G.res[s.pRes] += (s.pN || 0);
      if (s.extraEnthusiasm) G.enthusiasm += s.extraEnthusiasm;
      return { ok: true, pRes: s.pRes || null, pN: s.pN || 0, extraEnthusiasm: s.extraEnthusiasm || 0, weaponN: 0, cannonN: 0 };
    }
    if (!s.cRes) {
      if (s.pRes === 'enthusiasm') G.enthusiasm += s.pN;
      else if (s.pRes) G.res[s.pRes] += s.pN;
      const weaponN = s.prodWeapons || 0;
      const cannonN = s.prodCannons || 0;
      G.weapons += weaponN;
      G.cannons += cannonN;
      return { ok: true, pRes: s.pRes, pN: s.pN, weaponN, cannonN };
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

  buyPirate(si, opts = {}) {
    if (G.phase !== 'shopping' || G.busy || (!opts.ignoreAnimating && G.shopAnimating)) return;
    if (si >= G.shop.length) return;
    const L = this.L;
    const type = G.shop[si];
    const def = TYPES[type];
    if (G.enthusiasm < def.cost) {
      this.float(L.cx, L.Y_ISL_CY - 40 * L.k, 'Not enough ☠️', '#ef5350');
      return;
    }
    G.enthusiasm -= def.cost;
    const p = mkP(type);
    G.allCrew.push(p);
    G.discard.push(p);
    G.shop.splice(si, 1);
    G.shop.push(randomShopType(G.round));
    if (!opts.silent) this.float(L.cx, L.Y_ISL_CY - 40 * L.k, '+ ' + def.name + '!', '#66bb6a');
    this.ct.tip.setVisible(false);
    G.shopAnimating = false;
    if (opts.deferRender) return;
    this.renderAll();
    if (!opts.skipModalRefresh && this.scene.isActive('shopModal')) {
      this.scene.get('shopModal').renderModal();
    }
  }

  prepareNextRound() {
    if (G.phase !== 'shopping') return;
    G.discard.push(...G.hand);
    G.hand = [];
    G.sent = [];
    G.enthusiasm = 0;
    this._sendingToIsland.clear();
    this.ct.tip.setVisible(false);
    G.hand = drawCards(5);
    this.enterMapPhase();
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

        if (G.map.currentLayer >= MAP_LAYERS - 1) {
          this.showVictory();
          return;
        }

        G.hand = drawCards(5);
        this.enterMapPhase();
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
    overlay.fillStyle(0x000000, 1);
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
      this.scene.stop('map');
      this.scene.stop('shopModal');
      initState();
      this.scene.restart();
    });
    this.addTo('gameover', btn);
  }

  showVictory() {
    this.clearCt('gameover');
    const L = this.L;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 1);
    overlay.fillRect(0, 0, L.W, L.H);
    this.addTo('gameover', overlay);

    this.txt('gameover', L.cx, L.H * 0.28, '🏆 VICTORY! 🏆',
      { fontSize: L.fs(48), color: '#ffd740' });
    this.txt('gameover', L.cx, L.H * 0.36,
      'You conquered all 10 enemy ships!',
      { fontSize: L.fs(26), color: '#b0b8c8' });
    this.txt('gameover', L.cx, L.H * 0.42,
      `${G.round} rounds  ·  Crew of ${G.allCrew.length}`,
      { fontSize: L.fs(24), color: '#a0d0a0' });

    let inv = '';
    ['wood', 'stone', 'gold'].forEach(r => {
      if (G.res[r] > 0) inv += ` ${G.res[r]}${RES_EMOJI[r]}`;
    });
    if (G.cannons > 0) inv += ` ${G.cannons}💣`;
    if (inv) {
      this.txt('gameover', L.cx, L.H * 0.48, 'Final stash:' + inv,
        { fontSize: L.fs(22), color: '#80cbc4' });
    }

    const btn = this.add.text(L.cx, L.H * 0.58, '[ Play Again ]', {
      fontFamily: 'monospace', fontSize: L.fs(32), color: '#a0d0a0',
      backgroundColor: '#1e4535', padding: { x: 40, y: 20 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#2a6545' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#1e4535' }));
    btn.on('pointerdown', () => {
      this.clearCt('gameover');
      this.scene.stop('map');
      this.scene.stop('shopModal');
      initState();
      this.scene.restart();
    });
    this.addTo('gameover', btn);
  }

  // ──────────── HELPERS ────────────

  handPos(idx) {
    const L = this.L;
    const n = G.hand.length;
    const splitRows = L.NARROW_HAND_SPLIT && n === 5;
    if (!splitRows) {
      const sp = Math.min(210 * L.k, (L.W - 40) / Math.max(n - 1, 1));
      return {
        x: L.cx - ((n - 1) * sp) / 2 + idx * sp,
        y: L.Y_HAND,
      };
    }

    const topCount = 3;
    const topRow = idx < topCount;
    const rowN = topRow ? topCount : 2;
    const rowIdx = topRow ? idx : idx - topCount;
    const sp = Math.min(210 * L.k, (L.W - 80) / Math.max(rowN - 1, 1));
    const y = topRow ? (L.Y_HAND - 200 * L.k) : L.Y_HAND;
    return {
      x: L.cx - ((rowN - 1) * sp) / 2 + rowIdx * sp,
      y,
    };
  }

  handX(idx) {
    return this.handPos(idx).x;
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
    this.renderNav();
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

    const crew = [...G.allCrew].sort((a, b) => a.type < b.type ? -1 : a.type > b.type ? 1 : 0);
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
          spr.setAlpha(1);
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

    const shopLabel = this.add.text(0, L.Y_SHOP, 'Shop:', {
      fontFamily: 'monospace',
      fontSize: L.fs(22),
      color: '#b0b8c8',
    }).setOrigin(0, 0.5);

    const shop = G.shop.slice(0, 4);
    const shopSp = 56 * L.k;
    const shopIconW = 8 * L.SC_SM;
    const shopGap = 16 * L.k;
    const shopIconsW = shop.length > 0 ? shopIconW + (shop.length - 1) * shopSp : 0;
    const shopBlockW = shopLabel.width + (shop.length > 0 ? shopGap + shopIconsW : 0);
    const shopLeft = L.cx - shopBlockW / 2;
    shopLabel.setPosition(shopLeft, L.Y_SHOP);
    this.addTo('top', shopLabel);

    const shopSx = shopLeft + shopLabel.width + (shop.length > 0 ? shopGap + shopIconW / 2 : 0);
    shop.forEach((type, i) => {
      const frame = TYPES[type].frame;
      const spr = this.add.sprite(shopSx + i * shopSp, L.Y_SHOP, 'pirates', frame)
        .setScale(L.SC_SM);
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
      g.fillStyle(0x1a0808, 1);
      g.fillEllipse(cx, cy, 600 * L.k, 340 * L.k);
      g.fillStyle(0x3a1010, 1);
      g.fillEllipse(cx, cy, 440 * L.k, 220 * L.k);
      g.fillStyle(0x8a2020, 1);
      g.fillEllipse(cx - 50 * L.k, cy - 16 * L.k, 140 * L.k, 80 * L.k);
      this.addTo('island', g);

      this.txt('island', cx, cy - 120 * L.k, '🏴‍☠️', { fontSize: L.fsPx(56) });
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

    if (!G.island) {
      const g = this.add.graphics();
      g.fillStyle(0x0b1f33, 1);
      g.fillEllipse(cx, cy, 640 * L.k, 360 * L.k);
      g.fillStyle(0x113252, 1);
      g.fillEllipse(cx, cy + 10 * L.k, 540 * L.k, 250 * L.k);
      this.addTo('island', g);
      this.txt('island', cx, cy - 120 * L.k, '🌊', { fontSize: L.fsPx(56) });
      this.txt('island', cx, L.Y_ISL_LBL, 'Open sea',
        { fontSize: L.fs(22), color: '#9fc3e0' });
      return;
    }

    const g = this.add.graphics();
    g.fillStyle(0x0f2a40, 1);
    g.fillEllipse(cx, cy, 600 * L.k, 340 * L.k);
    g.fillStyle(G.island.accent, 1);
    g.fillEllipse(cx, cy, 440 * L.k, 220 * L.k);
    this.addTo('island', g);

    this.txt('island', cx, cy - 120 * L.k, G.island.emoji, { fontSize: L.fsPx(56) });

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
      if (this._sendingToIsland.has(hi)) return;
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
    const statusY = L.Y_ISL_LBL + 30 * L.k;
    let str = '', col = '#8090a0';
    if (G.phase === 'boarding') {
      str = 'Boarding! Prepare for battle!';
      col = '#ff8a80';
    } else if (G.phase === 'map') {
      str = 'Choose the next destination';
      col = '#9fc3e0';
    } else if (G.phase === 'sending') {
      const r = this.maxSend() - G.sent.length;
      str = `Tap a pirate to send ashore (${r} left)`;
    } else if (G.phase === 'ship') {
      str = 'Ship at work…';
      col = '#80cbc4';
    } else if (G.phase === 'removing') {
      str = 'Click a pirate above to exile';
      col = '#ff8a80';
    } else {
      str = `Shop  ·  enthusiasm: ☠️ ${G.enthusiasm}`;
      col = '#ce93d8';
    }
    this.txt('phase', L.cx, statusY, str, { fontSize: L.fs(22), color: col });
  }

  renderHand() {
    this.clearCt('hand');
    const L = this.L;

    G.hand.forEach((p, i) => {
      if (G.sent.includes(i) || this._sendingToIsland.has(i)) return;
      const def = TYPES[p.type];
      const handPos = this.handPos(i);
      const x = handPos.x;
      const y = handPos.y;

      const spr = this.add.sprite(x, y, 'pirates', def.frame).setScale(L.SC);

      if (G.phase === 'sending' && !G.busy) {
        spr.setInteractive({ useHandCursor: true });
        const cantConvert = def.island && def.island.convert &&
          (G.res[def.island.convert.cRes] || 0) < def.island.convert.cN;
        if (!def.canIsland || cantConvert) spr.setAlpha(1);
        spr.on('pointerover', () => spr.setScale(L.SC + 1));
        spr.on('pointerout', () => spr.setScale(L.SC));
        spr.on('pointerdown', (ptr) => {
          ptr.event.stopPropagation();
          this.sendToIsland(i);
        });
      }

      this.addTo('hand', spr);

      this.txt('hand', x, y + 54 * L.k, def.name,
        { fontSize: L.fs(20), color: '#a0b0c0' });
      if (G.phase === 'boarding') {
        this.txt('hand', x, y + 82 * L.k, (def.str || 0) + '⚔️',
          { fontSize: L.fs(18), color: '#e57373' });
      } else {
        this.txt('hand', x, y + 82 * L.k, def.dI,
          { fontSize: L.fs(18), color: '#7a9a6a' });
        this.txt('hand', x, y + 108 * L.k, def.dS,
          { fontSize: L.fs(18), color: '#6a8a9a' });
      }
    });
  }

  renderBtn() {
    this.clearCt('btn');
    const L = this.L;
    if (G.busy) return;
    const x = L.W - 20 * L.k;
    const y = L.Y_NAV;
    const right = { originX: 1 };

    if (G.phase === 'boarding') {
      this.mkBtn('btn', x, y, 'Board!', () => this.resolveBoarding(), right);
    } else if (G.phase === 'sending') {
      this.mkBtn('btn', x, y, 'End landing', () => this.endSending(), right);
    } else if (G.phase === 'shopping') {
      this.mkBtn('btn', x, y, 'Hire and go', () => this.openShopModal(), {
        ...right, bg: '#3a2a48', hoverBg: '#55406b', color: '#e0c8f0',
      });
    }
  }

  renderNav() {
    this.clearCt('nav');
    const L = this.L;

    const mapEnabled = true;
    const shopEnabled = !G.busy;
    const left = 20 * L.k;
    const gap = 12 * L.k;
    const leftOpts = { originX: 0 };

    const mapBtn = this.mkBtn('nav', left, L.Y_NAV, 'Map', () => {
      if (!mapEnabled) {
        this.float(L.cx, L.Y_NAV - 40 * L.k, 'Map is available between rounds', '#8090a0');
        return;
      }
      this.openMapModal();
    }, {
      ...leftOpts,
      enabled: mapEnabled,
      bg: '#2b3f52',
      hoverBg: '#35536f',
      disabledBg: '#1a2630',
      color: '#c0d8f0',
      disabledColor: '#5a6570',
    });

    this.mkBtn('nav', left + mapBtn.width + gap, L.Y_NAV, 'Shop', () => {
      this.openShopModal();
    }, {
      ...leftOpts,
      enabled: shopEnabled,
      bg: '#3a2a48',
      hoverBg: '#55406b',
      disabledBg: '#261d30',
      color: '#e0c8f0',
      disabledColor: '#6c6074',
    });
  }

  mkBtn(k, x, y, label, cb, opts = {}) {
    const L = this.L;
    const enabled = opts.enabled !== false;
    const bg = opts.bg || '#1e4535';
    const hoverBg = opts.hoverBg || '#2a6545';
    const disabledBg = opts.disabledBg || '#1a2630';
    const color = opts.color || '#c0d8c0';
    const disabledColor = opts.disabledColor || '#607080';
    const t = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: L.fs(24), color: enabled ? color : disabledColor,
      backgroundColor: enabled ? bg : disabledBg, padding: { x: 32, y: 16 },
    }).setOrigin(opts.originX != null ? opts.originX : 0.5, 0.5);
    if (enabled) {
      t.setInteractive({ useHandCursor: true });
    } else {
      t.setAlpha(1);
    }
    t.on('pointerover', () => {
      if (enabled) t.setStyle({ backgroundColor: hoverBg });
    });
    t.on('pointerout', () => {
      if (enabled) t.setStyle({ backgroundColor: bg });
    });
    t.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); cb(); });
    this.addTo(k, t);
    return t;
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
    bg.fillStyle(0x101828, 1);
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
