/* ============================================================
   PIRATES — Game State
   ============================================================ */

let uid = 0;
function mkP(type, opts = {}) {
  return {
    id: uid++,
    type,
    weaponKey: WEAPON_TYPES[opts.weaponKey] ? opts.weaponKey : null,
    might: Math.max(0, Math.floor(Number(opts.might) || 0)),
    tempo: Math.max(0, Math.floor(Number(opts.tempo) || 0)),
    wounded: !!opts.wounded,
  };
}

function getStreak() {
  const key = 'pirates_streak';
  const today = new Date().toISOString().slice(0, 10);
  let data;
  try { data = JSON.parse(localStorage.getItem(key)); } catch (_) {}
  if (!data || !data.lastDate) {
    data = { streak: 1, lastDate: today };
  } else if (data.lastDate === today) {
    // already counted today
  } else {
    const last = new Date(data.lastDate + 'T00:00:00');
    const now = new Date(today + 'T00:00:00');
    const diffDays = Math.round((now - last) / 86400000);
    data.streak = diffDays === 1 ? data.streak + 1 : 1;
    data.lastDate = today;
  }
  localStorage.setItem(key, JSON.stringify(data));
  return data.streak;
}

function shopMaxCostForRound(round) {
  return Math.max(3, Math.floor(Number(round) || 0) + 1);
}

function shopEligiblePool(round) {
  const maxCost = shopMaxCostForRound(round);
  return SHOP_POOL.filter(t => TYPES[t] && TYPES[t].cost <= maxCost);
}

function shopGenerationState(opts = {}) {
  if (opts && opts.state) return opts.state;
  return (typeof G !== 'undefined') ? G : null;
}

function nextScoutedShipNodeForMap(map, opts = {}) {
  if (!map || !Array.isArray(map.layers)) return null;
  const currentLayer = Number.isFinite(opts.currentLayer)
    ? opts.currentLayer
    : (Number.isFinite(map.currentLayer) ? map.currentLayer : -1);

  for (let li = Math.max(0, currentLayer + 1); li < map.layers.length; li++) {
    const layer = map.layers[li];
    if (!layer || layer.length !== 1 || layer[0].type !== 'ship') continue;
    return { node: layer[0], layerIdx: li };
  }
  return null;
}

function scoutedCounterTypesForMap(map, opts = {}) {
  const info = nextScoutedShipNodeForMap(map, opts);
  const mainKey = info && info.node && info.node.encounter && info.node.encounter.mainKey;
  const counters = (SCOUTED_SHIP_COUNTERS && SCOUTED_SHIP_COUNTERS[mainKey]) || [];
  return counters.filter(t => SHOP_POOL.includes(t) && TYPES[t]);
}

function isScoutedCounterShopType(type, map, opts = {}) {
  if (!type) return false;
  return scoutedCounterTypesForMap(map, opts).includes(type);
}

function scoutedCounterShopEnabled(opts = {}) {
  if (opts.disableScoutedCounter) return false;
  const state = shopGenerationState(opts);
  const mode = opts.mode || (state && state.mode);
  return mode !== 'battleTest';
}

function shopMapForGeneration(opts = {}) {
  if (opts.map) return opts.map;
  const state = shopGenerationState(opts);
  return state && state.map;
}

function maybeScoutedCounterShopType(round, pickedType, visibleTypes = [], opts = {}) {
  if (!scoutedCounterShopEnabled(opts)) return pickedType;

  const map = shopMapForGeneration(opts);
  const counters = scoutedCounterTypesForMap(map, opts);
  if (!counters.length) return pickedType;

  const visible = Array.isArray(visibleTypes) ? visibleTypes.filter(Boolean) : [];
  const fullVisible = pickedType ? [...visible, pickedType] : [...visible];
  if (fullVisible.some(t => counters.includes(t))) return pickedType;

  const maxCost = shopMaxCostForRound(round);
  const visibleSet = new Set(visible);
  const eligibleCounters = counters.filter(t =>
    TYPES[t]
    && TYPES[t].cost <= maxCost
    && !visibleSet.has(t)
  );
  if (!eligibleCounters.length) return pickedType;
  return Phaser.Utils.Array.GetRandom(eligibleCounters);
}

function applyScoutedCounterToShop(shop, round, opts = {}) {
  const out = Array.isArray(shop) ? [...shop] : [];
  if (!out.length) return out;
  const rawIndex = Number.isFinite(opts.newSlotIndex) ? Math.floor(opts.newSlotIndex) : out.length - 1;
  const newSlotIndex = Phaser.Math.Clamp(rawIndex, 0, out.length - 1);
  const visibleBefore = out.filter((_, index) => index !== newSlotIndex);
  out[newSlotIndex] = maybeScoutedCounterShopType(round, out[newSlotIndex], visibleBefore, opts);
  return out;
}

