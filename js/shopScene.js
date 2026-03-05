/* ============================================================
   PIRATES — Shop Panel Scene
   ============================================================ */

class ShopScene extends Phaser.Scene {
  constructor() { super('shopModal'); }

  create() {
    ensureCatTextures(this);
    this.L = computeLayout(this.scale.width, this.scale.height);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.panelLayer = this.add.container(0, 0).setDepth(40);
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

    this.renderPanel();
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
    this.panelLayer.setAlpha(0).setY(offset);
    this.tweens.add({
      targets: this.panelLayer,
      alpha: 1, y: 0,
      duration: 140,
      ease: 'Cubic.easeOut',
    });
  }

  computePanel() {
    const L = this.L;
    const sidePad = 18 * L.k;
    const top = L.Y_INV + 56 * L.k;
    const bottom = L.Y_HAND - 112 * L.k;
    const h = Math.max(300 * L.k, bottom - top);
    const w = L.W - sidePad * 2;
    const x = sidePad;
    const y = top;
    return { x, y, w, h };
  }

  shopPos(idx, n, panel, layout) {
    const L = this.L;
    const cardScale = layout.cardScale;
    const cols = Math.min(n, 2);
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const rowStart = row * cols;
    const rowN = Math.min(cols, n - rowStart);
    const cardW = CARD.W * L.k * cardScale;
    const cardH = CARD.H * L.k * cardScale;
    const innerW = panel.w - 60 * L.k;
    const freeW = Math.max(0, innerW - rowN * cardW);
    // Keep rows compact and centered instead of stretching cards to edges.
    const preferredGapX = 42 * L.k;
    const gapX = rowN <= 1 ? 0 : Math.min(preferredGapX, freeW / (rowN - 1));
    const rowW = rowN * cardW + gapX * (rowN - 1);
    const rowStartX = panel.x + (panel.w - rowW) / 2;
    const x = rowStartX + cardW / 2 + col * (cardW + gapX);
    const rows = Math.max(1, Math.ceil(n / cols));
    const rowPitch = cardH + layout.footerH + layout.rowGap;
    const usableH = panel.h - layout.topPad - layout.bottomPad;
    const totalRowsH = rows * rowPitch - layout.rowGap;
    const extraTop = Math.max(0, (usableH - totalRowsH) / 2);
    const startY = panel.y + layout.topPad + extraTop;
    const y = startY + row * rowPitch + cardH / 2;
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

  startFeaturedTicker(panel, def) {
    const L = this.L;
    const lines = [
      `Featured: ${def.name}`,
      `Island: ${def.dI}`,
      `Ship: ${def.dS}`,
      `Power: ${(def.str || 0)}⚔️`,
      `Cost: ☠️${def.cost}`,
    ];

    const tickerY = panel.y + panel.h - 70 * L.k;
    const label = this.add.text(panel.x + panel.w / 2, tickerY, lines[0], {
      fontFamily: 'monospace',
      fontSize: L.fs(18),
      color: '#3e2f12',
      align: 'center',
      wordWrap: { width: panel.w - 60 * L.k },
    }).setOrigin(0.5);
    this.panelLayer.add(label);

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

  renderPanel() {
    this.stopFeaturedTicker();
    this.panelLayer.removeAll(true);
    if (this.tipLayer) this.tipLayer.setVisible(false);
    const L = this.L;
    const m = this.computePanel();

    const paper = this.add.graphics();
    paper.fillStyle(0xe0d4b1, 1);
    paper.fillRoundedRect(m.x, m.y, m.w, m.h, 18 * L.k);
    paper.lineStyle(3, 0x6a5838, 1);
    paper.strokeRoundedRect(m.x, m.y, m.w, m.h, 18 * L.k);
    this.panelLayer.add(paper);

    const title = this.add.text(m.x + m.w / 2, m.y + 14 * L.k, 'Pirate Shop', {
      fontFamily: 'monospace', fontSize: L.fs(30), color: '#2b2b2b',
    }).setOrigin(0.5, 0);
    this.panelLayer.add(title);

    const canBuyNow = G.phase === 'shopping' && !G.busy;
    const infoText = canBuyNow ? `You have ☠️ ${G.enthusiasm}` : 'Hire in the end of the round';
    const info = this.add.text(m.x + m.w / 2, m.y + 46 * L.k, infoText, {
      fontFamily: 'monospace', fontSize: L.fs(18), color: canBuyNow ? '#6f2a82' : '#7a6a4a',
    }).setOrigin(0.5, 0);
    this.panelLayer.add(info);

    if (G.shop.length === 0) {
      const empty = this.add.text(m.x + m.w / 2, m.y + m.h * 0.48, '(empty)', {
        fontFamily: 'monospace', fontSize: L.fs(22), color: '#7a6a4a',
      }).setOrigin(0.5);
      this.panelLayer.add(empty);
      return;
    }

    const rows = Math.max(1, Math.ceil(G.shop.length / 2));
    const layoutBase = {
      topPad: 110 * L.k,
      bottomPad: 120 * L.k,
      footerH: 44 * L.k,
      rowGap: 44 * L.k,
    };
    const maxCardAreaH = m.h - layoutBase.topPad - layoutBase.bottomPad
      - rows * layoutBase.footerH - Math.max(0, rows - 1) * layoutBase.rowGap;
    const maxByRows = maxCardAreaH / Math.max(1, rows * CARD.H * L.k);
    const cardScale = Phaser.Math.Clamp(Math.min(0.9, maxByRows), 0.58, 0.9);
    const shopLayout = { ...layoutBase, cardScale };

    G.shop.forEach((type, i) => {
      const def = TYPES[type];
      const pos = this.shopPos(i, G.shop.length, m, shopLayout);
      const canBuy = canBuyNow && G.enthusiasm >= def.cost;
      const card = createPirateCard(this, {
        type,
        x: pos.x,
        y: pos.y,
        L,
        container: this.panelLayer,
        depth: 20 + i,
        scale: cardScale,
        interactive: true,
      });

      const cardImg = card.cardImg;
      const cardCt = card.container;
      if (!canBuy) cardImg.setTint(0x9da6b2);

      cardImg.on('pointerover', () => {
        this.tweens.add({
          targets: cardCt,
          scaleX: cardScale * 1.04,
          scaleY: cardScale * 1.04,
          duration: 120,
          ease: 'Sine.easeOut',
        });
      });
      cardImg.on('pointerout', () => {
        this.tweens.add({
          targets: cardCt,
          scaleX: cardScale,
          scaleY: cardScale,
          duration: 120,
          ease: 'Sine.easeOut',
        });
      });
      cardImg.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        if (!canBuy) return;
        this.animateBuyTransition(i, m, cardScale);
      });

      const footerY = pos.y + (CARD.H * L.k * cardScale) / 2 + 14 * L.k;
      const actionLabel = `[ ☠️${def.cost} ]`;
      // const actionLabel = canBuy
        // ? `[ buy ☠️${def.cost} ]`
        // : (canBuyNow ? `[ need ☠️${def.cost} ]` : `[ locked ☠️${def.cost} ]`);
      const actionColor = canBuy ? '#d7f0d7' : '#8a7a8a';
      const actionBg = canBuy ? '#275a32' : '#d9cda7';
      const action = this.add.text(pos.x, footerY, actionLabel, {
        fontFamily: 'monospace',
        fontSize: L.fs(19),
        color: actionColor,
        backgroundColor: actionBg,
        padding: { x: 10 * L.k, y: 6 * L.k },
      }).setOrigin(0.5, 0);
      this.panelLayer.add(action);

      if (canBuy) {
        action.setInteractive({ useHandCursor: true });
        action.on('pointerover', () => action.setStyle({ backgroundColor: '#357542' }));
        action.on('pointerout', () => action.setStyle({ backgroundColor: '#275a32' }));
        action.on('pointerdown', (ptr) => {
          ptr.event.stopPropagation();
          this.animateBuyTransition(i, m, cardScale);
        });
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
        this.animateBuyTransition(opts.shopIdx, this.computePanel());
      });
      this.tipLayer.add(bb);
      extraH = 60 * L.k;
    }

    this._tipRect = new Phaser.Geom.Rectangle(bx, by, bw, bh + extraH);
    this.tipLayer.setVisible(true);
  }

