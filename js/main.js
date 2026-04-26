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

function buildDeckOfCatsTestState(game) {
  const state = (typeof G !== 'undefined') ? G : null;
  const sceneKeys = game && game.scene && Array.isArray(game.scene.scenes)
    ? game.scene.scenes
      .filter(scene => scene && scene.sys && scene.sys.isActive())
      .map(scene => scene.scene && scene.scene.key)
      .filter(Boolean)
    : [];
  const hand = state && Array.isArray(state.hand) ? state.hand : [];
  const crew = state && Array.isArray(state.allCrew) ? state.allCrew : [];
  const woundedCrew = crew.filter(pirate => pirate && pirate.wounded).length;
  const combat = state && state.combat ? state.combat : null;
  const mapAvailable = state && state.map && typeof getAvailableNodes === 'function'
    ? getAvailableNodes(state.map)
    : [];

  return {
    activeScenes: sceneKeys,
    mode: state ? state.mode || 'run' : null,
    phase: state ? state.phase || null : null,
    round: state ? state.round || 0 : 0,
    layer: state && state.map ? state.map.currentLayer : null,
    resources: state && state.res ? { ...state.res } : { wood: 0, stone: 0, gold: 0 },
    enthusiasm: state ? state.enthusiasm || 0 : 0,
    alert: state ? state.boardingAlert || 0 : 0,
    boardingCount: state ? state.boardingCount || 0 : 0,
    gameOver: !!(state && state.gameOver),
    crew: {
      total: crew.length,
      ready: crew.length - woundedCrew,
      wounded: woundedCrew,
    },
    hand: hand.map((pirate, index) => ({
      index,
      id: pirate && pirate.id,
      type: pirate && pirate.type,
      wounded: !!(pirate && pirate.wounded),
      weapon: pirate && pirate.weaponKey || null,
    })),
    sent: state && Array.isArray(state.sent) ? [...state.sent] : [],
    shop: state && Array.isArray(state.shop) ? [...state.shop] : [],
    mapAvailable,
    island: state && state.island ? {
      name: state.island.name || null,
      maxSend: state.island.maxSend || null,
    } : null,
    combat: combat ? {
      mode: combat.mode || null,
      result: combat.result || null,
      enemyName: combat.enemyName || null,
      encounterDesc: combat.encounterDesc || null,
      alert: combat.boardingAlert || 0,
      guards: combat.boardingAlertGuards || 0,
      enemies: Array.isArray(combat.enemyParty)
        ? combat.enemyParty.filter(Boolean).map(enemy => ({
          name: enemy.name || enemy.key || null,
          hp: enemy.hp || 0,
          damage: enemy.damage || 0,
          range: enemy.range || null,
        }))
        : [],
    } : null,
  };
}

function installDeckOfCatsTestHook(game) {
  window.__deckOfCatsTest = {
    game,
    getState: () => buildDeckOfCatsTestState(game),
  };
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
    scene: [MenuScene, GameScene, MapScene, ShopScene, DrawPileScene, DiscardPileScene, PauseScene, CostumesScene, AllPiratesScene],
  });
  installDeckOfCatsTestHook(phaserGame);

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
