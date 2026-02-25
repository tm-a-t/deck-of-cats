/* ============================================================
   PIRATES — Boot
   ============================================================ */

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 1 / window.devicePixelRatio,
  },
  scene: [MenuScene, GameScene, MapScene, ShopScene],
});
