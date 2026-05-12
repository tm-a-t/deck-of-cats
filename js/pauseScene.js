/* ============================================================
   PIRATES — Pause Overlay Scene
   ============================================================ */

class PauseScene extends Phaser.Scene {
  constructor() { super('pauseModal'); }

  create(data = {}) {
    this.payload = Object.assign({ version: GAME_VERSION }, data);
    this.L = computeLayout(this.scale.width, this.scale.height);

    this.renderPauseMenu();

    this._onResize = () => {
      this.L = computeLayout(this.scale.width, this.scale.height);
      this.scene.restart(this.payload);
    };
    this.scale.on('resize', this._onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize);
    });
  }

  renderPauseMenu() {
    const L = this.L;

    const blocker = this.add.rectangle(0, 0, L.W, L.H, 0x000000, 0.58)
      .setOrigin(0, 0)
      .setInteractive();
    blocker.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
    });

    const w = Math.min(520 * L.k, L.W - 56 * L.k);
    const h = Math.min(360 * L.k, L.H - 120 * L.k);
    const x = L.cx - w / 2;
    const y = L.H * 0.23;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.34);
    shadow.fillRoundedRect(x + 8 * L.k, y + 10 * L.k, w, h, 22 * L.k);

    const paper = this.add.graphics();
    paper.fillStyle(uiColorInt(UI_THEME.colors.sand), 1);
    paper.fillRoundedRect(x, y, w, h, 22 * L.k);
    paper.lineStyle(4, uiColorInt(UI_THEME.colors.cocoa), 1);
    paper.strokeRoundedRect(x, y, w, h, 22 * L.k);

    this.add.text(L.cx, y + 28 * L.k, 'Paused', uiHeadingStyle(L, 34, UI_THEME.colors.ink))
      .setOrigin(0.5, 0);

    this.add.text(L.cx, y + 78 * L.k, `Version ${this.payload.version}`, uiBodyStyle(L, UI_THEME.colors.cocoa, {
      align: 'center',
    })).setOrigin(0.5, 0);

    const resumeBtn = makeUiPill(this, {
      x: L.cx,
      y: y + h - 110 * L.k,
      label: 'Resume',
      L,
      minW: 190 * L.k,
      minH: 56 * L.k,
      fill: UI_THEME.colors.cocoa,
      textColor: UI_THEME.colors.paper,
      textPx: 18,
    }).setInteractive({ useHandCursor: true });
    resumeBtn.on('pointerover', () => resumeBtn.setPillStyle({
      fill: UI_THEME.colors.cocoaDark,
      textColor: UI_THEME.colors.paper,
    }));
    resumeBtn.on('pointerout', () => resumeBtn.setPillStyle({
      fill: UI_THEME.colors.cocoa,
      textColor: UI_THEME.colors.paper,
    }));
    resumeBtn.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      playSfx(this, 'button');
      this.resumeGame();
    });

    const abandonBtn = makeUiPill(this, {
      x: L.cx,
      y: y + h - 44 * L.k,
      label: 'Abandon Game',
      L,
      minW: 220 * L.k,
      minH: 56 * L.k,
      fill: UI_THEME.colors.cocoa,
      textColor: UI_THEME.colors.paper,
      textPx: 18,
    }).setInteractive({ useHandCursor: true });
    abandonBtn.on('pointerover', () => abandonBtn.setPillStyle({
      fill: UI_THEME.colors.cocoaDark,
      textColor: UI_THEME.colors.paper,
    }));
    abandonBtn.on('pointerout', () => abandonBtn.setPillStyle({
      fill: UI_THEME.colors.cocoa,
      textColor: UI_THEME.colors.paper,
    }));
    abandonBtn.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      playSfx(this, 'button');
      this.abandonGame();
    });
  }

  resumeGame() {
    if (window.PokiBridge) {
      window.PokiBridge.gameplayStart();
    }
    this.scene.resume('game');
    this.scene.stop();
  }

  abandonGame() {
    if (window.PokiBridge) {
      window.PokiBridge.gameplayStop();
    }
    ['map', 'shopModal', 'drawPileModal', 'discardPileModal', 'game'].forEach((key) => {
      if (this.scene.isActive(key) || this.scene.isPaused(key)) {
        this.scene.stop(key);
      }
    });
    this.scene.start('menu');
  }
}
