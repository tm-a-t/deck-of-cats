/* ============================================================
   PIRATES — Start Menu Scene
   ============================================================ */

class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

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
      { label: 'Tutorial', cb: () => this.startTutorial() },
      { label: 'Costumes', cb: () => this.scene.start('costumes') },
      { label: 'All Pirates', cb: () => this.scene.start('allPirates') },
    ];
    const linksY = playY + 82 * L.k;
    links.forEach((item, idx) => {
      const link = this.add.text(L.cx, linksY + idx * 28 * L.k, item.label, uiBodyStyle(L, UI_THEME.colors.cocoa, {
        fontStyle: idx === 0 ? 'bold' : 'normal',
      })).setOrigin(0.5).setInteractive({ useHandCursor: true });
      link.on('pointerover', () => link.setColor(UI_THEME.colors.ink));
      link.on('pointerout', () => link.setColor(UI_THEME.colors.cocoa));
      link.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        item.cb();
      });
      this.root.add(link);
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

  startGame() {
    if (this.scene.isActive('map')) this.scene.stop('map');
    if (this.scene.isActive('shopModal')) this.scene.stop('shopModal');
    initState();
    this.scene.start('game');
  }

  startTutorial() {
    if (this.scene.isActive('map')) this.scene.stop('map');
    if (this.scene.isActive('shopModal')) this.scene.stop('shopModal');
    let tutorialReady = false;
    try {
      if (typeof initTutorialState === 'function') {
        initTutorialState();
        tutorialReady = true;
      } else if (typeof window !== 'undefined' && typeof window.initTutorialState === 'function') {
        window.initTutorialState();
        tutorialReady = true;
      }
    } catch (err) {
      console.error('Tutorial init failed:', err);
    }

    if (!tutorialReady) {
      initState();
    }

    this.scene.start('game');
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
      cb();
    });
    this.root.add(btn);
    return btn;
  }
}
