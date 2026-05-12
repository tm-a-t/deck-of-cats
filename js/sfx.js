/* ============================================================
   PIRATES — Sound Effects
   Small action-only SFX layer for UI and card interactions.
   ============================================================ */

const SFX_DEFS = {
  button: {
    key: 'sfx_button_click',
    path: 'sounds/button_click.ogg',
    volume: 0.18,
    rate: [0.96, 1.04],
    cooldown: 45,
  },
  cardPickup: {
    key: 'sfx_card_pickup',
    path: 'sounds/card_pickup.wav',
    volume: 0.16,
    rate: [0.96, 1.05],
    cooldown: 70,
  },
  cardPlace: {
    key: 'sfx_card_place',
    path: 'sounds/card_place.wav',
    volume: 0.18,
    rate: [0.95, 1.06],
    cooldown: 70,
  },
  cardReturn: {
    key: 'sfx_card_place',
    path: 'sounds/card_place.wav',
    volume: 0.08,
    rate: [0.84, 0.94],
    cooldown: 80,
  },
  panelOpen: {
    key: 'sfx_panel_open',
    path: 'sounds/panel_open.ogg',
    volume: 0.15,
    rate: [0.96, 1.02],
    cooldown: 110,
  },
  shopBuy: {
    key: 'sfx_shop_buy',
    path: 'sounds/shop_buy.ogg',
    volume: 0.18,
    rate: [0.97, 1.04],
    cooldown: 160,
  },
  mapSelect: {
    key: 'sfx_map_select',
    path: 'sounds/map_select.ogg',
    volume: 0.16,
    rate: [0.95, 1.05],
    cooldown: 120,
  },
  shuffle: {
    key: 'sfx_shuffle',
    path: 'sounds/shuffle.wav',
    volume: 0.22,
    rate: [0.98, 1.02],
    cooldown: 520,
  },
  resourceWood: {
    key: 'sfx_resource_wood',
    path: 'sounds/resource_wood.ogg',
    volume: 0.16,
    rate: [0.93, 1.04],
    cooldown: 220,
  },
  resourceStone: {
    key: 'sfx_resource_stone',
    path: 'sounds/resource_stone.ogg',
    volume: 0.15,
    rate: [0.92, 1.03],
    cooldown: 220,
  },
  resourceTreasure: {
    key: 'sfx_resource_treasure',
    path: 'sounds/resource_treasure.ogg',
    volume: 0.13,
    rate: [0.96, 1.06],
    cooldown: 240,
  },
};

function sfxAudioCacheHas(scene, key) {
  const cache = scene && scene.cache && scene.cache.audio;
  if (!cache) return false;
  if (typeof cache.exists === 'function') return cache.exists(key);
  if (typeof cache.has === 'function') return cache.has(key);
  if (typeof cache.get === 'function') return !!cache.get(key);
  return false;
}

function preloadSfx(scene) {
  if (!scene || !scene.load) return;
  const seen = new Set();
  Object.values(SFX_DEFS).forEach((def) => {
    if (!def || seen.has(def.key) || sfxAudioCacheHas(scene, def.key)) return;
    seen.add(def.key);
    scene.load.audio(def.key, def.path);
  });
}

function sfxNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function sfxPickRange(value) {
  if (Array.isArray(value)) {
    const lo = Number(value[0]);
    const hi = Number(value[1]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      return lo + Math.random() * (hi - lo);
    }
  }
  return value;
}

function playSfx(scene, name, opts = {}) {
  const def = SFX_DEFS[name];
  if (!def || !scene || !scene.sound) return false;
  if (scene.sound.locked) return false;
  if (!sfxAudioCacheHas(scene, def.key)) return false;

  const now = sfxNow();
  const cooldown = opts.cooldown != null ? opts.cooldown : (def.cooldown || 0);
  const lastByName = playSfx._lastByName || (playSfx._lastByName = {});
  if (cooldown > 0 && lastByName[name] && now - lastByName[name] < cooldown) {
    return false;
  }

  const config = {
    volume: opts.volume != null ? opts.volume : def.volume,
  };
  const rate = sfxPickRange(opts.rate != null ? opts.rate : def.rate);
  if (rate != null) config.rate = rate;
  const detune = sfxPickRange(opts.detune != null ? opts.detune : def.detune);
  if (detune != null) config.detune = detune;

  try {
    scene.sound.play(def.key, config);
    lastByName[name] = now;
    return true;
  } catch (err) {
    return false;
  }
}
