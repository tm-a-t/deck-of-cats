/* ============================================================
   PIRATES — Shop Modal Scene
   ============================================================ */

class ShopScene extends Phaser.Scene {
  constructor() { super('shopModal'); }

  create() {
    ensureCatTextures(this);
    this.L = computeLayout(this.scale.width, this.scale.height);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this._closing = false;
    this.modalLayer = this.add.container(0, 0).setDepth(40);
    this.tipLayer = this.add.container(0, 0).setDepth(50).setVisible(false);
    this._tipRect = null;
    this._tipJustOpened = false;
    this._featuredTicker = null;
    this._featuredTickerLabel = null;
    this._featuredTickerLines = [];
    this._featuredTickerIdx = 0;

    this.input.on('pointerdown', (ptr) => {
      if (this._tipJustOpened) { this._tipJustOpened = false; return; }
      if (this.tipLayer.visible) {
        if (!this._tipRect || !this._tipRect.contains(ptr.x, ptr.y)) {
          this.tipLayer.setVisible(false);
        }
      }
    });

    this.renderModal();
    this.animateOpen();

    this._onResize = () => {
      this.L = computeLayout(this.scale.width, this.scale.height);
      this.scene.restart();
    };
    this.scale.on('resize', this._onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize);
    });
  }

  animateOpen() {
    const offset = 30 * this.L.k;
    this.modalLayer.setAlpha(0).setY(offset);
    this.tweens.add({
      targets: this.modalLayer,
      alpha: 1, y: 0,
      duration: 140,
      ease: 'Cubic.easeOut',
    });
  }

  closeModal() {
    if (this._closing) return;
    this.stopFeaturedTicker();
    this._closing = true;
    this.input.enabled = false;
    this.tweens.add({
      targets: this.modalLayer,
      alpha: 0, y: 30 * this.L.k,
      duration: 100,
      ease: 'Cubic.easeIn',
      onComplete: () => this.scene.stop(),
    });
  }

  computeModal() {
    const L = this.L;
    const w = Math.min(L.W - 80 * L.k, 820 * L.k);
    const h = Math.min(L.H - 400 * L.k, 1040 * L.k);
    const x = (L.W - w) / 2;
    const y = (L.H - h) / 2;
    return { x, y, w, h };
  }

  shopPos(idx, n, modal) {
    const L = this.L;
    const cols = Math.min(n, 2);
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const rowStart = row * cols;
    const rowN = Math.min(cols, n - rowStart);
    const sp = Math.min(220 * L.k, (modal.w - 80 * L.k) / Math.max(cols - 1, 1));
    const x = modal.x + modal.w / 2 - ((rowN - 1) * sp) / 2 + col * sp;
    const rowGap = 350 * L.k;
    const topY = modal.y + 220 * L.k;
    const y = topY + row * rowGap;
    return { x, y };
  }

  stopFeaturedTicker() {
    if (this._featuredTicker) {
      this._featuredTicker.remove(false);
      this._featuredTicker = null;
    }
    this._featuredTickerLabel = null;
    this._featuredTickerLines = [];
    this._featuredTickerIdx = 0;
  }

  startFeaturedTicker(modal, def) {
    const L = this.L;
    const lines = [
      `Featured: ${def.name}`,
      `Island: ${def.dI}`,
      `Ship: ${def.dS}`,
      `Power: ${(def.str || 0)}⚔️`,
      `Cost: ☠️${def.cost}`,
    ];

    const tickerY = modal.y + modal.h - 70 * L.k;
    const label = this.add.text(modal.x + modal.w / 2, tickerY, lines[0], {
      fontFamily: 'monospace',
      fontSize: L.fs(18),
      color: '#3e2f12',
      align: 'center',
      wordWrap: { width: modal.w - 60 * L.k },
    }).setOrigin(0.5);
    this.modalLayer.add(label);

    this._featuredTickerLabel = label;
    this._featuredTickerLines = lines;
    this._featuredTickerIdx = 0;

    if (lines.length <= 1) return;
    this._featuredTicker = this.time.addEvent({
      delay: 1700,
      loop: true,
      callback: () => {
        if (!this._featuredTickerLabel || !this._featuredTickerLabel.active) return;
        this._featuredTickerIdx = (this._featuredTickerIdx + 1) % this._featuredTickerLines.length;
        this._featuredTickerLabel.setText(this._featuredTickerLines[this._featuredTickerIdx]);
      },
    });
  }

  renderModal() {
    this.stopFeaturedTicker();
    this.modalLayer.removeAll(true);
    if (this.tipLayer) this.tipLayer.setVisible(false);
    const L = this.L;
    const m = this.computeModal();

    const blocker = this.add.rectangle(0, 0, L.W, L.H, 0x000000, 0.25).setOrigin(0, 0);
    blocker.setInteractive();
    blocker.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      if (ptr.x >= m.x && ptr.x <= m.x + m.w && ptr.y >= m.y && ptr.y <= m.y + m.h) return;
      this.closeModal();
    });
    this.modalLayer.add(blocker);

    const paper = this.add.graphics();
    paper.fillStyle(0xe0d4b1, 1);
    paper.fillRoundedRect(m.x, m.y, m.w, m.h, 18 * L.k);
    paper.lineStyle(3, 0x6a5838, 1);
    paper.strokeRoundedRect(m.x, m.y, m.w, m.h, 18 * L.k);
    this.modalLayer.add(paper);

    const title = this.add.text(m.x + m.w / 2, m.y + 14 * L.k, 'Pirate Shop', {
      fontFamily: 'monospace', fontSize: L.fs(30), color: '#2b2b2b',
    }).setOrigin(0.5, 0);
    this.modalLayer.add(title);

    const close = this.add.text(m.x + m.w - 18 * L.k, m.y + 12 * L.k, '✕', {
      fontFamily: 'monospace', fontSize: L.fs(24), color: '#483818',
      backgroundColor: '#e0d4b1', padding: { x: 8 * L.k, y: 4 * L.k },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on('pointerover', () => close.setStyle({ color: '#7a3118' }));
    close.on('pointerout', () => close.setStyle({ color: '#483818' }));
    close.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      this.closeModal();
    });
    this.modalLayer.add(close);

    const canBuyNow = G.phase === 'shopping' && !G.busy;
    const infoText = canBuyNow ? `You have ☠️ ${G.enthusiasm}` : 'Hire in the end of the round';
    const info = this.add.text(m.x + m.w / 2, m.y + 46 * L.k, infoText, {
      fontFamily: 'monospace', fontSize: L.fs(18), color: canBuyNow ? '#6f2a82' : '#7a6a4a',
    }).setOrigin(0.5, 0);
    this.modalLayer.add(info);

    if (G.shop.length === 0) {
      const empty = this.add.text(m.x + m.w / 2, m.y + m.h * 0.48, '(empty)', {
        fontFamily: 'monospace', fontSize: L.fs(22), color: '#7a6a4a',
      }).setOrigin(0.5);
      this.modalLayer.add(empty);
      return;
    }

    G.shop.forEach((type, i) => {
      const def = TYPES[type];
      const pos = this.shopPos(i, G.shop.length, m);
      const canBuy = canBuyNow && G.enthusiasm >= def.cost;
      const cardTextShiftY = 24 * L.k;

      const spr = addCatSprite(this, pos.x, pos.y, type);
      spr.setScale(L.SC);
      spr.setInteractive({ useHandCursor: true });
      spr.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        this.showTip(type, pos.x, pos.y - 100 * L.k, { fromClick: true, shopIdx: i });
      });
      spr.on('pointerover', () => {
        if (this.tipLayer.visible) this.showTip(type, pos.x, pos.y - 100 * L.k, { shopIdx: i });
      });
      this.modalLayer.add(spr);

      this.modalLayer.add(this.add.text(pos.x, pos.y - 92 * L.k, `☠️${def.cost}`, {
        fontFamily: 'monospace', fontSize: L.fs(20), color: canBuy ? '#6f2a82' : '#8a7a8a',
      }).setOrigin(0.5, 0));
      this.modalLayer.add(this.add.text(pos.x, pos.y + 56 * L.k + cardTextShiftY, def.name, {
        fontFamily: 'monospace', fontSize: L.fs(18), color: '#3f4f60',
      }).setOrigin(0.5, 0));
      this.modalLayer.add(this.add.text(pos.x, pos.y + 86 * L.k + cardTextShiftY, def.dI, {
        fontFamily: 'monospace', fontSize: L.fs(16), color: '#5a7a4a',
      }).setOrigin(0.5, 0));
      this.modalLayer.add(this.add.text(pos.x, pos.y + 116 * L.k + cardTextShiftY, def.dS, {
        fontFamily: 'monospace', fontSize: L.fs(16), color: '#4a6f7a',
      }).setOrigin(0.5, 0));
      this.modalLayer.add(this.add.text(pos.x, pos.y + 146 * L.k + cardTextShiftY, (def.str || 0) + '⚔️', {
        fontFamily: 'monospace', fontSize: L.fs(16), color: '#a05a5a',
      }).setOrigin(0.5, 0));

      if (canBuy) {
        const buy = this.add.text(pos.x, pos.y + 186 * L.k + cardTextShiftY, '[ buy ]', {
          fontFamily: 'monospace',
          fontSize: L.fs(20),
          color: '#d7f0d7',
          backgroundColor: '#275a32',
          padding: { x: 12 * L.k, y: 6 * L.k },
        }).setOrigin(0.5, 0);
        buy.setInteractive({ useHandCursor: true });
        buy.on('pointerover', () => buy.setStyle({ backgroundColor: '#357542' }));
        buy.on('pointerout', () => buy.setStyle({ backgroundColor: '#275a32' }));
        buy.on('pointerdown', (ptr) => {
          ptr.event.stopPropagation();
          this.animateBuyTransition(i, m);
        });
        this.modalLayer.add(buy);
      }
    });

    if (G.tutorial && G.tutorial.active && G.shop.length === 1) {
      const featuredType = G.shop[0];
      const featuredDef = TYPES[featuredType];
      if (featuredDef) this.startFeaturedTicker(m, featuredDef);
    }
  }

  showTip(type, tx, ty, opts = {}) {
    const L = this.L;
    if (opts.fromClick) this._tipJustOpened = true;
    this.tipLayer.removeAll(true);
    const def = TYPES[type];
    const lines = [
      def.name, '─────────────',
      '🏝️ ' + def.dI, '⛵ ' + def.dS,
      (def.str || 0) + '⚔️',
    ];
    if (def.cost !== null) { lines.push(''); lines.push('Cost: ☠️' + def.cost); }
    const body = lines.join('\n');

    const tipFs = L.fs(22);
    const tmp = this.add.text(0, -999, body, {
      fontFamily: 'monospace', fontSize: tipFs, lineSpacing: 6 * L.k,
    });
    const tw = tmp.width, th = tmp.height;
    tmp.destroy();

    const pad = 20 * L.k;
    const bw = tw + pad * 2, bh = th + pad * 2;
    let bx = tx - bw / 2;
    let by = ty - bh - 16 * L.k;
    if (bx < 8 * L.k) bx = 8 * L.k;
    if (bx + bw > L.W - 8 * L.k) bx = L.W - bw - 8 * L.k;
    if (by < 8 * L.k) by = ty + 60 * L.k;

    const bg = this.add.graphics();
    bg.fillStyle(0x101828, 1);
    bg.fillRoundedRect(bx, by, bw, bh, 10 * L.k);
    bg.lineStyle(2 * L.k, 0x304860);
    bg.strokeRoundedRect(bx, by, bw, bh, 10 * L.k);
    this.tipLayer.add(bg);

    this.tipLayer.add(this.add.text(bx + pad, by + pad, body, {
      fontFamily: 'monospace', fontSize: tipFs, color: '#d0d8e0', lineSpacing: 6 * L.k,
    }));

    let extraH = 0;
    const canBuyNow = G.phase === 'shopping' && !G.busy && !G.shopAnimating;
    if (opts.shopIdx != null && canBuyNow && G.enthusiasm >= def.cost) {
      const btnY = by + bh + 8 * L.k;
      const bb = this.add.text(bx + bw / 2, btnY, 'Buy', {
        fontFamily: 'monospace', fontSize: L.fs(22), color: '#a0d8a0',
        backgroundColor: '#1a3a28', padding: { x: 20 * L.k, y: 10 * L.k },
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      bb.on('pointerover', () => bb.setStyle({ backgroundColor: '#2a5a38' }));
      bb.on('pointerout', () => bb.setStyle({ backgroundColor: '#1a3a28' }));
      bb.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        this.tipLayer.setVisible(false);
        this.animateBuyTransition(opts.shopIdx, this.computeModal());
      });
      this.tipLayer.add(bb);
      extraH = 60 * L.k;
    }

    this._tipRect = new Phaser.Geom.Rectangle(bx, by, bw, bh + extraH);
    this.tipLayer.setVisible(true);
  }

  animateBuyTransition(shopIdx, modal) {
    if (G.shopAnimating || G.phase !== 'shopping' || G.busy) return;
    const L = this.L;
    const game = this.scene.get('game');
    const oldShop = [...G.shop];
    const oldN = oldShop.length;
    if (shopIdx < 0 || shopIdx >= oldN) return;

    const type = oldShop[shopIdx];
    const cost = TYPES[type].cost;
    if (G.enthusiasm < cost) return;

    G.shopAnimating = true;

    const firstPos = this.shopPos(0, oldN, modal);
    const lastPos = this.shopPos(oldN - 1, oldN, modal);
    const rowMask = this.add.graphics().setDepth(70);
    rowMask.fillStyle(0xe0d4b1, 1);
    const maskTop = firstPos.y - 120 * L.k;
    const maskBot = lastPos.y + 240 * L.k;
    rowMask.fillRect(modal.x + 16 * L.k, maskTop, modal.w - 32 * L.k, maskBot - maskTop);
    this.modalLayer.add(rowMask);

    const dur = 340;
    const ghosts = [];
    oldShop.forEach((t, i) => {
      const p = this.shopPos(i, oldN, modal);
      const spr = addCatSprite(this, p.x, p.y, t);
      spr.setScale(L.SC).setDepth(80);
      this.modalLayer.add(spr);
      ghosts.push(spr);
    });

    game.buyPirate(shopIdx, { deferRender: true, silent: true, ignoreAnimating: true });
    const newN = G.shop.length;

    const removed = ghosts[shopIdx];
    this.tweens.add({
      targets: removed,
      y: removed.y - 100 * L.k,
      alpha: 0,
      duration: dur,
      ease: 'Power2',
    });

    let ni = 0;
    for (let i = 0; i < oldN; i++) {
      if (i === shopIdx) continue;
      if (ni >= newN) break;
      const tp = this.shopPos(ni, newN, modal);
      this.tweens.add({
        targets: ghosts[i],
        x: tp.x,
        y: tp.y,
        duration: dur,
        ease: 'Power2',
      });
      ni++;
    }

    let newGhost = null;
    const hasIncoming = newN > (oldN - 1);
    if (hasIncoming) {
      const newType = G.shop[newN - 1];
      const lastNewPos = this.shopPos(newN - 1, newN, modal);
      newGhost = addCatSprite(this, modal.x + modal.w + 90 * L.k, lastNewPos.y, newType);
      newGhost.setScale(L.SC).setDepth(80);
      this.modalLayer.add(newGhost);
      this.tweens.add({
        targets: newGhost,
        x: lastNewPos.x,
        duration: dur,
        ease: 'Power2',
        delay: 30,
      });
    }

    this.time.delayedCall(dur + 100, () => {
      ghosts.forEach(g => g.destroy());
      if (newGhost) newGhost.destroy();
      rowMask.destroy();
      G.shopAnimating = false;
      game.float(game.L.cx, game.L.Y_ISL_CY - 40 * game.L.k, '+ ' + TYPES[type].name + '!', '#66bb6a');
      game.renderAll();
      this.renderModal();
    });
  }
}