function starterShopCounterSlotIndex(shop, round, opts = {}) {
  const visible = Array.isArray(shop) ? shop.filter(Boolean) : [];
  if (!visible.length) return 0;
  const counters = new Set(scoutedCounterTypesForMap(shopMapForGeneration(opts), opts)
    .filter(t => TYPES[t] && TYPES[t].cost <= shopMaxCostForRound(round)));
  if (!counters.size || visible.some(t => counters.has(t))) return visible.length - 1;

  for (const lane of STARTER_SHOP_LANES) {
    if (!lane.some(t => counters.has(t))) continue;
    const idx = visible.findIndex(t => lane.includes(t) && !counters.has(t));
    if (idx >= 0) return idx;
  }
  return visible.length - 1;
}

function randomShopType(round, excludeTypes = [], opts = {}) {
  const eligiblePool = shopEligiblePool(round);
  const basePool = eligiblePool.length ? eligiblePool : SHOP_POOL;
  const exclude = new Set(Array.isArray(excludeTypes) ? excludeTypes : []);
  const distinctPool = basePool.filter(t => !exclude.has(t));
  const pool = distinctPool.length ? distinctPool : basePool;
  const picked = Phaser.Utils.Array.GetRandom(pool.length ? pool : SHOP_POOL);
  return maybeScoutedCounterShopType(round, picked, excludeTypes, opts);
}

function openingStarterShopMainKey(opts = {}) {
  const info = nextScoutedShipNodeForMap(shopMapForGeneration(opts), opts);
  return info && info.node && info.node.encounter && info.node.encounter.mainKey;
}

function starterShopTypeFromLane(lane, opts = {}) {
  const pool = lane.filter(t => SHOP_POOL.includes(t) && TYPES[t] && TYPES[t].cost <= 3);
  if (
    opts.mode !== 'battleTest'
    && lane.includes('poisoner')
    && lane.includes('drummer')
    && pool.includes('poisoner')
    && openingStarterShopMainKey(opts) === 'shellback'
  ) {
    return 'poisoner';
  }
  return Phaser.Utils.Array.GetRandom(pool);
}

function starterShop(opts = {}) {
  const picks = STARTER_SHOP_LANES.map(lane => starterShopTypeFromLane(lane, opts)).filter(Boolean);
  return Phaser.Utils.Array.Shuffle(picks);
}

function initialShop(n, round, opts = {}) {
  if (round === 0 && n === STARTER_SHOP_LANES.length) {
    const shop = starterShop(opts);
    return applyScoutedCounterToShop(shop, round, {
      ...opts,
      newSlotIndex: starterShopCounterSlotIndex(shop, round, opts),
    });
  }
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(randomShopType(round, arr, opts));
  return arr;
}

function battleTestTypePool() {
  return Object.keys(TYPES);
}

function randomBattleTestType() {
  const pool = battleTestTypePool();
  return Phaser.Utils.Array.GetRandom(pool.length ? pool : Object.keys(TYPES));
}

function buildBattleTestCrew(count) {
  const crew = [];
  const fighterCount = Math.max(3, Number(count) || 0);
  for (let i = 0; i < fighterCount; i++) crew.push(mkP(randomBattleTestType()));
  return crew;
}

function cloneBattleTestPirate(pirate) {
  if (!pirate || !TYPES[pirate.type]) return null;
  const cloned = mkP(pirate.type);
  if (pirate.id != null) cloned.id = pirate.id;
  cloned.weaponKey = WEAPON_TYPES[pirate.weaponKey] ? pirate.weaponKey : null;
  cloned.might = Math.max(0, Math.floor(Number(pirate.might) || 0));
  cloned.tempo = Math.max(0, Math.floor(Number(pirate.tempo) || 0));
  cloned.wounded = !!pirate.wounded;
  return cloned;
}

function cloneBattleTestCrew(crew) {
  if (!Array.isArray(crew)) return [];
  return crew.map(cloneBattleTestPirate).filter(Boolean);
}

function cloneBattleTestEnemy(enemy) {
  if (!enemy || typeof enemy !== 'object' || enemy.id == null) return null;
  return { ...enemy };
}

function cloneBattleTestRows(rows) {
  return [0, 1, 2].map((rowIndex) => {
    const row = Array.isArray(rows && rows[rowIndex]) ? rows[rowIndex] : [];
    return row.filter((id) => id != null);
  });
}

function buildBattleTestCombatState(repeatState) {
  const enemyParty = Array.isArray(repeatState && repeatState.enemyParty)
    ? repeatState.enemyParty.map(cloneBattleTestEnemy).filter(Boolean)
    : [];
  if (!enemyParty.length) return null;

  return {
    mode: 'setup',
    inspectedPirateId: null,
    inspectedEnemyId: null,
    enemyName: typeof repeatState.enemyName === 'string' && repeatState.enemyName
      ? repeatState.enemyName
      : 'Boarding Party',
    encounterDesc: repeatState.encounterDesc || null,
    enemyParty,
    playerSetupRows: cloneBattleTestRows(repeatState.playerSetupRows),
    enemySetupRows: cloneBattleTestRows(repeatState.enemySetupRows),
    playerFighters: null,
    enemyFighters: null,
    result: null,
  };
}

