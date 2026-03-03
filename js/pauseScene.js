/* ============================================================
   PIRATES — Pause Menu Scene
   ============================================================ */

class PauseScene extends Phaser.Scene {
  constructor() { super('pauseMenu'); }

  create() {
    this.L = computeLayout(this.scale.width, this.scale.height);
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

    const blocker = this.add.rectangle(0, 0, L.W, L.H, 0x000000, 0.58)
      .setOrigin(0, 0)
      .setInteractive();
    blocker.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
    });

    const continueBtn = this.add.text(L.cx, L.H * 0.48, 'Continue', {
      fontFamily: 'monospace',
      fontSize: L.fs(34),
      color: '#d7f0d7',
      backgroundColor: '#1e4535',
      padding: { x: 46 * L.k, y: 24 * L.k },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    continueBtn.on('pointerover', () => continueBtn.setStyle({ backgroundColor: '#2a6545' }));
    continueBtn.on('pointerout', () => continueBtn.setStyle({ backgroundColor: '#1e4535' }));
    continueBtn.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      this.resumeGame();
    });

    const restartBtn = this.add.text(L.cx, L.H * 0.58, 'Restart', {
      fontFamily: 'monospace',
      fontSize: L.fs(30),
      color: '#ffd8d8',
      backgroundColor: '#5a2525',
      padding: { x: 42 * L.k, y: 20 * L.k },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerover', () => restartBtn.setStyle({ backgroundColor: '#7a3030' }));
    restartBtn.on('pointerout', () => restartBtn.setStyle({ backgroundColor: '#5a2525' }));
    restartBtn.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      this.restartGame();
    });
  }

  resumeGame() {
    if (window.PokiBridge) window.PokiBridge.gameplayStart();
    this.scene.stop();
    this.scene.resume('game');
  }

  restartGame() {
    this.scene.stop();
    this.scene.resume('game');
    const game = this.scene.get('game');
    if (game && typeof game.restartCurrentRun === 'function') {
      game.restartCurrentRun();
    }
  }
}
