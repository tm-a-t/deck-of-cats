/* ============================================================
   PIRATES — Boot
   ============================================================ */

if (window.PokiBridge) {
  window.PokiBridge.init();
}

function applyViewportMode() {
  const w = window.innerWidth || 0;
  const h = window.innerHeight || 0;
  const vp = (typeof resolveViewportSize === 'function') ? resolveViewportSize(w, h) : { w, h };
  const isMobileViewport = isPortraitMobile(w, h);
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('mobile-mode', isMobileViewport);
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.viewportMode = isMobileViewport ? 'mobile' : 'desktop';
  }
  window.__VIEWPORT_MODE__ = isMobileViewport ? 'mobile' : 'desktop';
  window.__VIEWPORT_MODE_DEBUG__ = {
    windowWidth: w,
    windowHeight: h,
    checkWidth: vp.w,
    checkHeight: vp.h,
    aspect: vp.w > 0 ? (vp.h / vp.w) : 0,
    isMobile: isMobileViewport,
  };
}

applyViewportMode();
window.addEventListener('resize', applyViewportMode);
window.addEventListener('orientationchange', applyViewportMode);

const phaserGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 1 / window.devicePixelRatio,
  },
  scene: [GameScene, MapScene, ShopScene, PauseScene, MenuScene, CostumesScene, AllPiratesScene],
});

if (typeof window !== 'undefined') {
  window.__PHASER_GAME__ = phaserGame;
}