  animateBuyTransition(shopIdx, panel, cardScale = 1) {
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

    const shopLayout = {
      cardScale,
      topPad: 110 * L.k,
      bottomPad: 120 * L.k,
      footerH: 44 * L.k,
      rowGap: 18 * L.k,
    };
    const firstPos = this.shopPos(0, oldN, panel, shopLayout);
    const lastPos = this.shopPos(oldN - 1, oldN, panel, shopLayout);
    const cardH = CARD.H * L.k * cardScale;
    const rowMask = this.add.graphics().setDepth(70);
    rowMask.fillStyle(0xe0d4b1, 1);
    const maskTop = firstPos.y - cardH * 0.75;
    const maskBot = lastPos.y + cardH * 0.85;
    rowMask.fillRect(panel.x + 16 * L.k, maskTop, panel.w - 32 * L.k, maskBot - maskTop);
    this.panelLayer.add(rowMask);

    const dur = 340;
    const ghosts = [];
    oldShop.forEach((t, i) => {
      const p = this.shopPos(i, oldN, panel, shopLayout);
      const card = createPirateCard(this, {
        type: t,
        x: p.x,
        y: p.y,
        L,
        container: this.panelLayer,
        depth: 80,
        scale: cardScale,
      });
      ghosts.push(card);
    });

    game.buyPirate(shopIdx, { deferRender: true, silent: true, ignoreAnimating: true });
    const newN = G.shop.length;

    const removed = ghosts[shopIdx];
    this.tweens.add({
      targets: [removed.container, removed.shadow].filter(Boolean),
      y: removed.container.y - 100 * L.k,
      alpha: 0,
      duration: dur,
      ease: 'Power2',
    });

    let ni = 0;
    for (let i = 0; i < oldN; i++) {
      if (i === shopIdx) continue;
      if (ni >= newN) break;
      const tp = this.shopPos(ni, newN, panel, shopLayout);
      this.tweens.add({
        targets: [ghosts[i].container, ghosts[i].shadow].filter(Boolean),
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
      const lastNewPos = this.shopPos(newN - 1, newN, panel, shopLayout);
      newGhost = createPirateCard(this, {
        type: newType,
        x: panel.x + panel.w + 120 * L.k,
        y: lastNewPos.y,
        L,
        container: this.panelLayer,
        depth: 80,
        scale: cardScale,
      });
      this.tweens.add({
        targets: [newGhost.container, newGhost.shadow].filter(Boolean),
        x: lastNewPos.x,
        duration: dur,
        ease: 'Power2',
        delay: 30,
      });
    }

    this.time.delayedCall(dur + 100, () => {
      ghosts.forEach(g => {
        if (g.container) g.container.destroy();
        if (g.shadow) g.shadow.destroy();
      });
      if (newGhost) {
        if (newGhost.container) newGhost.container.destroy();
        if (newGhost.shadow) newGhost.shadow.destroy();
      }
      rowMask.destroy();
      G.shopAnimating = false;
      game.float(game.L.cx, game.L.Y_ISL_CY - 40 * game.L.k, '+ ' + TYPES[type].name + '!', '#66bb6a');
      game.renderAll();
      this.renderPanel();
    });
  }
}
