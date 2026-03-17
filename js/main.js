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

let isSyncingCanvasResolution = false;

function syncCanvasResolution(game) {
  if (!game || !game.canvas || !game.renderer || !game.scale) return;
  if (isSyncingCanvasResolution) return;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const vp = (typeof resolveViewportSize === 'function')
    ? resolveViewportSize(window.innerWidth || 0, window.innerHeight || 0)
    : { w: window.innerWidth || 0, h: window.innerHeight || 0 };
  const displayWidth = Math.round(vp.w || 0);
  const displayHeight = Math.round(vp.h || 0);
  const renderWidth = Math.round(displayWidth * dpr);
  const renderHeight = Math.round(displayHeight * dpr);

  if (!renderWidth || !renderHeight) return;

  const targetZoom = 1 / dpr;
  const needsZoom = Math.abs((game.scale.zoom || 0) - targetZoom) > 0.0001;
  const needsResize = game.scale.width !== renderWidth || game.scale.height !== renderHeight;

  if (!needsZoom && !needsResize) return;

  isSyncingCanvasResolution = true;
  try {
    if (needsZoom) {
      game.scale.setZoom(targetZoom);
    }
    if (needsResize) {
      game.scale.resize(renderWidth, renderHeight);
    }
  } finally {
    isSyncingCanvasResolution = false;
  }

  const scenes = (game.scene && Array.isArray(game.scene.scenes)) ? game.scene.scenes : [];
  for (const scene of scenes) {
    if (!scene || !scene.sys || !scene.sys.isActive() || !scene.cameras || !scene.cameras.main) continue;
    scene.cameras.main.setViewport(0, 0, renderWidth, renderHeight);
  }
}

function bootPhaserGame() {
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
    scene: [MenuScene, GameScene, MapScene, ShopScene, DrawPileScene, DiscardPileScene, CostumesScene, AllPiratesScene],
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
}

function waitForUiFonts() {
  if (!document.fonts || typeof document.fonts.load !== 'function') {
    return Promise.resolve();
  }

  return Promise.allSettled([
    document.fonts.load('64px "Amarante"'),
    document.fonts.load('14px "Lora"'),
    document.fonts.ready,
  ]).then(() => undefined);
}

waitForUiFonts().finally(() => {
  bootPhaserGame();
});
