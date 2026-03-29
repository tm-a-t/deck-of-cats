/* ============================================================
   PIRATES — All Pirates Gallery Scene
   ============================================================ */

class AllPiratesScene extends Phaser.Scene {
  constructor() { super('allPirates'); }

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
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.L = computeLayout(this.scale.width, this.scale.height);

    this.uiLayer = this.add.container(0, 0).setDepth(10);
    this.contentLayer = this.add.container(0, 0).setDepth(11);
    this._cardTips = new CardTooltipController(this, { depth: 80 });
    this._contentMaskSource = null;
    this._scrollY = 0;
    this._contentH = 0;

    this.renderGallery();
    this.setupScroll();

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
      if (this._cardTips) this._cardTips.destroy();
    });
  }

  renderGallery() {
    const L = this.L;
    const scrollArea = this.computeScrollArea();
    const allKeys = Object.keys(TYPES).filter((key) => TYPES[key]);

    this.uiLayer.removeAll(true);
    this.contentLayer.removeAll(true);
    if (this.contentLayer) this.contentLayer.clearMask(true);
    if (this._contentMaskSource) {
      this._contentMaskSource.destroy();
      this._contentMaskSource = null;
    }

    this._scrollArea = scrollArea;
    if (this._cardTips) {
      this._cardTips.setBoundsRect({
        left: 12 * L.k,
        top: 18 * L.k,
        right: L.W - 12 * L.k,
        bottom: L.H - 12 * L.k,
      });
      this._cardTips.hide();
    }

    const title = this.add.text(L.cx, 34 * L.k, 'All Pirates', uiHeadingStyle(L, 44, UI_THEME.colors.mutedPaper))
      .setOrigin(0.5, 0);
    this.uiLayer.add(title);

    const back = this.mkTextBtn(28 * L.k, 36 * L.k, '← Menu', () => this.scene.start('menu'), {
      color: UI_THEME.colors.mutedPaper,
      hoverColor: UI_THEME.colors.paper,
      originX: 0,
      originY: 0,
    });
    this.uiLayer.add(back);

    const divider = this.add.graphics();
    divider.lineStyle(Math.max(1, Math.round(2 * L.k)), uiColorInt(UI_THEME.colors.outline), 0.65);
    divider.lineBetween(20 * L.k, scrollArea.y - 16 * L.k, L.W - 20 * L.k, scrollArea.y - 16 * L.k);
    this.uiLayer.add(divider);

    const maskShape = this.make.graphics({ add: false });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(scrollArea.x, scrollArea.y, scrollArea.w, scrollArea.h);
    this._contentMaskSource = maskShape;
    this.contentLayer.setMask(maskShape.createGeometryMask());

    if (allKeys.length === 0) {
      const empty = this.add.text(
        L.cx,
        scrollArea.h / 2,
        'No pirates found',
        uiBodyStyle(L, UI_THEME.colors.paper, { align: 'center' })
      ).setOrigin(0.5);
      this.contentLayer.add(empty);
      this._contentH = scrollArea.h;
      this.applyScroll(0);
      return;
    }

    const layout = this.computeGridLayout(allKeys.length);
    allKeys.forEach((key, idx) => {
      const pos = this.gridCardPos(idx, layout);
      const tips = pirateCardEffectTips(key);
      const tipKey = `all-pirates-${key}-${idx}`;
      const card = createPirateCard(this, {
        type: key,
        x: pos.x,
        y: pos.y,
        L,
        container: this.contentLayer,
        depth: 10 + idx,
        scale: layout.cardScale,
        interactive: true,
      });
      const showTips = () => this._cardTips && this._cardTips.showForCard(card.container, tips, { key: tipKey });

      card.cardImg.on('pointerover', () => {
        this.tweens.add({
          targets: card.container,
          scaleX: layout.cardScale * 1.03,
          scaleY: layout.cardScale * 1.03,
          duration: 120,
          ease: 'Sine.easeOut',
        });
        showTips();
      });
      card.cardImg.on('pointerout', () => {
        this.tweens.add({
          targets: card.container,
          scaleX: layout.cardScale,
          scaleY: layout.cardScale,
          duration: 120,
          ease: 'Sine.easeOut',
        });
        if (this._cardTips) this._cardTips.hideForKey(tipKey);
      });
      card.cardImg.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        if (!isTouchLikePointer(ptr)) return;
        if (this._cardTips && this._cardTips.isActiveFor(tipKey)) {
          this._cardTips.hide();
          return;
        }
        showTips();
      });
    });

    this._contentH = layout.contentH;
    this.applyScroll(0);
  }

  computeScrollArea() {
    const L = this.L;
    const top = 114 * L.k;
    const bottomPad = 20 * L.k;
    return {
      x: 0,
      y: top,
      w: L.W,
      h: Math.max(120 * L.k, L.H - top - bottomPad),
    };
  }

  computeGridLayout(count) {
    const L = this.L;
    const area = this._scrollArea;
    const sidePad = 20 * L.k;
    const gapX = 16 * L.k;
    const gapY = 24 * L.k;
    const topPad = 6 * L.k;
    const bottomPad = 28 * L.k;
    const minScale = 0.72;
    const usableW = area.w - sidePad * 2;
    const maxFitCols = Math.max(
      1,
      Math.floor((usableW + gapX) / (CARD.W * L.k * minScale + gapX))
    );
    const cols = Math.max(1, Math.min(count, maxFitCols, 8));
    const cardScale = Phaser.Math.Clamp(
      (usableW - gapX * Math.max(0, cols - 1)) / Math.max(1, cols * CARD.W * L.k),
      minScale,
      1
    );
    const cardW = CARD.W * L.k * cardScale;
    const cardH = CARD.H * L.k * cardScale;
    const rows = Math.max(1, Math.ceil(count / cols));
    const gridW = cols * cardW + Math.max(0, cols - 1) * gapX;
    return {
      cols,
      gapX,
      gapY,
      cardScale,
      cardW,
      cardH,
      startX: sidePad + (usableW - gridW) / 2 + cardW / 2,
      startY: topPad + cardH / 2,
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

  setupScroll() {
    let dragging = false;
    let dragStartY = 0;
    let dragScrollStart = 0;

    this.input.on('pointerdown', (ptr) => {
      if (!this.isPointInScrollArea(ptr.x, ptr.y)) return;
      dragging = true;
      dragStartY = ptr.y;
      dragScrollStart = this._scrollY;
    });

    this.input.on('pointermove', (ptr) => {
      if (!dragging || !ptr.isDown) return;
      const dy = dragStartY - ptr.y;
      this.applyScroll(dragScrollStart + dy);
    });

    this.input.on('pointerup', () => {
      dragging = false;
    });

    this.input.on('wheel', (ptr, _gos, _dx, dy) => {
      if (!this.isPointInScrollArea(ptr.x, ptr.y)) return;
      this.applyScroll(this._scrollY + dy * 0.5);
    });
  }

  isPointInScrollArea(x, y) {
    const area = this._scrollArea;
    return !!area
      && x >= area.x
      && x <= area.x + area.w
      && y >= area.y
      && y <= area.y + area.h;
  }

  applyScroll(nextY) {
    if (this._cardTips) this._cardTips.hide();
    const maxScroll = Math.max(0, this._contentH - this._scrollArea.h);
    this._scrollY = Phaser.Math.Clamp(nextY, 0, maxScroll);
    this.contentLayer.y = this._scrollArea.y - this._scrollY;
  }

  mkTextBtn(x, y, label, cb, opts = {}) {
    const text = this.add.text(x, y, label, uiBodyStyle(this.L, opts.color || UI_THEME.colors.paper, {
      fontStyle: opts.fontStyle || 'normal',
    }))
      .setOrigin(opts.originX != null ? opts.originX : 0.5, opts.originY != null ? opts.originY : 0.5)
      .setInteractive({ useHandCursor: true });
    const baseColor = opts.color || UI_THEME.colors.paper;
    const hoverColor = opts.hoverColor || UI_THEME.colors.mutedPaper;
    text.on('pointerover', () => text.setColor(hoverColor));
    text.on('pointerout', () => text.setColor(baseColor));
    text.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      cb();
    });
    return text;
  }
}
