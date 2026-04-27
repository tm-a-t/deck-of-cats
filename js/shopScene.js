/* ============================================================
   PIRATES — Shop Panel Scene
   ============================================================ */

class ShopScene extends Phaser.Scene {
  constructor() { super('shopModal'); }

  init(data) {
    this._launchOriginRect = data && data.originRect ? { ...data.originRect } : null;
    this._skipOpenAnim = !!(data && data.skipOpenAnim);
  }

  create() {
    ensureCatTextures(this);
    this.L = computeLayout(this.scale.width, this.scale.height);
    this.panel = this.computePanel();
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this._panelTween = null;
    this._panelClosing = false;
    this.panelLayer = this.add.container(0, 0).setDepth(40);
    this._cardTips = new CardTooltipController(this, { depth: 80 });
    this._featuredTicker = null;
    this._featuredTickerLabel = null;
    this._featuredTickerLines = [];
    this._featuredTickerIdx = 0;

    this.input.on('pointerdown', (ptr) => {
      if (ptr.y > this.panel.h) {
        ptr.event.stopPropagation();
        this.requestClose();
      }
    });

    this.renderPanel();
    if (!this._skipOpenAnim) this.animateOpen();

    this._onResize = () => {
      this.L = computeLayout(this.scale.width, this.scale.height);
      this.scene.restart({ skipOpenAnim: true, originRect: this._launchOriginRect });
    };
    this.scale.on('resize', this._onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize);
      if (this._panelTween) this._panelTween.stop();
      this._panelTween = null;
      this._panelClosing = false;
      if (this._cardTips) this._cardTips.destroy();
    });
  }

  transitionTargets() {
    return [this.panelLayer];
  }

  currentOriginRect() {
    const game = this.scene.get('game');
    if (game && typeof game.panelButtonRect === 'function') {
      return game.panelButtonRect(this.scene.key) || this._launchOriginRect;
    }
    return this._launchOriginRect;
  }

  animateOpen() {
    const finalStates = snapshotPanelTargets(this.transitionTargets());
    const fromStates = finalStates.map((state) => (
      collapsedPanelState(state, this.panel, this._launchOriginRect, { L: this.L })
    ));
    this._panelTween = tweenPanelStates(this, fromStates, finalStates, {
      duration: PANEL_MOTION.openDuration,
      ease: PANEL_MOTION.openEase,
      onComplete: () => {
        this._panelTween = null;
      },
    });
  }

  requestClose() {
    if (this._panelClosing) return;
    this._panelClosing = true;
    const game = this.scene.get('game');
    if (game && typeof game.panelFlagKey === 'function') {
      const flagKey = game.panelFlagKey(this.scene.key);
      if (flagKey && game[flagKey]) game.setPanelOpen(this.scene.key, false);
    }
    this.input.enabled = false;
    if (this._cardTips) this._cardTips.hide();
    if (this._panelTween) {
      this._panelTween.stop();
      this._panelTween = null;
    }
    const fromStates = snapshotPanelTargets(this.transitionTargets());
    const toStates = fromStates.map((state) => (
      collapsedPanelState(state, this.panel, this.currentOriginRect(), { L: this.L })
    ));
    this._panelTween = tweenPanelStates(this, fromStates, toStates, {
      duration: PANEL_MOTION.closeDuration,
      ease: PANEL_MOTION.closeEase,
      onComplete: () => {
        this._panelTween = null;
        this.scene.stop();
      },
    });
  }

  computePanel() {
    const L = this.L;
    const handTop = handCardsTopY(L);
    const maxH = Math.min(L.H * 0.64, handTop - 16 * L.k);
    return {
      x: 0,
      y: 0,
      w: L.W,
      h: Math.max(320 * L.k, maxH),
    };
  }

  tooltipBounds(panel) {
    const pad = 18 * this.L.k;
    return {
      left: panel.x + pad,
      top: panel.y + pad,
      right: panel.x + panel.w - pad,
      bottom: panel.y + panel.h - pad,
    };
  }

  shopPos(idx, n, panel, layout) {
    const L = this.L;
    const cardScale = layout.cardScale;
    const cols = n <= 4 ? n : Math.ceil(n / 2);
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const rowStart = row * cols;
    const rowN = Math.min(cols, n - rowStart);
    const cardW = CARD.W * L.k * cardScale;
    const cardH = CARD.H * L.k * cardScale;
    const gapX = 20 * L.k;
    const gapY = 56 * L.k;
    const rowW = rowN * cardW + gapX * (rowN - 1);
    const rowStartX = panel.x + (panel.w - rowW) / 2;
    const x = rowStartX + cardW / 2 + col * (cardW + gapX);
    const rowPitch = cardH + layout.footerH + gapY;
    const startY = panel.y + layout.topPad;
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
    const islandDesc = pirateIslandDesc(def);
    const shipDesc = pirateShipDesc(def);
    const lines = [
      `Featured: ${def.name}`,
      `Island: ${islandDesc}`,
      `Ship: ${shipDesc}`,
      `Cost: ☠️${def.cost}`,
    ];

    const tickerY = panel.y + panel.h - 70 * L.k;
    const label = this.add.text(panel.x + panel.w / 2, tickerY, lines[0], {
      fontFamily: UI_THEME.fonts.body,
      fontSize: L.fs(14),
      color: UI_THEME.colors.ink,
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

  nextBoardingIntelLine() {
    const game = this.scene.get('game');
    if (!game || typeof game.nextShipIntelText !== 'function') return '';
    return game.nextShipIntelText();
  }

  renderNextBoardingIntel(panel) {
    const text = this.nextBoardingIntelLine();
    if (!text) return '';

    const L = this.L;
    const label = this.add.text(panel.x + 28 * L.k, panel.y + 86 * L.k, text, {
      ...uiBodyStyle(L, UI_THEME.colors.ink),
      fontSize: L.fs(13),
      lineSpacing: uiLineSpacingPx(L, 13, 15),
      wordWrap: { width: panel.w - 96 * L.k },
    }).setOrigin(0, 0);
    this.panelLayer.add(label);
    return text;
  }

  renderPanel() {
    this.stopFeaturedTicker();
    this.panelLayer.removeAll(true);
    const L = this.L;
    const m = this.computePanel();
    this.panel = m;
    if (this._cardTips) {
      this._cardTips.setBoundsRect(this.tooltipBounds(m));
      this._cardTips.hide();
    }

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

    const title = this.add.text(28 * L.k, 32 * L.k, 'Shop', uiHeadingStyle(L, 40, UI_THEME.colors.ink))
      .setOrigin(0, 0);
    this.panelLayer.add(title);

    const close = this.add.text(m.w - 28 * L.k, 32 * L.k, '×', uiHeadingStyle(L, 40, UI_THEME.colors.ink))
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      this.requestClose();
    });
    this.panelLayer.add(close);
    const intelText = this.renderNextBoardingIntel(m);

    const canBuyNow = G.phase === 'shopping' && !G.busy && !G.shopAnimating;
    const game = this.scene.get('game');

    if (G.shop.length === 0) {
      const empty = this.add.text(m.x + m.w / 2, m.y + m.h * 0.48, 'No pirates for hire', uiBodyStyle(L, UI_THEME.colors.ink))
        .setOrigin(0.5);
      this.panelLayer.add(empty);
      this.renderContinueButton(m);
      return;
    }

    const rows = Math.max(1, Math.ceil(G.shop.length / 4));
    const layoutBase = {
      topPad: (intelText ? 176 : 150) * L.k,
      bottomPad: 100 * L.k,
      footerH: 52 * L.k,
      rowGap: 44 * L.k,
    };
    const maxCardAreaH = m.h - layoutBase.topPad - layoutBase.bottomPad
      - rows * layoutBase.footerH - Math.max(0, rows - 1) * layoutBase.rowGap;
    const maxByRows = maxCardAreaH / Math.max(1, rows * CARD.H * L.k);
    const maxByWidth = (m.w - 96 * L.k) / Math.max(1, Math.min(G.shop.length, 4) * CARD.W * L.k);
    const cardScale = Phaser.Math.Clamp(Math.min(1, maxByRows, maxByWidth), 0.82, 1);
    const shopLayout = { ...layoutBase, cardScale };

    G.shop.forEach((type, i) => {
      const def = TYPES[type];
      const pos = this.shopPos(i, G.shop.length, m, shopLayout);
      const quote = game && typeof game.shopPurchaseQuote === 'function'
        ? game.shopPurchaseQuote(type)
        : { canBuy: G.enthusiasm >= def.cost, credit: false, alert: 0, cost: def.cost, effectiveCost: def.cost, discount: 0 };
      const canBuy = canBuyNow && quote.canBuy;
      const creditBuy = canBuy && quote.credit;
      const discountBuy = canBuy && quote.discount > 0;
      const tipKey = `shop-${i}-${type}`;
      const tips = pirateCardEffectTips(type);
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
      const showTips = () => this._cardTips && this._cardTips.showForCard(cardCt, tips, { key: tipKey });
      if (!canBuy) cardCt.setAlpha(0.72);

      cardImg.on('pointerover', () => {
        this.tweens.add({
          targets: cardCt,
          scaleX: cardScale * 1.04,
          scaleY: cardScale * 1.04,
          duration: 120,
          ease: 'Sine.easeOut',
        });
        showTips();
      });
      cardImg.on('pointerout', () => {
        this.tweens.add({
          targets: cardCt,
          scaleX: cardScale,
          scaleY: cardScale,
          duration: 120,
          ease: 'Sine.easeOut',
        });
        if (this._cardTips) this._cardTips.hideForKey(tipKey);
      });
      cardImg.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        if (isTouchLikePointer(ptr) && !this._cardTips.isActiveFor(tipKey)) {
          if (showTips()) return;
        }
        if (!canBuy) return;
        if (this._cardTips) this._cardTips.hide();
        this.animateBuyTransition(i, m, cardScale);
      });

      const priceY = pos.y - (CARD.H * L.k * cardScale) / 2 - 28 * L.k;
      const footerY = pos.y + (CARD.H * L.k * cardScale) / 2 + 28 * L.k;
      const effectiveCost = quote.effectiveCost != null ? quote.effectiveCost : def.cost;
      const prepDiscount = Math.max(0, Math.floor(Number(quote.openingCounterPrepDiscount) || 0));
      const priceReduced = effectiveCost < Math.max(0, Math.floor(Number(def.cost) || 0));
      const coverage = Math.max(0, Math.floor(Number(quote.fullCrewCoverage) || 0));
      const tags = [];
      if (quote.counter) tags.push('Counter');
      if (quote.alarmRushedRouteCounter) tags.push('Alarm-rushed');
      if (quote.alarmRushedRouteCounter) tags.push('Watch');
      if (prepDiscount > 0) tags.push('Opening Prep -1☠️');
      if (quote.openingCounterPrepMight) tags.push('Prep +💪');
      if (quote.preparedCounter) tags.push('Prepared');
      if (quote.topDeck) tags.push('Top deck');
      if (coverage > 0) tags.push('Full Crew cover');
      const payoffLines = quote.counterPayoff && Array.isArray(quote.counterPayoff.shopLines)
        ? quote.counterPayoff.shopLines
        : [];
      const priceLine = priceReduced
        ? `${def.cost}☠️ -> ${effectiveCost}☠️`
        : `${def.cost}☠️`;
      const coveredLine = coverage > 0 ? `Full Crew covers ${coverage}☠️` : '';
      const planLine = quote.consumesOpeningCounterPlan && canBuy
        ? (quote.openingCounterPrepMight ? `Opening Prep${prepDiscount > 0 ? ` -${prepDiscount}☠️` : ''} +💪` : 'Opening Prep spent')
        : '';
      const priceText = [
        tags.length ? tags.join(' · ') : '',
        ...payoffLines,
        priceLine,
        coveredLine,
        planLine,
      ].filter(Boolean).join('\n');
      const price = this.add.text(pos.x, priceY, priceText, uiBodyStyle(L, priceReduced ? '#177C05' : UI_THEME.colors.ink, {
        fontSize: L.fs((payoffLines.length || coverage > 0 || quote.consumesOpeningCounterPlan) ? 10 : (quote.preparedCounter ? 11 : (quote.topDeck ? 12 : ((priceReduced || quote.counter) ? 13 : 14)))),
        align: 'center',
        lineSpacing: payoffLines.length ? -1 * L.k : -2 * L.k,
      }))
        .setOrigin(0.5, 0.5);
      this.panelLayer.add(price);

      const missing = quote.missing != null
        ? Math.max(0, Math.floor(Number(quote.missing) || 0))
        : Math.max(0, effectiveCost - Math.max(0, Math.floor(Number(G.enthusiasm) || 0)));
      const actionLabel = canBuy
        ? (creditBuy ? `Buy +${quote.alert} Alert` : (coverage > 0 ? 'Buy covered' : (quote.openingCounterPrepMight ? 'Buy prep' : (discountBuy ? `Buy -${quote.discount}☠️` : 'Buy'))))
        : (missing > 0 ? `Need ${missing}☠️` : 'Buy');
      const actionFill = canBuy
        ? (creditBuy ? UI_THEME.colors.outline : UI_THEME.colors.cocoa)
        : UI_THEME.colors.disabled;
      const actionTextColor = canBuy ? UI_THEME.colors.paper : UI_THEME.colors.ink;
      const action = makeUiPill(this, {
        x: pos.x,
        y: footerY,
        label: actionLabel,
        L,
        minW: (creditBuy ? 132 : (coverage > 0 ? 126 : (discountBuy ? 108 : 74))) * L.k,
        minH: 44 * L.k,
        fill: actionFill,
        textColor: actionTextColor,
        textPx: (creditBuy || discountBuy || coverage > 0) ? 14 : 16,
      });
      this.panelLayer.add(action);

      if (canBuy) {
        action.setInteractive({ useHandCursor: true });
        action.on('pointerover', () => action.setPillStyle({
          fill: UI_THEME.colors.cocoaDark,
          textColor: UI_THEME.colors.paper,
        }));
        action.on('pointerout', () => action.setPillStyle({ fill: actionFill, textColor: UI_THEME.colors.paper }));
        action.on('pointerdown', (ptr) => {
          ptr.event.stopPropagation();
          if (this._cardTips) this._cardTips.hide();
          this.animateBuyTransition(i, m, cardScale);
        });
      }
    });

    this.renderQuietDocks(m);
    this.renderContinueButton(m);
  }

  renderQuietDocks(panel) {
    if (G.phase !== 'shopping') return;
    const game = this.scene.get('game');
    if (!game || (typeof game.isBattleTest === 'function' && game.isBattleTest())) return;

    const L = this.L;
    const pendingAlert = typeof game.pendingBoardingAlert === 'function'
      ? game.pendingBoardingAlert()
      : Math.max(0, Math.floor(Number(G.boardingAlert) || 0));
    const alertSummary = typeof game.boardingAlertSummary === 'function'
      ? game.boardingAlertSummary(pendingAlert)
      : null;
    const cost = typeof game.quietDocksCost === 'function'
      ? game.quietDocksCost()
      : Math.max(0, Math.floor(Number((QUIET_DOCKS && QUIET_DOCKS.cost) || 2) || 0));
    const enabled = typeof game.canUseQuietDocks === 'function' && game.canUseQuietDocks();
    const y = panel.y + panel.h - 42 * L.k;
    const text = pendingAlert > 0
      ? (alertSummary || `Alert ${pendingAlert}`)
      : 'Alert 0 · seas quiet';

    const label = this.add.text(panel.x + 28 * L.k, y - 31 * L.k, text, {
      ...uiBodyStyle(L, UI_THEME.colors.ink),
      fontSize: L.fs(13),
      wordWrap: { width: Math.min(panel.w * 0.46, 260 * L.k) },
    }).setOrigin(0, 0.5);
    this.panelLayer.add(label);

    const action = makeUiPill(this, {
      x: panel.x + 28 * L.k,
      y,
      label: `Quiet Docks ${cost}☠️`,
      L,
      minW: 158 * L.k,
      minH: 42 * L.k,
      textPx: 15,
      fill: enabled ? UI_THEME.colors.cocoa : UI_THEME.colors.disabled,
      textColor: enabled ? UI_THEME.colors.paper : UI_THEME.colors.ink,
    });
    action.setPosition(panel.x + 28 * L.k + action.width / 2, y);
    this.panelLayer.add(action);

    if (!enabled) return;
    action.setInteractive({ useHandCursor: true });
    action.on('pointerover', () => action.setPillStyle({
      fill: UI_THEME.colors.cocoaDark,
      textColor: UI_THEME.colors.paper,
    }));
    action.on('pointerout', () => action.setPillStyle({
      fill: UI_THEME.colors.cocoa,
      textColor: UI_THEME.colors.paper,
    }));
    action.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      if (this._cardTips) this._cardTips.hide();
      if (game.useQuietDocks({ skipPanelRefresh: true })) this.renderPanel();
    });
  }

  renderContinueButton(panel) {
    if (G.phase !== 'shopping') return;
    const L = this.L;
    const game = this.scene.get('game');
    const enabled = !G.busy && !G.shopAnimating;
    const action = makeUiPill(this, {
      x: 0,
      y: panel.y + panel.h - 42 * L.k,
      label: 'Continue',
      L,
      minW: 132 * L.k,
      minH: 46 * L.k,
      fill: enabled ? UI_THEME.colors.cocoa : UI_THEME.colors.disabled,
      textColor: enabled ? UI_THEME.colors.paper : UI_THEME.colors.ink,
    });
    action.setPosition(panel.x + panel.w - 28 * L.k - action.width / 2, action.y);
    this.panelLayer.add(action);

    if (!enabled) return;
    action.setInteractive({ useHandCursor: true });
    action.on('pointerover', () => action.setPillStyle({
      fill: UI_THEME.colors.cocoaDark,
      textColor: UI_THEME.colors.paper,
    }));
    action.on('pointerout', () => action.setPillStyle({
      fill: UI_THEME.colors.cocoa,
      textColor: UI_THEME.colors.paper,
    }));
    action.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      game.handleShoppingContinue();
    });
  }

  animateGhostToPile(cardView, cardScale, kind = 'discard') {
    const game = this.scene.get('game');
    const target = game.pileButtonCenter(kind === 'draw' ? 'draw' : 'discard');
    const startX = cardView.container.x;
    const startY = cardView.container.y;
    const endRot = Phaser.Math.FloatBetween(-0.14, 0.14);
    const arcSign = target.x >= startX ? 1 : -1;
    const cpX = (startX + target.x) / 2 + arcSign * 56 * this.L.k;
    const cpY = Math.min(startY, target.y) - 110 * this.L.k;
    const endScale = Math.min(cardScale, 0.34);
    const dur = 460;

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: dur,
      ease: 'Cubic.easeInOut',
      onUpdate: (tw) => {
        if (!cardView.container || !cardView.container.scene) return;
        const p = tw.getValue();
        const q = 1 - p;
        const x = q * q * startX + 2 * q * p * cpX + p * p * target.x;
        const y = q * q * startY + 2 * q * p * cpY + p * p * target.y;
        cardView.container.setPosition(x, y);
        cardView.container.setRotation(Phaser.Math.Linear(0, endRot, p));
        const scale = Phaser.Math.Linear(cardScale, endScale, p);
        cardView.container.setScale(scale);
        cardView.container.setAlpha(Phaser.Math.Linear(1, 0.2, p));
      },
    });

    return dur;
  }

  animateBuyTransition(shopIdx, panel, cardScale = 1) {
    if (G.shopAnimating || G.phase !== 'shopping' || G.busy) return;
    const L = this.L;
    const game = this.scene.get('game');
    if (this._cardTips) this._cardTips.hide();
    const oldShop = [...G.shop];
    const oldN = oldShop.length;
    if (shopIdx < 0 || shopIdx >= oldN) return;

    const type = oldShop[shopIdx];
    const quote = game && typeof game.shopPurchaseQuote === 'function'
      ? game.shopPurchaseQuote(type)
      : { canBuy: G.enthusiasm >= TYPES[type].cost, credit: false, alert: 0 };
    if (!quote.canBuy) return;

    G.shopAnimating = true;

    const shopLayout = {
      cardScale,
      topPad: 150 * L.k,
      bottomPad: 100 * L.k,
      footerH: 52 * L.k,
      rowGap: 56 * L.k,
    };
    const firstPos = this.shopPos(0, oldN, panel, shopLayout);
    const lastPos = this.shopPos(oldN - 1, oldN, panel, shopLayout);
    const cardH = CARD.H * L.k * cardScale;
    const rowMask = this.add.graphics().setDepth(70);
    rowMask.fillStyle(uiColorInt(UI_THEME.colors.sand), 1);
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

    const bought = game.buyPirate(shopIdx, { deferRender: true, silent: true, ignoreAnimating: true });
    if (!bought) {
      G.shopAnimating = false;
      ghosts.forEach(g => {
        if (g.container) g.container.destroy();
      });
      rowMask.destroy();
      this.renderPanel();
      return;
    }
    const newN = G.shop.length;

    const removed = ghosts[shopIdx];
    const buyDur = this.animateGhostToPile(removed, cardScale, quote.topDeck ? 'draw' : 'discard');

    let ni = 0;
    for (let i = 0; i < oldN; i++) {
      if (i === shopIdx) continue;
      if (ni >= newN) break;
      const tp = this.shopPos(ni, newN, panel, shopLayout);
      this.tweens.add({
        targets: ghosts[i].container,
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
        targets: newGhost.container,
        x: lastNewPos.x,
        duration: dur,
        ease: 'Power2',
        delay: 30,
      });
    }

    this.time.delayedCall(Math.max(dur, buyDur) + 100, () => {
      ghosts.forEach(g => {
        if (g.container) g.container.destroy();
      });
      if (newGhost) {
        if (newGhost.container) newGhost.container.destroy();
      }
      rowMask.destroy();
      G.shopAnimating = false;
      const alertText = quote.credit && quote.alert > 0 ? ` +${quote.alert} Alert` : '';
      const discountText = quote.discount > 0 ? ` -${quote.discount}☠️` : '';
      const prepDiscountText = quote.openingCounterPrepDiscount > 0 ? ` -${quote.openingCounterPrepDiscount}☠️` : '';
      const coveredText = quote.fullCrewCoverage > 0 ? ` Full Crew covers ${quote.fullCrewCoverage}☠️` : '';
      const planText = quote.consumesOpeningCounterPlan
        ? (quote.openingCounterPrepMight ? ` Opening Prep${prepDiscountText} +💪` : ' Prep spent')
        : '';
      const preparedText = quote.preparedCounter ? ' Prepared' : '';
      const deckText = quote.topDeck ? ' Top deck' : '';
      game.float(game.L.cx, game.L.Y_ISL_CY - 40 * game.L.k, '+ ' + TYPES[type].name + '!' + discountText + coveredText + planText + alertText + preparedText + deckText, '#66bb6a');
      game.renderAll();
      this.renderPanel();
    });
  }
}
