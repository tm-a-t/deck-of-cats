/* ============================================================
   PIRATES — Start Menu Scene
   ============================================================ */

class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  preload() {
    if (typeof preloadSfx === 'function') preloadSfx(this);
  }

  create() {
    this.cameras.main.setBackgroundColor(UI_THEME.colors.sand);
    this.L = computeLayout(this.scale.width, this.scale.height);

    this.root = this.add.container(0, 0);

    this.renderMenu();

    this._onResize = () => {
      this.L = computeLayout(this.scale.width, this.scale.height);
      this.scene.restart();
    };
    this.scale.on('resize', this._onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize);
    });
  }

  renderMenu() {
    const L = this.L;

    const titleY = L.H * 0.46;
    const title = this.add.text(L.cx, titleY, 'Deck of Cats', uiHeadingStyle(L, 64, UI_THEME.colors.ink, {
      align: 'center',
      wordWrap: { width: Math.min(L.W - 72 * L.k, 560 * L.k) },
    })).setOrigin(0.5, 1);
    this.root.add(title);

    const playY = titleY + 74 * L.k;
    this.mkBtn(L.cx, playY, 'Play', () => this.startGame(), {
      minW: 160 * L.k,
      minH: 66 * L.k,
    });

    const links = [
      { label: 'Battle Test', cb: () => this.startBattleTest() },
      { label: 'Costumes', cb: () => this.scene.start('costumes') },
      { label: 'All Pirates', cb: () => this.scene.start('allPirates') },
      { label: 'Survey', cb: () => this.openSurvey() },
    ];
    const linksY = playY + 78 * L.k;
    links.forEach((item, idx) => {
      this.mkTextBtn(L.cx, linksY + idx * 28 * L.k, item.label, item.cb);
    });

    const streak = getStreak();
    const streakLabel = `Streak: ${streak} day${streak !== 1 ? 's' : ''}`;
    const streakTxt = this.add.text(L.cx, L.H - 54 * L.k, streakLabel, uiBodyStyle(L, UI_THEME.colors.cocoa))
      .setOrigin(0.5)
      .setAlpha(0.85);
    this.root.add(streakTxt);

    const versionTxt = this.add.text(L.W - 18 * L.k, L.H - 18 * L.k, `v${GAME_VERSION}`, uiBodyStyle(L, UI_THEME.colors.cocoa))
      .setOrigin(1, 1)
      .setAlpha(0.7);
    this.root.add(versionTxt);
  }

  resetGameScenes() {
    ['map', 'shopModal', 'drawPileModal', 'discardPileModal'].forEach((key) => {
      if (this.scene.isActive(key)) this.scene.stop(key);
    });
  }

  startGame() {
    this.resetGameScenes();
    initState();
    this.scene.start('game');
  }

  startBattleTest() {
    this.resetGameScenes();
    initBattleTestState();
    this.scene.start('game');
  }

  openSurvey() {
    const url = this.getSurveyUrl();
    if (typeof window === 'undefined') return;
    const popup = typeof window.open === 'function'
      ? window.open(url, '_blank', 'noopener,noreferrer')
      : null;
    if (!popup && window.location) window.location.assign(url);
  }

  getSurveyUrl() {
    return `https://docs.google.com/forms/d/e/1FAIpQLScEAnKUl-glUgItxfcCDSrcqFNn07DhO5ipk-EzOtM2bTvo8Q/viewform?usp=pp_url&entry.67414477=${encodeURIComponent(GAME_VERSION)}`;
  }

  mkBtn(x, y, label, cb, opts = {}) {
    const btn = makeUiPill(this, {
      x,
      y,
      label,
      L: this.L,
      minW: opts.minW,
      minH: opts.minH,
      fill: opts.bg || UI_THEME.colors.cocoa,
      textColor: opts.color || UI_THEME.colors.paper,
      textPx: opts.textPx || 24,
    }).setInteractive({ useHandCursor: true });
    const hoverFill = opts.hoverBg || UI_THEME.colors.cocoaDark;
    btn.on('pointerover', () => btn.setPillStyle({
      fill: hoverFill,
      textColor: opts.color || UI_THEME.colors.paper,
    }));
    btn.on('pointerout', () => btn.setPillStyle({
      fill: opts.bg || UI_THEME.colors.cocoa,
      textColor: opts.color || UI_THEME.colors.paper,
    }));
    btn.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      playSfx(this, 'button');
      cb();
    });
    this.root.add(btn);
    return btn;
  }

  mkTextBtn(x, y, label, cb, opts = {}) {
    const style = Object.assign(
      {},
      uiBodyStyle(this.L, opts.color || UI_THEME.colors.cocoa, {
        fontStyle: opts.fontStyle || 'normal',
      }),
      opts.textStyle || {}
    );
    const text = this.add.text(x, y, label, style)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const hoverColor = opts.hoverColor || UI_THEME.colors.ink;
    text.on('pointerover', () => text.setColor(hoverColor));
    text.on('pointerout', () => text.setColor(opts.color || UI_THEME.colors.cocoa));
    text.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      playSfx(this, 'button');
      cb();
    });
    this.root.add(text);
    return text;
  }
}
