/* ============================================================
   PIRATES — Draw / Discard Panel Scenes
   ============================================================ */

class PilePanelScene extends Phaser.Scene {
  constructor(key, title) {
    super(key);
    this.panelTitle = title;
  }

  preload() {
    if (!this.textures.exists('catsImg')) {
      this.load.image('catsImg', 'assets/cats.png');
    }
    if (!this.textures.exists('notcatsImg')) {
      this.load.image('notcatsImg', 'assets/notcats.png');
    }
  }

  create() {
    ensureCatTextures(this);
    this.L = computeLayout(this.scale.width, this.scale.height);
    this.panel = this.computePanel();
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.panelLayer = this.add.container(0, 0).setDepth(40);
    this.contentLayer = this.add.container(0, 0).setDepth(41);
    this.uiLayer = this.add.container(0, 0).setDepth(42);
    this._contentH = 0;
    this._scrollMinY = 0;
    this._scrollMaxY = 0;
    this._contentMaskSource = null;

    this.input.on('pointerdown', (ptr) => {
      if (ptr.y > this.panel.h) {
        ptr.event.stopPropagation();
        this.scene.stop();
      }
    });

    this.renderPanel();
    this.setupScroll();
    this.animateOpen();

    this._onResize = () => {
      this.L = computeLayout(this.scale.width, this.scale.height);
      this.scene.restart();
    };
    this.scale.on('resize', this._onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize);
      if (this.contentLayer) this.contentLayer.clearMask(true);
      if (this._contentMaskSource) {
        this._contentMaskSource.destroy();
        this._contentMaskSource = null;
      }
    });
  }

  animateOpen() {
    const offset = 30 * this.L.k;
    [this.panelLayer, this.contentLayer, this.uiLayer].forEach((layer) => {
      layer.setAlpha(0).setY(-offset);
      this.tweens.add({
        targets: layer,
        alpha: 1,
        y: 0,
        duration: 140,
        ease: 'Cubic.easeOut',
      });
    });
  }

  computePanel() {
    const L = this.L;
    const handTop = handCardsTopY(L);
    const maxH = Math.min(L.H * 0.64, handTop - 16 * L.k);
    const h = Math.max(320 * L.k, maxH);
    const x = 0;
    const y = 0;
    const w = L.W;
    const pad = 22 * L.k;
    const headH = 98 * L.k;
    const footPad = 18 * L.k;
    return {
      x,
      y,
      w,
      h,
      pad,
      headH,
      footPad,
      innerX: x + pad,
      innerY: y + headH,
      innerW: w - pad * 2,
      innerH: h - headH - footPad,
    };
  }

  pileCards() {
    return [];
  }

  pileCardsForDisplay() {
    return this.pileCards().filter((pirate) => pirate && TYPES[pirate.type]);
  }

  emptyLabel() {
    return 'No cards here';
  }

  computeGridLayout(count) {
    const L = this.L;
    const m = this.panel;
    const gapX = 16 * L.k;
    const gapY = 24 * L.k;
    const topPad = 4 * L.k;
    const bottomPad = 18 * L.k;
    const minScale = 0.72;
    const maxFitCols = Math.max(
      1,
      Math.floor((m.innerW + gapX) / (CARD.W * L.k * minScale + gapX))
    );
    const cols = Math.max(1, Math.min(count, maxFitCols, 8));
    const cardScale = Phaser.Math.Clamp(
      (m.innerW - gapX * Math.max(0, cols - 1)) / Math.max(1, cols * CARD.W * L.k),
      minScale,
      1
    );
    const cardW = CARD.W * L.k * cardScale;
    const cardH = CARD.H * L.k * cardScale;
    const rows = Math.max(1, Math.ceil(count / cols));
    const gridW = cols * cardW + Math.max(0, cols - 1) * gapX;
    return {
      cols,
      rows,
      gapX,
      gapY,
      cardScale,
      cardW,
      cardH,
      startX: m.innerX + (m.innerW - gridW) / 2 + cardW / 2,
      startY: m.innerY + topPad + cardH / 2,
      contentH: topPad + rows * cardH + Math.max(0, rows - 1) * gapY + bottomPad,
    };
  }

  gridCardPos(idx, layout) {
    const row = Math.floor(idx / layout.cols);
    const col = idx % layout.cols;
    return {
      x: layout.startX + col * (layout.cardW + layout.gapX),
      y: layout.startY + row * (layout.cardH + layout.gapY),
    };
  }

  renderPanel() {
    this.panelLayer.removeAll(true);
    this.contentLayer.removeAll(true);
    this.uiLayer.removeAll(true);
    const L = this.L;
    const m = this.computePanel();
    this.panel = m;

    const shadow = this.add.graphics();
    shadow.fillStyle(uiColorInt(UI_THEME.colors.shadow), 0.18);
    shadow.fillRect(m.x, m.h - 10 * L.k, m.w, 20 * L.k);
    this.panelLayer.add(shadow);

    const paper = this.add.graphics();
    paper.fillStyle(uiColorInt(UI_THEME.colors.sand), 1);
    paper.fillRect(m.x, m.y, m.w, m.h);
    paper.lineStyle(Math.max(1, 3 * L.k), uiColorInt(UI_THEME.colors.sandEdge), 1);
    paper.lineBetween(m.x, m.h, m.w, m.h);
    this.panelLayer.add(paper);

    const cards = this.pileCardsForDisplay();
    const title = this.add.text(28 * L.k, 24 * L.k, this.panelTitle, uiHeadingStyle(L, 40, UI_THEME.colors.ink))
      .setOrigin(0, 0);
    this.uiLayer.add(title);

    const close = this.add.text(m.w - 28 * L.k, 24 * L.k, '×', uiHeadingStyle(L, 40, UI_THEME.colors.ink))
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      this.scene.stop();
    });
    this.uiLayer.add(close);

    if (cards.length === 0) {
      const empty = this.add.text(
        m.x + m.w / 2,
        m.innerY + m.innerH / 2,
        this.emptyLabel(),
        uiBodyStyle(L, UI_THEME.colors.ink, {
          align: 'center',
          wordWrap: { width: m.innerW - 32 * L.k },
        })
      ).setOrigin(0.5);
      this.contentLayer.add(empty);
      this._contentH = m.innerH;
      this.contentLayer.y = 0;
      return;
    }

    const layout = this.computeGridLayout(cards.length);
    cards.forEach((pirate, idx) => {
      const pos = this.gridCardPos(idx, layout);
      createPirateCard(this, {
        type: pirate.type,
        x: pos.x,
        y: pos.y,
        L,
        container: this.contentLayer,
        depth: 10 + idx,
        scale: layout.cardScale,
      });
    });

    this._contentH = layout.contentH;
    this.applyScrollBounds(true);
  }

  setupScroll() {
    const m = this.panel;
    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(m.innerX, m.innerY, m.innerW, m.innerH);
    this._contentMaskSource = maskShape;
    this.contentLayer.setMask(maskShape.createGeometryMask());
    this.applyScrollBounds(true);

    let dragging = false;
    let dragStartY = 0;
    let layerStartY = 0;

    this.input.on('pointerdown', (ptr) => {
      if (ptr.x < m.innerX || ptr.x > m.innerX + m.innerW) return;
      if (ptr.y < m.innerY || ptr.y > m.innerY + m.innerH) return;
      dragging = true;
      dragStartY = ptr.y;
      layerStartY = this.contentLayer.y;
    });

    this.input.on('pointermove', (ptr) => {
      if (!dragging) return;
      const dy = ptr.y - dragStartY;
      this.applyScroll(layerStartY + dy);
    });

    this.input.on('pointerup', () => {
      dragging = false;
    });

    this.input.on('wheel', (ptr, _gos, _dx, dy) => {
      if (ptr.x < m.innerX || ptr.x > m.innerX + m.innerW) return;
      if (ptr.y < m.innerY || ptr.y > m.innerY + m.innerH) return;
      this.applyScroll(this.contentLayer.y - dy * 0.5);
    });
  }

  applyScroll(nextY) {
    this.contentLayer.y = Phaser.Math.Clamp(nextY, this._scrollMinY, this._scrollMaxY);
  }

  applyScrollBounds(resetToTop = false) {
    const m = this.panel;
    this._scrollMinY = Math.min(0, m.innerH - this._contentH);
    this._scrollMaxY = 0;
    if (resetToTop) {
      this.contentLayer.y = 0;
    } else {
      this.applyScroll(this.contentLayer.y);
    }
  }
}

class DrawPileScene extends PilePanelScene {
  constructor() {
    super('drawPileModal', 'Draw Pile');
  }

  pileCards() {
    return [...G.deck].sort((a, b) => {
      const aName = (TYPES[a.type] && TYPES[a.type].name) || a.type || '';
      const bName = (TYPES[b.type] && TYPES[b.type].name) || b.type || '';
      const byName = aName.localeCompare(bName);
      if (byName !== 0) return byName;
      return (a.id || 0) - (b.id || 0);
    });
  }

  emptyLabel() {
    return 'Your draw pile is empty';
  }
}

class DiscardPileScene extends PilePanelScene {
  constructor() {
    super('discardPileModal', 'Discard');
  }

  pileCards() {
    return [...G.discard];
  }

  emptyLabel() {
    return 'No pirates in discard yet';
  }
}
