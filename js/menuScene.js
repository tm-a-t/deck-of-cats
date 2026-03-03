/* ============================================================
   PIRATES — Start Menu Scene
   ============================================================ */

class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    this.cameras.main.setBackgroundColor(BG_COLOR);
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

    const title = this.add.text(L.cx, L.H * 0.22, 'Deck of Cats', {
      fontFamily: 'monospace',
      fontSize: L.fsPx(72),
      color: '#d7c08f',
      stroke: '#31220f',
      strokeThickness: 8 * L.k,
    }).setOrigin(0.5);
    this.root.add(title);

    const sub = this.add.text(L.cx, L.H * 0.29, 'Deck Builder', {
      fontFamily: 'monospace',
      fontSize: L.fsPx(30),
      color: '#9fc3e0',
    }).setOrigin(0.5);
    this.root.add(sub);

    const ship = this.add.text(L.cx, L.H * 0.38, '🚢 ☠️ ⚓', {
      fontFamily: 'monospace',
      fontSize: L.fsPx(40),
      color: '#ffffff',
    }).setOrigin(0.5);
    this.root.add(ship);

    const startY = L.H * 0.54;
    const gap = 90 * L.k;
    this.mkBtn(L.cx, startY, 'Start', () => this.startGame(), {
      bg: '#1e4535',
      hoverBg: '#2a6545',
      color: '#d7f0d7',
    });
    this.mkBtn(L.cx, startY + gap, 'Tutorial', () => this.startTutorial(), {
      bg: '#2b3f52',
      hoverBg: '#35536f',
      color: '#d1e4f8',
    });
    this.mkBtn(L.cx, startY + gap * 2, 'Costumes', () => this.scene.start('costumes'), {
      bg: '#3b2b42',
      hoverBg: '#553d5f',
      color: '#e4d1f8',
    });
    this.mkBtn(L.cx, startY + gap * 3, 'All Pirates', () => this.scene.start('allPirates'), {
      bg: '#42352b',
      hoverBg: '#5f4d35',
      color: '#f8ddd1',
    });

    const streak = getStreak();
    const streakLabel = `Streak: ${streak} day${streak !== 1 ? 's' : ''}`;
    const streakTxt = this.add.text(L.cx, L.H * 0.44, streakLabel, {
      fontFamily: 'monospace',
      fontSize: L.fsPx(22),
      color: streak >= 7 ? '#ffd740' : streak >= 3 ? '#ffab40' : '#8da0b3',
    }).setOrigin(0.5);
    this.root.add(streakTxt);

    const hint = this.add.text(L.cx, L.H * 0.82,
      'Hire pirates, arm your ship, and win boardings',
      {
        fontFamily: 'monospace',
        fontSize: L.fsPx(20),
        color: '#8da0b3',
        wordWrap: { width: L.W - 80 * L.k },
        align: 'center',
      }).setOrigin(0.5);
    this.root.add(hint);
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
    const L = this.L;
    const bg = opts.bg || '#1e4535';
    const hoverBg = opts.hoverBg || '#2a6545';
    const color = opts.color || '#d7f0d7';
    const btn = this.add.text(x, y, label, {
      fontFamily: 'monospace',
      fontSize: L.fsPx(30),
      color,
      backgroundColor: bg,
      padding: { x: 42 * L.k, y: 18 * L.k },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: hoverBg }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: bg }));
    btn.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      cb();
    });
    this.root.add(btn);
    return btn;
  }
}
