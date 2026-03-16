/* ============================================================
   PIRATES — Boot
   ============================================================ */

if (window.PokiBridge) {
  window.PokiBridge.init();
}

function patchHiDpiText(resolution) {
  const snapTextToPixelGrid = (obj) => {
    if (!obj || !obj.scene || obj._isSnappingTextPosition) return obj;
    const objResolution = Math.max(1, obj.scene.game.config.resolution || resolution || 1);
    const left = obj.x - obj.displayOriginX;
    const top = obj.y - obj.displayOriginY;
    const snappedLeft = Math.round(left * objResolution) / objResolution;
    const snappedTop = Math.round(top * objResolution) / objResolution;

    obj._isSnappingTextPosition = true;
    obj.x = snappedLeft + obj.displayOriginX;
    obj.y = snappedTop + obj.displayOriginY;
    obj._isSnappingTextPosition = false;
    return obj;
  };

  const applyResolution = (obj) => {
    if (obj && typeof obj.setResolution === 'function') {
      obj.setResolution(resolution);
    }
    return snapTextToPixelGrid(obj);
  };

  const textProto = Phaser.GameObjects.Text.prototype;
  if (!textProto.__hidpiSnapPatched) {
    const originalSetOrigin = textProto.setOrigin;
    const originalSetPosition = textProto.setPosition;
    const originalSetText = textProto.setText;

    textProto.setOrigin = function () {
      return snapTextToPixelGrid(originalSetOrigin.apply(this, arguments));
    };
    textProto.setPosition = function () {
      return snapTextToPixelGrid(originalSetPosition.apply(this, arguments));
    };
    textProto.setText = function () {
      return snapTextToPixelGrid(originalSetText.apply(this, arguments));
    };
    textProto.__hidpiSnapPatched = true;
  }

  const factoryProto = Phaser.GameObjects.GameObjectFactory.prototype;
  if (!factoryProto.__hidpiTextPatched) {
    const originalFactoryText = factoryProto.text;
    factoryProto.text = function () {
      return applyResolution(originalFactoryText.apply(this, arguments));
    };
    factoryProto.__hidpiTextPatched = true;
  }

  const creatorProto = Phaser.GameObjects.GameObjectCreator.prototype;
  if (!creatorProto.__hidpiTextPatched) {
    const originalCreatorText = creatorProto.text;
    creatorProto.text = function () {
      return applyResolution(originalCreatorText.apply(this, arguments));
    };
    creatorProto.__hidpiTextPatched = true;
  }
}

function syncCanvasResolution(game) {
  if (!game || !game.canvas || !game.renderer || !game.scale) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const vp = (typeof resolveViewportSize === 'function')
    ? resolveViewportSize(window.innerWidth || 0, window.innerHeight || 0)
    : { w: window.innerWidth || 0, h: window.innerHeight || 0 };
  const displayWidth = Math.round(vp.w || 0);
  const displayHeight = Math.round(vp.h || 0);
  const renderWidth = Math.round(displayWidth * dpr);
  const renderHeight = Math.round(displayHeight * dpr);

  if (!renderWidth || !renderHeight) return;

  game.scale.setZoom(1 / dpr);
  game.scale.resize(renderWidth, renderHeight);

  const scenes = (game.scene && Array.isArray(game.scene.scenes)) ? game.scene.scenes : [];
  for (const scene of scenes) {
    if (!scene || !scene.sys || !scene.sys.isActive() || !scene.cameras || !scene.cameras.main) continue;
    scene.cameras.main.setViewport(0, 0, renderWidth, renderHeight);
  }

  if (typeof window !== 'undefined') {
    window.__PHASER_RESOLUTION_DEBUG__ = {
      dpr,
      zoom: 1 / dpr,
      renderWidth,
      renderHeight,
      displayWidth,
      displayHeight,
      canvasWidth: game.canvas.width,
      canvasHeight: game.canvas.height,
      clientWidth: game.canvas.clientWidth,
      clientHeight: game.canvas.clientHeight,
    };
  }
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

const dpr = Math.max(1, window.devicePixelRatio || 1);
const initialViewport = (typeof resolveViewportSize === 'function')
  ? resolveViewportSize(window.innerWidth || 0, window.innerHeight || 0)
  : { w: window.innerWidth || 0, h: window.innerHeight || 0 };

patchHiDpiText(dpr);

const phaserGame = new Phaser.Game({
  type: Phaser.AUTO,
  antialias: true,
  roundPixels: false,
  resolution: dpr,
  scale: {
    parent: 'game',
    mode: Phaser.Scale.NONE,
    width: Math.round((initialViewport.w || 0) * dpr),
    height: Math.round((initialViewport.h || 0) * dpr),
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
    zoom: 1 / dpr,
  },
  scene: [MenuScene, GameScene, MapScene, ShopScene, CostumesScene, AllPiratesScene],
});

phaserGame.scale.on('resize', () => {
  syncCanvasResolution(phaserGame);
});

window.addEventListener('resize', () => {
  syncCanvasResolution(phaserGame);
});

window.addEventListener('orientationchange', () => {
  syncCanvasResolution(phaserGame);
});

requestAnimationFrame(() => {
  syncCanvasResolution(phaserGame);
});

if (typeof window !== 'undefined') {
  window.__PHASER_GAME__ = phaserGame;
}