function equipPiratesFromWeaponQueue(pirates, weaponKeys, opts = {}) {
  const crew = Array.isArray(pirates) ? pirates.filter(Boolean) : [];
  const queue = Array.isArray(weaponKeys)
    ? weaponKeys.filter((weaponKey) => WEAPON_TYPES[weaponKey])
    : [];
  const targets = crew.filter((pirate) => !WEAPON_TYPES[pirate.weaponKey]);
  if (opts.shuffleTargets) Phaser.Utils.Array.Shuffle(targets);

  let idx = 0;
  queue.forEach((weaponKey) => {
    const pirate = targets[idx];
    if (!pirate || !WEAPON_TYPES[weaponKey]) return;
    pirate.weaponKey = weaponKey;
    idx += 1;
  });
}

let G = {};

function drawCardsWithMeta(n) {
  const out = [];
  const reshuffles = [];
  const steps = [];
  let pendingDraw = [];

  const flushDrawStep = () => {
    if (pendingDraw.length === 0) return;
    steps.push({ type: 'draw', cards: pendingDraw });
    pendingDraw = [];
  };

  for (let i = 0; i < n; i++) {
    if (G.deck.length === 0) {
      flushDrawStep();
      if (G.discard.length === 0) break;
      const cards = [...G.discard];
      const reshuffle = { cards, count: cards.length };
      reshuffles.push(reshuffle);
      steps.push({ type: 'reshuffle', cards, count: cards.length });
      G.deck = Phaser.Utils.Array.Shuffle(cards);
      G.discard = [];
    }
    const card = G.deck.pop();
    out.push(card);
    pendingDraw.push(card);
  }
  flushDrawStep();
  return { cards: out, reshuffles, steps };
}

function drawCards(n) {
  return drawCardsWithMeta(n).cards;
}

function initState() {
  const crew = [];
  for (let i = 0; i < 4; i++) crew.push(mkP('lumberjack'));
  for (let i = 0; i < 4; i++) crew.push(mkP('miner'));
  for (let i = 0; i < 2; i++) crew.push(mkP('armsman'));
  const map = generateMap();

  G = {
    mode: 'run',
    allCrew: [...crew],
    deck: Phaser.Utils.Array.Shuffle([...crew]),
    discard: [],
    hand: [],
    res: { wood: 0, stone: 0, gold: 0 },
    enthusiasm: 0,
    round: 0,
    phase: 'map',
    sent: [],
    island: null,
    enemyShip: null,
    combat: null,
    healing: null,
    boardingAlert: 0,
    boardingCount: 0,
    gameOver: false,
    shop: initialShop(4, 0, { map, mode: 'run' }),
    shopCreditUsed: false,
    fullCrewDiscount: 0,
    openingCounterPlan: false,
    cacheDrillMusterIds: [],
    shortCrewReportIds: [],
    counterWatchIds: [],
    shopAnimating: false,
    busy: false,
    map,
  };

  G.hand = drawCards(5);
}

function initBattleTestState(repeatState = null) {
  const fighterCount = 5;
  const repeatCrew = cloneBattleTestCrew(repeatState && repeatState.crew);
  const repeatCombat = buildBattleTestCombatState(repeatState);
  const useRepeatState = repeatCrew.length > 0 && !!repeatCombat;

  const crew = useRepeatState ? repeatCrew : buildBattleTestCrew(fighterCount);
  const encounterNo = useRepeatState
    ? Math.max(1, Number(
      (repeatState.enemyShip && repeatState.enemyShip.encounterNo)
        || repeatState.boardingCount
        || repeatState.round
    ) || 1)
    : Phaser.Math.Between(1, TOTAL_BATTLES);
  if (!useRepeatState) {
    const weaponCount = Phaser.Math.Between(1, crew.length);
    equipPiratesFromWeaponQueue(crew, rollWeaponKeys(weaponCount, { ensureDistinct: true }), { shuffleTargets: true });
  }
  const enemyShip = useRepeatState
    ? {
      ...(repeatState.enemyShip || {}),
      encounterNo,
      strength: Number((repeatState.enemyShip && repeatState.enemyShip.strength) || encounterNo) || encounterNo,
    }
    : { encounterNo, strength: encounterNo };

  G = {
    mode: 'battleTest',
    allCrew: [...crew],
    deck: [],
    discard: [],
    hand: [...crew],
    res: { wood: 0, stone: 0, gold: 0 },
    enthusiasm: 0,
    round: encounterNo,
    phase: 'boarding',
    sent: [],
    island: null,
    enemyShip,
    combat: useRepeatState ? repeatCombat : null,
    healing: null,
    boardingAlert: 0,
    boardingCount: encounterNo,
    gameOver: false,
    shop: [],
    shopCreditUsed: false,
    fullCrewDiscount: 0,
    openingCounterPlan: false,
    cacheDrillMusterIds: [],
    shortCrewReportIds: [],
    counterWatchIds: [],
    shopAnimating: false,
    busy: false,
    map: null,
  };
}
