#!/usr/bin/env node

/*
  High-speed headless simulator for Deck of Cats / Pirates mode.
  Reuses source data and logic from js/*.js via VM, skips UI/animation.
*/

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const GAME_FILES = [
  path.join(ROOT, 'js/constants.js'),
  path.join(ROOT, 'js/map.js'),
  path.join(ROOT, 'js/state.js'),
  path.join(ROOT, 'js/scene.js'),
];

function parseArgs(argv) {
  const out = {
    games: 10000,
    seed: 12345,
    maxSteps: 5000,
    json: false,
    policy: 'heuristic',
    modelPath: path.join(ROOT, 'sim', 'ml', 'checkpoints', 'shop_policy.pt'),
    pythonBin: 'python3',
    datasetOut: null,
    trajectoryOut: null,
    bestLog: path.join(ROOT, 'sim', 'best-purchases.log'),
    mlSample: false,
    mlTemperature: 1.0,
    mlEpsilon: 0.0,
    policyActions: 1024,
    checkOpeningCommission: false,
    checkPortDrill: false,
    checkShortCrewDrill: false,
    checkAlertTiers: false,
    checkScoutedCounterShop: false,
    checkScoutedCounterCache: false,
    checkOpeningCounterSubsidy: false,
    checkOpeningCounterPlan: false,
    checkOpeningSidePrep: false,
    checkOpeningShellbackCounter: false,
    checkOpeningDeckhandCounters: false,
    checkOpeningCachePurse: false,
    checkOpeningRouteMuster: false,
    checkOpeningRoutePrize: false,
    checkOpeningRoutePromotion: false,
    checkRouteSidekickReport: false,
    checkAlarmRushedRouteCounter: false,
    checkRouteCounterCover: false,
    checkOpeningAmbusherReport: false,
    checkCounterAmbusherReport: false,
    checkDrilledAmbusherBounty: false,
    checkCounterRecruitsReportEarly: false,
    checkMapSchedule: false,
    checkBoardingTrophy: false,
    checkCounterTrophy: false,
    checkCounterEdge: false,
    checkCounterAmbush: false,
    checkEncounterScaling: false,
    checkOpeningRouteCaptains: false,
    checkFirstShellback: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--games' || a === '-g') && argv[i + 1]) {
      out.games = Math.max(1, parseInt(argv[++i], 10) || out.games);
      continue;
    }
    if ((a === '--runs' || a === '-r') && argv[i + 1]) {
      out.games = Math.max(1, parseInt(argv[++i], 10) || out.games);
      continue;
    }
    if ((a === '--k' || a === '-k') && argv[i + 1]) {
      // Legacy compatibility: retry-by-epoch system is removed, keep arg as no-op.
      i++;
      continue;
    }
    if ((a === '--seed' || a === '-s') && argv[i + 1]) {
      out.seed = parseInt(argv[++i], 10) || out.seed;
      continue;
    }
    if ((a === '--max-steps' || a === '-m') && argv[i + 1]) {
      out.maxSteps = Math.max(100, parseInt(argv[++i], 10) || out.maxSteps);
      continue;
    }
    if (a === '--json') {
      out.json = true;
      continue;
    }
    if (a === '--policy' && argv[i + 1]) {
      out.policy = String(argv[++i]).toLowerCase();
      continue;
    }
    if (a === '--model-path' && argv[i + 1]) {
      out.modelPath = path.resolve(argv[++i]);
      continue;
    }
    if (a === '--python-bin' && argv[i + 1]) {
      out.pythonBin = argv[++i];
      continue;
    }
    if (a === '--dataset-out' && argv[i + 1]) {
      out.datasetOut = path.resolve(argv[++i]);
      continue;
    }
    if (a === '--trajectory-out' && argv[i + 1]) {
      out.trajectoryOut = path.resolve(argv[++i]);
      continue;
    }
    if (a === '--ml-sample') {
      out.mlSample = true;
      continue;
    }
    if (a === '--ml-temperature' && argv[i + 1]) {
      out.mlTemperature = Math.max(0.01, parseFloat(argv[++i]) || out.mlTemperature);
      continue;
    }
    if (a === '--ml-epsilon' && argv[i + 1]) {
      out.mlEpsilon = clamp(parseFloat(argv[++i]) || out.mlEpsilon, 0, 1);
      continue;
    }
    if (a === '--policy-actions' && argv[i + 1]) {
      out.policyActions = Math.max(5, parseInt(argv[++i], 10) || out.policyActions);
      continue;
    }
    if (a === '--best-log' && argv[i + 1]) {
      out.bestLog = path.resolve(argv[++i]);
      continue;
    }
    if (a === '--check-opening-commission') {
      out.checkOpeningCommission = true;
      continue;
    }
    if (a === '--check-port-drill') {
      out.checkPortDrill = true;
      continue;
    }
    if (a === '--check-short-crew-drill') {
      out.checkShortCrewDrill = true;
      continue;
    }
    if (a === '--check-alert-tiers') {
      out.checkAlertTiers = true;
      continue;
    }
    if (a === '--check-scouted-counter-shop') {
      out.checkScoutedCounterShop = true;
      continue;
    }
    if (a === '--check-scouted-counter-cache') {
      out.checkScoutedCounterCache = true;
      continue;
    }
    if (a === '--check-opening-counter-subsidy') {
      out.checkOpeningCounterSubsidy = true;
      continue;
    }
    if (a === '--check-full-crew-coverage') {
      out.checkOpeningCounterSubsidy = true;
      continue;
    }
    if (a === '--check-opening-counter-plan') {
      out.checkOpeningCounterPlan = true;
      continue;
    }
    if (a === '--check-opening-counter-prep') {
      out.checkOpeningCounterPlan = true;
      continue;
    }
    if (a === '--check-opening-side-prep') {
      out.checkOpeningSidePrep = true;
      continue;
    }
    if (a === '--check-opening-shellback-counter') {
      out.checkOpeningShellbackCounter = true;
      continue;
    }
    if (a === '--check-opening-route-counter-shop') {
      out.checkOpeningShellbackCounter = true;
      continue;
    }
    if (a === '--check-opening-deckhand-counters') {
      out.checkOpeningDeckhandCounters = true;
      continue;
    }
    if (a === '--check-opening-cache-purse' || a === '--check-opening-deckhand-scout-pay' || a === '--check-opening-scout-pay') {
      out.checkOpeningCachePurse = true;
      continue;
    }
    if (a === '--check-opening-route-muster') {
      out.checkOpeningRouteMuster = true;
      continue;
    }
    if (a === '--check-cache-drill-opening-payoff' || a === '--check-opening-route-prize' || a === '--check-opening-route-contract') {
      out.checkOpeningRoutePrize = true;
      continue;
    }
    if (a === '--check-opening-route-promotion') {
      out.checkOpeningRoutePromotion = true;
      continue;
    }
    if (a === '--check-route-sidekick-report') {
      out.checkRouteSidekickReport = true;
      continue;
    }
    if (a === '--check-alarm-rushed-route-counter' || a === '--check-dockside-rush-route-counter') {
      out.checkAlarmRushedRouteCounter = true;
      continue;
    }
    if (a === '--check-route-counter-cover' || a === '--check-opening-route-cover') {
      out.checkRouteCounterCover = true;
      continue;
    }
    if (a === '--check-opening-ambusher-report') {
      out.checkOpeningAmbusherReport = true;
      out.checkCounterAmbusherReport = true;
      continue;
    }
    if (a === '--check-counter-ambusher-report') {
      out.checkCounterAmbusherReport = true;
      continue;
    }
    if (a === '--check-drilled-ambusher-bounty') {
      out.checkDrilledAmbusherBounty = true;
      continue;
    }
    if (a === '--check-counter-recruits-report-early') {
      out.checkCounterRecruitsReportEarly = true;
      continue;
    }
    if (a === '--check-map-schedule') {
      out.checkMapSchedule = true;
      continue;
    }
    if (a === '--check-boarding-trophy') {
      out.checkBoardingTrophy = true;
      continue;
    }
    if (a === '--check-counter-trophy') {
      out.checkCounterTrophy = true;
      continue;
    }
    if (a === '--check-counter-edge') {
      out.checkCounterEdge = true;
      continue;
    }
    if (a === '--check-counter-ambush') {
      out.checkCounterAmbush = true;
      continue;
    }
    if (a === '--check-encounter-scaling') {
      out.checkEncounterScaling = true;
      continue;
    }
    if (a === '--check-first-shellback') {
      out.checkFirstShellback = true;
      out.checkOpeningRouteCaptains = true;
      continue;
    }
    if (a === '--check-opening-route-captains') {
      out.checkOpeningRouteCaptains = true;
    }
  }

  return out;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makePhaserStub(mathObj) {
  return {
    Utils: {
      Array: {
        GetRandom(arr) {
          if (!arr || arr.length === 0) return undefined;
          return arr[Math.floor(mathObj.random() * arr.length)];
        },
        Shuffle(arr) {
          const out = [...arr];
          for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(mathObj.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
          }
          return out;
        },
      },
    },
    Math: {
      Between(min, max) {
        const lo = Math.ceil(Math.min(min, max));
        const hi = Math.floor(Math.max(min, max));
        return lo + Math.floor(mathObj.random() * (hi - lo + 1));
      },
      Clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      },
      FloatBetween(min, max) {
        return min + mathObj.random() * (max - min);
      },
      Linear(a, b, t) {
        return a + (b - a) * t;
      },
    },
    Scene: class FakeScene {
      constructor() {
        this.scene = {
          isActive: () => false,
          stop: () => {},
          launch: () => {},
          bringToTop: () => {},
          get: () => null,
        };
      }
    },
  };
}

function buildRuntime() {
  const mathObj = Object.create(Math);
  let rng = Math.random;
  mathObj.random = () => rng();

  const context = vm.createContext({
    console,
    Math: mathObj,
    Date,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  });
  context.Phaser = makePhaserStub(mathObj);

  for (const file of GAME_FILES) {
    const code = fs.readFileSync(file, 'utf8');
    vm.runInContext(code, context, { filename: file });
  }

  vm.runInContext(
    `
    globalThis.__simApi = {
      initState,
      initBattleTestState,
      randomShopType,
      initialShop,
      applyScoutedCounterToShop,
      normalizeOpeningRouteShop,
      openingRoutePrimaryCounterTypeForShop,
      openingRouteSideOfferTypeForShop,
      openingRouteSidePrepGain,
      scoutedCounterTypesForMap,
      isScoutedCounterShopType,
      openingDeckhandCounterTypes,
      gameplayCounterTypes,
      firstBoardingEncounterBlueprint,
      firstShipLayerIndex,
      openingRouteCacheNodeForSelection,
      applyOpeningRouteToFirstShip,
      generateEncounterBlueprint,
      drawCards,
      getAvailableNodes,
      mapNodeById,
      MAP_LAYERS,
      COMBAT,
      TYPES,
      ISLANDS,
      QUIET_DOCKS,
      SHOP_CREDIT,
      ALARM_RUSHED_ROUTE_COUNTER_ALERT,
      SCOUTED_SHIP_COUNTERS,
      OPENING_DECKHAND_COUNTERS,
      OPENING_ROUTE_SIDE_OFFERS,
      OPENING_ROUTE_SIDE_PREP_GAINS,
      SCOUTED_COUNTER_CACHE_RES,
      RES_EMOJI,
      GameScene,
      getG: () => G,
      setG: (next) => { G = next; },
      getUid: () => uid,
      setUid: (next) => { uid = next; },
    };
  `,
    context
  );

  return {
    context,
    api: context.__simApi,
    setSeed(seed) {
      rng = mulberry32(seed >>> 0);
    },
    rand() {
      return context.Math.random();
    },
    randInt(max) {
      return Math.floor(context.Math.random() * max);
    },
  };
}

function removePirateById(G, pirateId) {
  G.allCrew = G.allCrew.filter(p => p.id !== pirateId);
  G.deck = G.deck.filter(p => p.id !== pirateId);
  G.discard = G.discard.filter(p => p.id !== pirateId);
  if (G.openingRouteCounterBoughtPirateId === pirateId) {
    G.openingRouteCounterBoughtPirateId = null;
  }
}

function canSend(api, G, idx) {
  const pirate = G.hand[idx];
  if (!pirate) return false;
  const def = api.TYPES[pirate.type];
  if (!def || !def.canIsland || !def.island) return false;
  if (def.island.convert) {
    const c = def.island.convert;
    if ((G.res[c.cRes] || 0) < c.cN) return false;
  }
  return true;
}

function pickRandom(runtime, arr) {
  if (!arr.length) return null;
  return arr[runtime.randInt(arr.length)];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function bucket(value, cuts) {
  for (let i = 0; i < cuts.length; i++) {
    if (value <= cuts[i]) return i;
  }
  return cuts.length;
}

function buildTypeIndexMap(api) {
  const sorted = Object.keys(api.TYPES).sort();
  const out = {};
  for (let i = 0; i < sorted.length; i++) {
    out[sorted[i]] = i + 1;
  }
  return out;
}

const DECISION_KIND = {
  map: 1,
  sending: 2,
  remove: 3,
  shop: 4,
};

function phaseCode(phase) {
  if (phase === 'map') return 1;
  if (phase === 'sending') return 2;
  if (phase === 'ship') return 3;
  if (phase === 'shopping') return 4;
  if (phase === 'boarding') return 5;
  if (phase === 'removing') return 6;
  return 0;
}

function islandCode(api, G) {
  if (!G.island) return 0;
  const idx = api.ISLANDS.indexOf(G.island);
  if (idx >= 0) return idx + 1;
  return 0;
}

function makeMask(actionCap, validIndices) {
  const mask = new Array(actionCap).fill(0);
  for (const idx of validIndices) {
    if (idx >= 0 && idx < actionCap) mask[idx] = 1;
  }
  return mask;
}

function totalWeapons(weapons) {
  if (weapons && typeof weapons === 'object') {
    return Object.values(weapons).reduce((sum, count) => sum + (count || 0), 0);
  }
  return weapons || 0;
}

function clearWeapons(weapons) {
  if (weapons && typeof weapons === 'object') {
    const next = {};
    Object.keys(weapons).forEach((key) => {
      next[key] = 0;
    });
    return next;
  }
  return 0;
}

function baseDecisionTokens(api, G, kindId) {
  const t = [];
  t.push(50 + kindId);
  t.push(80 + phaseCode(G.phase));
  t.push(100 + clamp(G.round, 0, 127));
  t.push(200 + bucket(G.enthusiasm, [0, 1, 2, 3, 5, 8, 12, 17, 24, 32]));
  t.push(220 + bucket(G.res.wood || 0, [0, 1, 2, 3, 5, 8, 12, 18, 26]));
  t.push(240 + bucket(G.res.stone || 0, [0, 1, 2, 3, 5, 8, 12, 18, 26]));
  t.push(260 + bucket(G.res.gold || 0, [0, 1, 2, 3, 4, 6, 9, 13, 20]));
  t.push(300 + bucket(totalWeapons(G.weapons), [0, 1, 2, 3, 5, 8, 12, 20, 32]));
  t.push(320 + bucket(G.cannons || 0, [0, 1, 2, 3, 5, 8, 12, 20, 32]));
  t.push(340 + bucket(G.allCrew.length, [10, 12, 14, 16, 18, 21, 24, 28, 32, 40, 56, 80]));
  t.push(360 + bucket(G.deck.length, [0, 2, 4, 6, 8, 10, 14, 20, 30, 45, 70]));
  t.push(380 + bucket(G.discard.length, [0, 2, 4, 6, 8, 10, 14, 20, 30, 45, 70]));
  t.push(400 + bucket(G.boardingCount || 0, [0, 1, 2, 3, 5, 8, 12, 20]));
  const enemyStrength = G.enemyShip ? G.enemyShip.strength : 0;
  t.push(420 + bucket(enemyStrength, [0, 6, 12, 18, 24, 32, 44, 60, 80, 120]));
  t.push(430 + bucket(G.boardingAlert || 0, [0, 1, 2, 3, 5, 8, 12, 20]));
  t.push(440 + islandCode(api, G));
  t.push(450 + clamp(G.fullCrewDiscount || 0, 0, 1));
  t.push(455 + (G.openingCounterPlan ? 1 : 0));
  t.push(460 + clamp(G.hand.length, 0, 32));
  t.push(500 + clamp(G.sent.length, 0, 8));
  return t;
}

function randomValidAction(runtime, mask) {
  const valid = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) valid.push(i);
  }
  if (!valid.length) return 0;
  return pickRandom(runtime, valid);
}

async function decideAction(runtime, policy, ctx) {
  if (!ctx.mask.some(Boolean)) {
    throw new Error(`no valid actions for decision kind=${ctx.kind}`);
  }
  if (policy.name === 'heuristic') {
    if (ctx.heuristicAction != null && ctx.mask[ctx.heuristicAction]) {
      return ctx.heuristicAction;
    }
    return randomValidAction(runtime, ctx.mask);
  }

  const action = await policy.decide({
    kind: ctx.kind,
    tokens: ctx.tokens,
    mask: ctx.mask,
  });
  if (!Number.isInteger(action) || action < 0 || action >= ctx.mask.length || !ctx.mask[action]) {
    throw new Error(`invalid action=${action} kind=${ctx.kind}`);
  }
  return action;
}

function buildMapDecision(api, G, actionCap) {
  const available = api.getAvailableNodes(G.map);
  const options = available.map((nodeId) => {
    const node = api.mapNodeById(G.map, nodeId);
    return { nodeId, node };
  });
  if (!options.length) return null;
  if (options.length > actionCap) {
    throw new Error(`map options overflow: ${options.length} > actionCap=${actionCap}`);
  }
  const tokens = baseDecisionTokens(api, G, DECISION_KIND.map);
  for (let i = 0; i < options.length; i++) {
    const o = options[i];
    if (o.node && o.node.type === 'ship') {
      tokens.push(900 + bucket(o.node.strength || 0, [2, 6, 12, 18, 24, 32, 44, 60, 80, 120]));
    } else {
      const islIdx = o.node ? (o.node.islandIdx + 1) : 0;
      tokens.push(800 + islIdx);
    }
    tokens.push(980 + clamp(i, 0, 120));
  }
  const mask = makeMask(actionCap, options.map((_, i) => i));
  return { kind: 'map', tokens, mask, options };
}

function buildSendingDecision(api, G, scene, typeIndexMap, actionCap) {
  const sentSet = new Set(G.sent);
  const maxSend = scene.maxSend();
  const options = [{ type: 'end_sending' }];
  if (G.sent.length < maxSend) {
    for (let i = 0; i < G.hand.length; i++) {
      if (sentSet.has(i)) continue;
      if (!canSend(api, G, i)) continue;
      options.push({ type: 'send_pirate', handIdx: i });
    }
  }
  if (options.length > actionCap) {
    throw new Error(`sending options overflow: ${options.length} > actionCap=${actionCap}`);
  }
  const tokens = baseDecisionTokens(api, G, DECISION_KIND.sending);
  tokens.push(520 + clamp(maxSend, 0, 8));
  for (let i = 0; i < options.length; i++) {
    const o = options[i];
    if (o.type === 'end_sending') {
      tokens.push(1000);
      tokens.push(1080 + clamp(i, 0, 120));
      continue;
    }
    const pirate = G.hand[o.handIdx];
    const typeIdx = pirate ? (typeIndexMap[pirate.type] || 0) : 0;
    tokens.push(1100 + clamp(typeIdx, 0, 380));
    tokens.push(1180 + clamp(o.handIdx, 0, 32));
  }
  const mask = makeMask(actionCap, options.map((_, i) => i));
  return { kind: 'sending', tokens, mask, options };
}

function buildRemoveDecision(api, G, shipPirateType, targets, typeIndexMap, actionCap) {
  if (targets.length > actionCap) {
    throw new Error(`remove options overflow: ${targets.length} > actionCap=${actionCap}`);
  }
  const options = targets.map(p => ({ type: 'remove_target', pirate: p }));
  const tokens = baseDecisionTokens(api, G, DECISION_KIND.remove);
  const shipIdx = typeIndexMap[shipPirateType] || 0;
  tokens.push(1300 + clamp(shipIdx, 0, 380));
  for (let i = 0; i < options.length; i++) {
    const p = options[i].pirate;
    const typeIdx = typeIndexMap[p.type] || 0;
    tokens.push(1400 + clamp(typeIdx, 0, 380));
    tokens.push(1480 + clamp(i, 0, 120));
  }
  const mask = makeMask(actionCap, options.map((_, i) => i));
  return { kind: 'remove', tokens, mask, options };
}

function quietDocksCost(api) {
  return Math.max(0, Math.floor(Number((api.QUIET_DOCKS && api.QUIET_DOCKS.cost) || 2) || 0));
}

function canQuietDocks(api, G) {
  if (!G || G.mode === 'battleTest' || G.phase !== 'shopping') return false;
  return Math.max(0, Math.floor(Number(G.boardingAlert) || 0)) > 0
    && Math.max(0, Math.floor(Number(G.enthusiasm) || 0)) >= quietDocksCost(api);
}

function shopCreditMaxMissing(api) {
  return Math.max(0, Math.floor(Number((api.SHOP_CREDIT && api.SHOP_CREDIT.maxMissing) || 0) || 0));
}

function shopCreditAlertPerMissing(api) {
  return Math.max(0, Math.floor(Number((api.SHOP_CREDIT && api.SHOP_CREDIT.alertPerMissing) || 0) || 0));
}

function alarmRushedRouteCounterAlertThreshold(api) {
  return Math.max(1, Math.floor(Number(api.ALARM_RUSHED_ROUTE_COUNTER_ALERT || 4) || 4));
}

function activeFullCrewDiscount(G) {
  if (!G || G.mode === 'battleTest' || G.phase !== 'shopping') return 0;
  return Math.max(0, Math.min(1, Math.floor(Number(G.fullCrewDiscount) || 0)));
}

function activeOpeningCounterPlan(G) {
  return !!(
    G
    && G.mode !== 'battleTest'
    && G.phase === 'shopping'
    && Math.max(0, Math.floor(Number(G.round) || 0)) >= 1
    && Math.max(0, Math.floor(Number(G.round) || 0)) <= 2
    && Math.max(0, Math.floor(Number(G.boardingCount) || 0)) === 0
    && G.openingCounterPlan
  );
}

function counterRecruitReportsEarlyForQuote(api, G, type, counter) {
  if (!G || G.mode === 'battleTest' || !counter) return false;
  if (!type || !api.TYPES[type]) return false;
  const turnsAway = nextShipTurnsAway(G);
  return turnsAway >= 1 && turnsAway <= 3;
}

function nextScoutedShipMainKey(G) {
  if (!G || !G.map || !Array.isArray(G.map.layers)) return null;
  const currentLayer = Number.isFinite(G.map.currentLayer) ? G.map.currentLayer : -1;
  for (let li = Math.max(0, currentLayer + 1); li < G.map.layers.length; li++) {
    const layer = G.map.layers[li];
    if (!layer || layer.length !== 1 || !layer[0] || layer[0].type !== 'ship') continue;
    return layer[0].encounter && layer[0].encounter.mainKey ? layer[0].encounter.mainKey : null;
  }
  return null;
}

function pirateTypeNameForQuote(api, type) {
  return (type && api.TYPES[type] && api.TYPES[type].name) || type || 'Pirate';
}

function openingSidePrepTargetInfoForQuote(api, G, mainKey, fallbackType) {
  const marker = G && G.openingRouteMuster;
  if (marker && marker.mainKey === mainKey && marker.pirateId != null) {
    const pirate = (G.allCrew || []).find(candidate =>
      candidate
      && candidate.id === marker.pirateId
    );
    const starterTypes = typeof api.openingDeckhandCounterTypes === 'function'
      ? api.openingDeckhandCounterTypes(mainKey, 1, { mode: G.mode })
      : [];
    if (pirate
      && starterTypes.includes(pirate.type)
      && (!marker.type || marker.type === pirate.type)) {
      return {
        pirateId: pirate.id,
        type: pirate.type,
        name: pirateTypeNameForQuote(api, pirate.type),
        targetsMuster: true,
      };
    }
  }
  return {
    pirateId: null,
    type: fallbackType || null,
    name: pirateTypeNameForQuote(api, fallbackType),
    targetsMuster: false,
  };
}

function openingSidePrepSupportTextForQuote(api, quote) {
  if (!quote || !quote.openingSidePrep) return '';
  const gain = quote.openingSidePrepGain || null;
  const gainText = gain && gain.buff === 'tempo'
    ? '⚡'
    : (gain && gain.buff === 'might' ? '💪' : '');
  const targetName = quote.openingSidePrepTargetName || pirateTypeNameForQuote(api, quote.openingSidePrepTargetType);
  return `Support${targetName ? ` ${targetName}` : ''}${gainText ? ` +${gainText}` : ''}`;
}

function openingSidekickBountyTextForQuote(api, quote) {
  if (!quote || !quote.openingSidePrep || !quote.openingSidekickBountyRes) return '';
  const emoji = api.RES_EMOJI && api.RES_EMOJI[quote.openingSidekickBountyRes];
  return emoji ? `Sidekick win +${emoji}` : '';
}

function preparedCounterGainsForQuote(api, type) {
  const gains = api.TYPES[type]
    && api.TYPES[type].ship
    && Array.isArray(api.TYPES[type].ship.personalGains)
    ? api.TYPES[type].ship.personalGains
    : [];
  return gains.filter(Boolean);
}

function shopPurchaseQuote(api, G, type) {
  const def = api.TYPES[type];
  const cost = Math.max(0, Math.floor(Number(def && def.cost) || 0));
  const counter = !!(
    def
    && typeof api.isScoutedCounterShopType === 'function'
    && api.isScoutedCounterShopType(type, G && G.map, { mode: G && G.mode })
  );
  const scoutedCounterTopDeck = counterRecruitReportsEarlyForQuote(api, G, type, counter);
  const discount = Math.min(cost, activeFullCrewDiscount(G));
  const costAfterDiscount = Math.max(0, cost - discount);
  const enthusiasm = Math.max(0, Math.floor(Number(G && G.enthusiasm) || 0));
  const openingCounterPlan = activeOpeningCounterPlan(G);
  const boardingCount = Math.max(0, Math.floor(Number(G && G.boardingCount) || 0));
  const openingCommissionReport = false;
  const openingFullCrewReport = false;
  const openingRouteMainKey = nextScoutedShipMainKey(G);
  const openingRoutePrimaryType = G && typeof api.openingRoutePrimaryCounterTypeForShop === 'function'
    ? api.openingRoutePrimaryCounterTypeForShop({
      map: G.map,
      mode: G.mode,
      boardingCount,
    })
    : null;
  const openingRoutePrimary = !!(openingRoutePrimaryType
    && openingRoutePrimaryType === type
    && boardingCount === 0
    && (!G || G.mode !== 'battleTest'));
  const openingRouteSideOfferType = G && typeof api.openingRouteSideOfferTypeForShop === 'function'
    ? api.openingRouteSideOfferTypeForShop({
      map: G.map,
      mode: G.mode,
      boardingCount,
    })
    : null;
  const openingSidePrepGain = typeof api.openingRouteSidePrepGain === 'function'
    ? api.openingRouteSidePrepGain(type)
    : null;
  const openingSidePrep = !!(openingRouteSideOfferType
    && openingRouteSideOfferType === type
    && G
    && G.mode !== 'battleTest'
    && boardingCount === 0
    && G.openingRouteCounterBoughtMainKey !== openingRouteMainKey
    && openingCounterPlan
    && openingSidePrepGain);
  const openingSidePrepTarget = openingSidePrep
    ? openingSidePrepTargetInfoForQuote(api, G, openingRouteMainKey, type)
    : null;
  const openingSidekickBountyRes = openingSidePrep
    && openingRouteMainKey
    && api.SCOUTED_COUNTER_CACHE_RES
    ? api.SCOUTED_COUNTER_CACHE_RES[openingRouteMainKey] || null
    : null;
  const discountPreparesCounter = discount > 0 && boardingCount > 0;
  const preparedCounter = !!(scoutedCounterTopDeck
    && preparedCounterGainsForQuote(api, type).length
    && discountPreparesCounter);
  const openingCounterPrepMight = !!(scoutedCounterTopDeck && counter && openingCounterPlan);
  const openingCounterPrepDiscount = (openingCounterPrepMight || openingSidePrep) ? Math.min(1, costAfterDiscount) : 0;
  const effectiveCost = Math.max(0, costAfterDiscount - openingCounterPrepDiscount);
  const consumesOpeningCounterPlan = !!(openingCounterPrepMight || openingSidePrep);
  const setupTopDeck = !!(scoutedCounterTopDeck && (discount > 0 || openingCounterPrepMight));
  const topDeckBeforeAlarm = openingRoutePrimary
    ? setupTopDeck
    : (openingSidePrep ? true : !!scoutedCounterTopDeck);
  const pendingAlert = Math.max(0, Math.floor(Number(G && G.boardingAlert) || 0));
  const claimedRouteCacheMainKey = G && G.openingRouteCacheClaimedMainKey != null
    ? G.openingRouteCacheClaimedMainKey
    : null;
  const claimedRouteCacheForAlarmRush = !!(openingRoutePrimary
    && claimedRouteCacheMainKey
    && claimedRouteCacheMainKey === openingRouteMainKey);
  const canAlarmRush = !!(openingRoutePrimary
    && scoutedCounterTopDeck
    && !setupTopDeck
    && claimedRouteCacheForAlarmRush);
  const alarmRushesWithAlert = (extraAlert = 0) => canAlarmRush
    && pendingAlert + Math.max(0, Math.floor(Number(extraAlert) || 0)) >= alarmRushedRouteCounterAlertThreshold(api);
  const shared = {
    openingCounterPlan,
    openingCounterPrep: openingCounterPrepMight,
    openingCounterPrepMight,
    openingCounterPrepDiscount,
    openingSidePrep,
    openingSidePrepGain,
    openingSidePrepTargetType: openingSidePrepTarget ? openingSidePrepTarget.type : null,
    openingSidePrepTargetName: openingSidePrepTarget ? openingSidePrepTarget.name : '',
    openingSidePrepTargetPirateId: openingSidePrepTarget ? openingSidePrepTarget.pirateId : null,
    openingSidePrepTargetsMuster: !!(openingSidePrepTarget && openingSidePrepTarget.targetsMuster),
    openingSidekickBountyRes,
    openingSidekickBountyEmoji: openingSidekickBountyRes && api.RES_EMOJI ? (api.RES_EMOJI[openingSidekickBountyRes] || '') : '',
    openingRoutePrimary,
    openingCommissionReport,
    openingFullCrewReport,
    consumesOpeningCounterPlan,
    consumesOpeningCounterPrep: consumesOpeningCounterPlan,
  };
  const withRouteCounterCover = (quote) => {
    const projectedAlert = pendingAlert + Math.max(0, Math.floor(Number(quote && quote.alert) || 0));
    const routeCounterCover = !!(quote
      && quote.canBuy
      && openingRoutePrimary
      && openingRoutePrimaryType === type
      && quote.counter
      && quote.topDeck
      && (quote.discount > 0
        || quote.fullCrewCoverage > 0
        || quote.openingCounterPrepMight
        || quote.alarmRushedRouteCounter)
      && projectedAlert > 0)
      ? 1
      : 0;
    return { ...quote, routeCounterCover };
  };
  if (!G || !def) {
    return {
      canBuy: false,
      credit: false,
      counter: false,
      topDeck: false,
      openingCommissionReport: false,
      openingFullCrewReport: false,
      preparedCounter: false,
      cost,
      effectiveCost,
      discount: 0,
      openingCounterPrepDiscount: 0,
      missing: 0,
      alert: 0,
      spend: 0,
      fullCrewCoverage: 0,
      openingCounterPlan: false,
      openingCounterPrep: false,
      openingCounterPrepMight: false,
      openingSidePrep: false,
      openingSidePrepGain: null,
      openingSidePrepTargetType: null,
      openingSidePrepTargetName: '',
      openingSidePrepTargetPirateId: null,
      openingSidePrepTargetsMuster: false,
      openingRoutePrimary: false,
      routeCounterCover: 0,
      alarmRushedRouteCounter: false,
      consumesOpeningCounterPlan: false,
      consumesOpeningCounterPrep: false,
    };
  }
  if (enthusiasm >= effectiveCost) {
    const alarmRushedRouteCounter = alarmRushesWithAlert(0);
    return withRouteCounterCover({
      canBuy: true,
      credit: false,
      counter,
      topDeck: topDeckBeforeAlarm || alarmRushedRouteCounter,
      preparedCounter,
      cost,
      effectiveCost,
      discount,
      missing: 0,
      alert: 0,
      spend: effectiveCost,
      fullCrewCoverage: 0,
      ...shared,
      alarmRushedRouteCounter,
    });
  }
  const missing = effectiveCost - enthusiasm;
  const shopCreditUsed = !!G.shopCreditUsed;
  const fullCrewCoverage = G.mode !== 'battleTest'
    && G.phase === 'shopping'
    && Math.max(0, Math.floor(Number(G.round) || 0)) === 1
    && Math.max(0, Math.floor(Number(G.boardingCount) || 0)) === 0
    && !shopCreditUsed
    && discount > 0
    && !openingCounterPlan
    && counter
    && topDeckBeforeAlarm
    && openingRouteMainKey
    && missing === 1
    ? 1
    : 0;
  if (fullCrewCoverage > 0) {
    return withRouteCounterCover({
      canBuy: true,
      credit: false,
      counter,
      topDeck: topDeckBeforeAlarm,
      preparedCounter,
      cost,
      effectiveCost,
      discount,
      missing,
      alert: 0,
      spend: Math.max(0, effectiveCost - fullCrewCoverage),
      fullCrewCoverage,
      ...shared,
      alarmRushedRouteCounter: false,
    });
  }
  const canCredit = G.mode !== 'battleTest'
    && G.phase === 'shopping'
    && !shopCreditUsed
    && missing >= 1
    && missing <= shopCreditMaxMissing(api);
  const creditAlert = canCredit ? missing * shopCreditAlertPerMissing(api) : 0;
  const alarmRushedRouteCounter = !!(canCredit && alarmRushesWithAlert(creditAlert));
  return withRouteCounterCover({
    canBuy: canCredit,
    credit: canCredit,
    counter,
    topDeck: topDeckBeforeAlarm || alarmRushedRouteCounter,
    preparedCounter,
    cost,
    effectiveCost,
    discount,
    missing,
    alert: creditAlert,
    spend: canCredit ? enthusiasm : 0,
    fullCrewCoverage: 0,
    ...shared,
    alarmRushedRouteCounter,
    consumesOpeningCounterPlan: !!(consumesOpeningCounterPlan && canCredit),
    consumesOpeningCounterPrep: !!(consumesOpeningCounterPlan && canCredit),
  });
}

function buildShopDecision(api, G, buysThisShop, typeIndexMap, actionCap) {
  if (actionCap < 6) {
    throw new Error(`policy action cap too small for shop: ${actionCap}`);
  }
  const options = [
    { type: 'buy_slot', slot: 0 },
    { type: 'buy_slot', slot: 1 },
    { type: 'buy_slot', slot: 2 },
    { type: 'buy_slot', slot: 3 },
    { type: 'quiet_docks' },
    { type: 'skip_shop' },
  ];
  const tokens = baseDecisionTokens(api, G, DECISION_KIND.shop);
  tokens.push(600 + clamp(buysThisShop, 0, 15));
  for (let slot = 0; slot < 4; slot++) {
    const type = G.shop[slot] || null;
    const typeIdx = type ? (typeIndexMap[type] || 0) : 0;
    const quote = type ? shopPurchaseQuote(api, G, type) : { canBuy: false, credit: false };
    const cost = type ? (quote.effectiveCost != null ? quote.effectiveCost : (api.TYPES[type].cost || 0)) : 0;
    const buyState = quote.canBuy ? (quote.credit ? 1 : 2) : 0;
    tokens.push(1600 + clamp(typeIdx, 0, 380));
    tokens.push(1800 + bucket(cost, [0, 1, 2, 3, 4, 5, 7, 10, 13, 17, 24]));
    tokens.push(1900 + buyState);
    tokens.push(1990 + clamp(quote.discount || 0, 0, 1));
    tokens.push(1992 + (quote.counter ? 1 : 0));
    tokens.push(1994 + (quote.openingCounterPrepMight ? 1 : 0));
    tokens.push(1996 + (quote.openingCommissionReport ? 1 : 0));
    tokens.push(2000 + (quote.alarmRushedRouteCounter ? 1 : 0));
    tokens.push(2002 + (quote.openingSidePrep ? 1 : 0));
    tokens.push(2004 + (quote.routeCounterCover ? 1 : 0));
  }
  const pendingAlert = Math.max(0, Math.floor(Number(G.boardingAlert) || 0));
  tokens.push(1940 + bucket(pendingAlert, [0, 1, 2, 3, 5, 8, 12, 20]));
  tokens.push(1950 + (canQuietDocks(api, G) ? 1 : 0));
  tokens.push(1960 + bucket(quietDocksCost(api), [0, 1, 2, 3, 4, 5, 7, 10]));
  tokens.push(1970 + (G.shopCreditUsed ? 1 : 0));
  tokens.push(1980 + shopCreditMaxMissing(api));
  tokens.push(1999); // explicit skip marker

  const valid = [5];
  if (canQuietDocks(api, G)) valid.push(4);
  for (let i = 0; i < 4; i++) {
    const type = G.shop[i];
    if (!type) continue;
    if (shopPurchaseQuote(api, G, type).canBuy) valid.push(i);
  }
  const mask = makeMask(actionCap, valid);
  return { kind: 'shop', tokens, mask, options };
}

class JsonlWriter {
  constructor(filePath) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.stream = fs.createWriteStream(filePath, { flags: 'w' });
  }

  write(obj) {
    this.stream.write(JSON.stringify(obj) + '\n');
  }

  close() {
    return new Promise((resolve) => {
      this.stream.end(resolve);
    });
  }
}

class HeuristicShopPolicy {
  constructor() {
    this.name = 'heuristic';
  }

  async decide(ctx) {
    return ctx.heuristicAction;
  }

  async close() {}
}

class PythonShopPolicy {
  constructor(opts) {
    this.name = 'ml';
    this.sample = !!opts.sample;
    this.temperature = Number(opts.temperature || 1.0);
    this.epsilon = Number(opts.epsilon || 0.0);
    this.proc = spawn(opts.pythonBin, [opts.serverPath, '--model', opts.modelPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.pending = [];
    this.crashed = null;
    this.stderrLines = [];
    this.proc.on('error', (err) => {
      this.crashed = err;
      this._failAll(err);
    });
    this.proc.on('exit', (code, signal) => {
      if (!this.crashed) {
        this.crashed = new Error(`policy server exited (code=${code}, signal=${signal || 'none'})`);
      }
      this._failAll(this.crashed);
    });

    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => {
      let payload;
      try {
        payload = JSON.parse(line);
      } catch (err) {
        this._failNext(new Error(`invalid JSON from policy server: ${line}`));
        return;
      }
      const next = this.pending.shift();
      if (!next) return;
      next.resolve(payload.action);
    });
    this._stdoutRl = rl;

    this.proc.stderr.on('data', (chunk) => {
      const msg = chunk.toString();
      this.stderrLines.push(msg);
      if (this.stderrLines.length > 20) this.stderrLines.shift();
    });
  }

  _failNext(err) {
    const next = this.pending.shift();
    if (next) next.reject(err);
  }

  _failAll(err) {
    while (this.pending.length > 0) {
      const p = this.pending.shift();
      p.reject(err);
    }
  }

  async decide(ctx) {
    if (this.crashed) throw this.crashed;
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      const payload = {
        tokens: ctx.tokens,
        mask: ctx.mask,
        sample: this.sample,
        temperature: this.temperature,
        epsilon: this.epsilon,
      };
      this.proc.stdin.write(JSON.stringify(payload) + '\n', (err) => {
        if (err) {
          this._failNext(err);
        }
      });
    });
  }

  async close() {
    if (!this.proc || this.proc.killed) return;
    try {
      this.proc.stdin.end();
    } catch (_) {}
    this._stdoutRl.close();
    await new Promise((resolve) => {
      const to = setTimeout(resolve, 400);
      this.proc.once('exit', () => {
        clearTimeout(to);
        resolve();
      });
      try {
        this.proc.kill('SIGTERM');
      } catch (_) {
        clearTimeout(to);
        resolve();
      }
    });
  }
}

function buyProbability(api, G, type, buysThisShop) {
  const def = api.TYPES[type];
  const cost = def.cost || 0;
  let p;

  if (cost >= 13) p = 0.98;
  else if (cost >= 10) p = 0.93;
  else if (cost >= 7) p = 0.86;
  else if (cost >= 5) p = 0.76;
  else if (cost >= 3) p = 0.65;
  else p = 0.52;

  // Deck bloat pressure: bigger crew => more selective.
  const crewSize = G.allCrew.length;
  if (crewSize >= 18) p -= 0.05;
  if (crewSize >= 24) p -= 0.07;
  if (crewSize >= 30) p -= 0.10;

  // Avoid overbuying in one shop visit.
  p -= buysThisShop * 0.12;

  // Early game tolerance to grow deck.
  if (G.round <= 8) p += 0.10;

  // Slightly avoid non-combat fillers.
  if ((def.str || 0) === 0) p -= 0.05;

  return clamp(p, 0.10, 0.99);
}

function adjustedBuyProbability(api, G, type, buysThisShop, quote) {
  let p = buyProbability(api, G, type, buysThisShop);
  if (quote && quote.counter) p += quote.credit ? 0.12 : 0.20;
  if (quote && quote.openingSidePrep) p += 0.16;
  if (quote && quote.routeCounterCover) p += 0.10;
  if (quote && quote.credit) {
    p -= 0.10 + Math.max(0, quote.missing - 1) * 0.08;
    if (G.round <= 2) p += 0.18;
    if (nextShipTurnsAway(G) <= 1) p -= 0.08;
  }
  return clamp(p, 0.05, 0.99);
}

function pickProbabilisticShopIndex(runtime, api, G, buysThisShop) {
  const buyable = [];
  for (let i = 0; i < G.shop.length; i++) {
    const type = G.shop[i];
    const quote = shopPurchaseQuote(api, G, type);
    if (!quote.canBuy) continue;
    buyable.push({ idx: i, cost: quote.cost, credit: quote.credit ? 1 : 0, counter: quote.counter ? 1 : 0, sidePrep: quote.openingSidePrep ? 1 : 0, quote });
  }
  if (!buyable.length) return -1;
  buyable.sort((a, b) => a.credit - b.credit || b.counter - a.counter || b.sidePrep - a.sidePrep || b.cost - a.cost);

  for (const item of buyable) {
    const type = G.shop[item.idx];
    const pBuy = adjustedBuyProbability(api, G, type, buysThisShop, item.quote);
    const roll = runtime ? runtime.rand() : Math.random();
    if (roll <= pBuy) return item.idx;
  }
  return -1;
}

function nextShipTurnsAway(G) {
  if (!G || !G.map || !Array.isArray(G.map.layers)) return 99;
  const currentLayer = Number.isFinite(G.map.currentLayer) ? G.map.currentLayer : -1;
  for (let li = Math.max(0, currentLayer + 1); li < G.map.layers.length; li++) {
    const layer = G.map.layers[li];
    if (layer && layer.length === 1 && layer[0].type === 'ship') return li - currentLayer;
  }
  return 99;
}

function quietDocksProbability(G, buysThisShop) {
  const alert = Math.max(0, Math.floor(Number(G.boardingAlert) || 0));
  let p = 0;
  if (alert >= 6) p = 0.82;
  else if (alert >= 3) p = 0.62;
  else if (alert >= 2) p = 0.34;
  else if (alert >= 1) p = 0.16;

  const turnsAway = nextShipTurnsAway(G);
  if (turnsAway <= 1) p += 0.18;
  else if (turnsAway <= 2) p += 0.10;
  if (G.enthusiasm <= 2) p -= 0.14;
  p -= buysThisShop * 0.04;
  return clamp(p, 0, 0.92);
}

function pickHeuristicShopAction(runtime, api, G, buysThisShop) {
  if (canQuietDocks(api, G) && runtime.rand() <= quietDocksProbability(G, buysThisShop)) return 4;
  const h = pickProbabilisticShopIndex(runtime, api, G, buysThisShop);
  return (h != null && h >= 0) ? h : 5;
}

function makeSimScene(api) {
  const scene = new api.GameScene();
  scene.ct = {
    tip: { setVisible: () => {} },
    gameover: { list: [] },
  };
  scene._sendingToIsland = new Set();
  scene._sacrificedIds = new Set();
  scene._cardHand = { cards: [] };
  scene._combatEnemyViews = {};
  scene._combatPlayerViews = {};
  scene._combatNodes = {};
  scene._combatEffectTimers = [];
  scene._combatSetupDragState = null;
  scene._combatSetupPopupPinned = false;
  scene._combatSetupPopupDismissTimer = null;
  scene._boardingIntroTimer = null;
  scene.renderAll = () => {};
  // Headless sim can still hit direct UI refresh calls from GameScene.
  scene.renderNav = () => {};
  scene.openMapPanel = () => {};
  scene.float = () => {};
  scene.effectText = () => {};
  scene.animateResourceGain = () => {};
  scene.queueHandAppear = () => 0;
  scene.queueCombatPirateReturn = () => false;
  scene.combatWorldPoint = () => ({ x: 0, y: 0 });
  scene.defeatCombatFighter = (fighter, deathPositions) => {
    if (!fighter || !fighter.alive) return false;
    fighter.alive = false;
    fighter.incomingUntil = 0;
    if (fighter.side === 'player' && !scene.isBattleTest()) scene.markPirateWounded(fighter.pirateId);
    if (Array.isArray(deathPositions)) deathPositions.push({ x: 0, y: 0 });
    return true;
  };
  scene.showGameOver = () => {};
  scene.showVictory = () => {};
  scene.sys = { isActive: () => true };
  scene.time = {
    now: 0,
    delayedCall: () => ({ hasDispatched: true, remove: () => {} }),
  };
  scene.L = { k: 1, Y_ISL_CY: 0, cx: 0 };
  return scene;
}

function applyShipWagesForSim(scene, G) {
  const preview = (scene && typeof scene.shipWagePreview === 'function')
    ? scene.shipWagePreview()
    : { wages: (scene && typeof scene.shipWages === 'function') ? scene.shipWages() : 0, alert: 0 };
  const wages = Math.max(0, Math.floor(Number(preview.wages) || 0));
  if (wages > 0) G.enthusiasm += wages;
  const alert = Math.max(0, Math.floor(Number(preview.alert) || 0));
  if (alert > 0 && G.mode !== 'battleTest') {
    G.boardingAlert = Math.max(0, Math.floor(Number(G.boardingAlert) || 0)) + alert;
  }
  return wages;
}

function updateFullCrewDiscountForSim(scene, G) {
  if (scene && typeof scene.updateFullCrewDiscountForCompletedIsland === 'function') {
    return scene.updateFullCrewDiscountForCompletedIsland();
  }
  const maxSend = scene && typeof scene.maxSend === 'function' ? scene.maxSend() : 0;
  const earned = G
    && G.mode !== 'battleTest'
    && G.island
    && !G.island.healWounded
    && maxSend > 0
    && (G.sent || []).length >= maxSend;
  G.fullCrewDiscount = earned ? 1 : 0;
  return G.fullCrewDiscount;
}

function updateOpeningCounterPlanForSim(scene, G) {
  if (scene && typeof scene.updateOpeningCounterPlanForCompletedIsland === 'function') {
    return scene.updateOpeningCounterPlanForCompletedIsland();
  }
  G.openingCounterPlan = false;
  return false;
}

function applyPortDrillForSim(scene) {
  if (scene && typeof scene.applyPortDrill === 'function') {
    return scene.applyPortDrill({ silent: true });
  }
  return null;
}

function applyShortCrewDrillForSim(scene) {
  if (scene && typeof scene.applyShortCrewDrill === 'function') {
    return scene.applyShortCrewDrill({ silent: true });
  }
  return null;
}

function applyShortCrewCounterAlertRefundForSim(scene, shortCrewResult, alertFloorBeforeWages) {
  if (scene && typeof scene.applyShortCrewCounterAlertRefund === 'function') {
    return scene.applyShortCrewCounterAlertRefund(shortCrewResult, alertFloorBeforeWages, { silent: true });
  }
  return { amount: 0 };
}

function applyScoutedCacheDrillForSim(scene, pirate) {
  if (scene && typeof scene.claimScoutedCounterCache === 'function') {
    const claim = scene.claimScoutedCounterCache(pirate, { silent: true });
    if (claim) return claim.drill || null;
  }
  if (scene && typeof scene.applyScoutedCacheDrill === 'function') {
    return scene.applyScoutedCacheDrill(pirate, { silent: true });
  }
  return null;
}

function assertOpeningCommissionCheck(condition, message) {
  if (!condition) throw new Error(`opening commission check failed: ${message}`);
}

function runOpeningCommissionChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];

  const setup = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.round = Math.max(0, Math.floor(Number(opts.round) || 0));
    G.boardingCount = Math.max(0, Math.floor(Number(opts.boardingCount) || 0));
    G.phase = 'sending';
    G.island = scene.buildIslandState(api.ISLANDS[opts.islandIdx || 0]);
    G.sent = [];
    const sentCount = Math.max(0, Math.floor(Number(opts.sent) || 0));
    for (let i = 0; i < sentCount; i++) G.sent.push(i);
    G.enthusiasm = 0;
    G.boardingAlert = Math.max(0, Math.floor(Number(opts.alert) || 0));
    G.fullCrewDiscount = 0;
    G.shopCreditUsed = false;
    scene._sendingToIsland.clear();
    return G;
  };

  const checkProjection = (name, opts, expected) => {
    const G = setup(opts);
    const preview = scene.shipWagePreview();
    const discount = updateFullCrewDiscountForSim(scene, G);
    applyShipWagesForSim(scene, G);
    assertOpeningCommissionCheck(preview.wages === expected.wages, `${name} wages ${preview.wages} !== ${expected.wages}`);
    assertOpeningCommissionCheck(preview.alert === expected.alert, `${name} alert ${preview.alert} !== ${expected.alert}`);
    assertOpeningCommissionCheck((preview.openingCommission || 0) === expected.commission, `${name} commission ${preview.openingCommission || 0} !== ${expected.commission}`);
    assertOpeningCommissionCheck(G.enthusiasm === expected.wages, `${name} granted ${G.enthusiasm} !== ${expected.wages}`);
    assertOpeningCommissionCheck(G.boardingAlert === expected.alert, `${name} granted alert ${G.boardingAlert} !== ${expected.alert}`);
    if (expected.discount != null) {
      assertOpeningCommissionCheck(discount === expected.discount, `${name} discount ${discount} !== ${expected.discount}`);
    }
    results.push({ name, ok: true, preview, discount, granted: G.enthusiasm, boardingAlert: G.boardingAlert });
    return { G, preview, discount };
  };

  checkProjection('normal round 1 full send no commission', { round: 1, islandIdx: 0, sent: 2 }, { wages: 1, alert: 0, commission: 0, discount: 1 });
  checkProjection('normal round 2 full send no commission', { round: 2, islandIdx: 0, sent: 2 }, { wages: 1, alert: 0, commission: 0, discount: 1 });
  checkProjection('port round 1 full send no commission', { round: 1, islandIdx: 3, sent: 3 }, { wages: 1, alert: 0, commission: 0, discount: 1 });
  checkProjection('normal round 1 empty send', { round: 1, islandIdx: 0, sent: 0 }, { wages: 3, alert: 2, commission: 0, discount: 0 });
  checkProjection('normal round 1 one-short send', { round: 1, islandIdx: 0, sent: 1 }, { wages: 3, alert: 1, commission: 1, discount: 0 });
  checkProjection('port round 1 one-short send', { round: 1, islandIdx: 3, sent: 2 }, { wages: 3, alert: 1, commission: 1, discount: 0 });
  checkProjection('port round 1 two-short send', { round: 1, islandIdx: 3, sent: 1 }, { wages: 3, alert: 2, commission: 0, discount: 0 });
  checkProjection('normal round 3 full send', { round: 3, islandIdx: 0, sent: 2 }, { wages: 1, alert: 0, commission: 0, discount: 1 });
  checkProjection('normal round 3 one-short no commission', { round: 3, islandIdx: 0, sent: 1 }, { wages: 2, alert: 1, commission: 0, discount: 0 });
  checkProjection('battle test no commission', { mode: 'battleTest', round: 1, islandIdx: 0, sent: 2 }, { wages: 0, alert: 0, commission: 0, discount: 0 });
  checkProjection('after boarding no commission', { round: 2, boardingCount: 1, islandIdx: 0, sent: 2 }, { wages: 1, alert: 0, commission: 0, discount: 1 });
  checkProjection('after boarding one-short no commission', { round: 2, boardingCount: 1, islandIdx: 0, sent: 1 }, { wages: 2, alert: 1, commission: 0, discount: 0 });
  checkProjection('infirmary no commission', { round: 1, islandIdx: 6, sent: 1 }, { wages: 0, alert: 0, commission: 0, discount: 0 });

  const shopCase = checkProjection('opening full-send discount still buys cost 2', { round: 1, islandIdx: 0, sent: 2 }, { wages: 1, alert: 0, commission: 0, discount: 1 });
  shopCase.G.phase = 'shopping';
  const costTwoType = shopCase.G.shop.find(type => api.TYPES[type] && api.TYPES[type].cost === 2);
  assertOpeningCommissionCheck(!!costTwoType, 'starter shop has no cost-2 pirate');
  const quote = scene.shopPurchaseQuote(costTwoType);
  assertOpeningCommissionCheck(quote.canBuy && !quote.credit, `cost-2 ${costTwoType} was not buyable without credit`);
  results.push({ name: 'starter cost-2 buyable without credit', ok: true, type: costTwoType, quote });

  const uiCase = setup({ round: 1, islandIdx: 0, sent: 1 });
  const planLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(1));
  const fillLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(2, { includePortDrill: true }));
  const action = scene.currentIslandAction();
  assertOpeningCommissionCheck(planLine.includes('+3☠️ Wages') && planLine.includes('Opening'), 'one-short plan line does not expose opening commission total');
  assertOpeningCommissionCheck(!fillLine.includes('Opening') && fillLine.includes('+1☠️ Wages') && fillLine.includes('Full Crew'), `fill crew line incorrectly exposes commission: ${fillLine}`);
  assertOpeningCommissionCheck(action && action.label.includes('+3☠️'), `end button label mismatch: ${action && action.label}`);
  results.push({ name: 'projection UI puts Opening Commission on one-short, not fill crew', ok: true, planLine, fillLine, actionLabel: action.label, sent: uiCase.sent.length });

  return { ok: true, checks: results };
}

function assertPortDrillCheck(condition, message) {
  if (!condition) throw new Error(`port drill check failed: ${message}`);
}

function assertShortCrewDrillCheck(condition, message) {
  if (!condition) throw new Error(`short crew drill check failed: ${message}`);
}

function assertAlertTierCheck(condition, message) {
  if (!condition) throw new Error(`alert tier check failed: ${message}`);
}

function assertScoutedCounterShopCheck(condition, message) {
  if (!condition) throw new Error(`scouted counter shop check failed: ${message}`);
}

function assertScoutedCounterCacheCheck(condition, message) {
  if (!condition) throw new Error(`scouted counter cache check failed: ${message}`);
}

function assertOpeningCounterSubsidyCheck(condition, message) {
  if (!condition) throw new Error(`full crew coverage check failed: ${message}`);
}

function assertOpeningCounterPlanCheck(condition, message) {
  if (!condition) throw new Error(`opening counter prep check failed: ${message}`);
}

function assertOpeningRouteCounterShopCheck(condition, message) {
  if (!condition) throw new Error(`opening route counter shop check failed: ${message}`);
}

function assertOpeningDeckhandCounterCheck(condition, message) {
  if (!condition) throw new Error(`opening deckhand counter check failed: ${message}`);
}

function assertOpeningCachePurseCheck(condition, message) {
  if (!condition) throw new Error(`opening cache purse check failed: ${message}`);
}

function assertOpeningRouteMusterCheck(condition, message) {
  if (!condition) throw new Error(`opening route muster check failed: ${message}`);
}

function assertOpeningRoutePrizeCheck(condition, message) {
  if (!condition) throw new Error(`cache drill opening payoff check failed: ${message}`);
}

function assertOpeningRoutePromotionCheck(condition, message) {
  if (!condition) throw new Error(`opening route promotion check failed: ${message}`);
}

function assertAlarmRushedRouteCounterCheck(condition, message) {
  if (!condition) throw new Error(`alarm-rushed route counter check failed: ${message}`);
}

function assertRouteCounterCoverCheck(condition, message) {
  if (!condition) throw new Error(`route counter cover check failed: ${message}`);
}

function assertCounterRecruitsReportEarlyCheck(condition, message) {
  if (!condition) throw new Error(`counter recruits report early check failed: ${message}`);
}

function assertMapScheduleCheck(condition, message) {
  if (!condition) throw new Error(`map schedule check failed: ${message}`);
}

function assertEncounterScalingCheck(condition, message) {
  if (!condition) throw new Error(`encounter scaling check failed: ${message}`);
}

function assertOpeningRouteCaptainsCheck(condition, message) {
  if (!condition) throw new Error(`opening route captains check failed: ${message}`);
}

function runOpeningRouteCaptainsChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  const samples = 24;
  const routeCases = [
    { islandIdx: 0, mainKey: 'shellback', supportKeys: ['bilgeRat', 'cabinBoy'], res: 'wood', amount: 1, enthusiasm: 1, alert: 0, counter: 'poisoner', label: 'Forest' },
    { islandIdx: 1, mainKey: 'powderBomber', supportKeys: ['bilgeRat', 'bilgeRat'], res: 'stone', amount: 1, enthusiasm: 2, alert: 1, counter: 'sawbones', label: 'Rocky' },
    { islandIdx: 3, mainKey: 'deckSniper', supportKeys: ['cabinBoy', 'cabinBoy'], res: 'gold', amount: 1, enthusiasm: 3, alert: 3, counter: 'needler', label: 'Port' },
  ];
  const routeByIslandIdx = new Map(routeCases.map(route => [route.islandIdx, route]));
  routeCases.forEach((route) => {
    const enemy = api.COMBAT.enemyArchetypes.find(a => a.key === route.mainKey);
    assertOpeningRouteCaptainsCheck(enemy, `${route.mainKey} archetype is missing`);
    const blueprint = api.firstBoardingEncounterBlueprint(route.mainKey);
    assertOpeningRouteCaptainsCheck(blueprint.mainKey === route.mainKey, `${route.label} blueprint main ${blueprint.mainKey} !== ${route.mainKey}`);
    assertOpeningRouteCaptainsCheck(
      JSON.stringify(blueprint.supportKeys) === JSON.stringify(route.supportKeys),
      `${route.label} blueprint support ${JSON.stringify(blueprint.supportKeys)} !== ${JSON.stringify(route.supportKeys)}`
    );
  });

  for (let sample = 0; sample < samples; sample++) {
    runtime.setSeed((0x5eed5e11 + sample * 6151) >>> 0);
    api.initState();
    const G = api.getG();
    const map = G.map;
    assertOpeningRouteCaptainsCheck(map && Array.isArray(map.layers), `sample ${sample} did not generate map layers`);
    const firstShipLayer = map.layers.findIndex(layer => layer && layer.length === 1 && layer[0].type === 'ship');
    assertOpeningRouteCaptainsCheck(firstShipLayer === 1, `sample ${sample} first ship layer ${firstShipLayer} !== 1`);

    const ship = map.layers[firstShipLayer][0];
    const encounter = ship && ship.encounter;
    assertOpeningRouteCaptainsCheck(encounter && encounter.totalCount === 3, `sample ${sample} first total ${encounter && encounter.totalCount} !== 3`);
    assertOpeningRouteCaptainsCheck(
      JSON.stringify(encounter.supportKeys) === JSON.stringify(['bilgeRat', 'cabinBoy']),
      `sample ${sample} first support ${JSON.stringify(encounter.supportKeys)}`
    );

    const firstEligibleCacheNodes = eligibleScoutedCounterCacheNodes(api, map.layers[firstShipLayer - 1]);
    const firstCacheNodes = map.layers[firstShipLayer - 1].filter(node => node && node.scoutedCache);
    assertOpeningRouteCaptainsCheck(firstEligibleCacheNodes.length === routeCases.length, `sample ${sample} first pre-ship layer has ${firstEligibleCacheNodes.length} eligible lanes`);
    assertOpeningRouteCaptainsCheck(
      firstCacheNodes.length === firstEligibleCacheNodes.length,
      `sample ${sample} first cache nodes ${firstCacheNodes.length} !== eligible lanes ${firstEligibleCacheNodes.length}`
    );
    firstEligibleCacheNodes.forEach((node) => {
      const cache = node && node.scoutedCache;
      const route = routeByIslandIdx.get(node.islandIdx);
      assertOpeningRouteCaptainsCheck(route, `sample ${sample} first cache has unexpected island ${node.islandIdx}`);
      const expectedStakes = expectedOpeningScoutedCounterCacheStakes(api, node, route.mainKey);
      assertOpeningRouteCaptainsCheck(cache && cache.mainKey === route.mainKey, `sample ${sample} first cache main ${cache && cache.mainKey} !== ${route.mainKey}`);
      assertOpeningRouteCaptainsCheck(cache.res === expectedStakes.res && cache.res === route.res, `sample ${sample} ${route.label} cache res ${cache.res} !== ${route.res}`);
      assertOpeningRouteCaptainsCheck(
        cache.amount === expectedStakes.amount
          && cache.enthusiasm === route.enthusiasm
          && cache.alert === route.alert,
        `sample ${sample} first cache values ${JSON.stringify(cache)}`
      );
      assertOpeningRouteCaptainsCheck(cache.claimed === false, `sample ${sample} first cache starts claimed`);
    });

    const laterMainKeys = [];
    for (let li = firstShipLayer + 1; li < map.layers.length; li++) {
      const layer = map.layers[li];
      if (layer && layer.length === 1 && layer[0].type === 'ship') {
        laterMainKeys.push(layer[0].encounter && layer[0].encounter.mainKey);
      }
    }
    assertOpeningRouteCaptainsCheck(laterMainKeys.length === 7, `sample ${sample} later ship count ${laterMainKeys.length}`);
  }

  results.push({
    name: 'generated regular maps mark Forest/Rocky/Port Boarding 1 caches with distinct route enemies and support',
    ok: true,
    samples,
  });

  runtime.setSeed(0x2cadcafe);
  api.initState();
  const pendingIntel = scene.nextShipIntel();
  assertOpeningRouteCaptainsCheck(
    pendingIntel && pendingIntel.mainKey === null && pendingIntel.mainLabel === 'Route decides',
    `opening pre-route intel was ${JSON.stringify(pendingIntel)}`
  );
  results.push({ name: 'pre-route Boarding 1 intel waits for the route choice', ok: true });

  for (const route of routeCases) {
    runtime.setSeed(0x2cadcafe);
    api.initState();
    const G = api.getG();
    const map = G.map;
    const firstShipLayer = map.layers.findIndex(layer => layer && layer.length === 1 && layer[0].type === 'ship');
    const ship = map.layers[firstShipLayer][0];
    const cacheNode = map.layers[firstShipLayer - 1].find(node => node && node.islandIdx === route.islandIdx);
    const startNode = cacheNode && map.layers[0].includes(cacheNode)
      ? cacheNode
      : map.layers[0].find(node => node && Array.isArray(node.conns) && cacheNode && node.conns.includes(cacheNode.id));
    assertOpeningRouteCaptainsCheck(cacheNode && cacheNode.scoutedCache, `${route.label} cache route missing`);
    assertOpeningRouteCaptainsCheck(startNode, `${route.label} start route missing`);
    assertOpeningRouteCaptainsCheck(
      startNode.islandIdx === route.islandIdx,
      `${route.label} start island ${startNode.islandIdx} does not match cache island ${route.islandIdx}`
    );

    assertOpeningRouteCaptainsCheck(scene.applyMapNodeSelection(startNode.id), `${route.label} start selection failed`);
    assertOpeningRouteCaptainsCheck(ship.encounter && ship.encounter.mainKey === route.mainKey, `${route.label} route selected ${ship.encounter && ship.encounter.mainKey}`);
    assertOpeningRouteCaptainsCheck(ship.encounter.totalCount === 3, `${route.label} route total ${ship.encounter.totalCount}`);
    assertOpeningRouteCaptainsCheck(
      JSON.stringify(ship.encounter.supportKeys) === JSON.stringify(route.supportKeys),
      `${route.label} route support ${JSON.stringify(ship.encounter.supportKeys)} !== ${JSON.stringify(route.supportKeys)}`
    );
    const enemy = api.COMBAT.enemyArchetypes.find(a => a.key === route.mainKey);
    assertOpeningRouteCaptainsCheck(
      ship.encounter.encounterDesc === (enemy.encounterDesc || enemy.summary),
      `${route.label} route desc ${ship.encounter.encounterDesc}`
    );

    G.phase = 'shopping';
    G.enthusiasm = 9;
    const quote = scene.shopPurchaseQuote(route.counter);
    assertOpeningRouteCaptainsCheck(quote.counter && !quote.topDeck, `${route.label} cash ${route.counter} quote should counter but wait for setup-gated top deck: ${JSON.stringify(quote)}`);
    results.push({ name: `${route.label} route commits Boarding 1 to ${route.mainKey} while cash primary waits for setup-gated top deck`, ok: true, quote });
  }

  return { ok: true, checks: results };
}

function runFirstShellbackChecks(runtime) {
  return runOpeningRouteCaptainsChecks(runtime);
}

function runMapScheduleChecks(runtime) {
  const api = runtime.api;
  const results = [];
  const expectedShipLayers = [1, 9, 14, 19, 24, 29, 34, 39];
  const earlyIslandLayers = [0, 2, 3, 4, 5, 6, 7, 8];
  const expectedEarlyIslandIdx = [0, 1, 3];
  const earlySegments = [
    { base: 0, length: 1 },
    { base: 2, length: 7 },
  ];

  for (let sample = 0; sample < 12; sample++) {
    runtime.setSeed((0x6d2b79f5 + sample * 9973) >>> 0);
    api.initState();
    const map = api.getG().map;
    assertMapScheduleCheck(map && Array.isArray(map.layers), `sample ${sample} did not generate map layers`);
    assertMapScheduleCheck(map.layers.length === api.MAP_LAYERS, `sample ${sample} layer count ${map.layers.length} !== ${api.MAP_LAYERS}`);

    const shipLayers = [];
    for (let li = 0; li < map.layers.length; li++) {
      const layer = map.layers[li];
      if (layer.length === 1 && layer[0].type === 'ship') shipLayers.push(li);
    }
    assertMapScheduleCheck(
      JSON.stringify(shipLayers) === JSON.stringify(expectedShipLayers),
      `sample ${sample} ship layers ${shipLayers.join(',')} !== ${expectedShipLayers.join(',')}`
    );

    for (const li of earlyIslandLayers) {
      const layer = map.layers[li];
      assertMapScheduleCheck(layer && layer.length === 3, `sample ${sample} layer ${li} has ${layer && layer.length} nodes`);
      assertMapScheduleCheck(layer.every(node => node.type === 'island'), `sample ${sample} layer ${li} has non-island node`);
      const islandIdx = layer.map(node => node.islandIdx).sort((a, b) => a - b);
      assertMapScheduleCheck(
        JSON.stringify(islandIdx) === JSON.stringify(expectedEarlyIslandIdx),
        `sample ${sample} layer ${li} islands ${islandIdx.join(',')} are not Forest/Rocky/Port once`
      );
    }

    for (let pi = 0; pi < 3; pi++) {
      const cacheNode = map.layers[0][pi];
      assertMapScheduleCheck(
        cacheNode.scoutedCache,
        `sample ${sample} opening path ${pi} layer-0 cache is missing`
      );
    }

    for (const { base, length } of earlySegments) {
      for (let step = 0; step < length - 1; step++) {
        const cur = map.layers[base + step];
        const nxt = map.layers[base + step + 1];
        for (let pi = 0; pi < cur.length; pi++) {
          assertMapScheduleCheck(
            JSON.stringify(cur[pi].conns) === JSON.stringify([nxt[pi].id]),
            `sample ${sample} layer ${base + step} path ${pi} does not connect straight`
          );
        }
      }
      const lastIslands = map.layers[base + length - 1];
      const ship = map.layers[base + length][0];
      assertMapScheduleCheck(ship && ship.type === 'ship', `sample ${sample} layer ${base + length} is not a ship`);
      for (const node of lastIslands) {
        assertMapScheduleCheck(
          JSON.stringify(node.conns) === JSON.stringify([ship.id]),
          `sample ${sample} early segment ending ${base + length - 1} does not converge into ship`
        );
      }
    }
  }

  results.push({
    name: '40-layer map schedule with early 1/7 islands and straight early paths',
    ok: true,
    samples: 12,
    shipLayers: expectedShipLayers,
    earlyIslandLayers,
  });
  return { ok: true, checks: results };
}

function encounterTierCounts(api, keys) {
  const archetypeMap = new Map(api.COMBAT.enemyArchetypes.map((a) => [a.key, a]));
  const counts = { weak: 0, strong: 0, unknown: 0 };
  keys.forEach((key) => {
    const arch = archetypeMap.get(key);
    if (!arch || !counts.hasOwnProperty(arch.tier)) counts.unknown++;
    else counts[arch.tier]++;
  });
  return counts;
}

function runEncounterScalingChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  let sawFlintAtBoarding5 = false;

  for (let sample = 0; sample < 160; sample++) {
    runtime.setSeed((0x47c6b7d3 + sample * 2654435761) >>> 0);
    const boarding5 = api.generateEncounterBlueprint(5);
    const keys5 = [boarding5.mainKey, ...(boarding5.supportKeys || [])];
    const counts5 = encounterTierCounts(api, keys5);
    assertEncounterScalingCheck(boarding5.totalCount === 5, `Boarding 5 total ${boarding5.totalCount} !== 5`);
    assertEncounterScalingCheck(keys5.length === 5, `Boarding 5 keys ${keys5.join(',')} length !== 5`);
    assertEncounterScalingCheck(counts5.strong === 4, `Boarding 5 strong count ${counts5.strong} !== 4: ${keys5.join(',')}`);
    assertEncounterScalingCheck(counts5.weak === 1, `Boarding 5 weak count ${counts5.weak} !== 1: ${keys5.join(',')}`);
    assertEncounterScalingCheck(counts5.unknown === 0, `Boarding 5 unknown keys: ${keys5.join(',')}`);
    if (keys5.includes('flintDuelist')) sawFlintAtBoarding5 = true;

    const fallback5 = scene.combatEncounterArchetypesFallback(5);
    const fallbackCounts5 = fallback5.reduce((counts, arch) => {
      if (arch && arch.tier === 'strong') counts.strong++;
      else if (arch && arch.tier === 'weak') counts.weak++;
      else counts.unknown++;
      return counts;
    }, { weak: 0, strong: 0, unknown: 0 });
    assertEncounterScalingCheck(fallback5.length === 5, `fallback Boarding 5 count ${fallback5.length} !== 5`);
    assertEncounterScalingCheck(fallbackCounts5.strong === 4, `fallback Boarding 5 strong ${fallbackCounts5.strong} !== 4`);
    assertEncounterScalingCheck(fallbackCounts5.weak === 1, `fallback Boarding 5 weak ${fallbackCounts5.weak} !== 1`);
    assertEncounterScalingCheck(fallbackCounts5.unknown === 0, 'fallback Boarding 5 contains unknown tier');

    const boarding6 = api.generateEncounterBlueprint(6);
    const keys6 = [boarding6.mainKey, ...(boarding6.supportKeys || [])];
    const counts6 = encounterTierCounts(api, keys6);
    assertEncounterScalingCheck(boarding6.totalCount === 5, `Boarding 6 total ${boarding6.totalCount} !== 5`);
    assertEncounterScalingCheck(keys6.length === 5, `Boarding 6 keys ${keys6.join(',')} length !== 5`);
    assertEncounterScalingCheck(counts6.strong === 5, `Boarding 6 strong count ${counts6.strong} !== 5: ${keys6.join(',')}`);
    assertEncounterScalingCheck(counts6.weak === 0, `Boarding 6 weak count ${counts6.weak} !== 0: ${keys6.join(',')}`);
    assertEncounterScalingCheck(counts6.unknown === 0, `Boarding 6 unknown keys: ${keys6.join(',')}`);
    const fallback6 = scene.combatEncounterArchetypesFallback(6);
    assertEncounterScalingCheck(fallback6.length === 5, `fallback Boarding 6 count ${fallback6.length} !== 5`);
    assertEncounterScalingCheck(
      fallback6.every(arch => arch && arch.tier === 'strong'),
      `fallback Boarding 6 is not all strong: ${fallback6.map(arch => arch && arch.key).join(',')}`
    );

    const boarding7 = api.generateEncounterBlueprint(7);
    const keys7 = [boarding7.mainKey, ...(boarding7.supportKeys || [])];
    const counts7 = encounterTierCounts(api, keys7);
    assertEncounterScalingCheck(boarding7.totalCount === 5, `Boarding 7 total ${boarding7.totalCount} !== 5`);
    assertEncounterScalingCheck(counts7.strong === 5 && counts7.weak === 0, `Boarding 7 changed: ${keys7.join(',')}`);

    const boarding8 = api.generateEncounterBlueprint(8);
    const keys8 = [boarding8.mainKey, ...(boarding8.supportKeys || [])];
    const counts8 = encounterTierCounts(api, keys8);
    assertEncounterScalingCheck(boarding8.totalCount === 5, `Boarding 8 total ${boarding8.totalCount} !== 5`);
    assertEncounterScalingCheck(counts8.strong === 5 && counts8.weak === 0, `Boarding 8 changed: ${keys8.join(',')}`);
  }

  assertEncounterScalingCheck(sawFlintAtBoarding5, 'Boarding 5 samples never included Flint Duelist');
  results.push({
    name: 'Boarding 5 is 4 strong plus 1 weak while Boardings 6-8 stay all-strong',
    ok: true,
    samples: 160,
    sawFlintAtBoarding5,
  });
  return { ok: true, checks: results };
}

function makeScoutedCounterTestMap(mainKey) {
  return {
    layers: [
      [{ id: 1, type: 'island', islandIdx: 0, conns: [2] }],
      [{ id: 2, type: 'ship', strength: 6, openingRouteMainKey: mainKey, encounter: { mainKey, supportKeys: ['bilgeRat', 'cabinBoy'], totalCount: 3 }, conns: [] }],
    ],
    visited: [],
    currentNodeId: null,
    currentLayer: -1,
  };
}

function makeDistantScoutedCounterTestMap(mainKey) {
  return {
    layers: [
      [{ id: 1, type: 'island', islandIdx: 0, conns: [2] }],
      [{ id: 2, type: 'island', islandIdx: 1, conns: [3] }],
      [{ id: 3, type: 'island', islandIdx: 2, conns: [4] }],
      [{ id: 4, type: 'island', islandIdx: 3, conns: [5] }],
      [{ id: 5, type: 'ship', strength: 6, openingRouteMainKey: mainKey, encounter: { mainKey, supportKeys: ['bilgeRat', 'cabinBoy'], totalCount: 3 }, conns: [] }],
    ],
    visited: [1],
    currentNodeId: 1,
    currentLayer: 0,
  };
}

function runScoutedCounterShopChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  const powderMap = makeScoutedCounterTestMap('powderBomber');

  for (let i = 0; i < 20; i++) {
    const shop = api.initialShop(4, 0, { map: powderMap, mode: 'run' });
    assertScoutedCounterShopCheck(shop.includes('sawbones'), `initial Powder Bomber shop lacks Sawbones: ${shop.join(',')}`);
    assertScoutedCounterShopCheck(new Set(shop).size === shop.length, `initial shop has duplicate: ${shop.join(',')}`);
  }
  results.push({ name: 'initial Powder Bomber shops include Sawbones', ok: true });

  const missShop = ['poisoner', 'trainer', 'needler', 'herald'];
  const adjusted = api.applyScoutedCounterToShop(missShop, 0, { map: powderMap, mode: 'run', newSlotIndex: 3 });
  assertScoutedCounterShopCheck(adjusted.includes('sawbones'), `adjusted miss shop lacks Sawbones: ${adjusted.join(',')}`);
  assertScoutedCounterShopCheck(new Set(adjusted).size === adjusted.length, `adjusted shop has duplicate: ${adjusted.join(',')}`);
  assertScoutedCounterShopCheck(adjusted.slice(0, 3).join(',') === missShop.slice(0, 3).join(','), 'counter swap changed non-new slots');
  results.push({ name: 'counter swap replaces only new slot', ok: true, adjusted });

  const refillBase = ['drummer', 'trainer', 'herald'];
  const refill = api.randomShopType(2, refillBase, { map: powderMap, mode: 'run' });
  const refilledShop = [...refillBase, refill];
  assertScoutedCounterShopCheck(refill === 'sawbones', `purchase refill chose ${refill} instead of Sawbones`);
  assertScoutedCounterShopCheck(new Set(refilledShop).size === refilledShop.length, `refill shop has duplicate: ${refilledShop.join(',')}`);
  results.push({ name: 'purchase/Continue refill slot can force counter without duplicates', ok: true, refilledShop });

  const battleShop = api.applyScoutedCounterToShop(missShop, 0, { map: powderMap, mode: 'battleTest', newSlotIndex: 3 });
  assertScoutedCounterShopCheck(JSON.stringify(battleShop) === JSON.stringify(missShop), `battle test shop changed: ${battleShop.join(',')}`);
  const unknownShop = api.applyScoutedCounterToShop(missShop, 0, {
    map: makeScoutedCounterTestMap('unknownEnemy'),
    mode: 'run',
    newSlotIndex: 3,
  });
  assertScoutedCounterShopCheck(JSON.stringify(unknownShop) === JSON.stringify(missShop), `unknown-counter shop changed: ${unknownShop.join(',')}`);
  results.push({ name: 'battle test and no-counter maps are unchanged', ok: true });

  api.initState();
  const G = api.getG();
  G.mode = 'run';
  G.map = powderMap;
  G.round = 2;
  G.phase = 'shopping';
  G.enthusiasm = 3;
  G.fullCrewDiscount = 0;
  G.shopCreditUsed = false;
  G.shop = ['needler', 'sawbones', 'trainer', 'herald'];
  const best = scene.bestVisibleShopPurchase();
  const plan = scene.shopPlanText();
  assertScoutedCounterShopCheck(best && best.type === 'sawbones', `best visible buy is ${best && best.type}`);
  assertScoutedCounterShopCheck(plan.includes('Counter Sawbones'), `plan text lacks counter label: ${plan}`);
  results.push({ name: 'recommendation prefers same-tier counter and labels it', ok: true, plan });

  return { ok: true, checks: results };
}

function eligibleScoutedCounterCacheNodes(api, layer) {
  return (Array.isArray(layer) ? layer : []).filter((node) => {
    const island = node && node.type === 'island' ? api.ISLANDS[node.islandIdx] : null;
    return island && !island.healWounded;
  });
}

function expectedScoutedCounterCacheNode(api, layer, res) {
  const candidates = eligibleScoutedCounterCacheNodes(api, layer);
  if (!candidates.length) return null;

  const matchingBonus = candidates.find((node) => {
    const island = api.ISLANDS[node.islandIdx];
    return island && island.bonus === res;
  });
  if (matchingBonus) return matchingBonus;

  const port = candidates.find((node) => {
    const island = api.ISLANDS[node.islandIdx];
    return island && island.extraSend;
  });
  return port || candidates[0];
}

function expectedOpeningScoutedCounterCacheResource(api, node, mainKey) {
  const island = node && node.type === 'island' ? api.ISLANDS[node.islandIdx] : null;
  if (!island) return api.SCOUTED_COUNTER_CACHE_RES[mainKey] || null;
  if (island.bonus === 'wood' || island.bonus === 'stone') return island.bonus;
  if (island.extraSend) return 'gold';
  return api.SCOUTED_COUNTER_CACHE_RES[mainKey] || null;
}

function expectedOpeningScoutedCounterCacheStakes(api, node, mainKey) {
  const island = node && node.type === 'island' ? api.ISLANDS[node.islandIdx] : null;
  if (island && island.bonus === 'wood') return { res: 'wood', amount: 1, enthusiasm: 1, alert: 0 };
  if (island && island.bonus === 'stone') return { res: 'stone', amount: 1, enthusiasm: 2, alert: 1 };
  if (island && island.extraSend) return { res: 'gold', amount: 1, enthusiasm: 3, alert: 3 };
  return {
    res: expectedOpeningScoutedCounterCacheResource(api, node, mainKey),
    amount: 1,
    enthusiasm: 1,
    alert: 1,
  };
}

function cacheDrillAlertRefundCap(alert) {
  return Math.min(Math.max(0, Math.floor(Number(alert) || 0)), 1);
}

function alertAfterCacheDrill(floor, cacheAlert) {
  const base = Math.max(0, Math.floor(Number(floor) || 0));
  const alert = Math.max(0, Math.floor(Number(cacheAlert) || 0));
  return base + alert - cacheDrillAlertRefundCap(alert);
}

function runScoutedCounterCacheChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  let generatedCacheCount = 0;
  const openingRouteByIslandIdx = new Map([
    [0, { islandIdx: 0, mainKey: 'shellback', res: 'wood', amount: 1, enthusiasm: 1, alert: 0, label: 'Forest', counterType: 'poisoner' }],
    [1, { islandIdx: 1, mainKey: 'powderBomber', res: 'stone', amount: 1, enthusiasm: 2, alert: 1, label: 'Rocky', counterType: 'sawbones' }],
    [3, { islandIdx: 3, mainKey: 'deckSniper', res: 'gold', amount: 1, enthusiasm: 3, alert: 3, label: 'Port', counterType: 'needler' }],
  ]);

  for (let sample = 0; sample < 12; sample++) {
    runtime.setSeed((0x8f53a31d + sample * 7919) >>> 0);
    api.initState();
    const G = api.getG();
    const map = G.map;
    assertScoutedCounterCacheCheck(map && Array.isArray(map.layers), `sample ${sample} did not generate map`);

    const shipCacheLayers = [];
    let shipNo = 0;
    for (let li = 1; li < map.layers.length; li++) {
      const layer = map.layers[li];
      if (!layer || layer.length !== 1 || layer[0].type !== 'ship') continue;
      shipNo++;

      const ship = layer[0];
      const mainKey = ship.encounter && ship.encounter.mainKey;
      const res = api.SCOUTED_COUNTER_CACHE_RES[mainKey];
      const prevLayer = map.layers[li - 1];
      const eligibleNodes = eligibleScoutedCounterCacheNodes(api, prevLayer);
      if (!res || !eligibleNodes.length) continue;

      const cacheNodes = prevLayer.filter((node) => node && node.scoutedCache);
      if (shipNo === 1) {
        const eligibleIds = new Set(eligibleNodes.map((node) => node.id));
        assertScoutedCounterCacheCheck(
          cacheNodes.length === eligibleNodes.length,
          `sample ${sample} first pre-boarding layer ${li - 1} has ${cacheNodes.length} caches for ${eligibleNodes.length} eligible lanes`
        );
        for (const node of cacheNodes) {
          assertScoutedCounterCacheCheck(eligibleIds.has(node.id), `sample ${sample} first cache marked ineligible node ${node.id}`);
        }
      } else {
        const expectedNode = expectedScoutedCounterCacheNode(api, prevLayer, res);
        assertScoutedCounterCacheCheck(cacheNodes.length === 1, `sample ${sample} layer ${li - 1} has ${cacheNodes.length} caches`);
        assertScoutedCounterCacheCheck(cacheNodes[0].id === expectedNode.id, `sample ${sample} cache node ${cacheNodes[0].id} !== preferred ${expectedNode.id}`);
      }

      for (const cacheNode of cacheNodes) {
        const cache = cacheNode.scoutedCache;
        const expectedMain = shipNo === 1
          ? (openingRouteByIslandIdx.get(cacheNode.islandIdx) || {}).mainKey
          : mainKey;
        const expectedStakes = shipNo === 1
          ? expectedOpeningScoutedCounterCacheStakes(api, cacheNode, expectedMain)
          : { res, amount: 1, enthusiasm: 1, alert: 1 };
        assertScoutedCounterCacheCheck(cache.mainKey === expectedMain, `sample ${sample} cache main ${cache.mainKey} !== ${expectedMain}`);
        assertScoutedCounterCacheCheck(cache.res === expectedStakes.res, `sample ${sample} cache res ${cache.res} !== ${expectedStakes.res}`);
        assertScoutedCounterCacheCheck(
          cache.amount === expectedStakes.amount
            && cache.enthusiasm === expectedStakes.enthusiasm
            && cache.alert === expectedStakes.alert,
          `sample ${sample} cache amount/enthusiasm/alert ${cache.amount}/${cache.enthusiasm}/${cache.alert}`
        );
        assertScoutedCounterCacheCheck(cache.claimed === false, `sample ${sample} cache starts claimed`);
      }
      shipCacheLayers.push(li - 1);
      generatedCacheCount += cacheNodes.length;
    }

    const firstShipLayer = map.layers.findIndex(layer => layer && layer.length === 1 && layer[0].type === 'ship');
    const firstEligibleNodes = firstShipLayer > 0
      ? eligibleScoutedCounterCacheNodes(api, map.layers[firstShipLayer - 1])
      : [];
    const firstCaches = firstShipLayer > 0
      ? map.layers[firstShipLayer - 1].filter((node) => node && node.scoutedCache)
      : null;
    assertScoutedCounterCacheCheck(
      firstCaches && firstCaches.length === firstEligibleNodes.length && firstCaches.every(node => !node.scoutedCache.claimed),
      `sample ${sample} first ship caches are missing before route selection`
    );
    assertScoutedCounterCacheCheck(shipCacheLayers.length === 8, `sample ${sample} generated ${shipCacheLayers.length} caches`);
  }
  results.push({ name: 'generated regular maps mark every Boarding 1 lane and one preferred cache before later ships', ok: true, samples: 12, generatedCacheCount });

  for (const cacheCase of openingRouteByIslandIdx.values()) {
    runtime.setSeed(0x5c0a7e11);
    api.initState();
    const G = api.getG();
    const map = G.map;
    const firstShipLayer = map.layers.findIndex(layer => layer && layer.length === 1 && layer[0].type === 'ship');
    const firstShip = map.layers[firstShipLayer][0];
    const cacheNodes = map.layers[firstShipLayer - 1].filter((node) => node && node.scoutedCache);
    assertScoutedCounterCacheCheck(cacheNodes.length > 1, `first cache selection sample has only ${cacheNodes.length} cache lane`);
    const chosen = cacheNodes.find((node) => node && node.islandIdx === cacheCase.islandIdx);
    assertScoutedCounterCacheCheck(chosen, `first cache selection sample lacks ${cacheCase.label} lane`);
    const untouched = cacheNodes.filter((node) => node !== chosen);
    const cache = chosen.scoutedCache;
    assertScoutedCounterCacheCheck(cache.res === cacheCase.res, `${cacheCase.label} cache res ${cache.res} !== ${cacheCase.res}`);
    assertScoutedCounterCacheCheck(cache.mainKey === cacheCase.mainKey, `${cacheCase.label} cache main ${cache.mainKey} !== ${cacheCase.mainKey}`);
    assertScoutedCounterCacheCheck(
      cache.amount === cacheCase.amount && cache.enthusiasm === cacheCase.enthusiasm && cache.alert === cacheCase.alert,
      `${cacheCase.label} cache values ${JSON.stringify(cache)}`
    );
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.enthusiasm = 0;
    G.boardingAlert = 2;
    G.phase = 'map';
    const handled = scene.applyMapNodeSelection(chosen.id);
    assertScoutedCounterCacheCheck(handled, 'generated first cache island selection failed');
    assertScoutedCounterCacheCheck(firstShip.encounter && firstShip.encounter.mainKey === cacheCase.mainKey, `${cacheCase.label} selection did not route first ship to ${cacheCase.mainKey}`);
    assertScoutedCounterCacheCheck(chosen.scoutedCache.claimed === false, 'selected first cache was claimed before a pirate opened it');
    assertScoutedCounterCacheCheck(untouched.every(node => node.scoutedCache && node.scoutedCache.claimed === false), 'unselected first cache lane was claimed');
    assertScoutedCounterCacheCheck(G.res[cache.res] === 0, `generated first cache granted ${cache.res} on selection: ${G.res[cache.res]}`);
    assertScoutedCounterCacheCheck(G.enthusiasm === 0, `generated first cache enthusiasm on selection ${G.enthusiasm}`);
    assertScoutedCounterCacheCheck(G.boardingAlert === 2, `generated first cache alert on selection ${G.boardingAlert} !== 2`);
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill && G.island.scoutedCacheDrill.mainKey === cache.mainKey, 'generated first cache did not arm Cache Drill');
    const expectedRefund = cacheDrillAlertRefundCap(cacheCase.alert);
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill.alertRefundAmount === expectedRefund, `${cacheCase.label} cache drill refund amount ${G.island.scoutedCacheDrill.alertRefundAmount} !== ${expectedRefund}`);
    const opener = G.hand[0];
    opener.type = cacheCase.counterType;
    opener.might = 0;
    G.sent = [0];
    const claim = scene.claimScoutedCounterCache(opener, { silent: true });
    assertScoutedCounterCacheCheck(claim && claim.cacheGrant, `${cacheCase.label} first sent counter did not open cache`);
    assertScoutedCounterCacheCheck(chosen.scoutedCache.claimed === true, 'selected first cache was not claimed after opener');
    assertScoutedCounterCacheCheck(G.res[cache.res] === 1, `generated first cache opener granted ${cache.res} ${G.res[cache.res]}`);
    assertScoutedCounterCacheCheck(G.enthusiasm === cacheCase.enthusiasm, `generated first cache opener enthusiasm ${G.enthusiasm} !== ${cacheCase.enthusiasm}`);
    assertScoutedCounterCacheCheck(claim.drill && claim.drill.applied, `${cacheCase.label} counter opener did not drill`);
    assertScoutedCounterCacheCheck(claim.drill.alertRefund && claim.drill.alertRefund.amount === expectedRefund, `${cacheCase.label} counter opener refund ${JSON.stringify(claim.drill.alertRefund)} !== ${expectedRefund}`);
    assertScoutedCounterCacheCheck(G.boardingAlert === alertAfterCacheDrill(2, cacheCase.alert), `generated first cache counter opener alert ${G.boardingAlert} !== ${alertAfterCacheDrill(2, cacheCase.alert)}`);
    assertScoutedCounterCacheCheck(
      Object.keys(G.res).every((res) => (res === cacheCase.res ? G.res[res] === 1 : G.res[res] === 0)),
      `${cacheCase.label} cache changed wrong resources ${JSON.stringify(G.res)}`
    );
    results.push({ name: `${cacheCase.label} Boarding 1 cache pays only when first sent counter opens and drills`, ok: true });
  }

  {
    const cacheCase = openingRouteByIslandIdx.get(3);
    runtime.setSeed(0x5c0a7e11);
    api.initState();
    const G = api.getG();
    const map = G.map;
    const firstShipLayer = map.layers.findIndex(layer => layer && layer.length === 1 && layer[0].type === 'ship');
    const firstShip = map.layers[firstShipLayer][0];
    const chosen = map.layers[firstShipLayer - 1].find((node) => node && node.islandIdx === cacheCase.islandIdx);
    assertScoutedCounterCacheCheck(chosen && chosen.scoutedCache, 'Port non-counter cache route missing');
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.enthusiasm = 0;
    G.boardingAlert = 0;
    G.phase = 'map';
    assertScoutedCounterCacheCheck(scene.applyMapNodeSelection(chosen.id), 'Port non-counter cache selection failed');
    const opener = G.hand[0];
    opener.type = 'miner';
    opener.might = 0;
    G.sent = [0];
    const claim = scene.claimScoutedCounterCache(opener, { silent: true });
    assertScoutedCounterCacheCheck(claim && claim.cacheGrant && !claim.drill, `Port non-counter claim mismatch: ${JSON.stringify(claim)}`);
    assertScoutedCounterCacheCheck(G.res.gold === 1, `Port non-counter cache gold ${G.res.gold} !== 1`);
    assertScoutedCounterCacheCheck(G.enthusiasm === 3, `Port non-counter cache skulls ${G.enthusiasm} !== 3`);
    assertScoutedCounterCacheCheck(G.boardingAlert === 3, `Port non-counter cache Alert ${G.boardingAlert} !== 3`);
    assertScoutedCounterCacheCheck(scene.boardingAlertGuardCount(G.boardingAlert) === 2, 'Port non-counter cache Alert did not reach the two-guard tier');
    G.phase = 'map';
    assertScoutedCounterCacheCheck(scene.applyMapNodeSelection(firstShip.id), 'Port non-counter first boarding selection failed');
    assertScoutedCounterCacheCheck(G.phase === 'boarding' && G.enemyShip && G.enemyShip.boardingAlert === 3, `Port boarding Alert snapshot mismatch: ${JSON.stringify(G.enemyShip)}`);
    assertScoutedCounterCacheCheck(G.enemyShip.boardingAlertGuards === 2, `Port boarding guard tier ${G.enemyShip.boardingAlertGuards} !== 2`);
    results.push({ name: 'Port non-counter opener keeps +3 cache Alert into Boarding 1 for the two-guard tier', ok: true });
  }

  {
    api.initBattleTestState();
    const G = api.getG();
    assertScoutedCounterCacheCheck(G.mode === 'battleTest' && G.map === null, 'Battle Test generated a cache-bearing map');
    results.push({ name: 'Battle Test starts without a map or cache lanes', ok: true });
  }

  const selectNode = (node, opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.map = {
      layers: [[node], [{ id: 99, type: 'ship', strength: 6, encounter: { mainKey: 'shellback', supportKeys: [], totalCount: 1 }, conns: [] }]],
      visited: [],
      currentNodeId: null,
      currentLayer: -1,
    };
    G.phase = 'map';
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.enthusiasm = 0;
    G.boardingAlert = Math.max(0, Math.floor(Number(opts.boardingAlert) || 0));
    G.enemyShip = null;
    G.island = null;
    G.healing = null;
    return { G, handled: scene.applyMapNodeSelection(node.id) };
  };

  {
    const node = {
      id: 10,
      type: 'island',
      islandIdx: 0,
      conns: [99],
      scoutedCache: { mainKey: 'shellback', res: 'wood', amount: 1, enthusiasm: 1, alert: 1, claimed: false },
    };
    const { G, handled } = selectNode(node, { boardingAlert: 2 });
    assertScoutedCounterCacheCheck(handled, 'cache island selection failed');
    assertScoutedCounterCacheCheck(G.res.wood === 0, `cache granted wood on selection ${G.res.wood}`);
    assertScoutedCounterCacheCheck(G.enthusiasm === 0, `cache granted enthusiasm on selection ${G.enthusiasm}`);
    assertScoutedCounterCacheCheck(G.boardingAlert === 2, `cache alert changed on selection ${G.boardingAlert} !== 2`);
    assertScoutedCounterCacheCheck(node.scoutedCache.claimed === false, 'cache was claimed on selection');
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill && G.island.scoutedCacheDrill.mainKey === 'shellback', 'cache island did not arm pending Cache Drill');
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill.alertRefundAmount === 1, `cache refund amount ${G.island.scoutedCacheDrill.alertRefundAmount} !== 1`);
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill.alertFloorBeforeCache === 0, `cache refund floor should wait for opener, got ${G.island.scoutedCacheDrill.alertFloorBeforeCache}`);
    const nonCounter = G.hand[0];
    const secondCounter = G.hand[1];
    nonCounter.type = 'miner';
    secondCounter.type = 'poisoner';
    secondCounter.might = 0;
    G.sent = [0];
    const nonCounterClaim = scene.claimScoutedCounterCache(nonCounter, { silent: true });
    assertScoutedCounterCacheCheck(nonCounterClaim && nonCounterClaim.cacheGrant && !nonCounterClaim.drill, `non-counter opener claim mismatch: ${JSON.stringify(nonCounterClaim)}`);
    assertScoutedCounterCacheCheck(G.res.wood === 1, `claimed cache granted again to wood ${G.res.wood}`);
    assertScoutedCounterCacheCheck(G.enthusiasm === 1, `non-counter opener enthusiasm ${G.enthusiasm} !== 1`);
    assertScoutedCounterCacheCheck(G.boardingAlert === 3, `claimed cache alerted again to ${G.boardingAlert}`);
    assertScoutedCounterCacheCheck(node.scoutedCache.claimed === true, 'cache was not claimed by first opener');
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill.cacheClaimed === true && G.island.scoutedCacheDrill.granted === false, 'non-counter opener consumed Cache Drill reward state incorrectly');
    G.sent = [0, 1];
    const second = scene.claimScoutedCounterCache(secondCounter, { silent: true }) || applyScoutedCacheDrillForSim(scene, secondCounter);
    assertScoutedCounterCacheCheck(!second, 'second sent counter claimed or drilled an already opened cache');
    assertScoutedCounterCacheCheck((secondCounter.might || 0) === 0, 'second sent counter gained Might from already opened cache');
    assertScoutedCounterCacheCheck(G.res.wood === 1 && G.enthusiasm === 1 && G.boardingAlert === 3, `second send changed cache rewards ${JSON.stringify({ res: G.res, enthusiasm: G.enthusiasm, alert: G.boardingAlert })}`);
    results.push({ name: 'cache selection delays payout; first non-counter opens once and later counters cannot drill', ok: true });
  }

  {
    const node = {
      id: 11,
      type: 'island',
      islandIdx: 0,
      conns: [99],
      scoutedCache: { mainKey: 'shellback', res: 'wood', amount: 1, enthusiasm: 1, alert: 1, claimed: false },
    };
    const { G, handled } = selectNode(node, { boardingAlert: 4 });
    assertScoutedCounterCacheCheck(handled && G.phase === 'sending', 'no-send cache island selection failed');
    assertScoutedCounterCacheCheck(G.sent.length === 0 && node.scoutedCache.claimed === false, 'no-send setup started claimed or sent');
    const wagePreview = scene.shipWagePreview();
    applyShipWagesForSim(scene, G);
    assertScoutedCounterCacheCheck(node.scoutedCache.claimed === false, 'zero-send ending claimed the cache');
    assertScoutedCounterCacheCheck(G.res.wood === 0, `zero-send cache granted wood ${G.res.wood}`);
    assertScoutedCounterCacheCheck(G.enthusiasm === wagePreview.wages, `zero-send cache changed enthusiasm ${G.enthusiasm} !== wages ${wagePreview.wages}`);
    assertScoutedCounterCacheCheck(G.boardingAlert === 4 + wagePreview.alert, `zero-send cache changed alert ${G.boardingAlert} !== wage alert ${4 + wagePreview.alert}`);
    results.push({ name: 'ending a cache island with zero sent pirates pays only normal Ship Wages and leaves the cache unopened', ok: true });
  }

  {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.map = makeScoutedCounterTestMap('powderBomber');
    G.round = 3;
    G.boardingCount = 0;
    G.phase = 'sending';
    G.island = scene.buildIslandState(api.ISLANDS[0]);
    G.shop = ['sawbones'];
    G.enthusiasm = 1;
    G.boardingAlert = 1;
    G.shopCreditUsed = false;
    const wage = scene.shipWageProjection(2);
    const discount = scene.projectFullCrewDiscount(2);
    const quote = scene.shopPurchaseQuote('sawbones', {
      enthusiasm: G.enthusiasm + wage.wages,
      boardingAlert: G.boardingAlert + wage.alert,
      fullCrewDiscount: discount,
      shopCreditUsed: false,
      allowCredit: true,
    });
    const plan = scene.formatSendingPlanLine(scene.sendingPlanProjection(2));
    assertScoutedCounterCacheCheck(wage.wages === 1 && discount === 1, `full-send projection wages/discount ${wage.wages}/${discount}`);
    assertScoutedCounterCacheCheck(quote.canBuy && !quote.credit, `cache bounty full-send quote needed credit: ${JSON.stringify(quote)}`);
    assertScoutedCounterCacheCheck(quote.counter && quote.topDeck && !quote.preparedCounter, `pre-boarding cache bounty quote should top-deck without discount preparation: ${JSON.stringify(quote)}`);
    assertScoutedCounterCacheCheck(quote.effectiveCost === 2 && quote.spend === 2, `cache bounty quote cost/spend ${quote.effectiveCost}/${quote.spend}`);
    assertScoutedCounterCacheCheck(!plan.includes('prepared') && plan.includes('top deck') && !plan.includes('credit'), `cache bounty plan should top-deck without pre-boarding preparation: ${plan}`);
    results.push({ name: 'pre-boarding cache bounty plus full-send discount makes a cost-3 counter affordable without Prepared or Dockside Credit', ok: true, plan });
  }

  const setupDrill = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.round = 1;
    G.boardingCount = Math.max(0, Math.floor(Number(opts.boardingCount) || 0));
    if (opts.map) {
      G.map = opts.map;
    }
    G.phase = 'sending';
    G.island = scene.buildIslandState(api.ISLANDS[opts.islandIdx != null ? opts.islandIdx : 0]);
    if (opts.cache !== false) {
      const cacheAlert = Math.max(0, Math.floor(Number(opts.alertRefundAmount) || 0));
      G.island.scoutedCacheDrill = {
        mainKey: opts.mainKey || 'shellback',
        granted: false,
        cachePending: true,
        cacheClaimed: false,
        cacheNodeId: opts.cacheNodeId != null ? opts.cacheNodeId : null,
        openerId: null,
        res: opts.cacheRes || 'wood',
        amount: opts.cacheAmount == null ? 1 : Math.max(0, Math.floor(Number(opts.cacheAmount) || 0)),
        enthusiasm: Math.max(0, Math.floor(Number(opts.cacheEnthusiasm) || 0)),
        alert: cacheAlert,
        alertRefundAmount: cacheAlert,
        alertFloorBeforeCache: 0,
        alertRefunded: false,
      };
    }
    const pirates = [
      { id: 9001, type: 'poisoner', weaponKey: null, might: 2, tempo: 0, wounded: false },
      { id: 9002, type: 'needler', weaponKey: null, might: 0, tempo: 0, wounded: false },
      { id: 9003, type: 'miner', weaponKey: null, might: 0, tempo: 0, wounded: false },
    ];
    G.allCrew = pirates.slice();
    G.hand = pirates.slice();
    G.deck = [];
    G.discard = [];
    G.sent = [];
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.enthusiasm = Math.max(0, Math.floor(Number(opts.enthusiasm) || 0));
    G.boardingAlert = Math.max(0, Math.floor(Number(opts.boardingAlert) || 0));
    scene._sacrificedIds.clear();
    return { G, pirates };
  };

  const sendForDrill = (G, pirate, handIdx, opts = {}) => {
    G.sent.push(handIdx);
    scene.resolveIsland(pirate);
    if (opts.removeAfterIsland) {
      removePirateById(G, pirate.id);
      scene._sacrificedIds.add(pirate.id);
    }
    return applyScoutedCacheDrillForSim(scene, pirate);
  };

  {
    const { G, pirates } = setupDrill({ enthusiasm: 1, boardingAlert: 2, alertRefundAmount: 1 });
    const reward = sendForDrill(G, pirates[0], 0);
    assertScoutedCounterCacheCheck(reward && reward.applied, 'matching counter did not receive Cache Drill');
    assertScoutedCounterCacheCheck((pirates[0].might || 0) === 3, `matching counter might ${pirates[0].might || 0} !== 3`);
    assertScoutedCounterCacheCheck(reward.alertRefund && reward.alertRefund.amount === 1, `matching counter refund ${reward.alertRefund && reward.alertRefund.amount} !== 1`);
    assertScoutedCounterCacheCheck(G.boardingAlert === 2, `matching counter alert ${G.boardingAlert} !== 2`);
    assertScoutedCounterCacheCheck(G.enthusiasm === 3, `Cache Drill refund removed cache enthusiasm or island gain ${G.enthusiasm}`);
    assertScoutedCounterCacheCheck(G.res.wood === 1, `matching counter did not open cache wood ${JSON.stringify(G.res)}`);
    assertScoutedCounterCacheCheck((G.cacheDrillMusterIds || []).includes(pirates[0].id), 'matching counter did not create Cache Drill muster marker');
    const second = sendForDrill(G, pirates[1], 1);
    assertScoutedCounterCacheCheck(!second, 'second matching counter received another Cache Drill');
    assertScoutedCounterCacheCheck((pirates[1].might || 0) === 0, 'second matching counter gained Might');
    assertScoutedCounterCacheCheck(G.boardingAlert === 2, `second matching counter changed alert to ${G.boardingAlert}`);
    results.push({ name: 'Cache Drill grants +1 Might and clears a normal +1 Alert cache for the first surviving matching counter only', ok: true });
  }

  {
    const laterCacheMap = {
      layers: [
        [{ id: 1, type: 'ship', strength: 6, encounter: { mainKey: 'shellback', supportKeys: [], totalCount: 1 }, conns: [2] }],
        [{ id: 2, type: 'island', islandIdx: 0, conns: [3] }],
        [{ id: 3, type: 'ship', strength: 8, encounter: { mainKey: 'shellback', supportKeys: [], totalCount: 1 }, conns: [] }],
      ],
      visited: [1, 2],
      currentNodeId: 2,
      currentLayer: 1,
    };
    const { G, pirates } = setupDrill({
      boardingAlert: 6,
      alertRefundAmount: 1,
      boardingCount: 1,
      map: laterCacheMap,
    });
    const reward = sendForDrill(G, pirates[0], 0);
    assertScoutedCounterCacheCheck(reward && reward.applied, 'Boarding 2+ matching counter did not receive Cache Drill');
    assertScoutedCounterCacheCheck(reward.alertRefund && reward.alertRefund.amount === 1, `Boarding 2+ +1 cache refund ${JSON.stringify(reward.alertRefund)}`);
    assertScoutedCounterCacheCheck(G.boardingAlert === 6, `Boarding 2+ +1 cache did not refund to floor 6, got ${G.boardingAlert}`);
    results.push({ name: 'Boarding 2+ normal +1 Alert caches are still fully cleared by Cache Drill', ok: true });
  }

  {
    const { G, pirates } = setupDrill({ boardingAlert: 2, alertRefundAmount: 1 });
    const reward = sendForDrill(G, pirates[2], 2);
    assertScoutedCounterCacheCheck(!reward, 'non-counter received Cache Drill');
    assertScoutedCounterCacheCheck((pirates[2].might || 0) === 0, 'non-counter gained Might');
    assertScoutedCounterCacheCheck(G.boardingAlert === 3, `non-counter opener did not keep cache alert at 3, got ${G.boardingAlert}`);
    assertScoutedCounterCacheCheck(G.res.wood === 1, `non-counter opener did not claim cache wood ${JSON.stringify(G.res)}`);
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill.cacheClaimed === true, 'non-counter opener did not mark cache claimed');
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill.granted === false, 'non-counter opener granted Cache Drill');
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill.alertRefunded === false, 'non-counter consumed cache Alert refund');
    assertScoutedCounterCacheCheck((G.cacheDrillMusterIds || []).length === 0, 'non-counter created Cache Drill muster marker');
    results.push({ name: 'first sent non-counter opens cache once without Cache Drill or Alert refund', ok: true });
  }

  {
    const { G, pirates } = setupDrill({ mode: 'battleTest', boardingAlert: 3, alertRefundAmount: 1, alertFloorBeforeCache: 2 });
    const reward = sendForDrill(G, pirates[0], 0);
    assertScoutedCounterCacheCheck(!reward, 'Battle Test received Cache Drill');
    assertScoutedCounterCacheCheck((pirates[0].might || 0) === 2, 'Battle Test changed counter Might');
    assertScoutedCounterCacheCheck(G.boardingAlert === 3, `Battle Test changed alert to ${G.boardingAlert}`);
    assertScoutedCounterCacheCheck((G.cacheDrillMusterIds || []).length === 0, 'Battle Test created Cache Drill muster marker');
    results.push({ name: 'Battle Test receives no Cache Drill even with defensive cache state', ok: true });
  }

  {
    const { G, pirates } = setupDrill({ cache: false });
    const reward = sendForDrill(G, pirates[0], 0);
    assertScoutedCounterCacheCheck(!reward, 'no-cache island received Cache Drill');
    assertScoutedCounterCacheCheck((pirates[0].might || 0) === 2, 'no-cache island changed counter Might');
    assertScoutedCounterCacheCheck((G.cacheDrillMusterIds || []).length === 0, 'unmarked island created Cache Drill muster marker');
    results.push({ name: 'unmarked islands receive no Cache Drill', ok: true });
  }

  {
    const { G, pirates } = setupDrill({ islandIdx: 5, boardingAlert: 2, alertRefundAmount: 1 });
    const reward = sendForDrill(G, pirates[0], 0, { removeAfterIsland: true });
    assertScoutedCounterCacheCheck(!reward, 'Siren-removed counter received Cache Drill');
    assertScoutedCounterCacheCheck((pirates[0].might || 0) === 2, 'Siren-removed counter gained Might');
    assertScoutedCounterCacheCheck(G.boardingAlert === 3, `Siren-removed opener did not keep cache Alert, got ${G.boardingAlert}`);
    assertScoutedCounterCacheCheck(G.res.wood === 1, `Siren-removed opener did not claim cache payload ${JSON.stringify(G.res)}`);
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill.cacheClaimed === true && !G.island.scoutedCacheDrill.granted, 'Siren-removed opener did not claim cache without drill');
    assertScoutedCounterCacheCheck(!G.allCrew.some(p => p.id === pirates[0].id), 'Siren setup failed to remove pirate');
    assertScoutedCounterCacheCheck((G.cacheDrillMusterIds || []).length === 0, 'Siren-removed counter created Cache Drill muster marker');
    results.push({ name: 'Siren-removed first opener still claims cache but cannot receive Cache Drill', ok: true });
  }

  {
    const { G, pirates } = setupDrill({ boardingAlert: 2, alertRefundAmount: 1 });
    const reward = sendForDrill(G, pirates[0], 0);
    const shopTop = { id: 9010, type: 'sawbones', weaponKey: null, might: 0, tempo: 0, wounded: false };
    G.allCrew.push(shopTop);
    G.deck = [shopTop];
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertScoutedCounterCacheCheck(reward && reward.applied, 'muster setup failed to grant Cache Drill');
    assertScoutedCounterCacheCheck(G.hand[0] === pirates[0], 'Cache Drill pirate was not drawn first after Shop Continue');
    assertScoutedCounterCacheCheck(G.hand[1] === shopTop, 'Cache Drill pirate did not stay above existing top-deck shop purchase');
    assertScoutedCounterCacheCheck((G.cacheDrillMusterIds || []).length === 0, 'Cache Drill muster marker was not cleared on Continue');
    const zones = [...(G.hand || []), ...(G.deck || []), ...(G.discard || [])].filter(p => p && p.id === pirates[0].id);
    assertScoutedCounterCacheCheck(zones.length === 1, `Cache Drill pirate duplicated across zones ${zones.length} times`);
    results.push({ name: 'Cache Drill muster places the drilled counter above shop top-deck cards without duplication', ok: true });
  }

  {
    const { G, pirates } = setupDrill({ boardingAlert: 2, alertRefundAmount: 1 });
    sendForDrill(G, pirates[0], 0);
    G.allCrew = G.allCrew.filter(p => p.id !== pirates[0].id);
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    const zones = [...(G.hand || []), ...(G.deck || []), ...(G.discard || [])].filter(p => p && p.id === pirates[0].id);
    assertScoutedCounterCacheCheck(zones.length === 0, 'removed Cache Drill pirate was mustered after leaving crew');
    assertScoutedCounterCacheCheck((G.cacheDrillMusterIds || []).length === 0, 'removed Cache Drill pirate left a stale muster marker');
    results.push({ name: 'Cache Drill muster ignores pirates no longer in crew and clears stale markers', ok: true });
  }

  {
    const node = { id: 20, type: 'island', islandIdx: 0, conns: [99] };
    const { G } = selectNode(node);
    assertScoutedCounterCacheCheck(G.res.wood === 0 && G.enthusiasm === 0 && G.boardingAlert === 0, 'unmarked island granted a cache');
    results.push({ name: 'unmarked islands do not grant cache rewards', ok: true });
  }

  {
    const node = {
      id: 30,
      type: 'island',
      islandIdx: 6,
      conns: [99],
      scoutedCache: { mainKey: 'shellback', res: 'wood', amount: 1, enthusiasm: 1, alert: 1, claimed: false },
    };
    const { G } = selectNode(node);
    assertScoutedCounterCacheCheck(G.res.wood === 0 && G.enthusiasm === 0 && G.boardingAlert === 0, 'Infirmary Island granted a cache');
    results.push({ name: 'Infirmary cache markers are ignored defensively', ok: true });
  }

  {
    const node = {
      id: 40,
      type: 'island',
      islandIdx: 0,
      conns: [99],
      scoutedCache: { mainKey: 'shellback', res: 'wood', amount: 1, enthusiasm: 1, alert: 1, claimed: false },
    };
    const { G } = selectNode(node, { mode: 'battleTest' });
    assertScoutedCounterCacheCheck(G.res.wood === 0 && G.enthusiasm === 0 && G.boardingAlert === 0, 'Battle Test granted a cache');
    results.push({ name: 'Battle Test mode ignores cache rewards', ok: true });
  }

  {
    api.initState();
    const G = api.getG();
    const ship = {
      id: 50,
      type: 'ship',
      strength: 6,
      encounter: { mainKey: 'shellback', supportKeys: [], totalCount: 1 },
      conns: [],
      scoutedCache: { mainKey: 'shellback', res: 'wood', amount: 1, enthusiasm: 1, alert: 1, claimed: false },
    };
    G.map = { layers: [[ship]], visited: [], currentNodeId: null, currentLayer: -1 };
    G.phase = 'map';
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.boardingAlert = 0;
    scene.applyMapNodeSelection(ship.id);
    assertScoutedCounterCacheCheck(G.res.wood === 0 && G.enthusiasm === 0, 'ship node granted cache reward');
    assertScoutedCounterCacheCheck(G.enemyShip && G.phase === 'boarding', 'ship node did not enter boarding');
    results.push({ name: 'ship nodes do not grant cache rewards', ok: true });
  }

  return { ok: true, checks: results };
}

function runOpeningRouteContractChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  const routeCases = [
    { label: 'Forest/Shellback', mainKey: 'shellback', primary: 'poisoner', starterType: 'lumberjack' },
    { label: 'Rocky/Powder Bomber', mainKey: 'powderBomber', primary: 'sawbones', starterType: 'miner' },
    { label: 'Port/Deck Sniper', mainKey: 'deckSniper', primary: 'needler', starterType: 'armsman' },
  ];
  const makePirate = (id, type, opts = {}) => ({
    id,
    type,
    weaponKey: opts.weaponKey || null,
    might: opts.might || 0,
    tempo: opts.tempo || 0,
    wounded: !!opts.wounded,
  });
  const fillerShop = (primary) => [primary, 'drummer', 'herald', 'trainer'];
  const routeFirstIsland = (map, mainKey) => {
    const firstShipLayer = map.layers.findIndex(layer => layer && layer.length === 1 && layer[0].type === 'ship');
    const routeCache = map.layers[firstShipLayer - 1].find(node => node && node.scoutedCache && node.scoutedCache.mainKey === mainKey);
    const firstIsland = routeCache && map.layers[0].includes(routeCache)
      ? routeCache
      : map.layers[0].find(node => node && Array.isArray(node.conns) && routeCache && node.conns.includes(routeCache.id));
    return { firstShipLayer, routeCache, firstIsland };
  };

  routeCases.forEach((route, routeIndex) => {
    runtime.setSeed((0x61c04700 + routeIndex * 8191) >>> 0);
    api.initState();
    const G = api.getG();
    const { routeCache, firstIsland } = routeFirstIsland(G.map, route.mainKey);
    assertOpeningRouteContractCheck(routeCache && routeCache.scoutedCache, `${route.label} route cache missing`);
    assertOpeningRouteContractCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), `${route.label} route selection failed`);

    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = false;
    G.enthusiasm = api.TYPES[route.primary].cost;
    G.shop = api.normalizeOpeningRouteShop(fillerShop(route.primary), G.round, {
      map: G.map,
      mode: G.mode,
      boardingCount: G.boardingCount,
    });
    const primaryIndex = G.shop.indexOf(route.primary);
    assertOpeningRouteContractCheck(primaryIndex >= 0, `${route.label} primary ${route.primary} missing from shop ${G.shop.join(',')}`);
    const bought = scene.buyPirate(primaryIndex, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningRouteContractCheck(bought && bought.type === route.primary, `${route.label} primary buy failed`);
    assertOpeningRouteContractCheck(G.openingRouteCounterBoughtMainKey === route.mainKey, `${route.label} primary buy did not mark ${route.mainKey}`);
    assertOpeningRouteContractCheck(G.openingRouteCounterBoughtPirateId === bought.id, `${route.label} primary buy did not record bought pirate id`);

    const cache = routeCache.scoutedCache;
    const baseEnthusiasm = Math.max(0, Math.floor(Number(cache.enthusiasm) || 0));
    const baseAlert = Math.max(0, Math.floor(Number(cache.alert) || 0));
    G.phase = 'map';
    G.enthusiasm = 0;
    G.boardingAlert = 5;
    assertOpeningRouteContractCheck(scene.applyMapNodeSelection(routeCache.id), `${route.label} cache selection failed`);
    assertOpeningRouteContractCheck(G.enthusiasm === baseEnthusiasm, `${route.label} cache paid passive contract ${G.enthusiasm} !== ${baseEnthusiasm}`);
    assertOpeningRouteContractCheck(G.boardingAlert === 5 + baseAlert, `${route.label} contract changed Alert ${G.boardingAlert} !== ${5 + baseAlert}`);
    assertOpeningRouteContractCheck(G.res[cache.res] === 1, `${route.label} cache resource was doubled or missing: ${JSON.stringify(G.res)}`);
    const drillDesc = scene.scoutedCacheDrillDescription();
    const primaryName = api.TYPES[route.primary].name;
    assertOpeningRouteContractCheck(drillDesc.includes(`${primaryName} claims +☠️ Contract`), `${route.label} drill text did not surface contract: ${drillDesc}`);

    const beforeDrillEnthusiasm = G.enthusiasm;
    G.hand = [bought];
    G.sent = [0];
    const drill = applyScoutedCacheDrillForSim(scene, bought);
    assertOpeningRouteContractCheck(drill && drill.applied, `${route.label} matching bought counter did not claim Cache Drill`);
    assertOpeningRouteContractCheck(drill.openingRouteContractEnthusiasm === 1, `${route.label} Cache Drill contract reward ${JSON.stringify(drill)}`);
    assertOpeningRouteContractCheck(G.enthusiasm === beforeDrillEnthusiasm + 1, `${route.label} Cache Drill contract enthusiasm ${G.enthusiasm} !== ${beforeDrillEnthusiasm + 1}`);
    assertOpeningRouteContractCheck(G.boardingAlert === 5, `${route.label} Cache Drill refund should return only cache Alert to 5, got ${G.boardingAlert}`);
    results.push({ name: `${route.label} bought primary counter earns +1 Opening Route Contract only through Cache Drill`, ok: true });
  });

  {
    const route = routeCases[0];
    runtime.setSeed(0x61c04820);
    api.initState();
    const G = api.getG();
    const { routeCache, firstIsland } = routeFirstIsland(G.map, route.mainKey);
    assertOpeningRouteContractCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), 'starter claimant route selection failed');
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = false;
    G.enthusiasm = api.TYPES[route.primary].cost;
    G.shop = api.normalizeOpeningRouteShop(fillerShop(route.primary), G.round, {
      map: G.map,
      mode: G.mode,
      boardingCount: G.boardingCount,
    });
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningRouteContractCheck(bought && G.openingRouteCounterBoughtPirateId === bought.id, 'starter claimant setup did not record primary');
    const starter = (G.allCrew || []).find(pirate => pirate && pirate.type === route.starterType);
    assertOpeningRouteContractCheck(starter, 'starter claimant setup has no route starter');
    const baseEnthusiasm = Math.max(0, Math.floor(Number(routeCache.scoutedCache.enthusiasm) || 0));
    G.phase = 'map';
    G.enthusiasm = 0;
    G.boardingAlert = 3;
    assertOpeningRouteContractCheck(scene.applyMapNodeSelection(routeCache.id), 'starter claimant cache selection failed');
    assertOpeningRouteContractCheck(G.enthusiasm === baseEnthusiasm, 'starter claimant cache paid passive contract');
    G.hand = [starter];
    G.sent = [0];
    const drill = applyScoutedCacheDrillForSim(scene, starter);
    assertOpeningRouteContractCheck(drill && drill.applied, 'starter route counter did not claim Cache Drill');
    assertOpeningRouteContractCheck(!drill.openingRouteContractEnthusiasm, `starter route counter earned contract ${JSON.stringify(drill)}`);
    assertOpeningRouteContractCheck(G.enthusiasm === baseEnthusiasm, `starter route counter changed enthusiasm ${G.enthusiasm}`);
    const latePrimaryDrill = applyScoutedCacheDrillForSim(scene, bought);
    assertOpeningRouteContractCheck(!latePrimaryDrill, 'bought primary claimed contract after starter consumed Cache Drill');
    results.push({ name: 'starter route counter can claim Cache Drill but cannot earn the bought-primary contract', ok: true });
  }

  {
    const route = routeCases[0];
    runtime.setSeed(0x61c04780);
    api.initState();
    const G = api.getG();
    const { routeCache, firstIsland } = routeFirstIsland(G.map, route.mainKey);
    assertOpeningRouteContractCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), 'non-counter route selection failed');
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = false;
    G.enthusiasm = 10;
    G.shop = api.normalizeOpeningRouteShop(fillerShop(route.primary), G.round, {
      map: G.map,
      mode: G.mode,
      boardingCount: G.boardingCount,
    });
    const fillerIndex = G.shop.findIndex(type => type !== route.primary);
    const bought = scene.buyPirate(fillerIndex, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningRouteContractCheck(bought && bought.type !== route.primary, `non-counter setup bought ${bought && bought.type}`);
    assertOpeningRouteContractCheck(!G.openingRouteCounterBoughtMainKey, 'non-counter buy marked opening route counter');
    assertOpeningRouteContractCheck(G.openingRouteCounterBoughtPirateId == null, 'non-counter buy recorded opening route pirate id');
    const baseEnthusiasm = Math.max(0, Math.floor(Number(routeCache.scoutedCache.enthusiasm) || 0));
    G.phase = 'map';
    G.enthusiasm = 0;
    assertOpeningRouteContractCheck(scene.applyMapNodeSelection(routeCache.id), 'non-counter cache selection failed');
    assertOpeningRouteContractCheck(G.enthusiasm === baseEnthusiasm, `non-counter first buy granted contract ${G.enthusiasm} !== ${baseEnthusiasm}`);
    results.push({ name: 'buying a non-counter before the cache does not earn Opening Route Contract', ok: true });
  }

  const applyDirectCache = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.boardingCount = Math.max(0, Math.floor(Number(opts.boardingCount) || 0));
    G.openingRouteCounterBoughtMainKey = opts.marker == null ? null : opts.marker;
    G.openingRouteCounterBoughtPirateId = opts.pirateId == null ? null : opts.pirateId;
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.enthusiasm = 0;
    G.boardingAlert = 2;
    const node = {
      id: opts.id || 500,
      type: 'island',
      islandIdx: 0,
      conns: [],
      scoutedCache: {
        mainKey: opts.mainKey || 'shellback',
        res: 'wood',
        amount: 1,
        enthusiasm: 1,
        alert: 1,
        claimed: !!opts.claimed,
      },
    };
    return { G, node, grant: scene.applyScoutedCounterCache(node) };
  };

  const setupDirectDrill = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.boardingCount = Math.max(0, Math.floor(Number(opts.boardingCount) || 0));
    const pirate = makePirate(opts.pirateId || 8100, opts.type || 'poisoner');
    G.allCrew = opts.owned === false ? [] : [pirate];
    G.deck = [];
    G.discard = [];
    G.hand = [pirate];
    G.sent = [0];
    G.phase = 'sending';
    G.enthusiasm = 0;
    G.boardingAlert = 2;
    G.openingRouteCounterBoughtMainKey = opts.marker == null ? 'shellback' : opts.marker;
    G.openingRouteCounterBoughtPirateId = opts.recordedPirateId == null ? pirate.id : opts.recordedPirateId;
    const mainKey = opts.mainKey || 'shellback';
    const routeContractPirateId = Object.prototype.hasOwnProperty.call(opts, 'routeContractPirateId')
      ? opts.routeContractPirateId
      : (G.openingRouteCounterBoughtMainKey === mainKey ? G.openingRouteCounterBoughtPirateId : null);
    G.island = scene.buildIslandState(api.ISLANDS[0]);
    G.island.scoutedCacheDrill = {
      mainKey,
      granted: false,
      alertRefundAmount: 0,
      alertFloorBeforeCache: 2,
      alertRefunded: false,
      routeContractPirateId,
    };
    return { G, pirate, drill: applyScoutedCacheDrillForSim(scene, pirate) };
  };

  {
    const { G, grant } = applyDirectCache({ marker: 'powderBomber', mainKey: 'shellback' });
    assertOpeningRouteContractCheck(grant && grant.routeContractEnthusiasm === 0, `wrong marker route contract ${JSON.stringify(grant)}`);
    assertOpeningRouteContractCheck(G.enthusiasm === 1 && G.boardingAlert === 3, `wrong marker cache values ${G.enthusiasm}/${G.boardingAlert}`);
    const wrongDrill = setupDirectDrill({ marker: 'powderBomber', mainKey: 'shellback' });
    assertOpeningRouteContractCheck(wrongDrill.drill && !wrongDrill.drill.openingRouteContractEnthusiasm, `wrong marker drill contract ${JSON.stringify(wrongDrill.drill)}`);
    assertOpeningRouteContractCheck(wrongDrill.G.enthusiasm === 0, `wrong marker drill changed enthusiasm ${wrongDrill.G.enthusiasm}`);
    results.push({ name: 'wrong route primary marker does not earn Opening Route Contract', ok: true });
  }

  {
    const { G, grant } = applyDirectCache({ marker: 'shellback', mainKey: 'shellback', boardingCount: 1 });
    assertOpeningRouteContractCheck(grant && grant.routeContractEnthusiasm === 0, `post-Boarding cache route contract ${JSON.stringify(grant)}`);
    assertOpeningRouteContractCheck(G.enthusiasm === 1, `post-Boarding cache granted contract ${G.enthusiasm}`);
    const laterDrill = setupDirectDrill({ marker: 'shellback', mainKey: 'shellback', boardingCount: 1 });
    assertOpeningRouteContractCheck(laterDrill.drill && !laterDrill.drill.openingRouteContractEnthusiasm, `post-Boarding drill contract ${JSON.stringify(laterDrill.drill)}`);
    assertOpeningRouteContractCheck(laterDrill.G.enthusiasm === 0, `post-Boarding drill granted contract ${laterDrill.G.enthusiasm}`);
    results.push({ name: 'Boarding 2+ caches do not earn Opening Route Contract even with a stale marker', ok: true });
  }

  {
    const { G, grant } = applyDirectCache({ marker: 'shellback', mainKey: 'shellback', mode: 'battleTest' });
    assertOpeningRouteContractCheck(!grant, `Battle Test cache granted ${JSON.stringify(grant)}`);
    assertOpeningRouteContractCheck(G.enthusiasm === 0 && G.boardingAlert === 2, `Battle Test cache changed values ${G.enthusiasm}/${G.boardingAlert}`);
    const battleDrill = setupDirectDrill({ marker: 'shellback', mainKey: 'shellback', mode: 'battleTest' });
    assertOpeningRouteContractCheck(!battleDrill.drill, `Battle Test drill granted ${JSON.stringify(battleDrill.drill)}`);
    assertOpeningRouteContractCheck(battleDrill.G.enthusiasm === 0, `Battle Test drill changed enthusiasm ${battleDrill.G.enthusiasm}`);
    results.push({ name: 'Battle Test ignores Opening Route Contract and cache rewards', ok: true });
  }

  {
    const { G, node, grant } = applyDirectCache({ marker: null, mainKey: 'shellback' });
    assertOpeningRouteContractCheck(grant && grant.routeContractEnthusiasm === 0 && G.enthusiasm === 1, `pre-primary cache grant mismatch ${JSON.stringify(grant)}`);
    G.openingRouteCounterBoughtMainKey = 'shellback';
    G.openingRouteCounterBoughtPirateId = 8100;
    const retry = scene.applyScoutedCounterCache(node);
    assertOpeningRouteContractCheck(!retry, `claimed cache paid retroactive contract ${JSON.stringify(retry)}`);
    assertOpeningRouteContractCheck(G.enthusiasm === 1, `claimed cache changed enthusiasm after late primary marker ${G.enthusiasm}`);
    const lateDrill = setupDirectDrill({ type: 'poisoner', marker: 'shellback', mainKey: 'shellback', routeContractPirateId: null });
    assertOpeningRouteContractCheck(lateDrill.drill && lateDrill.drill.applied, 'late-purchase primary did not claim normal Cache Drill');
    assertOpeningRouteContractCheck(!lateDrill.drill.openingRouteContractEnthusiasm, `late-purchase primary earned contract ${JSON.stringify(lateDrill.drill)}`);
    assertOpeningRouteContractCheck(lateDrill.G.enthusiasm === 0, `late-purchase primary changed enthusiasm ${lateDrill.G.enthusiasm}`);
    results.push({ name: 'buying the route primary after the cache is claimed cannot pay Opening Route Contract retroactively', ok: true });
  }

  {
    const otherCounter = setupDirectDrill({ type: 'needler', marker: 'shellback', mainKey: 'shellback', recordedPirateId: 9999 });
    assertOpeningRouteContractCheck(otherCounter.drill && otherCounter.drill.applied, 'other counter did not claim direct Cache Drill');
    assertOpeningRouteContractCheck(!otherCounter.drill.openingRouteContractEnthusiasm, `other counter earned contract ${JSON.stringify(otherCounter.drill)}`);
    assertOpeningRouteContractCheck(otherCounter.G.enthusiasm === 0, `other counter changed enthusiasm ${otherCounter.G.enthusiasm}`);
    results.push({ name: 'other shop counters can claim Cache Drill but cannot earn the bought-primary contract', ok: true });
  }

  {
    const removed = setupDirectDrill({ type: 'poisoner', marker: 'shellback', mainKey: 'shellback', owned: false });
    assertOpeningRouteContractCheck(!removed.drill, `removed bought primary received Cache Drill ${JSON.stringify(removed.drill)}`);
    assertOpeningRouteContractCheck(removed.G.enthusiasm === 0, `removed bought primary changed enthusiasm ${removed.G.enthusiasm}`);
    results.push({ name: 'removed bought primary cannot earn Opening Route Contract', ok: true });
  }

  return { ok: true, checks: results };
}

function runOpeningRoutePrizeChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  const routeCases = [
    { label: 'Forest/Shellback', mainKey: 'shellback', primary: 'poisoner' },
    { label: 'Rocky/Powder Bomber', mainKey: 'powderBomber', primary: 'sawbones' },
    { label: 'Port/Deck Sniper', mainKey: 'deckSniper', primary: 'needler' },
  ];
  const openingCounters = ['poisoner', 'sawbones', 'needler'];

  const makePirate = (id, type, opts = {}) => ({
    id,
    type,
    weaponKey: opts.weaponKey || null,
    might: opts.might || 0,
    tempo: opts.tempo || 0,
    wounded: !!opts.wounded,
  });
  const fillerShop = (primary) => [primary, 'drummer', 'herald', 'trainer'];
  const routeFirstIsland = (map, mainKey) => {
    const firstShipLayer = map.layers.findIndex(layer => layer && layer.length === 1 && layer[0].type === 'ship');
    const routeCache = map.layers[firstShipLayer - 1].find(node => node && node.scoutedCache && node.scoutedCache.mainKey === mainKey);
    const firstIsland = routeCache && map.layers[0].includes(routeCache)
      ? routeCache
      : map.layers[0].find(node => node && Array.isArray(node.conns) && routeCache && node.conns.includes(routeCache.id));
    const ship = map.layers[firstShipLayer][0];
    return { firstShipLayer, routeCache, firstIsland, ship };
  };
  const assertOnlyRoutePrimaryOpeningCounter = (shop, label, primary) => {
    const visible = (shop || []).filter(type => openingCounters.includes(type));
    assertOpeningRoutePrizeCheck(
      visible.length === 1 && visible[0] === primary,
      `${label} expected only ${primary} as opening counter, got ${(shop || []).join(',')}`
    );
  };
  const enemyFor = (key, row, rowOrder, idSuffix = 0) => {
    const archetype = api.COMBAT.enemyArchetypes.find((entry) => entry && entry.key === key);
    assertOpeningRoutePrizeCheck(!!archetype, `missing archetype ${key}`);
    const member = scene.buildCombatEnemyMember(archetype, `${key}_route_prize_${idSuffix}`);
    return scene.buildEnemyCombatFighter(member, row, rowOrder);
  };
  const fighterFor = (pirate, row, rowOrder, combat) =>
    scene.buildPlayerCombatFighter(pirate, row, rowOrder, combat);

  const setupBoarding = (opts = {}) => {
    api.initState();
    const G = api.getG();
    const mainKey = opts.mainKey || 'deckSniper';
    const type = opts.type || 'needler';
    const pirate = makePirate(8800, type);
    const filler = makePirate(8801, 'trainer');
    G.mode = opts.mode || 'run';
    G.phase = 'boarding';
    G.busy = false;
    G.boardingCount = Math.max(1, Math.floor(Number(opts.boardingCount) || 1));
    G.enemyShip = {
      strength: 6,
      encounterNo: G.boardingCount,
      encounter: { mainKey, supportKeys: [], totalCount: 1 },
    };
    G.allCrew = opts.owned === false ? [filler] : [pirate, filler];
    G.hand = [pirate, filler];
    G.deck = [];
    G.discard = [];
    G.sent = [];
    G.res = { wood: 0, stone: 0, gold: 0 };
    const markerMainKey = Object.prototype.hasOwnProperty.call(opts, 'markerMainKey')
      ? opts.markerMainKey
      : mainKey;
    const markerPirateId = Object.prototype.hasOwnProperty.call(opts, 'markerPirateId')
      ? opts.markerPirateId
      : pirate.id;
    G.openingRouteCounterBoughtMainKey = markerMainKey;
    G.openingRouteCounterBoughtPirateId = markerPirateId;
    const cacheMarkerMainKey = Object.prototype.hasOwnProperty.call(opts, 'cacheMarkerMainKey')
      ? opts.cacheMarkerMainKey
      : (opts.cacheMarker ? mainKey : null);
    G.cacheDrillBountyMarks = cacheMarkerMainKey ? [{ pirateId: pirate.id, mainKey: cacheMarkerMainKey }] : [];
    G.enemyShip.cacheDrillBountyMarks = G.cacheDrillBountyMarks.slice();
    const handPirates = [pirate, filler];
    G.combat = {
      mode: 'fighting',
      encounterMainKey: mainKey,
      enemyParty: [],
      playerFighters: (opts.playerRows || [[0, 0, 0]])
        .map(([pirateIdx, row, rowOrder]) => {
          const fighterPirate = handPirates[pirateIdx];
          return fighterPirate ? fighterFor(fighterPirate, row, rowOrder, null) : null;
        })
        .filter(Boolean),
      enemyFighters: [enemyFor(mainKey, 0, 0)],
      boardingAlert: 0,
      boardingAlertGuards: 0,
      returnedPirateIds: [],
      reinforcementCount: Math.max(0, Math.floor(Number(opts.reinforcementCount) || 0)),
      cacheDrillBountyMarks: G.cacheDrillBountyMarks.slice(),
    };
    return { G, pirate, combat: G.combat };
  };

  const setupPrizeDefaultBoarding = (opts = {}) => {
    api.initState();
    const G = api.getG();
    const mainKey = opts.mainKey || 'deckSniper';
    const prize = makePirate(8900, opts.prizeType || 'needler', {
      might: Object.prototype.hasOwnProperty.call(opts, 'prizeMight') ? opts.prizeMight : 1,
      wounded: !!opts.prizeWounded,
    });
    const starter = makePirate(8901, opts.starterType || 'armsman');
    const filler = makePirate(8902, opts.fillerType || 'lumberjack');
    G.mode = opts.mode || 'run';
    G.phase = 'boarding';
    G.busy = false;
    G.boardingCount = Math.max(1, Math.floor(Number(opts.boardingCount) || 1));
    G.enemyShip = {
      strength: 6,
      encounterNo: G.boardingCount,
      encounter: { mainKey, supportKeys: [], totalCount: 1 },
    };
    G.hand = opts.includePrizeInHand === false ? [starter, filler] : [starter, prize, filler];
    G.allCrew = opts.ownPrize === false ? [starter, filler] : [starter, prize, filler];
    G.deck = [];
    G.discard = [];
    G.sent = [];
    G.res = { wood: 0, stone: 0, gold: 0 };
    const markerMainKey = Object.prototype.hasOwnProperty.call(opts, 'markerMainKey')
      ? opts.markerMainKey
      : mainKey;
    const markerPirateId = Object.prototype.hasOwnProperty.call(opts, 'markerPirateId')
      ? opts.markerPirateId
      : prize.id;
    G.openingRouteCounterBoughtMainKey = markerMainKey;
    G.openingRouteCounterBoughtPirateId = markerPirateId;
    G.cacheDrillBountyMarks = markerMainKey && markerPirateId != null
      ? [{ pirateId: markerPirateId, mainKey: markerMainKey }]
      : [];
    G.enemyShip.cacheDrillBountyMarks = G.cacheDrillBountyMarks.slice();
    G.combat = {
      mode: 'fighting',
      encounterMainKey: mainKey,
      enemyParty: [],
      playerFighters: [],
      enemyFighters: [enemyFor(mainKey, 0, 0)],
      boardingAlert: 0,
      boardingAlertGuards: 0,
      returnedPirateIds: [],
      reinforcementCount: Math.max(0, Math.floor(Number(opts.reinforcementCount) || 0)),
      cacheDrillBountyMarks: G.cacheDrillBountyMarks.slice(),
    };
    G.combat.playerSetupRows = scene.combatDefaultPlayerSetupRows(G.combat);
    G.combat.playerFighters = scene.buildPlayerCombatFighters(G.combat.playerSetupRows, G.combat);
    return { G, prize, starter, filler, combat: G.combat };
  };

  {
    const { G, prize, starter, combat } = setupPrizeDefaultBoarding();
    assertOpeningRoutePrizeCheck(combat.playerSetupRows[0][0] === prize.id, `Cache Drill bounty counter did not lead front-left: ${JSON.stringify(combat.playerSetupRows)}`);
    assertOpeningRoutePrizeCheck(combat.playerSetupRows[0][1] === starter.id, `starter did not remain behind drilled counter: ${JSON.stringify(combat.playerSetupRows)}`);
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningRoutePrizeCheck(result && result.pirateId === prize.id, `Cache Drill default ambusher ${result && result.pirateId} !== ${prize.id}`);
    scene.finishBoardingCombat('win');
    assertOpeningRoutePrizeCheck(G.res.gold === 2, `defaulted Cache Drill ambusher gold ${G.res.gold} !== 2`);
    assertOpeningRoutePrizeCheck(combat.ambushBounty && combat.ambushBounty.drilled && combat.ambushBounty.count === 2, `defaulted Cache Drill bounty payload ${JSON.stringify(combat.ambushBounty)}`);
    results.push({ name: 'Cache Drill bounty counter leads default setup and claims +2 Ambush Bounty', ok: true });
  }

  {
    const { G, starter, combat } = setupPrizeDefaultBoarding({ markerMainKey: null, markerPirateId: null });
    G.cacheDrillBountyMarks = [{ pirateId: starter.id, mainKey: 'deckSniper' }];
    G.enemyShip.cacheDrillBountyMarks = G.cacheDrillBountyMarks.slice();
    combat.cacheDrillBountyMarks = G.cacheDrillBountyMarks.slice();
    combat.playerSetupRows = scene.combatDefaultPlayerSetupRows(combat);
    combat.playerFighters = scene.buildPlayerCombatFighters(combat.playerSetupRows, combat);
    assertOpeningRoutePrizeCheck(combat.playerSetupRows[0][0] === starter.id, `cache-drilled starter did not lead front-left: ${JSON.stringify(combat.playerSetupRows)}`);
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningRoutePrizeCheck(result && result.pirateId === starter.id, `cache-drilled starter ambusher ${result && result.pirateId} !== ${starter.id}`);
    scene.finishBoardingCombat('win');
    assertOpeningRoutePrizeCheck(G.res.gold === 2, `cache-drilled starter gold ${G.res.gold} !== 2`);
    assertOpeningRoutePrizeCheck(combat.ambushBounty && combat.ambushBounty.drilled && combat.ambushBounty.count === 2, `cache-drilled starter bounty payload ${JSON.stringify(combat.ambushBounty)}`);
    results.push({ name: 'Cache-drilled Opening Deckhand starter can claim +2 Ambush Bounty', ok: true });
  }

  [
    { name: 'absent drilled pirate', opts: { includePrizeInHand: false } },
    { name: 'wounded drilled pirate', opts: { prizeWounded: true } },
    { name: 'removed drilled pirate', opts: { ownPrize: false } },
    { name: 'wrong-main Cache Drill marker', opts: { markerMainKey: 'shellback' } },
    { name: 'cleared Cache Drill marker', opts: { markerMainKey: null, markerPirateId: null } },
    { name: 'Battle Test Cache Drill marker', opts: { mode: 'battleTest' } },
  ].forEach(({ name, opts }) => {
    const { starter, combat } = setupPrizeDefaultBoarding(opts);
    assertOpeningRoutePrizeCheck(combat.playerSetupRows[0][0] === starter.id, `${name} did not fall back to starter counter: ${JSON.stringify(combat.playerSetupRows)}`);
    results.push({ name: `${name} keeps existing Boarding 1 default counter fallback`, ok: true });
  });

  {
    const { prize, combat } = setupPrizeDefaultBoarding({ boardingCount: 2 });
    assertOpeningRoutePrizeCheck(combat.playerSetupRows[0][0] === prize.id, `Boarding 2 did not keep matching drilled counter first: ${JSON.stringify(combat.playerSetupRows)}`);
    results.push({ name: 'Boarding 2 can also lead with a matching active Cache Drill bounty counter', ok: true });
  }

  routeCases.forEach((route, routeIndex) => {
    runtime.setSeed((0x61c05700 + routeIndex * 8191) >>> 0);
    api.initState();
    const G = api.getG();
    const { firstIsland } = routeFirstIsland(G.map, route.mainKey);
    assertOpeningRoutePrizeCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), `${route.label} cash route selection failed`);

    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = false;
    G.enthusiasm = api.TYPES[route.primary].cost;
    G.shop = api.normalizeOpeningRouteShop(fillerShop(route.primary), G.round, {
      map: G.map,
      mode: G.mode,
      boardingCount: G.boardingCount,
    });
    const primaryIndex = G.shop.indexOf(route.primary);
    const quote = scene.shopPurchaseQuote(route.primary);
    assertOpeningRoutePrizeCheck(primaryIndex >= 0, `${route.label} cash primary ${route.primary} missing from shop ${G.shop.join(',')}`);
    assertOpeningRoutePrizeCheck(quote.canBuy && quote.counter && !quote.credit, `${route.label} cash primary was not buyable as a counter: ${JSON.stringify(quote)}`);
    assertOpeningRoutePrizeCheck(!quote.topDeck && !quote.openingCounterPrepMight, `${route.label} cash primary received setup perks: ${JSON.stringify(quote)}`);
    assertOpeningRoutePrizeCheck(quote.counterPayoff && quote.counterPayoff.bountyCount === 1, `${route.label} cash primary previewed doubled bounty: ${JSON.stringify(quote.counterPayoff)}`);
    const bought = scene.buyPirate(primaryIndex, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningRoutePrizeCheck(bought && bought.type === route.primary, `${route.label} cash primary buy failed`);
    assertOpeningRoutePrizeCheck(!G.openingRouteCounterBoughtMainKey, `${route.label} cash buy secured route primary`);
    assertOpeningRoutePrizeCheck(G.openingRouteCounterBoughtPirateId == null, `${route.label} cash buy recorded bought pirate`);
    assertOpeningRoutePrizeCheck(G.discard.includes(bought) && !G.deck.includes(bought), `${route.label} cash primary did not go only to discard`);
    assertOpeningRoutePrizeCheck(!(G.counterWatchIds || []).includes(bought.id), `${route.label} cash primary gained Counter Watch`);
    assertOpeningRoutePrizeCheck((bought.might || 0) === 0 && !bought.weaponKey && (bought.tempo || 0) === 0, `${route.label} cash primary gained upgrades: ${JSON.stringify(bought)}`);
    assertOnlyRoutePrimaryOpeningCounter(G.shop, `${route.label} cash-buy refill`, route.primary);
    results.push({ name: `${route.label} cash-only primary stays unsecured and keeps the route counter guaranteed`, ok: true, quote });
  });

  routeCases.forEach((route, routeIndex) => {
    runtime.setSeed((0x61c09700 + routeIndex * 8191) >>> 0);
    api.initState();
    const G = api.getG();
    const { routeCache, firstIsland, ship } = routeFirstIsland(G.map, route.mainKey);
    assertOpeningRoutePrizeCheck(routeCache && routeCache.scoutedCache, `${route.label} route cache missing`);
    assertOpeningRoutePrizeCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), `${route.label} route selection failed`);

    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = true;
    G.enthusiasm = api.TYPES[route.primary].cost;
    G.shop = api.normalizeOpeningRouteShop(fillerShop(route.primary), G.round, {
      map: G.map,
      mode: G.mode,
      boardingCount: G.boardingCount,
    });
    const primaryIndex = G.shop.indexOf(route.primary);
    const quote = scene.shopPurchaseQuote(route.primary);
    assertOpeningRoutePrizeCheck(primaryIndex >= 0, `${route.label} primary ${route.primary} missing from shop ${G.shop.join(',')}`);
    assertOpeningRoutePrizeCheck(quote.counter && quote.topDeck && quote.openingCounterPrepMight, `${route.label} prep primary missed setup-gated quote perks: ${JSON.stringify(quote)}`);
    assertOpeningRoutePrizeCheck(quote.counterPayoff && quote.counterPayoff.bountyCount === 1, `${route.label} prep shop previewed doubled bounty before Cache Drill: ${JSON.stringify(quote.counterPayoff)}`);
    const bought = scene.buyPirate(primaryIndex, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningRoutePrizeCheck(bought && bought.type === route.primary, `${route.label} primary buy failed`);
    assertOpeningRoutePrizeCheck(G.openingRouteCounterBoughtMainKey === route.mainKey, `${route.label} primary buy did not mark ${route.mainKey}`);
    assertOpeningRoutePrizeCheck(G.openingRouteCounterBoughtPirateId === bought.id, `${route.label} primary buy did not record bought pirate id`);
    assertOpeningRoutePrizeCheck(G.deck[G.deck.length - 1] === bought && (G.counterWatchIds || []).includes(bought.id), `${route.label} prep buy missed Top deck Watch`);
    assertOpeningRoutePrizeCheck((bought.might || 0) === 1 && !bought.weaponKey && (bought.tempo || 0) === 0, `${route.label} prep buy upgrades wrong: ${JSON.stringify(bought)}`);

    const cache = routeCache.scoutedCache;
    const baseEnthusiasm = Math.max(0, Math.floor(Number(cache.enthusiasm) || 0));
    const baseAlert = Math.max(0, Math.floor(Number(cache.alert) || 0));
    G.phase = 'map';
    G.enthusiasm = 0;
    G.boardingAlert = 5;
    assertOpeningRoutePrizeCheck(scene.applyMapNodeSelection(routeCache.id), `${route.label} cache selection failed`);
    assertOpeningRoutePrizeCheck(G.enthusiasm === 0, `${route.label} cache paid enthusiasm on selection ${G.enthusiasm}`);
    assertOpeningRoutePrizeCheck(G.boardingAlert === 5, `${route.label} cache changed Alert on selection ${G.boardingAlert}`);
    assertOpeningRoutePrizeCheck(G.res[cache.res] === 0, `${route.label} cache resource paid on selection: ${JSON.stringify(G.res)}`);
    const drillDesc = scene.scoutedCacheDrillDescription();
    assertOpeningRoutePrizeCheck(!drillDesc.includes('Contract'), `${route.label} drill text still promised Contract: ${drillDesc}`);
    assertOpeningRoutePrizeCheck(drillDesc.includes('first sent opens'), `${route.label} drill text did not explain first opener: ${drillDesc}`);

    const beforeDrillEnthusiasm = G.enthusiasm;
    G.hand = [bought];
    G.sent = [0];
    const claim = scene.claimScoutedCounterCache(bought, { silent: true });
    const drill = claim && claim.drill;
    assertOpeningRoutePrizeCheck(drill && drill.applied, `${route.label} matching bought counter did not claim Cache Drill`);
    assertOpeningRoutePrizeCheck(!drill.openingRouteContractEnthusiasm, `${route.label} Cache Drill returned obsolete contract reward ${JSON.stringify(drill)}`);
    assertOpeningRoutePrizeCheck(G.enthusiasm === beforeDrillEnthusiasm + baseEnthusiasm, `${route.label} cache opener enthusiasm ${G.enthusiasm} !== ${beforeDrillEnthusiasm + baseEnthusiasm}`);
    assertOpeningRoutePrizeCheck(G.boardingAlert === alertAfterCacheDrill(5, baseAlert), `${route.label} Cache Drill alert ${G.boardingAlert} !== ${alertAfterCacheDrill(5, baseAlert)} from +${baseAlert}`);
    assertOpeningRoutePrizeCheck(G.res[cache.res] === 1, `${route.label} opener cache resource missing: ${JSON.stringify(G.res)}`);

    G.phase = 'map';
    assertOpeningRoutePrizeCheck(scene.applyMapNodeSelection(ship.id), `${route.label} ship selection failed`);
    assertOpeningRoutePrizeCheck(G.phase === 'boarding' && G.boardingCount === 1, `${route.label} did not enter Boarding 1`);
    assertOpeningRoutePrizeCheck((G.enemyShip.cacheDrillBountyMarks || []).some(mark => mark.pirateId === bought.id && mark.mainKey === route.mainKey), `${route.label} Cache Drill bounty marker did not persist into Boarding 1`);
    scene.ensureBoardingCombat();
    scene.finishBoardingCombat('loss');
    assertOpeningRoutePrizeCheck((G.cacheDrillBountyMarks || []).length === 0 && G.openingRouteCounterBoughtMainKey == null, `${route.label} Cache Drill marker did not clear after Boarding 1 resolution`);
    results.push({ name: `${route.label} Opening Prep primary only doubles bounty after claiming Cache Drill`, ok: true });
  });

  {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.map = makeScoutedCounterTestMap('deckSniper');
    G.round = 3;
    G.boardingCount = 1;
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = false;
    G.enthusiasm = api.TYPES.needler.cost;
    G.shop = ['needler'];
    const quote = scene.shopPurchaseQuote('needler');
    assertOpeningRoutePrizeCheck(quote.canBuy && quote.counter && quote.topDeck && !quote.openingRoutePrimary, `post-Boarding-1 cash counter lost Top deck: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningRoutePrizeCheck(G.deck[G.deck.length - 1] === bought && (G.counterWatchIds || []).includes(bought.id), 'post-Boarding-1 cash scouted counter did not top-deck with Watch');
    assertOpeningRoutePrizeCheck(!G.discard.includes(bought), 'post-Boarding-1 cash scouted counter went to discard');
    results.push({ name: 'post-Boarding-1 cash scouted counters still Top deck and Watch', ok: true });
  }

  {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.map = makeScoutedCounterTestMap('deckSniper');
    G.round = 3;
    G.boardingCount = 1;
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 1;
    G.openingCounterPlan = false;
    G.enthusiasm = api.TYPES.needler.cost - 1;
    G.shop = ['needler'];
    const quote = scene.shopPurchaseQuote('needler');
    assertOpeningRoutePrizeCheck(quote.canBuy && quote.counter && quote.topDeck && quote.preparedCounter && !quote.openingRoutePrimary, `post-Boarding-1 discounted counter lost Prepared Top deck: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningRoutePrizeCheck(G.deck[G.deck.length - 1] === bought && (G.counterWatchIds || []).includes(bought.id), 'post-Boarding-1 prepared counter did not top-deck with Watch');
    assertOpeningRoutePrizeCheck(bought.weaponKey === 'toxinPistol', `post-Boarding-1 prepared counter missed weapon: ${JSON.stringify(bought)}`);
    results.push({ name: 'post-Boarding-1 Full Crew scouted counters still become Prepared', ok: true });
  }

  {
    const { G, pirate, combat } = setupBoarding({ mainKey: 'deckSniper', type: 'needler' });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningRoutePrizeCheck(result && result.pirateId === pirate.id, 'bought route primary did not Counter Ambush');
    scene.finishBoardingCombat('win');
    assertOpeningRoutePrizeCheck(G.res.gold === 1, `prep-only route primary bounty ${G.res.gold} !== 1`);
    assertOpeningRoutePrizeCheck(combat.ambushBounty && combat.ambushBounty.count === 1 && !combat.ambushBounty.drilled, `prep-only bounty payload ${JSON.stringify(combat.ambushBounty)}`);
    assertOpeningRoutePrizeCheck(G.openingRouteCounterBoughtPirateId == null, 'route counter marker survived winning Boarding 1');
    results.push({ name: 'prep-qualified route primary without Cache Drill receives normal +1 Ambush Bounty', ok: true, res: { ...G.res } });
  }

  {
    const { G, combat } = setupBoarding({ mainKey: 'deckSniper', type: 'needler', cacheMarker: true });
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('win');
    assertOpeningRoutePrizeCheck(G.res.gold === 2, `Cache Drill bounty did not pay +2: ${JSON.stringify(G.res)}`);
    assertOpeningRoutePrizeCheck(combat.ambushBounty && combat.ambushBounty.count === 2 && combat.ambushBounty.drilled, `Cache Drill bounty payload ${JSON.stringify(combat.ambushBounty)}`);
    results.push({ name: 'Cache-drilled route primary pays +2 Ambush Bounty', ok: true });
  }

  {
    const { combat } = setupBoarding({
      mainKey: 'deckSniper',
      type: 'needler',
      cacheMarker: true,
      playerRows: [[1, 0, 0], [0, 1, 0]],
    });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningRoutePrizeCheck(!result && !combat.counterAmbush, `back-row drilled counter still ambushed: ${JSON.stringify(result)}`);
    results.push({ name: 'moving the cache-drilled counter out of the front row prevents Counter Ambush', ok: true });
  }

  {
    const { G, combat } = setupBoarding({ mainKey: 'deckSniper', type: 'needler' });
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('win');
    assertOpeningRoutePrizeCheck(G.res.gold === 1, `unmarked route primary doubled bounty ${JSON.stringify(G.res)}`);
    assertOpeningRoutePrizeCheck(combat.ambushBounty && combat.ambushBounty.count === 1, `unmarked route primary payload ${JSON.stringify(combat.ambushBounty)}`);
    results.push({ name: 'route primary without Cache Drill receives only normal Ambush Bounty', ok: true });
  }

  {
    const { G, combat } = setupBoarding({ mainKey: 'deckSniper', type: 'needler', markerMainKey: null });
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('win');
    assertOpeningRoutePrizeCheck(G.res.gold === 1, `unmarked route primary bounty ${JSON.stringify(G.res)} !== +1`);
    assertOpeningRoutePrizeCheck(combat.ambushBounty && combat.ambushBounty.count === 1, `unmarked payload ${JSON.stringify(combat.ambushBounty)}`);
    results.push({ name: 'unmarked surviving ambusher still receives normal +1 Ambush Bounty', ok: true });
  }

  {
    const { G, combat } = setupBoarding({ mainKey: 'flintDuelist', type: 'poisoner', cacheMarkerMainKey: 'shellback' });
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('win');
    assertOpeningRoutePrizeCheck(G.res.wood === 1, `wrong-main Cache Drill doubled bounty ${JSON.stringify(G.res)}`);
    assertOpeningRoutePrizeCheck(combat.ambushBounty && combat.ambushBounty.count === 1, `wrong-main payload ${JSON.stringify(combat.ambushBounty)}`);
    results.push({ name: 'wrong-main fights do not receive doubled Cache Drill bounty', ok: true });
  }

  {
    const { G, combat } = setupBoarding({ mainKey: 'deckSniper', type: 'needler', boardingCount: 2 });
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('win');
    assertOpeningRoutePrizeCheck(G.res.gold === 1, `Boarding 2 unmarked bounty doubled ${JSON.stringify(G.res)}`);
    assertOpeningRoutePrizeCheck(combat.ambushBounty && combat.ambushBounty.count === 1, `Boarding 2 payload ${JSON.stringify(combat.ambushBounty)}`);
    results.push({ name: 'Boarding 2+ unmarked counters receive normal Ambush Bounty', ok: true });
  }

  {
    const { G, combat } = setupBoarding({ mainKey: 'shellback', type: 'needler' });
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('win');
    assertOpeningRoutePrizeCheck(G.res.wood === 1, `non-primary counter doubled bounty ${JSON.stringify(G.res)}`);
    assertOpeningRoutePrizeCheck(combat.ambushBounty && combat.ambushBounty.count === 1, `non-primary payload ${JSON.stringify(combat.ambushBounty)}`);
    results.push({ name: 'unmarked non-primary counters receive normal Ambush Bounty', ok: true });
  }

  {
    const { G, combat } = setupBoarding({ mainKey: 'deckSniper', type: 'needler', owned: false });
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('win');
    assertOpeningRoutePrizeCheck(G.res.gold === 1, `removed bought pirate doubled bounty ${JSON.stringify(G.res)}`);
    assertOpeningRoutePrizeCheck(G.openingRouteCounterBoughtPirateId == null, 'removed bought pirate marker was not cleared');
    results.push({ name: 'removed bought pirates do not receive doubled Cache Drill bounty', ok: true });
  }

  {
    const { G, combat } = setupBoarding({ mainKey: 'deckSniper', type: 'needler' });
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('loss');
    assertOpeningRoutePrizeCheck(G.res.gold === 0 && !combat.ambushBounty, `loss granted bounty ${JSON.stringify(G.res)}`);
    assertOpeningRoutePrizeCheck(G.openingRouteCounterBoughtPirateId == null, 'loss did not clear route counter marker');
    results.push({ name: 'losses grant no Ambush Bounty', ok: true });
  }

  {
    const { G, combat } = setupBoarding({ mainKey: 'deckSniper', type: 'needler' });
    scene.applyCounterAmbush(combat, { silent: true });
    scene.defeatCombatFighter(combat.playerFighters[0], []);
    scene.finishBoardingCombat('win');
    assertOpeningRoutePrizeCheck(G.res.gold === 0 && !combat.ambushBounty, `defeated ambusher granted bounty ${JSON.stringify(G.res)}`);
    results.push({ name: 'defeated ambushers do not receive Ambush Bounty', ok: true });
  }

  {
    const { G, pirate, combat } = setupBoarding({ mainKey: 'deckSniper', type: 'needler', reinforcementCount: 1 });
    combat.counterAmbush = { applied: true, pirateId: pirate.id, type: pirate.type, mainKey: 'deckSniper' };
    scene.finishBoardingCombat('win');
    assertOpeningRoutePrizeCheck(G.res.gold === 0 && !combat.ambushBounty, `reinforcement win granted bounty ${JSON.stringify(G.res)}`);
    results.push({ name: 'reinforcement-hand wins never receive Ambush Bounty', ok: true });
  }

  {
    const { G, pirate, combat } = setupBoarding({ mode: 'battleTest', mainKey: 'deckSniper', type: 'needler' });
    combat.counterAmbush = { applied: true, pirateId: pirate.id, type: pirate.type, mainKey: 'deckSniper' };
    scene.finishBoardingCombat('win');
    assertOpeningRoutePrizeCheck(G.res.gold === 0 && !combat.ambushBounty, `Battle Test granted bounty ${JSON.stringify(G.res)}`);
    results.push({ name: 'Battle Test ignores Cache Drill bounty markers', ok: true });
  }

  return { ok: true, checks: results };
}

function runOpeningRoutePromotionChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  const routes = [
    { label: 'Forest/Shellback', mainKey: 'shellback', primary: 'poisoner', starterType: 'lumberjack', sideOffer: 'drummer', bountyRes: 'wood', weaponKey: 'venomKnife' },
    { label: 'Rocky/Powder Bomber', mainKey: 'powderBomber', primary: 'sawbones', starterType: 'miner', sideOffer: 'trainer', bountyRes: 'stone', weaponKey: 'barbedBlade' },
    { label: 'Port/Deck Sniper', mainKey: 'deckSniper', primary: 'needler', starterType: 'armsman', sideOffer: 'survivalist', bountyRes: 'gold', weaponKey: 'toxinPistol' },
  ];

  const makePirate = (id, type) => ({
    id,
    type,
    weaponKey: null,
    might: 0,
    tempo: 0,
    wounded: false,
  });

  const enemyFor = (key, row, rowOrder, idSuffix = 0) => {
    const archetype = api.COMBAT.enemyArchetypes.find((entry) => entry && entry.key === key);
    assertOpeningRoutePromotionCheck(!!archetype, `missing archetype ${key}`);
    const member = scene.buildCombatEnemyMember(archetype, `${key}_route_promotion_${idSuffix}`);
    return scene.buildEnemyCombatFighter(member, row, rowOrder);
  };

  const setupBoarding = (route, opts = {}) => {
    api.initState();
    const G = api.getG();
    const mainKey = opts.mainKey || route.mainKey;
    const boardingNo = Math.max(1, Math.floor(Number(opts.boardingNo) || 1));
    const pirate = makePirate(9800, opts.type || route.primary);
    const filler = makePirate(9801, opts.fillerType || 'trainer');
    const handPirates = [pirate, filler];

    G.mode = opts.mode || 'run';
    G.phase = 'boarding';
    G.busy = false;
    G.boardingCount = boardingNo;
    G.enemyShip = {
      strength: 6,
      encounterNo: boardingNo,
      encounter: { mainKey, supportKeys: [], totalCount: 1 },
    };
    G.allCrew = opts.owned === false ? [filler] : [pirate, filler];
    G.hand = handPirates.slice();
    G.deck = [];
    G.discard = [];
    G.sent = [];
    G.res = { wood: 5, stone: 5, gold: 5 };
    G.enthusiasm = 0;
    G.openingRouteCounterBoughtMainKey = Object.prototype.hasOwnProperty.call(opts, 'markerMainKey')
      ? opts.markerMainKey
      : route.mainKey;
    G.openingRouteCounterBoughtPirateId = Object.prototype.hasOwnProperty.call(opts, 'markerPirateId')
      ? opts.markerPirateId
      : pirate.id;
    G.combat = {
      mode: 'fighting',
      encounterMainKey: mainKey,
      enemyParty: [],
      playerFighters: [],
      enemyFighters: [enemyFor(mainKey, 0, 0)],
      boardingAlert: 0,
      boardingAlertGuards: 0,
      returnedPirateIds: [],
      reinforcementCount: Math.max(0, Math.floor(Number(opts.reinforcementCount) || 0)),
      watchReadyCounterIds: [],
    };
    G.combat.playerFighters = (opts.playerRows || [[0, 0, 0], [1, 1, 0]])
      .map(([pirateIndex, row, rowOrder]) => {
        const fighterPirate = handPirates[pirateIndex];
        return fighterPirate ? scene.buildPlayerCombatFighter(fighterPirate, row, rowOrder, G.combat) : null;
      })
      .filter(Boolean);
    return { G, pirate, filler, combat: G.combat };
  };

  routes.forEach((route) => {
    const { G, pirate, combat } = setupBoarding(route);
    const startingRes = { ...G.res };
    const ambush = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningRoutePromotionCheck(ambush && ambush.pirateId === pirate.id, `${route.label} primary did not Counter Ambush`);
    assertOpeningRoutePromotionCheck(!pirate.weaponKey && (pirate.might || 0) === 0 && (pirate.tempo || 0) === 0, `${route.label} primary started upgraded`);
    scene.finishBoardingCombat('win');
    assertOpeningRoutePromotionCheck(pirate.weaponKey === route.weaponKey, `${route.label} primary weapon ${pirate.weaponKey} !== ${route.weaponKey}`);
    assertOpeningRoutePromotionCheck(combat.openingRoutePromotion && combat.openingRoutePromotion.pirateId === pirate.id, `${route.label} missing promotion payload`);
    assertOpeningRoutePromotionCheck(combat.openingRoutePromotion.text && combat.openingRoutePromotion.text.length > 0, `${route.label} promotion text missing`);
    assertOpeningRoutePromotionCheck(G.enthusiasm === 0, `${route.label} promotion paid ship enthusiasm ${G.enthusiasm}`);
    ['wood', 'stone', 'gold'].forEach((resKey) => {
      const expected = startingRes[resKey] + (resKey === route.bountyRes ? 1 : 0);
      assertOpeningRoutePromotionCheck(G.res[resKey] === expected, `${route.label} resource ${resKey} ${G.res[resKey]} !== ${expected}`);
    });
    results.push({ name: `${route.label} secured bought primary promotes to its ship weapon after surviving Boarding 1 Counter Ambush`, ok: true });
  });

  {
    const route = routes[0];
    const { pirate, combat } = setupBoarding(route, {
      type: route.starterType,
      markerMainKey: route.mainKey,
    });
    const ambush = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningRoutePromotionCheck(ambush && ambush.pirateId === pirate.id, 'starter-only setup did not ambush');
    scene.finishBoardingCombat('win');
    assertOpeningRoutePromotionCheck(!combat.openingRoutePromotion && !pirate.weaponKey, 'Opening Deckhand Counter starter received promotion');
    results.push({ name: 'Opening Deckhand Counter starters never receive Opening Route Promotion', ok: true });
  }

  {
    const route = routes[0];
    const { pirate, combat } = setupBoarding(route, {
      type: route.sideOffer,
      markerMainKey: route.mainKey,
    });
    combat.counterAmbush = {
      applied: true,
      pirateId: pirate.id,
      type: pirate.type,
      mainKey: route.mainKey,
    };
    const promotion = scene.grantOpeningRoutePromotion(combat, 'win');
    assertOpeningRoutePromotionCheck(!promotion && !pirate.weaponKey, 'Opening Side Prep side offer received promotion');
    results.push({ name: 'Opening Side Prep purchases fail the route-primary promotion type gate', ok: true });
  }

  {
    const route = routes[2];
    const { pirate, combat } = setupBoarding(route, {
      markerMainKey: null,
      markerPirateId: null,
    });
    const ambush = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningRoutePromotionCheck(ambush && ambush.pirateId === pirate.id, 'discard-only primary setup did not ambush');
    scene.finishBoardingCombat('win');
    assertOpeningRoutePromotionCheck(!combat.openingRoutePromotion && !pirate.weaponKey, 'discard-only route primary received promotion');
    results.push({ name: 'discard-only route-primary buys without the secured marker never promote', ok: true });
  }

  {
    const route = routes[2];
    const { G, pirate, combat } = setupBoarding(route, { mode: 'battleTest' });
    combat.counterAmbush = {
      applied: true,
      pirateId: pirate.id,
      type: pirate.type,
      mainKey: route.mainKey,
    };
    scene.finishBoardingCombat('win');
    assertOpeningRoutePromotionCheck(G.mode === 'battleTest' && !combat.openingRoutePromotion && !pirate.weaponKey, 'Battle Test granted Opening Route Promotion');
    results.push({ name: 'Battle Test never grants Opening Route Promotion', ok: true });
  }

  {
    const route = routes[0];
    const { pirate, combat } = setupBoarding(route);
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('loss');
    assertOpeningRoutePromotionCheck(!combat.openingRoutePromotion && !pirate.weaponKey, 'loss granted Opening Route Promotion');
    results.push({ name: 'losses never grant Opening Route Promotion', ok: true });
  }

  {
    const route = routes[1];
    const { pirate, combat } = setupBoarding(route);
    scene.applyCounterAmbush(combat, { silent: true });
    combat.reinforcementCount = 1;
    scene.finishBoardingCombat('win');
    assertOpeningRoutePromotionCheck(!combat.openingRoutePromotion && !pirate.weaponKey, 'reinforcement-hand win granted Opening Route Promotion');
    results.push({ name: 'reinforcement-hand wins never grant Opening Route Promotion', ok: true });
  }

  {
    const route = routes[2];
    const { pirate, combat } = setupBoarding(route, { boardingNo: 2 });
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('win');
    assertOpeningRoutePromotionCheck(!combat.openingRoutePromotion && !pirate.weaponKey, 'Boarding 2 granted Opening Route Promotion');
    results.push({ name: 'Boarding 2+ never grants Opening Route Promotion', ok: true });
  }

  {
    const route = routes[2];
    const { pirate, combat } = setupBoarding(route, {
      playerRows: [[1, 0, 0], [0, 1, 0]],
    });
    const ambush = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningRoutePromotionCheck(!ambush, 'missing-ambush setup unexpectedly ambushed');
    scene.finishBoardingCombat('win');
    assertOpeningRoutePromotionCheck(!combat.openingRoutePromotion && !pirate.weaponKey, 'missing Counter Ambush granted Opening Route Promotion');
    results.push({ name: 'wins without Counter Ambush never grant Opening Route Promotion', ok: true });
  }

  {
    const route = routes[2];
    const { pirate, combat } = setupBoarding(route, {
      mainKey: 'shellback',
      markerMainKey: route.mainKey,
    });
    const ambush = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningRoutePromotionCheck(ambush && ambush.mainKey === 'shellback', 'wrong-main setup did not ambush Shellback');
    scene.finishBoardingCombat('win');
    assertOpeningRoutePromotionCheck(!combat.openingRoutePromotion && !pirate.weaponKey, 'wrong-main encounter granted Opening Route Promotion');
    results.push({ name: 'wrong-main encounters never grant Opening Route Promotion', ok: true });
  }

  {
    const route = routes[0];
    const { pirate, combat } = setupBoarding(route);
    const ambush = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningRoutePromotionCheck(ambush && ambush.pirateId === pirate.id, 'defeated-ambusher setup did not ambush');
    scene.defeatCombatFighter(combat.playerFighters[0], []);
    scene.finishBoardingCombat('win');
    assertOpeningRoutePromotionCheck(!combat.openingRoutePromotion && !pirate.weaponKey, 'defeated ambusher received Opening Route Promotion');
    results.push({ name: 'defeated ambushers never receive Opening Route Promotion', ok: true });
  }

  return { ok: true, checks: results };
}

function runAlarmRushedRouteCounterChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  const routeCases = [
    { label: 'Forest/Shellback', mainKey: 'shellback', primary: 'poisoner' },
    { label: 'Rocky/Powder Bomber', mainKey: 'powderBomber', primary: 'sawbones' },
    { label: 'Port/Deck Sniper', mainKey: 'deckSniper', primary: 'needler' },
  ];
  const fillerShop = (primary) => [primary, 'drummer', 'herald', 'trainer'];
  const routeFirstIsland = (map, mainKey) => {
    const firstShipLayer = map.layers.findIndex(layer => layer && layer.length === 1 && layer[0].type === 'ship');
    const routeCache = map.layers[firstShipLayer - 1].find(node => node && node.scoutedCache && node.scoutedCache.mainKey === mainKey);
    const firstIsland = routeCache && map.layers[0].includes(routeCache)
      ? routeCache
      : map.layers[0].find(node => node && Array.isArray(node.conns) && routeCache && node.conns.includes(routeCache.id));
    return { firstShipLayer, routeCache, firstIsland };
  };
  const setupRouteShop = (route, opts = {}) => {
    api.initState();
    const G = api.getG();
    const desiredMode = opts.mode || 'run';
    G.mode = 'run';
    const { firstIsland } = routeFirstIsland(G.map, route.mainKey);
    assertAlarmRushedRouteCounterCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), `${route.label} route selection failed`);
    G.mode = desiredMode;
    G.phase = opts.phase || 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.shopCreditUsed = !!opts.shopCreditUsed;
    G.fullCrewDiscount = Math.max(0, Math.floor(Number(opts.fullCrewDiscount) || 0));
    G.openingCounterPlan = !!opts.openingCounterPlan;
    G.openingRouteCacheClaimedMainKey = opts.openingRouteCacheClaimedMainKey != null
      ? opts.openingRouteCacheClaimedMainKey
      : (opts.cacheClaimed ? route.mainKey : null);
    G.boardingAlert = Math.max(0, Math.floor(Number(opts.boardingAlert) || 0));
    G.boardingCount = Math.max(0, Math.floor(Number(opts.boardingCount) || 0));
    G.enthusiasm = opts.enthusiasm != null
      ? Math.max(0, Math.floor(Number(opts.enthusiasm) || 0))
      : api.TYPES[route.primary].cost;
    G.shop = api.normalizeOpeningRouteShop(fillerShop(route.primary), G.round, {
      map: G.map,
      mode: G.mode,
      boardingCount: G.boardingCount,
    });
    G.deck = [];
    G.discard = [];
    G.counterWatchIds = [];
    return G;
  };
  const finishIslandForShop = (G, sent = []) => {
    G.sent = Array.isArray(sent) ? [...sent] : [];
    const wagePreview = scene.shipWagePreview();
    const alertFloorBeforeWages = Math.max(0, Math.floor(Number(G.boardingAlert) || 0));
    updateFullCrewDiscountForSim(scene, G);
    updateOpeningCounterPlanForSim(scene, G);
    applyShipWagesForSim(scene, G);
    applyShortCrewCounterAlertRefundForSim(scene, null, alertFloorBeforeWages);
    if (typeof scene.enterShoppingPhase === 'function') {
      scene.enterShoppingPhase();
    } else {
      G.phase = 'shopping';
      G.shopCreditUsed = false;
    }
    return wagePreview;
  };
  const finishZeroSendIslandForShop = (G) => finishIslandForShop(G, []);
  const assertSceneAndPolicyMatch = (G, type, label) => {
    const quote = scene.shopPurchaseQuote(type);
    const directQuote = shopPurchaseQuote(api, G, type);
    assertAlarmRushedRouteCounterCheck(
      !!quote.alarmRushedRouteCounter === !!directQuote.alarmRushedRouteCounter
        && !!quote.topDeck === !!directQuote.topDeck
        && !!quote.credit === !!directQuote.credit
        && (quote.alert || 0) === (directQuote.alert || 0),
      `${label} scene/direct quote mismatch: ${JSON.stringify({ quote, directQuote })}`
    );
    return quote;
  };

  {
    const route = routeCases[2];
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    const { firstIsland } = routeFirstIsland(G.map, route.mainKey);
    assertAlarmRushedRouteCounterCheck(firstIsland && firstIsland.islandIdx === 3, 'Deck Sniper route did not start on Port');
    assertAlarmRushedRouteCounterCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), 'Port claimed-cache route selection failed');
    const openerIndex = G.hand.findIndex(pirate => pirate && pirate.type !== 'armsman');
    const opener = G.hand[openerIndex];
    assertAlarmRushedRouteCounterCheck(opener, 'Port claimed-cache setup did not find a non-counter opener');
    G.sent = [openerIndex];
    const claim = scene.claimScoutedCounterCache(opener, { silent: true });
    assertAlarmRushedRouteCounterCheck(claim && claim.cacheGrant && !claim.drill, `Port non-counter opener claim mismatch: ${JSON.stringify(claim)}`);
    assertAlarmRushedRouteCounterCheck(G.openingRouteCacheClaimedMainKey === route.mainKey, `Port cache claim marker ${G.openingRouteCacheClaimedMainKey} !== ${route.mainKey}`);
    assertAlarmRushedRouteCounterCheck(claim.openingCounterPrep && G.openingCounterPlan === true, 'non-counter Port cache claim did not grant Opening Counter Prep');
    const wagePreview = finishIslandForShop(G, [openerIndex]);
    assertAlarmRushedRouteCounterCheck(G.enthusiasm >= api.TYPES[route.primary].cost && G.boardingAlert === 5, `Port claimed-cache state mismatch: ${JSON.stringify({ enthusiasm: G.enthusiasm, alert: G.boardingAlert, wagePreview })}`);
    const quote = assertSceneAndPolicyMatch(G, route.primary, 'Port claimed-cache Opening Prep');
    assertAlarmRushedRouteCounterCheck(quote.canBuy && quote.counter && quote.openingRoutePrimary && !quote.credit, `Port claimed-cache quote not cash-buyable primary: ${JSON.stringify(quote)}`);
    assertAlarmRushedRouteCounterCheck(quote.openingCounterPrepMight && quote.topDeck && !quote.alarmRushedRouteCounter, `Port claimed-cache primary did not use Opening Prep before Alarm rush: ${JSON.stringify(quote)}`);
    assertAlarmRushedRouteCounterCheck(!quote.preparedCounter && quote.fullCrewCoverage === 0, `Port claimed-cache Opening Prep gained excluded setup perks: ${JSON.stringify(quote)}`);
    const plan = scene.shopPlanText();
    assertAlarmRushedRouteCounterCheck(plan.includes('Opening Prep') && plan.includes('top deck') && !plan.includes('Alarm rush'), `Port claimed-cache plan missing Opening Prep/top-deck: ${plan}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertAlarmRushedRouteCounterCheck(bought && bought.type === route.primary, 'Port claimed-cache cash buy failed');
    assertAlarmRushedRouteCounterCheck(G.deck[G.deck.length - 1] === bought && !G.discard.includes(bought), 'Port claimed-cache cash buy did not top-deck');
    assertAlarmRushedRouteCounterCheck((G.counterWatchIds || []).includes(bought.id), 'Port claimed-cache cash buy missed Counter Watch');
    assertAlarmRushedRouteCounterCheck((bought.might || 0) === 1 && (bought.tempo || 0) === 0 && !bought.weaponKey, `Port claimed-cache Opening Prep buy missed prep Might or gained extras: ${JSON.stringify(bought)}`);
    assertAlarmRushedRouteCounterCheck((G.cacheDrillBountyMarks || []).length === 0, 'Port claimed-cache cash buy created Cache Drill marks');
    assertAlarmRushedRouteCounterCheck(G.boardingAlert === 4, `Port claimed-cache cash buy did not apply Route Counter Cover: ${G.boardingAlert}`);
    assertAlarmRushedRouteCounterCheck(G.openingRouteCounterBoughtMainKey === route.mainKey && G.openingRouteCounterBoughtPirateId === bought.id, 'Port claimed-cache cash buy did not secure route counter');
    results.push({ name: 'claimed Port cache non-counter opener buys Needler with cache Opening Prep before Alarm rush', ok: true, quote, plan, wagePreview });
  }

  {
    const route = routeCases[2];
    const G = setupRouteShop(route, { boardingAlert: 4 });
    const quote = assertSceneAndPolicyMatch(G, route.primary, 'Port cash high Alert');
    assertAlarmRushedRouteCounterCheck(quote.canBuy && quote.counter && quote.openingRoutePrimary, `Port quote not buyable primary counter: ${JSON.stringify(quote)}`);
    assertAlarmRushedRouteCounterCheck(!quote.alarmRushedRouteCounter && !quote.topDeck && !quote.credit && quote.alert === 0, `Port cash high Alert became a rush: ${JSON.stringify(quote)}`);
    assertAlarmRushedRouteCounterCheck(!quote.openingCounterPrepMight && !quote.preparedCounter && quote.fullCrewCoverage === 0, `Port cash high Alert gained setup perks: ${JSON.stringify(quote)}`);
    const plan = scene.shopPlanText();
    assertAlarmRushedRouteCounterCheck(!plan.includes('Alarm rush') && !plan.includes('Alarm-rushed') && !plan.includes('top deck, Watch'), `Port shop plan mislabeled unclaimed cash high Alert rush: ${plan}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertAlarmRushedRouteCounterCheck(bought && bought.type === route.primary, 'Port high-Alert cash buy failed');
    assertAlarmRushedRouteCounterCheck(G.discard.includes(bought) && !G.deck.includes(bought), 'Port high-Alert cash buy did not discard');
    assertAlarmRushedRouteCounterCheck(!(G.counterWatchIds || []).includes(bought.id), 'Port high-Alert cash buy gained Counter Watch');
    assertAlarmRushedRouteCounterCheck((bought.might || 0) === 0 && (bought.tempo || 0) === 0 && !bought.weaponKey, `Port high-Alert cash buy gained prep/Prepared upgrades: ${JSON.stringify(bought)}`);
    assertAlarmRushedRouteCounterCheck((G.cacheDrillBountyMarks || []).length === 0, 'Port high-Alert cash buy created Cache Drill marks');
    assertAlarmRushedRouteCounterCheck(!G.openingRouteCounterBoughtMainKey && G.openingRouteCounterBoughtPirateId == null, 'Port high-Alert cash buy secured route counter');
    results.push({ name: 'unclaimed Port route primary bought with cash at 4 pending Alert stays unsecured and discards without Watch', ok: true, quote, plan });
  }

  {
    const route = routeCases[2];
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    const { firstIsland } = routeFirstIsland(G.map, route.mainKey);
    assertAlarmRushedRouteCounterCheck(firstIsland && firstIsland.islandIdx === 3, 'Deck Sniper route did not start on Port');
    assertAlarmRushedRouteCounterCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), 'Port zero-send route selection failed');
    const wagePreview = finishZeroSendIslandForShop(G);
    assertAlarmRushedRouteCounterCheck(wagePreview.wages === 4 && wagePreview.alert === 3, `Port zero-send wages mismatch: ${JSON.stringify(wagePreview)}`);
    assertAlarmRushedRouteCounterCheck(G.enthusiasm >= api.TYPES[route.primary].cost && G.boardingAlert === 3, `Port zero-send state mismatch: ${JSON.stringify({ enthusiasm: G.enthusiasm, alert: G.boardingAlert })}`);
    const quote = assertSceneAndPolicyMatch(G, route.primary, 'Port cash below threshold');
    assertAlarmRushedRouteCounterCheck(quote.canBuy && !quote.alarmRushedRouteCounter && !quote.topDeck, `below-threshold cash primary top-decked: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertAlarmRushedRouteCounterCheck(G.discard.includes(bought) && !G.deck.includes(bought), 'below-threshold cash primary did not discard');
    assertAlarmRushedRouteCounterCheck(!(G.counterWatchIds || []).includes(bought.id), 'below-threshold cash primary gained Counter Watch');
    assertAlarmRushedRouteCounterCheck(!G.openingRouteCounterBoughtMainKey && G.openingRouteCounterBoughtPirateId == null, 'below-threshold cash primary secured route counter');
    results.push({ name: 'Port zero-send leaves 3 projected Alert below the Alarm rush threshold and discards the cash route primary', ok: true, quote, wagePreview });
  }

  {
    const route = routeCases[2];
    const G = setupRouteShop(route, { boardingAlert: 3, cacheClaimed: true });
    const quote = assertSceneAndPolicyMatch(G, route.primary, 'Port claimed-cache cash below threshold');
    assertAlarmRushedRouteCounterCheck(quote.canBuy && !quote.credit && !quote.alarmRushedRouteCounter && !quote.topDeck, `claimed-cache cash below threshold top-decked: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertAlarmRushedRouteCounterCheck(G.discard.includes(bought) && !G.deck.includes(bought), 'claimed-cache cash below threshold did not discard');
    assertAlarmRushedRouteCounterCheck(!(G.counterWatchIds || []).includes(bought.id), 'claimed-cache cash below threshold gained Counter Watch');
    assertAlarmRushedRouteCounterCheck(!G.openingRouteCounterBoughtMainKey && G.openingRouteCounterBoughtPirateId == null, 'claimed-cache cash below threshold secured route counter');
    results.push({ name: 'claimed route-cache cash primary below 4 pending Alert still discards', ok: true, quote });
  }

  {
    const route = routeCases[2];
    const G = setupRouteShop(route, { boardingAlert: 2, enthusiasm: api.TYPES[route.primary].cost - 2, cacheClaimed: true });
    const quote = assertSceneAndPolicyMatch(G, route.primary, 'Port credit alarm');
    assertAlarmRushedRouteCounterCheck(quote.canBuy && quote.credit && quote.alert === 2, `credit alarm did not expose +2 Alert: ${JSON.stringify(quote)}`);
    assertAlarmRushedRouteCounterCheck(quote.alarmRushedRouteCounter && quote.topDeck, `credit alarm did not top-deck: ${JSON.stringify(quote)}`);
    const plan = scene.shopPlanText();
    assertAlarmRushedRouteCounterCheck(plan.includes('Alarm rush') && plan.includes('credit +2 Alert') && plan.includes('top deck') && plan.includes('Watch'), `credit plan missing Alarm rush/credit/top-deck Watch: ${plan}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertAlarmRushedRouteCounterCheck(G.boardingAlert === 3 && G.shopCreditUsed === true, `credit alarm Alert/shopCredit mismatch after Cover: ${G.boardingAlert}/${G.shopCreditUsed}`);
    assertAlarmRushedRouteCounterCheck(G.deck[G.deck.length - 1] === bought && (G.counterWatchIds || []).includes(bought.id), 'credit alarm buy missed draw pile or Watch');
    assertAlarmRushedRouteCounterCheck((bought.might || 0) === 0 && !bought.weaponKey && (bought.tempo || 0) === 0, `credit alarm gained excluded upgrades: ${JSON.stringify(bought)}`);
    assertAlarmRushedRouteCounterCheck(G.openingRouteCounterBoughtMainKey === route.mainKey && G.openingRouteCounterBoughtPirateId === bought.id, 'credit alarm buy did not secure route counter');
    results.push({ name: 'Dockside Credit still qualifies claimed-cache Alarm rush when same-purchase Alert reaches 4', ok: true, quote, plan });
  }

  {
    const route = routeCases[2];
    const G = setupRouteShop(route, { boardingAlert: 2, enthusiasm: api.TYPES[route.primary].cost - 2 });
    const quote = assertSceneAndPolicyMatch(G, route.primary, 'Port unclaimed credit alarm exclusion');
    assertAlarmRushedRouteCounterCheck(quote.canBuy && quote.credit && quote.alert === 2 && !quote.alarmRushedRouteCounter && !quote.topDeck, `unclaimed credit route primary top-decked: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertAlarmRushedRouteCounterCheck(G.boardingAlert === 4 && G.discard.includes(bought) && !G.deck.includes(bought), 'unclaimed credit primary did not discard with +2 Alert');
    assertAlarmRushedRouteCounterCheck(!(G.counterWatchIds || []).includes(bought.id), 'unclaimed credit primary gained Counter Watch');
    assertAlarmRushedRouteCounterCheck(!G.openingRouteCounterBoughtMainKey && G.openingRouteCounterBoughtPirateId == null, 'unclaimed credit primary secured route counter');
    results.push({ name: 'unclaimed route caches block credit Alarm rush even at 4 projected Alert', ok: true, quote });
  }

  {
    const route = routeCases[2];
    const G = setupRouteShop(route, { boardingAlert: 1, enthusiasm: api.TYPES[route.primary].cost - 2, cacheClaimed: true });
    const quote = assertSceneAndPolicyMatch(G, route.primary, 'Port credit below threshold');
    assertAlarmRushedRouteCounterCheck(quote.canBuy && quote.credit && quote.alert === 2 && !quote.alarmRushedRouteCounter && !quote.topDeck, `credit below threshold top-decked: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertAlarmRushedRouteCounterCheck(G.boardingAlert === 3 && G.discard.includes(bought) && !G.deck.includes(bought), 'credit below threshold did not discard with +2 Alert');
    assertAlarmRushedRouteCounterCheck(!(G.counterWatchIds || []).includes(bought.id), 'credit below threshold gained Counter Watch');
    assertAlarmRushedRouteCounterCheck(!G.openingRouteCounterBoughtMainKey && G.openingRouteCounterBoughtPirateId == null, 'credit below threshold secured route counter');
    results.push({ name: 'claimed-cache Dockside Credit route-primary buys at 3 projected Alert still discard', ok: true, quote });
  }

  {
    const route = routeCases[1];
    const G = setupRouteShop(route, {
      boardingAlert: 4,
      fullCrewDiscount: 1,
      enthusiasm: api.TYPES[route.primary].cost - 1,
      cacheClaimed: true,
    });
    const quote = assertSceneAndPolicyMatch(G, route.primary, 'Full Crew setup owns top-deck');
    assertAlarmRushedRouteCounterCheck(quote.canBuy && quote.topDeck && !quote.alarmRushedRouteCounter && quote.discount === 1, `Full Crew setup was mislabeled Alarm rush: ${JSON.stringify(quote)}`);
    results.push({ name: 'Full Crew setup remains separate from Alarm rush labeling', ok: true, quote });
  }

  {
    const route = routeCases[0];
    const G = setupRouteShop(route, { boardingAlert: 4, openingCounterPlan: true, cacheClaimed: true });
    const quote = assertSceneAndPolicyMatch(G, route.primary, 'Opening Prep setup owns top-deck');
    assertAlarmRushedRouteCounterCheck(quote.canBuy && quote.topDeck && quote.openingCounterPrepMight && !quote.alarmRushedRouteCounter, `Opening Prep setup was mislabeled Alarm rush: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertAlarmRushedRouteCounterCheck((bought.might || 0) === 1, 'Opening Prep no longer granted prep Might');
    results.push({ name: 'Opening Counter Prep remains the only opening route-primary prep Might path', ok: true, quote });
  }

  {
    const route = routeCases[2];
    const G = setupRouteShop(route, { boardingAlert: 4, cacheClaimed: true });
    const quote = assertSceneAndPolicyMatch(G, 'drummer', 'non-counter alarm exclusion');
    assertAlarmRushedRouteCounterCheck(!quote.counter && !quote.alarmRushedRouteCounter && !quote.topDeck, `non-counter received Alarm rush route setup: ${JSON.stringify(quote)}`);
    results.push({ name: 'non-counter buys never become Alarm rush route counters', ok: true, quote });
  }

  {
    const route = routeCases[2];
    const G = setupRouteShop(route, { boardingAlert: 4, boardingCount: 1 });
    const quote = assertSceneAndPolicyMatch(G, route.primary, 'Boarding 2+ alarm exclusion');
    assertAlarmRushedRouteCounterCheck(!quote.openingRoutePrimary && !quote.alarmRushedRouteCounter, `Boarding 2+ received alarm route setup: ${JSON.stringify(quote)}`);
    results.push({ name: 'Boarding 2+ route-primary buys cannot use Alarm rush setup', ok: true, quote });
  }

  {
    const route = routeCases[2];
    const G = setupRouteShop(route, { mode: 'battleTest', boardingAlert: 4 });
    const quote = assertSceneAndPolicyMatch(G, route.primary, 'Battle Test alarm exclusion');
    assertAlarmRushedRouteCounterCheck(!quote.openingRoutePrimary && !quote.alarmRushedRouteCounter && !quote.topDeck, `Battle Test received alarm route setup: ${JSON.stringify(quote)}`);
    results.push({ name: 'Battle Test purchases cannot use Alarm rush setup', ok: true, quote });
  }

  return { ok: true, checks: results };
}

function runRouteCounterCoverChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  const routeCases = [
    { label: 'Forest/Shellback', mainKey: 'shellback', primary: 'poisoner', sideOffer: 'drummer' },
    { label: 'Rocky/Powder Bomber', mainKey: 'powderBomber', primary: 'sawbones', sideOffer: 'trainer' },
    { label: 'Port/Deck Sniper', mainKey: 'deckSniper', primary: 'needler', sideOffer: 'survivalist' },
  ];

  const routeFirstIsland = (map, mainKey) => {
    const firstShipLayer = map.layers.findIndex(layer => layer && layer.length === 1 && layer[0].type === 'ship');
    const routeCache = map.layers[firstShipLayer - 1].find(node => node && node.scoutedCache && node.scoutedCache.mainKey === mainKey);
    const firstIsland = routeCache && map.layers[0].includes(routeCache)
      ? routeCache
      : map.layers[0].find(node => node && Array.isArray(node.conns) && routeCache && node.conns.includes(routeCache.id));
    return { firstIsland };
  };

  const setupRouteShop = (route, opts = {}) => {
    api.initState();
    const G = api.getG();
    const { firstIsland } = routeFirstIsland(G.map, route.mainKey);
    assertRouteCounterCoverCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), `${route.label} route selection failed`);
    G.mode = opts.mode || 'run';
    G.phase = 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.shopCreditUsed = !!opts.shopCreditUsed;
    G.fullCrewDiscount = Math.max(0, Math.floor(Number(opts.fullCrewDiscount) || 0));
    G.openingCounterPlan = !!opts.openingCounterPlan;
    G.openingRouteCacheClaimedMainKey = opts.cacheClaimed ? route.mainKey : (opts.openingRouteCacheClaimedMainKey || null);
    G.boardingAlert = Math.max(0, Math.floor(Number(opts.boardingAlert) || 0));
    G.boardingCount = Math.max(0, Math.floor(Number(opts.boardingCount) || 0));
    G.enthusiasm = opts.enthusiasm != null
      ? Math.max(0, Math.floor(Number(opts.enthusiasm) || 0))
      : api.TYPES[route.primary].cost;
    G.shop = api.normalizeOpeningRouteShop(
      [route.primary, route.sideOffer, 'herald', 'trainer'],
      G.round,
      { map: G.map, mode: G.mode, boardingCount: G.boardingCount }
    );
    G.deck = [];
    G.discard = [];
    G.counterWatchIds = [];
    return G;
  };

  {
    const route = routeCases[1];
    const G = setupRouteShop(route, {
      boardingAlert: 1,
      fullCrewDiscount: 1,
      enthusiasm: 1,
    });
    const quote = scene.shopPurchaseQuote(route.primary);
    const directQuote = shopPurchaseQuote(api, G, route.primary);
    assertRouteCounterCoverCheck(quote.canBuy && quote.topDeck && quote.fullCrewCoverage === 1, `Rocky coverage quote mismatch: ${JSON.stringify(quote)}`);
    assertRouteCounterCoverCheck(quote.routeCounterCover === 1 && directQuote.routeCounterCover === 1, `Rocky coverage did not preview Cover: ${JSON.stringify({ quote, directQuote })}`);
    assertRouteCounterCoverCheck(scene.shopPlanText().includes('Cover -1 Alert'), `Rocky plan did not show Cover: ${scene.shopPlanText()}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertRouteCounterCoverCheck(bought && bought.type === route.primary, 'Rocky coverage buy failed');
    assertRouteCounterCoverCheck(G.boardingAlert === 0, `Rocky coverage Cover left Alert ${G.boardingAlert}`);
    assertRouteCounterCoverCheck(G.openingRouteCounterBoughtMainKey === route.mainKey && (G.counterWatchIds || []).includes(bought.id), 'Rocky coverage buy did not secure watched counter');
    results.push({ name: 'Rocky Full Crew coverage route-primary buy reduces pending Alert by 1', ok: true, quote });
  }

  {
    const route = routeCases[2];
    const G = setupRouteShop(route, {
      boardingAlert: 3,
      openingCounterPlan: true,
    });
    const quote = scene.shopPurchaseQuote(route.primary);
    assertRouteCounterCoverCheck(quote.canBuy && quote.topDeck && quote.openingCounterPrepMight && quote.routeCounterCover === 1, `Port Opening Prep quote missed Cover: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertRouteCounterCoverCheck(bought && bought.type === route.primary && (bought.might || 0) === 1, 'Port Opening Prep buy failed or missed Might');
    assertRouteCounterCoverCheck(G.boardingAlert === 2, `Port Opening Prep Cover left Alert ${G.boardingAlert}`);
    results.push({ name: 'Port Opening Counter Prep route-primary buy reduces pending Alert by 1', ok: true, quote });
  }

  {
    const route = routeCases[2];
    const G = setupRouteShop(route, {
      boardingAlert: 4,
      cacheClaimed: true,
    });
    const quote = scene.shopPurchaseQuote(route.primary);
    assertRouteCounterCoverCheck(quote.canBuy && quote.topDeck && quote.alarmRushedRouteCounter && quote.routeCounterCover === 1, `Port Alarm rush quote missed Cover: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertRouteCounterCoverCheck(bought && bought.type === route.primary, 'Port Alarm rush buy failed');
    assertRouteCounterCoverCheck(G.boardingAlert === 3, `Port Alarm rush Cover left Alert ${G.boardingAlert}`);
    results.push({ name: 'Cache-claimed Alarm Rush route-primary buy reduces pending Alert by 1', ok: true, quote });
  }

  {
    const route = routeCases[0];
    const G = setupRouteShop(route, {
      boardingAlert: 0,
      fullCrewDiscount: 1,
      enthusiasm: 0,
    });
    const quote = scene.shopPurchaseQuote(route.primary);
    assertRouteCounterCoverCheck(quote.canBuy && quote.topDeck && quote.discount === 1 && quote.routeCounterCover === 0, `Forest no-Alert quote granted Cover: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertRouteCounterCoverCheck(bought && G.boardingAlert === 0, `Forest no-Alert buy changed Alert ${G.boardingAlert}`);
    results.push({ name: 'Forest secured route-primary buy at 0 pending Alert grants no extra Cover reward', ok: true, quote });
  }

  {
    const route = routeCases[1];
    const G = setupRouteShop(route, {
      boardingAlert: 2,
      openingCounterPlan: true,
      enthusiasm: api.TYPES[route.sideOffer].cost,
    });
    const quote = scene.shopPurchaseQuote(route.sideOffer);
    assertRouteCounterCoverCheck(quote.canBuy && quote.openingSidePrep && quote.topDeck && quote.routeCounterCover === 0, `side prep quote received Cover: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.sideOffer), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertRouteCounterCoverCheck(bought && bought.type === route.sideOffer, 'side prep buy failed');
    assertRouteCounterCoverCheck(G.boardingAlert === 2 && !G.openingRouteCounterBoughtMainKey, `side prep changed Alert or secured route: ${G.boardingAlert}/${G.openingRouteCounterBoughtMainKey}`);
    results.push({ name: 'Opening Side Prep does not trigger Route Counter Cover', ok: true, quote });
  }

  {
    const route = routeCases[2];
    const G = setupRouteShop(route, { boardingAlert: 4 });
    const quote = scene.shopPurchaseQuote(route.primary);
    assertRouteCounterCoverCheck(quote.canBuy && !quote.topDeck && quote.routeCounterCover === 0, `discard-only primary quote received Cover: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertRouteCounterCoverCheck(bought && G.discard.includes(bought) && !G.deck.includes(bought), 'discard-only primary did not discard');
    assertRouteCounterCoverCheck(G.boardingAlert === 4 && !G.openingRouteCounterBoughtMainKey, `discard-only primary changed Alert or secured route: ${G.boardingAlert}/${G.openingRouteCounterBoughtMainKey}`);
    results.push({ name: 'discard-only route-primary buys do not trigger Route Counter Cover', ok: true, quote });
  }

  [
    { name: 'Battle Test', route: routeCases[2], opts: { mode: 'battleTest', boardingAlert: 2, fullCrewDiscount: 1, openingCounterPlan: true, cacheClaimed: true } },
    { name: 'Boarding 2+', route: routeCases[1], opts: { boardingCount: 1, boardingAlert: 2, fullCrewDiscount: 1 } },
  ].forEach(({ name, route, opts }) => {
    const G = setupRouteShop(route, opts);
    const quote = scene.shopPurchaseQuote(route.primary);
    assertRouteCounterCoverCheck(quote.routeCounterCover === 0, `${name} quote received Cover: ${JSON.stringify(quote)}`);
    const before = G.boardingAlert;
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertRouteCounterCoverCheck(bought && G.boardingAlert === before, `${name} buy changed Alert ${G.boardingAlert} !== ${before}`);
    results.push({ name: `${name} route-primary buys do not trigger Route Counter Cover`, ok: true, quote });
  });

  return { ok: true, checks: results };
}

runOpeningRouteContractChecks = runOpeningRoutePrizeChecks;

function runOpeningCounterSubsidyChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];

  const setupPurchase = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.map = opts.map === undefined
      ? makeScoutedCounterTestMap(opts.mainKey || 'shellback')
      : opts.map;
    G.round = opts.round != null ? Math.max(0, Math.floor(Number(opts.round) || 0)) : 1;
    G.boardingCount = opts.boardingCount != null
      ? Math.max(0, Math.floor(Number(opts.boardingCount) || 0))
      : 0;
    G.phase = opts.phase || 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.enthusiasm = opts.enthusiasm != null ? Math.max(0, Math.floor(Number(opts.enthusiasm) || 0)) : 1;
    G.boardingAlert = Math.max(0, Math.floor(Number(opts.boardingAlert) || 0));
    G.fullCrewDiscount = Math.max(0, Math.floor(Number(opts.fullCrewDiscount) || 0));
    G.openingCounterPlan = !!opts.openingCounterPlan;
    G.shopCreditUsed = !!opts.shopCreditUsed;
    G.shop = [opts.type || 'sawbones'];
    G.hand = [];
    G.sent = [];
    G.discard = [];
    G.deck = G.allCrew[0] ? [G.allCrew[0]] : [];
    G.counterWatchIds = [];
    return G;
  };

  [
    { label: 'Shellback', mainKey: 'shellback', type: 'needler' },
    { label: 'Powder Bomber', mainKey: 'powderBomber', type: 'sawbones' },
    { label: 'Deck Sniper', mainKey: 'deckSniper', type: 'needler' },
  ].forEach(({ label, mainKey, type }) => {
    const G = setupPurchase({ type, mainKey, enthusiasm: 1, fullCrewDiscount: 1 });
    const quote = scene.shopPurchaseQuote(type);
    const directQuote = shopPurchaseQuote(api, G, type);
    assertOpeningCounterSubsidyCheck(quote.canBuy && !quote.credit, `${label} quote was not buyable without credit: ${JSON.stringify(quote)}`);
    assertOpeningCounterSubsidyCheck(quote.fullCrewCoverage === 1, `${label} coverage ${quote.fullCrewCoverage} !== 1`);
    assertOpeningCounterSubsidyCheck(quote.discount === 1 && quote.missing === 1 && quote.spend === 1 && quote.alert === 0, `${label} quote economics mismatch: ${JSON.stringify(quote)}`);
    assertOpeningCounterSubsidyCheck(quote.counter && quote.topDeck && !quote.preparedCounter && !quote.openingCounterPrepMight, `${label} quote should be top-deck without pre-boarding preparation: ${JSON.stringify(quote)}`);
    assertOpeningCounterSubsidyCheck(directQuote.canBuy && !directQuote.credit && directQuote.fullCrewCoverage === 1 && !directQuote.preparedCounter && !directQuote.openingCounterPrepMight, `${label} sim policy quote missed coverage or prepped early: ${JSON.stringify(directQuote)}`);
    const plan = scene.shopPlanText();
    assertOpeningCounterSubsidyCheck(plan.includes('Full Crew covers -1☠️') && !plan.includes('credit') && !plan.includes('prepared'), `${label} plan did not show Full Crew coverage buy: ${plan}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningCounterSubsidyCheck(bought && bought.type === type, `${label} covered ${type} buy failed`);
    assertOpeningCounterSubsidyCheck(G.enthusiasm === 0, `${label} covered buy left enthusiasm ${G.enthusiasm}`);
    assertOpeningCounterSubsidyCheck(G.boardingAlert === 0, `${label} covered buy added Alert ${G.boardingAlert}`);
    assertOpeningCounterSubsidyCheck(G.shopCreditUsed === false, `${label} covered buy marked shopCreditUsed`);
    assertOpeningCounterSubsidyCheck(G.fullCrewDiscount === 0, `${label} covered buy did not consume Full Crew Discount`);
    assertOpeningCounterSubsidyCheck(G.deck[G.deck.length - 1] === bought, `${label} covered counter did not go to top of deck`);
    assertOpeningCounterSubsidyCheck((G.counterWatchIds || []).includes(bought.id), `${label} covered counter did not gain Counter Watch`);
    assertOpeningCounterSubsidyCheck(!bought.weaponKey && bought.might === 0 && bought.tempo === 0, `${label} covered pre-boarding counter gained upgrades: ${JSON.stringify(bought)}`);
    assertOpeningCounterSubsidyCheck(!G.discard.includes(bought), `${label} covered counter also went to discard`);
    results.push({ name: `round-1 full-discount ${label} counter missing exactly one is covered without credit, Alert, Might, or Prepared`, ok: true, plan });
  });

  [
    { label: 'Shellback', mainKey: 'shellback', type: 'needler' },
    { label: 'Powder Bomber', mainKey: 'powderBomber', type: 'sawbones' },
    { label: 'Deck Sniper', mainKey: 'deckSniper', type: 'needler' },
  ].forEach(({ label, mainKey, type }) => {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.map = makeScoutedCounterTestMap(mainKey);
    G.round = 1;
    G.boardingCount = 0;
    G.phase = 'sending';
    G.island = scene.buildIslandState(api.ISLANDS[0]);
    G.shop = [type];
    G.enthusiasm = 0;
    G.boardingAlert = 0;
    G.fullCrewDiscount = 0;
    G.shopCreditUsed = false;
    G.sent = [];
    const fullLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(2, { includePortDrill: true }));
    assertOpeningCounterSubsidyCheck(fullLine.includes('Full Crew -1☠️'), `${label} full-send line lacks discount: ${fullLine}`);
    assertOpeningCounterSubsidyCheck(fullLine.includes('Full Crew covers -1☠️') && !fullLine.includes('credit') && !fullLine.includes('prepared'), `${label} full-send projection did not expose Full Crew coverage without credit: ${fullLine}`);
    results.push({ name: `round-1 full-send sending plan previews Full Crew coverage for the ${label} counter buy`, ok: true, fullLine });
  });

  const cases = [
    {
      name: 'without Full Crew Discount uses Dockside Credit for missing two',
      opts: { type: 'needler', enthusiasm: 1, fullCrewDiscount: 0 },
      expect: { canBuy: true, credit: true, alert: 2, prepared: false },
    },
    {
      name: 'round 2 before Boarding 1 keeps Dockside Credit without discount preparation',
      opts: { type: 'needler', round: 2, enthusiasm: 1, fullCrewDiscount: 1 },
      expect: { canBuy: true, credit: true, alert: 1, prepared: false },
    },
    {
      name: 'after first boarding keeps Dockside Credit for the one-missing discounted counter',
      opts: { type: 'needler', boardingCount: 1, enthusiasm: 1, fullCrewDiscount: 1 },
      expect: { canBuy: true, credit: true, alert: 1, prepared: true },
    },
    {
      name: 'Battle Test stays blocked instead of receiving Full Crew coverage',
      opts: { type: 'needler', mode: 'battleTest', enthusiasm: 1, fullCrewDiscount: 1 },
      expect: { canBuy: false, credit: false, alert: 0, prepared: false },
    },
    {
      name: 'missing two after discount still uses Dockside Credit',
      opts: { type: 'needler', enthusiasm: 0, fullCrewDiscount: 1 },
      expect: { canBuy: true, credit: true, alert: 2, prepared: false },
    },
    {
      name: 'non-counter one-missing discounted buys never receive Full Crew coverage',
      opts: { type: 'trainer', enthusiasm: 1, fullCrewDiscount: 1 },
      expect: { canBuy: true, credit: true, alert: 1, prepared: false },
    },
    {
      name: 'already-affordable discounted counters do not display Full Crew coverage',
      opts: { type: 'needler', enthusiasm: 2, fullCrewDiscount: 1 },
      expect: { canBuy: true, credit: false, alert: 0, prepared: false, planNoCovered: true },
    },
    {
      name: 'used Dockside Credit blocks the one-missing discounted counter instead of covering it',
      opts: { type: 'needler', enthusiasm: 1, fullCrewDiscount: 1, shopCreditUsed: true },
      expect: { canBuy: false, credit: false, alert: 0, prepared: false },
    },
      {
        name: 'Opening Counter Prep applies after Full Crew Discount and still gives the counter +Might',
        opts: { type: 'sawbones', mainKey: 'powderBomber', enthusiasm: 1, fullCrewDiscount: 1, openingCounterPlan: true },
        expect: { canBuy: true, credit: false, alert: 0, prepared: false, prepMight: true, prepDiscount: 1, effectiveCost: 1, spend: 1 },
      },
  ];

  cases.forEach(({ name, opts, expect }) => {
    const G = setupPurchase(opts);
    const quote = scene.shopPurchaseQuote(opts.type || 'sawbones');
    const directQuote = shopPurchaseQuote(api, G, opts.type || 'sawbones');
    assertOpeningCounterSubsidyCheck((quote.fullCrewCoverage || 0) === 0, `${name} scene quote received Full Crew coverage: ${JSON.stringify(quote)}`);
    assertOpeningCounterSubsidyCheck((directQuote.fullCrewCoverage || 0) === 0, `${name} sim quote received Full Crew coverage: ${JSON.stringify(directQuote)}`);
    assertOpeningCounterSubsidyCheck(!!quote.canBuy === !!expect.canBuy, `${name} canBuy ${quote.canBuy} !== ${expect.canBuy}`);
    assertOpeningCounterSubsidyCheck(!!quote.credit === !!expect.credit, `${name} credit ${quote.credit} !== ${expect.credit}`);
    assertOpeningCounterSubsidyCheck(Math.max(0, quote.alert || 0) === expect.alert, `${name} alert ${quote.alert} !== ${expect.alert}`);
    assertOpeningCounterSubsidyCheck(!!quote.preparedCounter === !!expect.prepared, `${name} prepared ${quote.preparedCounter} !== ${expect.prepared}`);
      if (expect.prepMight != null) {
        assertOpeningCounterSubsidyCheck(!!quote.openingCounterPrepMight === !!expect.prepMight, `${name} prep Might ${quote.openingCounterPrepMight} !== ${expect.prepMight}`);
        assertOpeningCounterSubsidyCheck(!!directQuote.openingCounterPrepMight === !!expect.prepMight, `${name} sim prep Might ${directQuote.openingCounterPrepMight} !== ${expect.prepMight}`);
      }
      if (expect.prepDiscount != null) {
        assertOpeningCounterSubsidyCheck((quote.openingCounterPrepDiscount || 0) === expect.prepDiscount, `${name} prep discount ${quote.openingCounterPrepDiscount || 0} !== ${expect.prepDiscount}`);
        assertOpeningCounterSubsidyCheck((directQuote.openingCounterPrepDiscount || 0) === expect.prepDiscount, `${name} sim prep discount ${directQuote.openingCounterPrepDiscount || 0} !== ${expect.prepDiscount}`);
      }
      if (expect.effectiveCost != null) {
        assertOpeningCounterSubsidyCheck(quote.effectiveCost === expect.effectiveCost && quote.spend === expect.spend, `${name} economics ${quote.effectiveCost}/${quote.spend} !== ${expect.effectiveCost}/${expect.spend}`);
      }
    if (expect.planNoCovered) {
      const plan = scene.shopPlanText();
      assertOpeningCounterSubsidyCheck(!plan.includes('covers'), `${name} displayed coverage: ${plan}`);
    }
    results.push({ name, ok: true, quote });
  });

  return { ok: true, checks: results };
}

function runOpeningCounterPlanChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];

  const nearbyMap = (mainKey = 'powderBomber') => {
    return makeScoutedCounterTestMap(mainKey);
  };

  const setupShop = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.map = opts.map === undefined ? nearbyMap(opts.mainKey || 'powderBomber') : opts.map;
    G.round = opts.round != null ? Math.max(0, Math.floor(Number(opts.round) || 0)) : 1;
    G.boardingCount = opts.boardingCount != null
      ? Math.max(0, Math.floor(Number(opts.boardingCount) || 0))
      : 0;
    G.phase = 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.enthusiasm = opts.enthusiasm != null ? Math.max(0, Math.floor(Number(opts.enthusiasm) || 0)) : 3;
    G.boardingAlert = Math.max(0, Math.floor(Number(opts.boardingAlert) || 0));
    G.fullCrewDiscount = Math.max(0, Math.floor(Number(opts.fullCrewDiscount) || 0));
    G.openingCounterPlan = !!opts.openingCounterPlan;
    G.shopCreditUsed = !!opts.shopCreditUsed;
    G.shop = opts.shop ? [...opts.shop] : [opts.type || 'sawbones'];
    G.hand = [];
    G.sent = [];
    G.discard = [];
    G.deck = G.allCrew[0] ? [G.allCrew[0]] : [];
    G.counterWatchIds = [];
    return G;
  };

  const setupSending = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.map = nearbyMap(opts.mainKey || 'powderBomber');
    G.round = opts.round != null ? Math.max(0, Math.floor(Number(opts.round) || 0)) : 1;
    G.boardingCount = opts.boardingCount != null
      ? Math.max(0, Math.floor(Number(opts.boardingCount) || 0))
      : 0;
    G.phase = 'sending';
    G.island = scene.buildIslandState(api.ISLANDS[opts.islandIdx != null ? opts.islandIdx : 0]);
    G.sent = [];
    const sentCount = Math.max(0, Math.floor(Number(opts.sent) || 0));
    for (let i = 0; i < sentCount; i++) G.sent.push(i);
    if (opts.removeFirstSent && G.sent.length) {
      const pirate = G.hand[G.sent[0]];
      if (pirate) {
        removePirateById(G, pirate.id);
        scene._sacrificedIds.add(pirate.id);
      }
    }
    G.enthusiasm = 0;
    G.boardingAlert = 0;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = false;
    G.shopCreditUsed = false;
    return G;
  };

  {
    const G = setupSending({ sent: 1 });
    const preview = scene.shipWagePreview();
    updateFullCrewDiscountForSim(scene, G);
    updateOpeningCounterPlanForSim(scene, G);
    applyShipWagesForSim(scene, G);
    G.phase = 'shopping';
    G.shop = ['sawbones'];
    G.shopCreditUsed = false;

    assertOpeningCounterPlanCheck(preview.openingCommission === 1 && preview.wages === 3 && preview.alert === 1, `one-short wages changed: ${JSON.stringify(preview)}`);
    assertOpeningCounterPlanCheck(G.openingCounterPlan === true, 'eligible one-short did not grant Opening Counter Prep');
    assertOpeningCounterPlanCheck(G.fullCrewDiscount === 0, 'one-short unexpectedly granted Full Crew Discount');

      const quote = scene.shopPurchaseQuote('sawbones');
      const directQuote = shopPurchaseQuote(api, G, 'sawbones');
      assertOpeningCounterPlanCheck(quote.canBuy && !quote.credit, `prep counter quote was not affordable normally: ${JSON.stringify(quote)}`);
      assertOpeningCounterPlanCheck(quote.counter && quote.topDeck && quote.openingCounterPrepMight && !quote.preparedCounter, `prep counter quote was not +Might top-deck: ${JSON.stringify(quote)}`);
      assertOpeningCounterPlanCheck(quote.discount === 0 && quote.openingCounterPrepDiscount === 1 && quote.effectiveCost === 2 && quote.spend === 2 && quote.fullCrewCoverage === 0, `prep quote economics mismatch: ${JSON.stringify(quote)}`);
      assertOpeningCounterPlanCheck(directQuote.openingCounterPrepMight && directQuote.openingCounterPrepDiscount === 1 && directQuote.effectiveCost === 2 && !directQuote.preparedCounter && directQuote.fullCrewCoverage === 0, `sim helper quote missed prep: ${JSON.stringify(directQuote)}`);
      const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
      assertOpeningCounterPlanCheck(bought && bought.type === 'sawbones', 'prep counter buy failed');
      assertOpeningCounterPlanCheck(G.enthusiasm === 1, `prep counter did not spend discounted cost: ${G.enthusiasm}`);
      assertOpeningCounterPlanCheck(G.openingCounterPlan === false, 'Opening Counter Prep was not consumed');
    assertOpeningCounterPlanCheck(G.deck[G.deck.length - 1] === bought, 'prep counter was not placed on top of deck');
    assertOpeningCounterPlanCheck((G.counterWatchIds || []).includes(bought.id), 'prep counter did not gain Counter Watch');
    assertOpeningCounterPlanCheck(!bought.weaponKey && bought.might === 1, `prep Sawbones did not gain only +1 Might: ${JSON.stringify(bought)}`);
    results.push({ name: 'one-short Opening Commission grants Opening Counter Prep for +1 Might on the first top-deck scouted counter', ok: true });
  }

  {
    const G = setupShop({ openingCounterPlan: true, shop: ['herald', 'sawbones'], enthusiasm: 7 });
    const firstQuote = scene.shopPurchaseQuote('herald');
    assertOpeningCounterPlanCheck(firstQuote.canBuy && !firstQuote.counter && !firstQuote.topDeck && !firstQuote.openingCommissionReport && !firstQuote.consumesOpeningCounterPlan && !firstQuote.openingCounterPrep && !firstQuote.preparedCounter && !firstQuote.openingCounterPrepMight, `non-counter first quote mismatch: ${JSON.stringify(firstQuote)}`);
    const first = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningCounterPlanCheck(first && first.type === 'herald', 'non-counter first buy failed');
    assertOpeningCounterPlanCheck(G.openingCounterPlan === true, 'non-counter first buy consumed Opening Counter Prep');
    assertOpeningCounterPlanCheck(G.discard.includes(first) && !G.deck.includes(first), 'non-counter first buy did not go to discard');
    assertOpeningCounterPlanCheck((G.counterWatchIds || []).length === 0, 'non-counter first buy gained Counter Watch');
    assertOpeningCounterPlanCheck(!first.weaponKey && (first.might || 0) === 0 && (first.tempo || 0) === 0, `non-counter first buy gained counter/prep perks: ${JSON.stringify(first)}`);
    const quote = scene.shopPurchaseQuote('sawbones');
      assertOpeningCounterPlanCheck(quote.canBuy && quote.topDeck && !quote.preparedCounter && quote.openingCounterPrepMight && quote.openingCounterPrepDiscount === 1 && quote.effectiveCost === 2 && quote.consumesOpeningCounterPlan, `later counter did not keep banked prep: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningCounterPlanCheck(bought && bought.type === 'sawbones', 'later counter buy failed');
    assertOpeningCounterPlanCheck(G.openingCounterPlan === false, 'later counter did not consume banked Opening Counter Prep');
    assertOpeningCounterPlanCheck(G.deck[G.deck.length - 1] === bought, 'later prep counter was not placed on top of deck');
    assertOpeningCounterPlanCheck((G.counterWatchIds || []).includes(bought.id), 'later prep counter did not gain Counter Watch');
    assertOpeningCounterPlanCheck(!bought.weaponKey && (bought.might || 0) === 1, `later counter missed banked prep after non-counter buy: ${JSON.stringify(bought)}`);
    results.push({ name: 'opening non-counter buys discard without consuming prep, letting a later counter spend it', ok: true });
  }

  {
    const G = setupShop({ openingCounterPlan: true, shop: ['herald'], enthusiasm: 4 });
    const quote = scene.shopPurchaseQuote('herald');
    assertOpeningCounterPlanCheck(quote.canBuy && !quote.openingCommissionReport && !quote.topDeck && !quote.consumesOpeningCounterPlan && !quote.openingCounterPrepMight, `non-counter-only quote top-decked or consumed prep: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningCounterPlanCheck(bought && bought.type === 'herald', 'non-counter-only buy failed');
    assertOpeningCounterPlanCheck(G.openingCounterPlan === true, 'non-counter-only buy consumed Opening Counter Prep');
    assertOpeningCounterPlanCheck(G.discard.includes(bought) && !G.deck.includes(bought), 'non-counter-only buy did not go to discard');
    assertOpeningCounterPlanCheck((G.counterWatchIds || []).length === 0, 'non-counter-only buy gained Counter Watch');
    prepareNextRoundForSim(api, scene);
    assertOpeningCounterPlanCheck(G.openingCounterPlan === false, 'unused prep did not expire after non-counter-only Continue');
    assertOpeningCounterPlanCheck(G.phase === 'map', `non-counter-only Continue did not return to map: ${G.phase}`);
    results.push({ name: 'buying only a non-counter leaves Opening Counter Prep banked until Continue expires it', ok: true });
  }

  {
    const G = setupShop({ openingCounterPlan: true, fullCrewDiscount: 1, shop: ['herald', 'sawbones'], enthusiasm: 4 });
    const quote = scene.shopPurchaseQuote('herald');
    assertOpeningCounterPlanCheck(quote.canBuy && !quote.openingCommissionReport && !quote.openingFullCrewReport && !quote.topDeck && quote.discount === 1 && !quote.consumesOpeningCounterPlan && !quote.openingCounterPrepMight, `Full Crew non-counter quote mismatch: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningCounterPlanCheck(bought && bought.type === 'herald', 'Full Crew non-counter buy failed');
    assertOpeningCounterPlanCheck(G.fullCrewDiscount === 0 && G.openingCounterPlan === true, 'Full Crew non-counter buy did not spend only discount');
    assertOpeningCounterPlanCheck(G.discard.includes(bought) && !G.deck.includes(bought) && (G.counterWatchIds || []).length === 0, 'Full Crew non-counter changed discard/watch behavior');
    const counterQuote = scene.shopPurchaseQuote('sawbones');
      assertOpeningCounterPlanCheck(counterQuote.canBuy && counterQuote.topDeck && counterQuote.openingCounterPrepMight && counterQuote.openingCounterPrepDiscount === 1 && counterQuote.effectiveCost === 2 && counterQuote.discount === 0, `counter after Full Crew non-counter did not keep prep: ${JSON.stringify(counterQuote)}`);
    const counter = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningCounterPlanCheck(counter && counter.type === 'sawbones', 'counter after Full Crew non-counter buy failed');
    assertOpeningCounterPlanCheck(G.openingCounterPlan === false && G.deck[G.deck.length - 1] === counter && counter.might === 1, `counter after Full Crew non-counter missed prep: ${JSON.stringify(counter)}`);
    results.push({ name: 'Full Crew non-counter buys discard and spend only the discount, preserving prep for a later counter', ok: true });
  }

  {
    const G = setupShop({ openingCounterPlan: true, shop: ['survivalist'], enthusiasm: 1 });
    const quote = scene.shopPurchaseQuote('survivalist');
    assertOpeningCounterPlanCheck(quote.canBuy && quote.credit && quote.alert === 2 && !quote.openingCommissionReport && !quote.topDeck && !quote.openingSidePrep && !quote.consumesOpeningCounterPlan, `Dockside Credit non-counter quote mismatch: ${JSON.stringify(quote)}`);
    assertOpeningCounterPlanCheck(!quote.counter && !quote.openingCounterPrepMight && !quote.preparedCounter, `Dockside Credit non-counter gained counter perks: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningCounterPlanCheck(bought && bought.type === 'survivalist', 'Dockside Credit non-counter buy failed');
    assertOpeningCounterPlanCheck(G.openingCounterPlan === true, 'Dockside Credit non-counter consumed Opening Counter Prep');
    assertOpeningCounterPlanCheck(G.shopCreditUsed === true && G.boardingAlert === 2, `Dockside Credit non-counter missed Alert/credit state: alert=${G.boardingAlert} credit=${G.shopCreditUsed}`);
    assertOpeningCounterPlanCheck(G.discard.includes(bought) && !G.deck.includes(bought) && (G.counterWatchIds || []).length === 0, 'Dockside Credit non-counter did not discard without Counter Watch');
    assertOpeningCounterPlanCheck(!bought.weaponKey && (bought.might || 0) === 0 && (bought.tempo || 0) === 0, `Dockside Credit non-counter gained upgrades: ${JSON.stringify(bought)}`);
    results.push({ name: 'Dockside Credit non-counter buys add normal Alert without consuming Opening Counter Prep', ok: true });
  }

  {
    const G = setupShop({ openingCounterPlan: true, shop: ['sawbones'], enthusiasm: 3 });
    prepareNextRoundForSim(api, scene);
    assertOpeningCounterPlanCheck(G.openingCounterPlan === false, 'unused Opening Counter Prep did not expire on Continue');
    assertOpeningCounterPlanCheck(G.phase === 'map', `Continue did not return to map: ${G.phase}`);
    results.push({ name: 'unused Opening Counter Prep expires on Shop Continue', ok: true });
  }

  {
      const G = setupShop({ openingCounterPlan: true, fullCrewDiscount: 1, shop: ['sawbones'], enthusiasm: 2 });
      const quote = scene.shopPurchaseQuote('sawbones');
      assertOpeningCounterPlanCheck(quote.canBuy && quote.discount === 1 && quote.openingCounterPrepDiscount === 1 && quote.effectiveCost === 1 && quote.spend === 1, `discount+prep quote changed price: ${JSON.stringify(quote)}`);
      assertOpeningCounterPlanCheck(quote.openingCounterPrepMight && !quote.preparedCounter && quote.fullCrewCoverage === 0, `pre-boarding prep did not own +Might with Full Crew Discount present: ${JSON.stringify(quote)}`);
      const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
      assertOpeningCounterPlanCheck(bought && !bought.weaponKey && bought.might === 1, `discount+prep counter did not gain only +1 Might: ${JSON.stringify(bought)}`);
      assertOpeningCounterPlanCheck(G.enthusiasm === 1 && G.fullCrewDiscount === 0 && G.openingCounterPlan === false, 'discount+prep buy did not consume both shop flags or discounted spend');
      results.push({ name: 'Opening Counter Prep grants +1 Might even when Full Crew Discount changes the price', ok: true });
    }

  {
      const G = setupShop({ openingCounterPlan: true, mainKey: 'shellback', shop: ['needler'], enthusiasm: 3 });
      const quote = scene.shopPurchaseQuote('needler');
      assertOpeningCounterPlanCheck(quote.canBuy && quote.counter && quote.topDeck && quote.openingCounterPrepMight, `Shellback prep quote missed +Might: ${JSON.stringify(quote)}`);
      assertOpeningCounterPlanCheck(quote.openingCounterPrepDiscount === 1 && quote.effectiveCost === 2 && !quote.preparedCounter && quote.fullCrewCoverage === 0, `Shellback prep quote incorrectly priced, prepared, or covered: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningCounterPlanCheck(bought && bought.type === 'needler', 'Shellback prep Needler buy failed');
    assertOpeningCounterPlanCheck(G.deck[G.deck.length - 1] === bought, 'Shellback prep Needler did not top-deck');
    assertOpeningCounterPlanCheck((G.counterWatchIds || []).includes(bought.id), 'Shellback prep Needler did not gain Counter Watch');
    assertOpeningCounterPlanCheck(!bought.weaponKey && bought.might === 1 && bought.tempo === 0, `Shellback prep Needler gained wrong upgrades: ${JSON.stringify(bought)}`);
    results.push({ name: 'Opening Counter Prep gives a Shellback counter +1 Might, top deck, and Counter Watch without Prepared weapon gains', ok: true });
  }

  {
      const G = setupShop({ openingCounterPlan: true, shop: ['sawbones'], enthusiasm: 1 });
      const quote = scene.shopPurchaseQuote('sawbones');
      assertOpeningCounterPlanCheck(quote.canBuy && quote.credit && quote.alert === 1 && quote.missing === 1 && quote.spend === 1 && quote.consumesOpeningCounterPlan, `prep should use Dockside Credit only for the post-discount missing one: ${JSON.stringify(quote)}`);
      assertOpeningCounterPlanCheck(quote.openingCounterPrepMight && quote.openingCounterPrepDiscount === 1 && quote.effectiveCost === 2 && quote.fullCrewCoverage === 0 && quote.routeCounterCover === 1, `prep incorrectly priced, covered, or missed Route Counter Cover: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningCounterPlanCheck(bought && bought.type === 'sawbones', 'Dockside Credit prep counter buy failed');
    assertOpeningCounterPlanCheck(G.openingCounterPlan === false, 'Dockside Credit prep counter did not consume Opening Counter Prep');
    assertOpeningCounterPlanCheck(G.shopCreditUsed === true && G.boardingAlert === 0, `Dockside Credit prep counter missed Alert/credit/Cover state: alert=${G.boardingAlert} credit=${G.shopCreditUsed}`);
    assertOpeningCounterPlanCheck(G.deck[G.deck.length - 1] === bought && (G.counterWatchIds || []).includes(bought.id), 'Dockside Credit prep counter did not top-deck with Counter Watch');
    assertOpeningCounterPlanCheck(!bought.weaponKey && bought.might === 1, `Dockside Credit prep counter gained wrong upgrades: ${JSON.stringify(bought)}`);
    results.push({ name: 'Opening Counter Prep can be spent by a Dockside Credit route counter and Route Counter Cover cancels one pending Alert', ok: true });
  }

  {
    const G = setupShop({ openingCounterPlan: true, shop: ['sawbones'], enthusiasm: 5, boardingAlert: 1 });
    const used = scene.useQuietDocks({ deferRender: true, silent: true, skipPanelRefresh: true });
    assertOpeningCounterPlanCheck(used, 'Quiet Docks could not be used');
    assertOpeningCounterPlanCheck(G.openingCounterPlan === true, 'Quiet Docks consumed Opening Counter Prep');
    assertOpeningCounterPlanCheck(G.enthusiasm === 3 && G.boardingAlert === 0, `Quiet Docks economics changed: enthusiasm=${G.enthusiasm} alert=${G.boardingAlert}`);
    prepareNextRoundForSim(api, scene);
    assertOpeningCounterPlanCheck(G.openingCounterPlan === false, 'Quiet Docks banked prep did not expire on Continue');
    results.push({ name: 'Quiet Docks leaves Opening Counter Prep banked until Continue expires it', ok: true });
  }

  const exclusions = [
    { name: 'full send', opts: { sent: 2 } },
    { name: 'empty send', opts: { sent: 0 } },
    { name: 'two-short Port send', opts: { islandIdx: 3, sent: 1 } },
    { name: 'Infirmary round', opts: { islandIdx: 6, sent: 1 } },
    { name: 'Battle Test', opts: { mode: 'battleTest', sent: 1 } },
    { name: 'after first boarding', opts: { boardingCount: 1, sent: 1 } },
    { name: 'round 3', opts: { round: 3, sent: 1 } },
    { name: 'removed sent pirate', opts: { sent: 1, removeFirstSent: true } },
  ];
  exclusions.forEach(({ name, opts }) => {
    const G = setupSending(opts);
    updateOpeningCounterPlanForSim(scene, G);
    assertOpeningCounterPlanCheck(G.openingCounterPlan === false, `${name} granted Opening Counter Prep`);
    results.push({ name: `${name} does not grant Opening Counter Prep`, ok: true });
  });

  return { ok: true, checks: results };
}

function runOpeningRouteCounterShopChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  const samples = 24;
  const starters = new Set(['lumberjack', 'miner', 'armsman']);
  const openingCounters = ['poisoner', 'sawbones', 'needler'];
  const fillerTypes = ['drummer', 'herald', 'trainer', 'survivalist'];
  const economyTypes = ['herald', 'survivalist'];
  const sideOfferByPrimary = {
    poisoner: 'drummer',
    sawbones: 'trainer',
    needler: 'survivalist',
  };
  const routeCases = [
    { label: 'Forest', mainKey: 'shellback', starterType: 'lumberjack', primary: 'poisoner', sideOffer: 'drummer' },
    { label: 'Rocky', mainKey: 'powderBomber', starterType: 'miner', primary: 'sawbones', sideOffer: 'trainer' },
    { label: 'Port', mainKey: 'deckSniper', starterType: 'armsman', primary: 'needler', sideOffer: 'survivalist' },
  ];

  const assertBasicShop = (shop, label) => {
    assertOpeningRouteCounterShopCheck(shop.length === 4, `${label} shop length ${shop.length}`);
    assertOpeningRouteCounterShopCheck(new Set(shop).size === shop.length, `${label} duplicate shop ${shop.join(',')}`);
    assertOpeningRouteCounterShopCheck(shop.every(type => api.TYPES[type] && !starters.has(type)), `${label} shop has starter or unknown ${shop.join(',')}`);
  };

  const assertRouteFocusedShop = (shop, label, primary) => {
    assertBasicShop(shop, label);
    const sideOffer = sideOfferByPrimary[primary];
    const openingVisible = shop.filter(type => openingCounters.includes(type));
    assertOpeningRouteCounterShopCheck(
      openingVisible.length === 1 && openingVisible[0] === primary,
      `${label} route focus expected only ${primary}, got ${shop.join(',')}`
    );
    assertOpeningRouteCounterShopCheck(
      !sideOffer || shop.includes(sideOffer),
      `${label} route side offer ${sideOffer} missing from ${shop.join(',')}`
    );
    const fillers = shop.filter(type => type !== primary);
    assertOpeningRouteCounterShopCheck(
      fillers.length === 3 && fillers.every(type => fillerTypes.includes(type) && api.TYPES[type].cost <= 3),
      `${label} route fillers are not distinct affordable starters: ${shop.join(',')}`
    );
  };

  const assertPostPrimaryShop = (shop, label) => {
    assertBasicShop(shop, label);
    const openingVisible = shop.filter(type => openingCounters.includes(type));
    assertOpeningRouteCounterShopCheck(
      openingVisible.length === 0,
      `${label} should suppress opening counters after primary purchase, got ${shop.join(',')}`
    );
    assertOpeningRouteCounterShopCheck(
      shop.every(type => fillerTypes.includes(type) && api.TYPES[type].cost <= 3),
      `${label} post-primary shop did not use affordable starter fillers: ${shop.join(',')}`
    );
  };

  const routeFirstIsland = (map, mainKey) => {
    const firstShipLayer = map.layers.findIndex(layer => layer && layer.length === 1 && layer[0].type === 'ship');
    const routeCache = map.layers[firstShipLayer - 1].find(node => node && node.scoutedCache && node.scoutedCache.mainKey === mainKey);
    const firstIsland = routeCache && map.layers[0].includes(routeCache)
      ? routeCache
      : map.layers[0].find(node => node && Array.isArray(node.conns) && routeCache && node.conns.includes(routeCache.id));
    return { firstShipLayer, routeCache, firstIsland };
  };

  const continueRefreshShopForTest = (G) => {
    G.shop.shift();
    G.shop.push(api.randomShopType(G.round + 1, G.shop, { map: G.map, mode: G.mode }));
    if (typeof api.normalizeOpeningRouteShop === 'function') {
      G.shop = api.normalizeOpeningRouteShop(G.shop, G.round + 1, {
        map: G.map,
        mode: G.mode,
        boardingCount: G.boardingCount,
        newSlotIndex: G.shop.length - 1,
      });
    }
  };

  for (let sample = 0; sample < samples; sample++) {
    runtime.setSeed((0x51e11bac + sample * 3571) >>> 0);
    api.initState();
    const G = api.getG();
    const shop = Array.isArray(G.shop) ? G.shop : [];
    const map = G.map;
    const firstShipLayer = map && Array.isArray(map.layers)
      ? map.layers.findIndex(layer => layer && layer.length === 1 && layer[0].type === 'ship')
      : -1;
    const firstShip = firstShipLayer >= 0 ? map.layers[firstShipLayer][0] : null;

    assertOpeningRouteCounterShopCheck(firstShip && firstShip.encounter, `sample ${sample} first ship is missing`);
    assertBasicShop(shop, `sample ${sample} pre-route`);
    openingCounters.forEach((type) => {
      assertOpeningRouteCounterShopCheck(shop.includes(type), `sample ${sample} opening shop lacks ${type}: ${shop.join(',')}`);
    });
    assertOpeningRouteCounterShopCheck(
      shop.filter(type => economyTypes.includes(type)).length === 1,
      `sample ${sample} opening shop lacks exactly one economy slot: ${shop.join(',')}`
    );
  }
  results.push({ name: 'pre-route regular opening shops still stage Poisoner, Sawbones, Needler, and one economy pirate', ok: true, samples });

  const getRandom = runtime.context.Phaser.Utils.Array.GetRandom;
  runtime.context.Phaser.Utils.Array.GetRandom = (arr) => (arr && arr.length ? arr[arr.length - 1] : undefined);
  try {
    const shellbackBattleShop = api.initialShop(4, 0, { map: makeScoutedCounterTestMap('shellback'), mode: 'battleTest' });
    assertOpeningRouteCounterShopCheck(shellbackBattleShop.includes('drummer'), `Battle Test starter shop was forced off Drummer: ${shellbackBattleShop.join(',')}`);
    assertOpeningRouteCounterShopCheck(!shellbackBattleShop.includes('poisoner'), `Battle Test starter shop unexpectedly forced Poisoner: ${shellbackBattleShop.join(',')}`);

    const powderShop = api.initialShop(4, 0, { map: makeScoutedCounterTestMap('powderBomber'), mode: 'run' });
    assertRouteFocusedShop(powderShop, 'Powder Bomber route initialShop', 'sawbones');
    results.push({ name: 'Battle Test keeps old lane sampling while route-known regular initial shops focus one counter', ok: true, shellbackBattleShop, powderShop });
  } finally {
    runtime.context.Phaser.Utils.Array.GetRandom = getRandom;
  }

  {
    const unchanged = api.normalizeOpeningRouteShop(
      ['poisoner', 'sawbones', 'needler', 'herald'],
      2,
      { map: makeScoutedCounterTestMap('shellback'), mode: 'run', boardingCount: 1 }
    );
    openingCounters.forEach((type) => {
      assertOpeningRouteCounterShopCheck(unchanged.includes(type), `post-Boarding-1 normalize removed ${type}: ${unchanged.join(',')}`);
    });
    const laterScouted = api.applyScoutedCounterToShop(
      ['herald', 'trainer', 'survivalist', 'drummer'],
      2,
      { map: makeScoutedCounterTestMap('shellback'), mode: 'run', boardingCount: 1, newSlotIndex: 3 }
    );
    assertOpeningRouteCounterShopCheck(
      laterScouted.some(type => ['poisoner', 'needler', 'plagueCaptain'].includes(type)),
      `post-Boarding-1 scouted counter shop no longer injected a Shellback counter: ${laterScouted.join(',')}`
    );
    results.push({ name: 'post-Boarding-1 shops skip route focus and keep existing scouted counter injection', ok: true, unchanged, laterScouted });
  }

  routeCases.forEach(({ label, mainKey, primary }, routeIndex) => {
    runtime.setSeed((0x704501b0 + routeIndex) >>> 0);
    api.initState();
    const G = api.getG();
    const map = G.map;
    const { firstShipLayer, routeCache, firstIsland } = routeFirstIsland(map, mainKey);
    assertOpeningRouteCounterShopCheck(routeCache, `missing ${label} ${mainKey} cache`);
    assertOpeningRouteCounterShopCheck(firstIsland && firstIsland.type === 'island', `missing ${label} first island setup`);
    assertOpeningRouteCounterShopCheck(scene.applyMapNodeSelection(firstIsland.id), `${label} first island selection failed`);
    assertOpeningRouteCounterShopCheck(G.phase === 'sending' && G.round === 1 && G.map.currentLayer === 0, `${label} first round setup phase=${G.phase} round=${G.round} layer=${G.map.currentLayer}`);
    assertOpeningRouteCounterShopCheck(map.layers[firstShipLayer][0].encounter.mainKey === mainKey, `${label} route did not scout ${mainKey}`);
    assertRouteFocusedShop(G.shop, `${label} route-selected shop`, primary);

    G.sent = Array.from({ length: scene.maxSend() }, (_, index) => index);
    updateFullCrewDiscountForSim(scene, G);
    applyShipWagesForSim(scene, G);
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    if (typeof api.normalizeOpeningRouteShop === 'function') {
      G.shop = api.normalizeOpeningRouteShop(G.shop, G.round, { map: G.map, mode: G.mode, boardingCount: G.boardingCount });
    }
    assertRouteFocusedShop(G.shop, `${label} shop entry`, primary);
    assertOpeningRouteCounterShopCheck(G.enthusiasm === 1, `${label} full send wages left ${G.enthusiasm} enthusiasm`);
    assertOpeningRouteCounterShopCheck(G.fullCrewDiscount === 1, `${label} full send discount ${G.fullCrewDiscount}`);
    assertOpeningRouteCounterShopCheck(G.boardingAlert === 0, `${label} full send added Alert ${G.boardingAlert}`);

    const index = G.shop.indexOf(primary);
    const routeQuote = scene.shopPurchaseQuote(primary);
    const routeDirectQuote = shopPurchaseQuote(api, G, primary);
    const expectedCoverage = primary === 'poisoner' ? 0 : 1;
    const expectedEffective = Math.max(0, api.TYPES[primary].cost - 1);
    const expectedMissing = Math.max(0, expectedEffective - 1);
    assertOpeningRouteCounterShopCheck(index >= 0, `${label} ${primary} not found in shop for buy`);
    assertOpeningRouteCounterShopCheck(routeQuote.canBuy && !routeQuote.credit, `${label} ${primary} quote was not covered without credit: ${JSON.stringify(routeQuote)}`);
    assertOpeningRouteCounterShopCheck(routeQuote.counter && routeQuote.topDeck && !routeQuote.preparedCounter, `${label} ${primary} should be a watched top-deck counter without preparation: ${JSON.stringify(routeQuote)}`);
    assertOpeningRouteCounterShopCheck(!routeQuote.openingCounterPrepMight, `${label} Full Crew ${primary} should not consume Opening Counter Prep: ${JSON.stringify(routeQuote)}`);
    assertOpeningRouteCounterShopCheck(routeQuote.counterPayoff && routeQuote.counterPayoff.bountyCount === 1, `${label} Full Crew ${primary} previewed doubled bounty: ${JSON.stringify(routeQuote.counterPayoff)}`);
    assertOpeningRouteCounterShopCheck(routeQuote.discount === 1 && routeQuote.effectiveCost === expectedEffective && routeQuote.spend === 1 && routeQuote.missing === expectedMissing, `${label} ${primary} economics mismatch: ${JSON.stringify(routeQuote)}`);
    assertOpeningRouteCounterShopCheck(routeQuote.fullCrewCoverage === expectedCoverage && !routeQuote.credit && routeQuote.alert === 0, `${label} ${primary} coverage mismatch: ${JSON.stringify(routeQuote)}`);
    assertOpeningRouteCounterShopCheck(routeDirectQuote.canBuy && !routeDirectQuote.credit && routeDirectQuote.fullCrewCoverage === expectedCoverage && !routeDirectQuote.preparedCounter, `${label} sim policy quote mismatch: ${JSON.stringify(routeDirectQuote)}`);

    const covered = scene.buyPirate(index, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningRouteCounterShopCheck(covered && covered.type === primary, `${label} ${primary} buy failed`);
    assertOpeningRouteCounterShopCheck(G.enthusiasm === 0, `${label} covered buy left enthusiasm ${G.enthusiasm}`);
    assertOpeningRouteCounterShopCheck(G.boardingAlert === 0, `${label} covered buy added Alert ${G.boardingAlert}`);
    assertOpeningRouteCounterShopCheck(G.shopCreditUsed === false, `${label} covered buy used Dockside Credit`);
    assertOpeningRouteCounterShopCheck(G.fullCrewDiscount === 0, `${label} covered buy did not consume Full Crew Discount`);
    assertOpeningRouteCounterShopCheck(G.deck[G.deck.length - 1] === covered, `${label} covered counter did not go to top of deck`);
    assertOpeningRouteCounterShopCheck((G.counterWatchIds || []).includes(covered.id), `${label} covered counter did not gain Counter Watch`);
    assertOpeningRouteCounterShopCheck(!covered.weaponKey && (covered.might || 0) === 0 && (covered.tempo || 0) === 0, `${label} pre-boarding covered counter gained upgrades: ${JSON.stringify(covered)}`);
    assertOpeningRouteCounterShopCheck(!G.discard.includes(covered), `${label} covered counter also went to discard`);
    assertOpeningRouteCounterShopCheck(G.openingRouteCounterBoughtMainKey === mainKey, `${label} primary buy did not mark route counter as bought`);
    assertPostPrimaryShop(G.shop, `${label} purchase refill`);

    continueRefreshShopForTest(G);
    assertPostPrimaryShop(G.shop, `${label} Continue refill`);
    results.push({ name: `round-1 full-send ${label} route buys watched ${primary}, then broadens pre-Boarding shop`, ok: true, quote: routeQuote });
  });

  const sidePrepExpectedGain = (type) => {
    if (type === 'drummer') return { might: 0, tempo: 1 };
    if (type === 'trainer' || type === 'survivalist') return { might: 1, tempo: 0 };
    return { might: 0, tempo: 0 };
  };

  routeCases.forEach(({ label, mainKey, starterType, primary, sideOffer }, routeIndex) => {
    runtime.setSeed((0x704501f0 + routeIndex) >>> 0);
    api.initState();
    const G = api.getG();
    const { firstIsland } = routeFirstIsland(G.map, mainKey);
    assertOpeningRouteCounterShopCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), `${label} side-prep route selection failed`);
    const musteredStarter = G.openingRouteMuster
      ? (G.allCrew || []).find(pirate => pirate && pirate.id === G.openingRouteMuster.pirateId)
      : null;
    assertOpeningRouteCounterShopCheck(musteredStarter && musteredStarter.type === starterType, `${label} did not muster ${starterType} for side prep`);
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = true;
    G.openingRouteCacheClaimedMainKey = mainKey;
    G.cacheDrillBountyMarks = [{ pirateId: 999900 + routeIndex, mainKey, boardingNo: 1 }];
    G.enthusiasm = api.TYPES[sideOffer].cost;
    G.shop = api.normalizeOpeningRouteShop(
      [primary, ...openingCounters.filter(type => type !== primary), 'herald'],
      G.round,
      { map: G.map, mode: G.mode, boardingCount: G.boardingCount }
    );
    assertRouteFocusedShop(G.shop, `${label} side-prep setup`, primary);
    const sideIndex = G.shop.indexOf(sideOffer);
    const sideQuote = scene.shopPurchaseQuote(sideOffer);
    const directQuote = shopPurchaseQuote(api, G, sideOffer);
    const expectedGain = sidePrepExpectedGain(sideOffer);
    assertOpeningRouteCounterShopCheck(sideIndex >= 0, `${label} side offer ${sideOffer} missing from ${G.shop.join(',')}`);
    assertOpeningRouteCounterShopCheck(
      sideQuote.canBuy
        && !sideQuote.counter
        && sideQuote.topDeck
        && sideQuote.openingSidePrep
        && sideQuote.openingSidekickBountyRes === api.SCOUTED_COUNTER_CACHE_RES[mainKey]
        && !sideQuote.openingCounterPrepMight
        && sideQuote.consumesOpeningCounterPlan
        && sideQuote.openingCounterPrepDiscount === 1
        && !sideQuote.alarmRushedRouteCounter
        && !sideQuote.counterPayoff,
      `${label} side offer quote missed Opening Side Prep or gained counter perks: ${JSON.stringify(sideQuote)}`
    );
    assertOpeningRouteCounterShopCheck(
      sideQuote.openingSidePrepTargetsMuster
        && sideQuote.openingSidePrepTargetPirateId === musteredStarter.id
        && sideQuote.openingSidePrepTargetType === starterType
        && sideQuote.openingSidePrepTargetName === api.TYPES[starterType].name,
      `${label} side offer quote did not target mustered starter: ${JSON.stringify(sideQuote)}`
    );
    assertOpeningRouteCounterShopCheck(
      directQuote.canBuy
        && directQuote.openingSidePrep
        && directQuote.topDeck
        && !directQuote.counter
        && directQuote.openingSidePrepTargetsMuster
        && directQuote.openingSidePrepTargetType === starterType
        && directQuote.openingSidekickBountyRes === api.SCOUTED_COUNTER_CACHE_RES[mainKey],
      `${label} sim helper missed Opening Side Prep: ${JSON.stringify(directQuote)}`
    );
    const supportText = openingSidePrepSupportTextForQuote(api, sideQuote);
    const sidekickBountyText = openingSidekickBountyTextForQuote(api, sideQuote);
    assertOpeningRouteCounterShopCheck(
      supportText.includes(api.TYPES[starterType].name) && supportText.includes(expectedGain.might ? '💪' : '⚡'),
      `${label} side prep support text missed target/gain: ${supportText}`
    );
    assertOpeningRouteCounterShopCheck(
      sidekickBountyText.includes(api.RES_EMOJI[api.SCOUTED_COUNTER_CACHE_RES[mainKey]]),
      `${label} side prep bounty text missed resource: ${sidekickBountyText}`
    );
    const marksBefore = JSON.stringify(G.cacheDrillBountyMarks || []);
    const expectedEnthusiasm = api.TYPES[sideOffer].cost - sideQuote.spend;
    const bought = scene.buyPirate(sideIndex, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningRouteCounterShopCheck(bought && bought.type === sideOffer, `${label} side offer first buy failed`);
    assertOpeningRouteCounterShopCheck(G.deck[G.deck.length - 1] === bought && !G.discard.includes(bought), `${label} side prep did not top-deck only`);
    assertOpeningRouteCounterShopCheck(!(G.counterWatchIds || []).includes(bought.id), `${label} side offer gained Counter Watch`);
    assertOpeningRouteCounterShopCheck((bought.might || 0) === 0 && (bought.tempo || 0) === 0 && !bought.weaponKey, `${label} side prep upgraded bought side offer instead of starter: ${JSON.stringify(bought)}`);
    assertOpeningRouteCounterShopCheck((musteredStarter.might || 0) === expectedGain.might && (musteredStarter.tempo || 0) === expectedGain.tempo && !musteredStarter.weaponKey, `${label} side prep upgrades wrong starter: ${JSON.stringify(musteredStarter)}`);
    assertOpeningRouteCounterShopCheck(G.openingCounterPlan === false, `${label} side prep did not consume Opening Counter Prep`);
    assertOpeningRouteCounterShopCheck(G.enthusiasm === expectedEnthusiasm, `${label} side prep spend ${G.enthusiasm} !== ${expectedEnthusiasm}`);
    assertOpeningRouteCounterShopCheck(!G.openingRouteCounterBoughtMainKey && G.openingRouteCounterBoughtPirateId == null, `${label} side offer marked route primary as bought`);
    assertOpeningRouteCounterShopCheck(G.openingRouteSidekick && G.openingRouteSidekick.pirateId === bought.id && G.openingRouteSidekick.mainKey === mainKey && G.openingRouteSidekick.type === sideOffer, `${label} side prep did not mark exact Route Sidekick: ${JSON.stringify(G.openingRouteSidekick)}`);
    assertOpeningRouteCounterShopCheck(JSON.stringify(G.cacheDrillBountyMarks || []) === marksBefore, `${label} side offer moved Cache Drill bounty marks`);
    assertRouteFocusedShop(G.shop, `${label} after side-prep buy`, primary);
    results.push({ name: `${label} route side offer spends Opening Side Prep to support the mustered starter and leaves primary unsecured`, ok: true, bought: sideOffer, quote: sideQuote, supportText });
  });

  {
    const route = routeCases[1];
    runtime.setSeed(0x70450208);
    api.initState();
    const G = api.getG();
    const { firstIsland } = routeFirstIsland(G.map, route.mainKey);
    assertOpeningRouteCounterShopCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), 'fallback side-prep route selection failed');
    const musteredStarter = G.openingRouteMuster
      ? (G.allCrew || []).find(pirate => pirate && pirate.id === G.openingRouteMuster.pirateId)
      : null;
    assertOpeningRouteCounterShopCheck(musteredStarter, 'fallback side-prep did not create a starter marker');
    removePirateById(G, musteredStarter.id);
    G.hand = (G.hand || []).filter(pirate => pirate && pirate.id !== musteredStarter.id);
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = true;
    G.enthusiasm = api.TYPES[route.sideOffer].cost;
    G.shop = [route.primary, route.sideOffer, 'herald', 'survivalist'];
    const quote = scene.shopPurchaseQuote(route.sideOffer);
    assertOpeningRouteCounterShopCheck(
      quote.canBuy
        && quote.openingSidePrep
        && quote.topDeck
        && !quote.counter
        && !quote.openingSidePrepTargetsMuster
        && quote.openingSidePrepTargetType === route.sideOffer,
      `fallback side prep quote did not fall back to side offer: ${JSON.stringify(quote)}`
    );
    const bought = scene.buyPirate(1, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    const expectedGain = sidePrepExpectedGain(route.sideOffer);
    assertOpeningRouteCounterShopCheck(bought && bought.type === route.sideOffer, 'fallback side prep buy failed');
    assertOpeningRouteCounterShopCheck(G.deck[G.deck.length - 1] === bought && !G.discard.includes(bought), 'fallback side prep did not top-deck bought side offer');
    assertOpeningRouteCounterShopCheck((bought.might || 0) === expectedGain.might && (bought.tempo || 0) === expectedGain.tempo && !bought.weaponKey, `fallback side prep did not upgrade bought side offer: ${JSON.stringify(bought)}`);
    assertOpeningRouteCounterShopCheck(!(G.counterWatchIds || []).includes(bought.id), 'fallback side prep side offer gained Counter Watch');
    assertOpeningRouteCounterShopCheck(G.openingRouteSidekick && G.openingRouteSidekick.pirateId === bought.id && G.openingRouteSidekick.mainKey === route.mainKey && G.openingRouteSidekick.type === route.sideOffer, `fallback side prep did not mark exact Route Sidekick: ${JSON.stringify(G.openingRouteSidekick)}`);
    results.push({ name: 'Opening Side Prep falls back to the bought side offer when the mustered starter is gone', ok: true, quote });
  }

  {
    const route = routeCases[1];
    runtime.setSeed(0x7045020c);
    api.initState();
    const G = api.getG();
    const { firstIsland } = routeFirstIsland(G.map, route.mainKey);
    assertOpeningRouteCounterShopCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), 'side-prep plan route selection failed');
    const musteredStarter = G.openingRouteMuster
      ? (G.allCrew || []).find(pirate => pirate && pirate.id === G.openingRouteMuster.pirateId)
      : null;
    assertOpeningRouteCounterShopCheck(musteredStarter && musteredStarter.type === route.starterType, 'side-prep plan did not muster route starter');
    G.shop = [route.sideOffer];
    G.enthusiasm = 0;
    G.boardingAlert = 0;
    const planLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(1));
    assertOpeningRouteCounterShopCheck(
      planLine.includes(`Support ${api.TYPES[route.starterType].name} +💪`)
        && planLine.includes('Side Prep -1☠️')
        && planLine.includes(`Sidekick win +${api.RES_EMOJI[api.SCOUTED_COUNTER_CACHE_RES[route.mainKey]]}`),
      `side-prep sending plan did not expose target support and bounty: ${planLine}`
    );
    results.push({ name: 'sending plan exposes the Opening Side Prep support target and sidekick bounty by name', ok: true, planLine });
  }

  {
    const route = routeCases[0];
    runtime.setSeed(0x70450210);
    api.initState();
    const G = api.getG();
    const { firstIsland } = routeFirstIsland(G.map, route.mainKey);
    assertOpeningRouteCounterShopCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), 'non-side-offer negative route selection failed');
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = true;
    G.enthusiasm = 10;
    G.shop = [route.primary, route.sideOffer, 'herald', 'trainer'];
    const quote = scene.shopPurchaseQuote('herald');
    assertOpeningRouteCounterShopCheck(
      quote.canBuy && !quote.counter && !quote.topDeck && !quote.openingSidePrep && !quote.consumesOpeningCounterPlan,
      `non-side-offer non-counter used Opening Side Prep: ${JSON.stringify(quote)}`
    );
    const bought = scene.buyPirate(G.shop.indexOf('herald'), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningRouteCounterShopCheck(bought && bought.type === 'herald', 'non-side-offer Herald buy failed');
    assertOpeningRouteCounterShopCheck(G.discard.includes(bought) && !G.deck.includes(bought), 'non-side-offer did not discard normally');
    assertOpeningRouteCounterShopCheck(G.openingCounterPlan === true, 'non-side-offer consumed Opening Counter Prep');
    assertOpeningRouteCounterShopCheck(!G.openingRouteSidekick, `non-side-offer marked Route Sidekick: ${JSON.stringify(G.openingRouteSidekick)}`);
    results.push({ name: 'non-side-offer non-counters cannot use Opening Side Prep', ok: true, quote });
  }

  [
    { name: 'Battle Test', setup: (G, route) => { G.mode = 'battleTest'; G.boardingCount = 0; G.openingRouteCounterBoughtMainKey = null; } },
    { name: 'post-Boarding-1', setup: (G, route) => { G.boardingCount = 1; G.openingRouteCounterBoughtMainKey = null; } },
    { name: 'secured route primary', setup: (G, route) => { G.boardingCount = 0; G.openingRouteCounterBoughtMainKey = route.mainKey; } },
  ].forEach((negative, negIndex) => {
    const route = routeCases[negIndex];
    runtime.setSeed((0x70450220 + negIndex) >>> 0);
    api.initState();
    const G = api.getG();
    const { firstIsland } = routeFirstIsland(G.map, route.mainKey);
    assertOpeningRouteCounterShopCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), `${negative.name} side-prep negative route selection failed`);
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = true;
    G.enthusiasm = 10;
    negative.setup(G, route);
    G.shop = [route.sideOffer, route.primary, 'herald', 'trainer'];
    const quote = scene.shopPurchaseQuote(route.sideOffer);
    assertOpeningRouteCounterShopCheck(
      quote.canBuy && !quote.openingSidePrep && !quote.topDeck && !quote.consumesOpeningCounterPlan,
      `${negative.name} side offer used Opening Side Prep: ${JSON.stringify(quote)}`
    );
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningRouteCounterShopCheck(bought && bought.type === route.sideOffer, `${negative.name} side offer buy failed`);
    assertOpeningRouteCounterShopCheck(G.discard.includes(bought) && !G.deck.includes(bought), `${negative.name} side offer did not discard normally`);
    assertOpeningRouteCounterShopCheck(G.openingCounterPlan === true, `${negative.name} side offer consumed Opening Counter Prep`);
    assertOpeningRouteCounterShopCheck(!G.openingRouteSidekick, `${negative.name} side offer marked Route Sidekick: ${JSON.stringify(G.openingRouteSidekick)}`);
    results.push({ name: `${negative.name} side offers cannot use Opening Side Prep`, ok: true, quote });
  });

  routeCases.forEach(({ label, mainKey, primary }, routeIndex) => {
    runtime.setSeed((0x70450240 + routeIndex) >>> 0);
    api.initState();
    const G = api.getG();
    const { firstIsland } = routeFirstIsland(G.map, mainKey);
    assertOpeningRouteCounterShopCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), `${label} discard-primary route selection failed`);
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = false;
    G.enthusiasm = api.TYPES[primary].cost;
    G.shop = api.normalizeOpeningRouteShop(
      [primary, ...openingCounters.filter(type => type !== primary), 'herald'],
      G.round,
      { map: G.map, mode: G.mode, boardingCount: G.boardingCount }
    );
    assertRouteFocusedShop(G.shop, `${label} discard-primary setup`, primary);
    const quote = scene.shopPurchaseQuote(primary);
    assertOpeningRouteCounterShopCheck(quote.canBuy && quote.counter && !quote.topDeck && !quote.credit, `${label} discard-primary quote mismatch: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(G.shop.indexOf(primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningRouteCounterShopCheck(bought && bought.type === primary, `${label} discard-primary buy failed`);
    assertOpeningRouteCounterShopCheck(G.discard.includes(bought) && !G.deck.includes(bought), `${label} discard-primary did not go to discard`);
    assertOpeningRouteCounterShopCheck(!G.openingRouteCounterBoughtMainKey && G.openingRouteCounterBoughtPirateId == null, `${label} discard-primary secured route marker`);
    assertRouteFocusedShop(G.shop, `${label} after discard-primary buy`, primary);
    continueRefreshShopForTest(G);
    assertRouteFocusedShop(G.shop, `${label} Continue after discard-primary buy`, primary);
    results.push({ name: `${label} discard-only route-primary buys keep exactly one guaranteed primary counter in refills`, ok: true, quote });
  });

  routeCases.forEach(({ label, mainKey, primary }, routeIndex) => {
    runtime.setSeed((0x704502a0 + routeIndex) >>> 0);
    api.initState();
    const G = api.getG();
    const map = G.map;
    const { firstIsland } = routeFirstIsland(map, mainKey);
    assertOpeningRouteCounterShopCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), `${label} prep route selection failed`);
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = true;
    G.enthusiasm = api.TYPES[primary].cost;
    G.shop = api.normalizeOpeningRouteShop(
      [primary, ...openingCounters.filter(type => type !== primary), 'herald'],
      G.round,
      { map: G.map, mode: G.mode, boardingCount: G.boardingCount }
    );
    assertRouteFocusedShop(G.shop, `${label} Opening Prep shop`, primary);
      const quote = scene.shopPurchaseQuote(primary);
      assertOpeningRouteCounterShopCheck(
        quote.canBuy && quote.counter && quote.topDeck && quote.openingCounterPrepMight && quote.consumesOpeningCounterPlan,
        `${label} Opening Counter Prep quote missed top-deck +Might: ${JSON.stringify(quote)}`
      );
      assertOpeningRouteCounterShopCheck(
        quote.cost === api.TYPES[primary].cost
          && quote.openingCounterPrepDiscount === 1
          && quote.effectiveCost === Math.max(0, quote.cost - 1)
          && quote.spend === quote.effectiveCost,
        `${label} Opening Prep ${primary} discount mismatch: ${JSON.stringify(quote)}`
      );
      const bought = scene.buyPirate(G.shop.indexOf(primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
      assertOpeningRouteCounterShopCheck(bought && bought.type === primary, `${label} Opening Prep ${primary} buy failed`);
      assertOpeningRouteCounterShopCheck(G.enthusiasm === 1, `${label} Opening Prep ${primary} did not leave the discounted 1☠️: ${G.enthusiasm}`);
    assertOpeningRouteCounterShopCheck(G.openingCounterPlan === false, `${label} Opening Prep was not consumed`);
    assertOpeningRouteCounterShopCheck(G.openingRouteCounterBoughtMainKey === mainKey, `${label} Opening Prep primary buy did not mark route counter as bought`);
    assertOpeningRouteCounterShopCheck((bought.might || 0) === 1 && !bought.weaponKey && (bought.tempo || 0) === 0, `${label} Opening Prep ${primary} upgrades wrong: ${JSON.stringify(bought)}`);
    assertOpeningRouteCounterShopCheck(G.deck[G.deck.length - 1] === bought && (G.counterWatchIds || []).includes(bought.id), `${label} Opening Prep ${primary} missed top-deck Watch`);
    results.push({ name: `${label} primary route counter consumes Opening Counter Prep for +1 Might, top deck, and Watch`, ok: true, quote });
  });

  return { ok: true, checks: results };
}

function runOpeningCachePurseChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  const routes = [
    { label: 'Forest/Shellback', mainKey: 'shellback', primary: 'poisoner', starterType: 'lumberjack', nonmatchingType: 'miner', islandIdx: 0, cacheRes: 'wood', cacheEnthusiasm: 1, cacheAlert: 0 },
    { label: 'Rocky/Powder Bomber', mainKey: 'powderBomber', primary: 'sawbones', starterType: 'miner', nonmatchingType: 'lumberjack', islandIdx: 1, cacheRes: 'stone', cacheEnthusiasm: 2, cacheAlert: 1 },
    { label: 'Port/Deck Sniper', mainKey: 'deckSniper', primary: 'needler', starterType: 'armsman', nonmatchingType: 'miner', islandIdx: 3, cacheRes: 'gold', cacheEnthusiasm: 3, cacheAlert: 3 },
  ];

  const routeCacheMap = (route) => ({
    layers: [
      [{
        id: 1,
        type: 'island',
        islandIdx: route.islandIdx,
        conns: [2],
        scoutedCache: {
          mainKey: route.mainKey,
          res: route.cacheRes,
          amount: 1,
          enthusiasm: route.cacheEnthusiasm,
          alert: route.cacheAlert,
          claimed: false,
        },
      }],
      [{ id: 2, type: 'ship', strength: 6, openingRouteMainKey: route.mainKey, encounter: { mainKey: route.mainKey, supportKeys: ['bilgeRat', 'cabinBoy'], totalCount: 3 }, conns: [] }],
    ],
    visited: [],
    currentNodeId: null,
    currentLayer: -1,
  });

  const setupOpening = (route, opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.map = opts.map || routeCacheMap(route);
    G.map.currentNodeId = opts.currentNodeId != null ? opts.currentNodeId : 1;
    G.map.currentLayer = opts.currentLayer != null ? opts.currentLayer : 0;
    G.map.visited = Array.isArray(opts.visited) ? [...opts.visited] : [G.map.currentNodeId];
    G.round = opts.round != null ? Math.max(0, Math.floor(Number(opts.round) || 0)) : 1;
    G.boardingCount = opts.boardingCount != null
      ? Math.max(0, Math.floor(Number(opts.boardingCount) || 0))
      : 0;
    G.phase = 'sending';
    G.island = scene.buildIslandState(api.ISLANDS[route.islandIdx]);
    G.sent = [];
    G.deck = [];
    G.discard = [];
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.enthusiasm = Math.max(0, Math.floor(Number(opts.enthusiasm) || 0));
    G.boardingAlert = Math.max(0, Math.floor(Number(opts.boardingAlert) || 0));
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = false;
    G.counterWatchIds = [];
    G.cacheDrillMusterIds = [];
    G.cacheDrillBountyMarks = [];
    scene._sacrificedIds.clear();
    scene._sendingToIsland.clear();

    const count = Math.max(3, scene.maxSend());
    const pirates = G.allCrew.slice(0, count);
    pirates.forEach((pirate, index) => {
      pirate.type = index === 0
        ? (opts.firstType || route.starterType)
        : (index === 1 ? (opts.secondType || route.nonmatchingType) : 'lumberjack');
      pirate.weaponKey = null;
      pirate.might = 0;
      pirate.tempo = 0;
      pirate.wounded = false;
    });
    G.hand = pirates.slice(0, count);
    const cacheNode = G.map && G.map.layers && G.map.layers[0] && G.map.layers[0][0];
    G.island.scoutedCacheDrill = scene.armScoutedCounterCache(cacheNode);
    return { G, pirates };
  };

  api.initState();
  {
    const G = api.getG();
    assertOpeningCachePurseCheck(!Object.prototype.hasOwnProperty.call(G, 'openingDeckhandScoutPaid'), 'run state still initializes openingDeckhandScoutPaid');
    assertOpeningCachePurseCheck(typeof scene.applyOpeningDeckhandScoutPay !== 'function', 'GameScene still exposes Opening Deckhand Scout Pay');
    results.push({ name: 'Opening Deckhand Scout Pay state and resolver are removed', ok: true });
  }

  routes.forEach((route) => {
    const { G, pirates } = setupOpening(route);
    const skullBadge = `+${route.cacheEnthusiasm > 1 ? route.cacheEnthusiasm : ''}☠️`;
    const drillDesc = scene.scoutedCacheDrillDescription();
    assertOpeningCachePurseCheck(drillDesc.includes(skullBadge), `${route.label} cache description missing ${skullBadge}: ${drillDesc}`);
    G.sent.push(0);
    scene.resolveIsland(pirates[0]);
    const claim = scene.claimScoutedCounterCache(pirates[0], { silent: true });
    assertOpeningCachePurseCheck(claim && claim.cacheGrant, `${route.label} starter did not open cache`);
    assertOpeningCachePurseCheck(claim.cacheGrant.enthusiasm === route.cacheEnthusiasm, `${route.label} cache skull grant ${claim.cacheGrant.enthusiasm} !== ${route.cacheEnthusiasm}`);
    assertOpeningCachePurseCheck(G.enthusiasm === route.cacheEnthusiasm, `${route.label} skulls ${G.enthusiasm} !== cache ${route.cacheEnthusiasm}`);
    assertOpeningCachePurseCheck((pirates[0].might || 0) === 1, `${route.label} matching starter missed Cache Drill Might`);
    assertOpeningCachePurseCheck(claim.drill && claim.drill.applied, `${route.label} matching starter missed Cache Drill`);
    const repeat = scene.claimScoutedCounterCache(pirates[0], { silent: true });
    assertOpeningCachePurseCheck(!repeat && G.enthusiasm === route.cacheEnthusiasm, `${route.label} cache paid twice`);
    results.push({ name: `${route.label} opening cache pays its visible skull purse once to the first matching starter opener`, ok: true });
  });

  {
    const route = routes[1];
    runtime.setSeed(0x5cadc0de);
    api.initState();
    const G = api.getG();
    const cacheNode = G.map.layers[0].find(node =>
      node && node.scoutedCache && node.scoutedCache.mainKey === route.mainKey
    );
    assertOpeningCachePurseCheck(cacheNode, 'generated Rocky layer-0 cache route missing');
    assertOpeningCachePurseCheck(scene.applyMapNodeSelection(cacheNode.id), 'generated Rocky route selection failed');
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.enthusiasm = 0;
    G.boardingAlert = 4;
    const pirate = G.hand[0];
    pirate.type = route.starterType;
    pirate.weaponKey = null;
    pirate.might = 0;
    pirate.tempo = 0;
    pirate.wounded = false;
    G.sent = [0];
    scene.resolveIsland(pirate);
    const cacheClaim = scene.claimScoutedCounterCache(pirate, { silent: true });
    assertOpeningCachePurseCheck(cacheClaim && cacheClaim.cacheGrant && cacheClaim.drill && cacheClaim.drill.applied, 'layer-0 starter opener did not open and drill cache');
    assertOpeningCachePurseCheck(G.enthusiasm === route.cacheEnthusiasm, `Rocky cache skulls ${G.enthusiasm} !== ${route.cacheEnthusiasm}`);
    assertOpeningCachePurseCheck(G.boardingAlert === 4, `Rocky cache Alert was not refunded to floor 4, got ${G.boardingAlert}`);
    assertOpeningCachePurseCheck(G.res.stone === 3, `Rocky island plus cache stone ${G.res.stone} !== 3`);
    assertOpeningCachePurseCheck((pirate.might || 0) === 1, `Cache Drill starter Might ${pirate.might || 0} !== 1`);
    assertOpeningCachePurseCheck(G.openingCounterPlan === true && cacheClaim.drill.openingCounterPrep, 'Route Starter Cache Prep was not armed by same-round cache drill');
    results.push({ name: 'generated layer-0 opening cache grants the visible purse and Cache Drill without hidden scout pay', ok: true });
  }

  routes.forEach((route) => {
    const { G, pirates } = setupOpening(route);
    const maxSend = scene.maxSend();
    for (let handIdx = 0; handIdx < maxSend; handIdx++) {
      const pirate = pirates[handIdx];
      G.sent.push(handIdx);
      scene.resolveIsland(pirate);
      scene.claimScoutedCounterCache(pirate, { silent: true });
    }
    updateFullCrewDiscountForSim(scene, G);
    updateOpeningCounterPlanForSim(scene, G);
    applyShipWagesForSim(scene, G);
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.busy = false;
    G.shopAnimating = false;
    G.shop = [route.primary, 'drummer', 'herald', 'trainer'];
    const quote = scene.shopPurchaseQuote(route.primary);
    const expectedSkulls = route.cacheEnthusiasm + 1;
    assertOpeningCachePurseCheck(G.enthusiasm === expectedSkulls, `${route.label} full send shop skulls ${G.enthusiasm} !== cache purse plus wages ${expectedSkulls}`);
    assertOpeningCachePurseCheck(G.fullCrewDiscount === 1, `${route.label} full send did not keep Full Crew Discount`);
    assertOpeningCachePurseCheck(G.boardingAlert === Math.max(0, route.cacheAlert - 1), `${route.label} full send cache path Alert ${G.boardingAlert} !== ${Math.max(0, route.cacheAlert - 1)}`);
    assertOpeningCachePurseCheck(quote.canBuy && !quote.credit && quote.discount === 1 && quote.topDeck, `${route.label} primary quote not buyable/top-decked without credit: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningCachePurseCheck(bought && bought.type === route.primary, `${route.label} primary buy failed`);
    assertOpeningCachePurseCheck(G.deck[G.deck.length - 1] === bought && !G.discard.includes(bought), `${route.label} primary did not top-deck`);
    assertOpeningCachePurseCheck((G.counterWatchIds || []).includes(bought.id), `${route.label} primary did not gain Counter Watch`);
    results.push({ name: `${route.label} full-send cache purse funds a first-shop top-deck route counter buy`, ok: true });
  });

  {
    const route = routes[1];
    const { G, pirates } = setupOpening(route, { firstType: route.nonmatchingType });
    G.sent.push(0);
    scene.resolveIsland(pirates[0]);
    const claim = scene.claimScoutedCounterCache(pirates[0], { silent: true });
    assertOpeningCachePurseCheck(claim && claim.cacheGrant && !claim.drill, 'nonmatching first opener did not receive normal cache purse without Cache Drill');
    assertOpeningCachePurseCheck(G.enthusiasm === route.cacheEnthusiasm, `nonmatching first opener skulls ${G.enthusiasm} !== cache ${route.cacheEnthusiasm}`);
    assertOpeningCachePurseCheck(claim.openingCounterPrep && G.openingCounterPlan === true, 'nonmatching first opener did not arm cache-granted Opening Counter Prep');
    G.phase = 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.shopCreditUsed = false;
    G.enthusiasm = api.TYPES[route.primary].cost;
    const sideOffer = route.label === 'Rocky/Powder Bomber' ? 'trainer' : 'drummer';
    G.shop = [route.primary, sideOffer, 'herald', 'survivalist'];
    const quote = scene.shopPurchaseQuote(route.primary);
    assertOpeningCachePurseCheck(quote.canBuy && quote.topDeck && quote.openingCounterPrepMight && quote.openingCounterPrepDiscount === 1, `nonmatching cache opener did not expose primary Opening Prep: ${JSON.stringify(quote)}`);
    const sideQuote = scene.shopPurchaseQuote(sideOffer);
    assertOpeningCachePurseCheck(sideQuote.canBuy && sideQuote.openingSidePrep && sideQuote.topDeck && !sideQuote.counter, `nonmatching cache opener did not expose side Opening Prep: ${JSON.stringify(sideQuote)}`);
    const side = scene.buyPirate(1, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningCachePurseCheck(side && side.type === sideOffer && G.deck[G.deck.length - 1] === side, 'cache-granted side prep did not top-deck side offer');
    assertOpeningCachePurseCheck((side.might || 0) + (side.tempo || 0) === 1 && !(G.counterWatchIds || []).includes(side.id), `cache-granted side prep applied wrong support state: ${JSON.stringify(side)}`);
    assertOpeningCachePurseCheck((G.cacheDrillBountyMarks || []).length === 0, 'nonmatching cache side prep created Cache Drill bounty marks');
    results.push({ name: 'nonmatching first opener receives the cache purse and arms primary or side Opening Prep without Cache Drill', ok: true, quote, sideQuote });
  }

  {
    const route = routes[1];
    const { G, pirates } = setupOpening(route, {
      firstType: route.nonmatchingType,
      secondType: route.starterType,
      map: routeCacheMap(route),
      boardingAlert: 5,
    });
    G.island.scoutedCacheDrill = scene.armScoutedCounterCache(G.map.layers[0][0]);
    G.sent.push(0);
    scene.resolveIsland(pirates[0]);
    const firstClaim = scene.claimScoutedCounterCache(pirates[0], { silent: true });
    assertOpeningCachePurseCheck(firstClaim && firstClaim.cacheGrant && !firstClaim.drill, 'nonmatching first opener did not consume cache without Cache Drill');
    assertOpeningCachePurseCheck(G.boardingAlert === 5 + route.cacheAlert, `nonmatching opener unexpectedly refunded cache Alert to ${G.boardingAlert}`);
    const beforeSecondStarter = G.enthusiasm;
    const prepAfterFirst = G.openingCounterPlan;
    G.sent.push(1);
    scene.resolveIsland(pirates[1]);
    const secondClaim = scene.claimScoutedCounterCache(pirates[1], { silent: true });
    assertOpeningCachePurseCheck(G.enthusiasm === beforeSecondStarter, `second-slot starter created hidden skulls ${G.enthusiasm} !== ${beforeSecondStarter}`);
    assertOpeningCachePurseCheck(!secondClaim, 'second-slot starter reopened or drilled an already claimed cache');
    assertOpeningCachePurseCheck((pirates[1].might || 0) === 0 && !pirates[1].weaponKey && (pirates[1].tempo || 0) === 0, 'second-slot starter gained hidden personal rewards');
    assertOpeningCachePurseCheck(prepAfterFirst && G.openingCounterPlan === true, 'second-slot starter changed the first opener cache prep flag');
    assertOpeningCachePurseCheck((G.cacheDrillMusterIds || []).length === 0, 'second-slot starter created Cache Drill early report');
    assertOpeningCachePurseCheck((G.cacheDrillBountyMarks || []).length === 0, 'second-slot starter created Cache Drill bounty mark');
    assertOpeningCachePurseCheck(G.boardingAlert === 5 + route.cacheAlert, `second-slot starter changed Alert ${G.boardingAlert}`);
    results.push({ name: 'matching starter sent second creates no hidden reward after another pirate opens the cache', ok: true });
  }

  {
    const route = routes[0];
    const { G, pirates } = setupOpening(route);
    assertOpeningCachePurseCheck(G.sent.length === 0 && G.island.scoutedCacheDrill && G.island.scoutedCacheDrill.cachePending, 'zero-send setup did not start with pending cache');
    const wagePreview = scene.shipWagePreview();
    applyShipWagesForSim(scene, G);
    assertOpeningCachePurseCheck(G.enthusiasm === wagePreview.wages, `zero-send opening received cache skulls ${G.enthusiasm} !== wages ${wagePreview.wages}`);
    assertOpeningCachePurseCheck(G.island.scoutedCacheDrill.cachePending && !G.island.scoutedCacheDrill.cacheClaimed, 'zero-send opening claimed cache');
    assertOpeningCachePurseCheck(G.openingCounterPlan === false, 'zero-send opening armed Opening Prep');
    assertOpeningCachePurseCheck(pirates[0] && G.allCrew.includes(pirates[0]), 'zero-send setup removed a starter');
    results.push({ name: 'zero-send openings skip the cache purse entirely', ok: true });
  }

  {
    const route = routes[2];
    const { G, pirates } = setupOpening(route, { mode: 'battleTest' });
    G.sent.push(0);
    scene.resolveIsland(pirates[0]);
    const claim = scene.claimScoutedCounterCache(pirates[0], { silent: true });
    assertOpeningCachePurseCheck(!claim && G.enthusiasm === 0 && G.openingCounterPlan === false, 'Battle Test received opening cache purse or prep');
    results.push({ name: 'Battle Test receives no opening cache purse', ok: true });
  }

  {
    const route = routes[0];
    const layerOneMap = {
      layers: [
        [{ id: 1, type: 'island', islandIdx: 0, conns: [2] }],
        [{ id: 2, type: 'island', islandIdx: route.islandIdx, conns: [3] }],
        [{ id: 3, type: 'ship', strength: 6, openingRouteMainKey: route.mainKey, encounter: { mainKey: route.mainKey, supportKeys: ['bilgeRat', 'cabinBoy'], totalCount: 3 }, conns: [] }],
      ],
      visited: [1, 2],
      currentNodeId: 2,
      currentLayer: 1,
    };
    const { G, pirates } = setupOpening(route, {
      map: layerOneMap,
      currentNodeId: 2,
      currentLayer: 1,
      visited: [1, 2],
      round: 1,
    });
    G.sent.push(0);
    scene.resolveIsland(pirates[0]);
    const claim = scene.claimScoutedCounterCache(pirates[0], { silent: true });
    assertOpeningCachePurseCheck(!claim && G.enthusiasm === 0 && G.openingCounterPlan === false, 'non-cache layer-1 island received opening cache purse or prep');
    results.push({ name: 'non-cache layer-1 islands receive no opening cache purse', ok: true });
  }

  {
    const route = routes[0];
    const { G, pirates } = setupOpening(route, { round: 2, boardingCount: 0 });
    G.sent.push(0);
    scene.resolveIsland(pirates[0]);
    const claim = scene.claimScoutedCounterCache(pirates[0], { silent: true });
    assertOpeningCachePurseCheck(claim && claim.cacheGrant && G.enthusiasm === route.cacheEnthusiasm, 'round-2 cache purse did not behave as a normal cache reward');
    results.push({ name: 'round-2 cache purse is normal cache currency, not a round-1-only starter exception', ok: true });
  }

  {
    const route = routes[0];
    const { G, pirates } = setupOpening(route, { boardingCount: 1, round: 2 });
    G.sent.push(0);
    scene.resolveIsland(pirates[0]);
    const claim = scene.claimScoutedCounterCache(pirates[0], { silent: true });
    assertOpeningCachePurseCheck(claim && claim.cacheGrant && G.enthusiasm === route.cacheEnthusiasm, 'post-Boarding-1 cache purse was suppressed like scout pay');
    assertOpeningCachePurseCheck(G.openingCounterPlan === false, 'post-Boarding-1 cache armed Opening Prep');
    results.push({ name: 'post-Boarding-1 cache purse remains ordinary cache currency when a test cache is present', ok: true });
  }

  {
    const route = routes[0];
    const { G, pirates } = setupOpening(route);
    G.sent.push(0);
    scene.resolveIsland(pirates[0]);
    removePirateById(G, pirates[0].id);
    scene._sacrificedIds.add(pirates[0].id);
    const claim = scene.claimScoutedCounterCache(pirates[0], { silent: true });
    assertOpeningCachePurseCheck(claim && claim.cacheGrant && !claim.drill, 'removed first opener did not claim cache without Cache Drill');
    assertOpeningCachePurseCheck(G.enthusiasm === route.cacheEnthusiasm, `removed opener cache skulls ${G.enthusiasm} !== ${route.cacheEnthusiasm}`);
    assertOpeningCachePurseCheck(claim.openingCounterPrep && G.openingCounterPlan === true, 'removed first opener did not arm cache Opening Prep');
    results.push({ name: 'removed first openers still claim the visible cache purse and prep but cannot drill', ok: true });
  }

  return { ok: true, checks: results };
}

function runOpeningDeckhandCounterChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  const routes = [
    { label: 'Forest/Shellback', mainKey: 'shellback', primary: 'poisoner', starterType: 'lumberjack', nonmatchingType: 'miner', islandIdx: 0, sentCount: 1, bountyRes: 'wood', cacheAlert: 0 },
    { label: 'Rocky/Powder Bomber', mainKey: 'powderBomber', primary: 'sawbones', starterType: 'miner', nonmatchingType: 'lumberjack', islandIdx: 1, sentCount: 1, bountyRes: 'stone', cacheAlert: 1 },
    { label: 'Port/Deck Sniper', mainKey: 'deckSniper', primary: 'needler', starterType: 'armsman', nonmatchingType: 'miner', islandIdx: 3, sentCount: 2, bountyRes: 'gold', cacheAlert: 3 },
  ];

  const starterName = (type) => (api.TYPES[type] && api.TYPES[type].name) || type;

  const setupSending = (route, opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.map = opts.map || makeScoutedCounterTestMap(route.mainKey);
    G.round = Math.max(1, Math.floor(Number(opts.round) || 1));
    G.boardingCount = Math.max(0, Math.floor(Number(opts.boardingCount) || 0));
    G.phase = 'sending';
    G.island = scene.buildIslandState(api.ISLANDS[route.islandIdx]);
    G.sent = [];
    const sentCount = opts.sentCount != null
      ? Math.max(0, Math.floor(Number(opts.sentCount) || 0))
      : route.sentCount;
    const pirates = G.allCrew.slice(0, Math.max(3, sentCount + 1, route.sentCount + 1));
    pirates.forEach((pirate, index) => {
      pirate.type = index === 0 ? (opts.firstType || route.starterType) : 'armsman';
      pirate.weaponKey = null;
      pirate.might = 0;
      pirate.tempo = 0;
      pirate.wounded = false;
    });
    if (route.sentCount > 1 || sentCount > 1) pirates[1].type = route.nonmatchingType;
    G.hand = pirates.slice(0, Math.max(3, sentCount + 1, route.sentCount + 1));
    for (let i = 0; i < sentCount; i++) G.sent.push(i);
    G.deck = [];
    G.discard = [];
    G.enthusiasm = 0;
    G.boardingAlert = Math.max(0, Math.floor(Number(opts.boardingAlert) || 1));
    G.shortCrewReportIds = [];
    G.counterWatchIds = [];
    scene._sacrificedIds.clear();
    scene._sendingToIsland.clear();
    return { G, pirates };
  };

  routes.forEach((route) => {
    const badgeSetup = setupSending(route, { sentCount: 0 });
    const routeOrder = scene.openingRouteCounterState();
    assertOpeningDeckhandCounterCheck(routeOrder && routeOrder.starterType === route.starterType, `${route.label} route order starter ${routeOrder && routeOrder.starterType}`);
    assertOpeningDeckhandCounterCheck(routeOrder.available, `${route.label} route starter was not available`);
    const routeBadge = scene.routeCounterBadgeForCard(badgeSetup.pirates[0]);
    const missBadge = scene.routeCounterBadgeForCard(badgeSetup.pirates[1]);
    assertOpeningDeckhandCounterCheck(routeBadge && routeBadge.label === 'Route counter', `${route.label} starter badge missing`);
    assertOpeningDeckhandCounterCheck(!missBadge, `${route.label} nonmatching starter was badged`);
    const routePlanLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(route.sentCount));
    assertOpeningDeckhandCounterCheck(routePlanLine.includes(`Route counter: ${starterName(route.starterType)}`), `${route.label} one-short line did not name route starter: ${routePlanLine}`);
    assertOpeningDeckhandCounterCheck(routePlanLine.includes('Watch') && routePlanLine.includes('counter refunds Alert'), `${route.label} one-short route line did not expose Watch/refund: ${routePlanLine}`);
    results.push({ name: `${route.label} sending aid badges and names ${starterName(route.starterType)} as the route counter`, ok: true, routePlanLine });

    const { G, pirates } = setupSending(route, { boardingAlert: 4 });
    const drilled = pirates[0];
    const result = applyShortCrewDrillForSim(scene);
    assertOpeningDeckhandCounterCheck(result && result.applied, `${route.label} ${starterName(route.starterType)} did not receive Short Crew Drill`);
    assertOpeningDeckhandCounterCheck((drilled.might || 0) === 1, `${route.label} starter Might ${(drilled.might || 0)} !== 1`);
    assertOpeningDeckhandCounterCheck(result.reportEarly, `${route.label} starter did not report early`);
    assertOpeningDeckhandCounterCheck(result.counterAlertRefund && result.counterAlertRefund.eligible, `${route.label} starter did not qualify for counter Alert refund`);
    assertOpeningDeckhandCounterCheck(result.counterWatch, `${route.label} starter did not gain Counter Watch`);
    assertOpeningDeckhandCounterCheck((G.shortCrewReportIds || []).includes(drilled.id), `${route.label} starter did not keep report marker`);
    assertOpeningDeckhandCounterCheck((G.counterWatchIds || []).includes(drilled.id), `${route.label} starter did not keep Counter Watch marker`);
    const floor = G.boardingAlert;
    applyShipWagesForSim(scene, G);
    const refund = applyShortCrewCounterAlertRefundForSim(scene, result, floor);
    assertOpeningDeckhandCounterCheck(refund && refund.amount === 1, `${route.label} starter refund ${JSON.stringify(refund)}`);
    assertOpeningDeckhandCounterCheck(G.boardingAlert === floor, `${route.label} starter alert ${G.boardingAlert} !== ${floor}`);
    const line = scene.formatSendingPlanLine(scene.sendingPlanProjection(route.sentCount));
    assertOpeningDeckhandCounterCheck(line.includes('Alert +1->+0') && line.includes('Watch'), `${route.label} plan line did not expose starter counter payoff: ${line}`);
    results.push({ name: `${route.label} ${starterName(route.starterType)} one-short drills, refunds Alert, reports, and gains Watch`, ok: true });

    const mismatch = setupSending(route, { firstType: route.nonmatchingType, boardingAlert: 2 });
    const mismatchResult = applyShortCrewDrillForSim(scene);
    assertOpeningDeckhandCounterCheck(mismatchResult && mismatchResult.applied, `${route.label} nonmatching setup did not drill`);
    assertOpeningDeckhandCounterCheck(!(mismatchResult.counterAlertRefund && mismatchResult.counterAlertRefund.eligible), `${route.label} nonmatching starter qualified for refund`);
    assertOpeningDeckhandCounterCheck(!mismatchResult.counterWatch, `${route.label} nonmatching starter gained Counter Watch`);
    const mismatchFloor = mismatch.G.boardingAlert;
    applyShipWagesForSim(scene, mismatch.G);
    const mismatchRefund = applyShortCrewCounterAlertRefundForSim(scene, mismatchResult, mismatchFloor);
    assertOpeningDeckhandCounterCheck(!mismatchRefund || mismatchRefund.amount === 0, `${route.label} nonmatching starter refunded Alert`);
    assertOpeningDeckhandCounterCheck(mismatch.G.boardingAlert === mismatchFloor + 1, `${route.label} nonmatching starter did not keep Ship Wages Alert`);
    results.push({ name: `${route.label} nonmatching starter does not get counter refund or Watch`, ok: true });
  });

  const setupCache = (route, starterType, opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.map = makeScoutedCounterTestMap(route.mainKey);
    G.map.currentNodeId = 1;
    G.map.currentLayer = 0;
    G.map.visited = [1];
    G.round = opts.round != null ? Math.max(0, Math.floor(Number(opts.round) || 0)) : 1;
    G.boardingCount = opts.boardingCount != null
      ? Math.max(0, Math.floor(Number(opts.boardingCount) || 0))
      : 0;
    G.phase = 'sending';
    G.island = scene.buildIslandState(api.ISLANDS[route.islandIdx]);
    G.island.scoutedCacheDrill = {
      mainKey: route.mainKey,
      granted: false,
      cachePending: true,
      cacheClaimed: false,
      cacheNodeId: null,
      openerId: null,
      res: route.bountyRes,
      amount: 1,
      enthusiasm: 0,
      alert: route.cacheAlert,
      alertRefundAmount: route.cacheAlert,
      alertFloorBeforeCache: 0,
      alertRefunded: false,
    };
    const pirate = G.allCrew[0];
    pirate.type = starterType;
    pirate.weaponKey = null;
    pirate.might = 0;
    pirate.tempo = 0;
    pirate.wounded = false;
    G.hand = [pirate];
    G.sent = [0];
    G.deck = [];
    G.discard = [];
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.boardingAlert = 2;
    G.cacheDrillMusterIds = [];
    G.openingCounterPlan = !!opts.openingCounterPlan;
    G.openingRouteCounterBoughtMainKey = opts.boughtMainKey || null;
    G.openingRouteCounterBoughtPirateId = opts.boughtPirateId == null ? null : opts.boughtPirateId;
    scene._sacrificedIds.clear();
    return { G, pirate };
  };

  const enemyForPassOff = (key, row, rowOrder, idSuffix = 0) => {
    const archetype = api.COMBAT.enemyArchetypes.find((entry) => entry && entry.key === key);
    assertOpeningDeckhandCounterCheck(!!archetype, `missing archetype ${key}`);
    const member = scene.buildCombatEnemyMember(archetype, `${key}_passoff_${idSuffix}`);
    return scene.buildEnemyCombatFighter(member, row, rowOrder);
  };

  const setupPassOffCombat = (G, route, starter, bought) => {
    G.phase = 'boarding';
    G.boardingCount = 1;
    G.enemyShip = {
      strength: 6,
      encounterNo: 1,
      encounter: {
        mainKey: route.mainKey,
        supportKeys: ['bilgeRat', 'cabinBoy'],
        totalCount: 3,
      },
      cacheDrillBountyMarks: Array.isArray(G.cacheDrillBountyMarks) ? [...G.cacheDrillBountyMarks] : [],
    };
    G.hand = [starter, bought];
    G.deck = [];
    G.discard = [];
    G.combat = {
      mode: 'fighting',
      encounterMainKey: route.mainKey,
      enemyParty: [],
      playerFighters: [],
      enemyFighters: [
        enemyForPassOff(route.mainKey, 0, 0, 0),
        enemyForPassOff('bilgeRat', 0, 1, 1),
        enemyForPassOff('cabinBoy', 0, 2, 2),
      ],
      boardingAlert: 0,
      boardingAlertGuards: 0,
      returnedPirateIds: [],
      reinforcementCount: 0,
      watchReadyCounterIds: [],
      cacheDrillBountyMarks: Array.isArray(G.cacheDrillBountyMarks) ? [...G.cacheDrillBountyMarks] : [],
    };
    return G.combat;
  };

  routes.forEach((route) => {
    const { G, pirate } = setupCache(route, route.starterType, { round: 2 });
    const drillDesc = scene.scoutedCacheDrillDescription();
    const firstShopCounter = scene.scoutedCacheDrillCounterTypes(route.mainKey).find(type => type !== route.starterType);
    const firstShopName = firstShopCounter && api.TYPES[firstShopCounter] && api.TYPES[firstShopCounter].name;
    assertOpeningDeckhandCounterCheck(drillDesc.includes('first sent opens') && drillDesc.includes(starterName(route.starterType)), `${route.label} Cache Drill did not name route starter first: ${drillDesc}`);
    assertOpeningDeckhandCounterCheck(!firstShopName || drillDesc.includes(firstShopName), `${route.label} Cache Drill hid shop counters: ${drillDesc}`);
    if (route.cacheAlert > 1) {
      const remainingAlert = route.cacheAlert - cacheDrillAlertRefundCap(route.cacheAlert);
      assertOpeningDeckhandCounterCheck(drillDesc.includes('cuts 1 Alert') && drillDesc.includes(`leaves +${remainingAlert} pending`) && !drillDesc.includes('disarms cache Alert'), `${route.label} Cache Drill partial Alert copy mismatch: ${drillDesc}`);
    } else {
      assertOpeningDeckhandCounterCheck(route.cacheAlert > 0 ? drillDesc.includes('disarms cache Alert') : !drillDesc.includes('disarms cache Alert'), `${route.label} Cache Drill Alert copy mismatch: ${drillDesc}`);
    }
    assertOpeningDeckhandCounterCheck(drillDesc.includes('Opening Prep'), `${route.label} Cache Drill did not preview route-starter Opening Prep: ${drillDesc}`);
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(reward && reward.applied, `${route.label} starter did not claim Cache Drill`);
    assertOpeningDeckhandCounterCheck(reward.openingCounterPrep === true, `${route.label} starter Cache Drill did not grant Opening Counter Prep`);
    assertOpeningDeckhandCounterCheck(G.openingCounterPlan === true, `${route.label} G.openingCounterPlan not set by starter Cache Drill`);
    assertOpeningDeckhandCounterCheck((pirate.might || 0) === 1, `${route.label} Cache Drill Might ${(pirate.might || 0)} !== 1`);
    assertOpeningDeckhandCounterCheck(reward.alertRefund && reward.alertRefund.amount === cacheDrillAlertRefundCap(route.cacheAlert), `${route.label} Cache Drill refund ${JSON.stringify(reward.alertRefund)}`);
    assertOpeningDeckhandCounterCheck(G.boardingAlert === alertAfterCacheDrill(2, route.cacheAlert), `${route.label} Cache Drill alert ${G.boardingAlert} !== ${alertAfterCacheDrill(2, route.cacheAlert)}`);
    assertOpeningDeckhandCounterCheck((G.cacheDrillMusterIds || []).includes(pirate.id), `${route.label} Cache Drill did not mark early report`);
    const maxSend = scene.maxSend();
    while (G.hand.length < maxSend) {
      const filler = { id: 9200 + G.hand.length, type: route.nonmatchingType, weaponKey: null, might: 0, tempo: 0, wounded: false };
      G.hand.push(filler);
      G.allCrew.push(filler);
    }
    G.sent = Array.from({ length: maxSend }, (_, index) => index);
    updateOpeningCounterPlanForSim(scene, G);
    assertOpeningDeckhandCounterCheck(G.openingCounterPlan === true, `${route.label} full-send completion overwrote Cache Drill Opening Prep`);
    results.push({ name: `${route.label} ${starterName(route.starterType)} can claim Boarding 1 Cache Drill and preserve Opening Prep into full-send completion`, ok: true, drillDesc });
  });

  routes.forEach((route) => {
    const { G, pirate } = setupCache(route, route.starterType, { round: 2 });
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(reward && reward.openingCounterPrep, `${route.label} setup did not grant starter cache prep`);
    assertOpeningDeckhandCounterCheck((G.cacheDrillBountyMarks || []).length === 1, `${route.label} setup did not create one Cache Drill bounty mark`);
    assertOpeningDeckhandCounterCheck(G.cacheDrillBountyMarks[0].pirateId === pirate.id && G.cacheDrillBountyMarks[0].mainKey === route.mainKey, `${route.label} starter did not own initial bounty mark`);
    G.counterWatchIds = [pirate.id];
    G.phase = 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.enthusiasm = api.TYPES[route.primary].cost;
    G.shop = api.normalizeOpeningRouteShop(
      [route.primary, 'drummer', 'herald', 'trainer'],
      G.round,
      { map: G.map, mode: G.mode, boardingCount: G.boardingCount }
    );
    const quote = scene.shopPurchaseQuote(route.primary);
    assertOpeningDeckhandCounterCheck(
      quote.canBuy && quote.counter && quote.topDeck && quote.openingCounterPrepMight && quote.openingCounterPrepDiscount === 1,
      `${route.label} route primary did not quote as Opening Prep top-deck counter: ${JSON.stringify(quote)}`
    );
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningDeckhandCounterCheck(bought && bought.type === route.primary, `${route.label} route primary buy failed after starter cache prep`);
    assertOpeningDeckhandCounterCheck(G.openingCounterPlan === false, `${route.label} route primary buy did not consume Opening Prep`);
    assertOpeningDeckhandCounterCheck((bought.might || 0) === 1 && !bought.weaponKey && (bought.tempo || 0) === 0, `${route.label} route primary prep upgrades wrong: ${JSON.stringify(bought)}`);
    assertOpeningDeckhandCounterCheck(G.deck[G.deck.length - 1] === bought, `${route.label} route primary did not top-deck after starter cache prep`);
    assertOpeningDeckhandCounterCheck((G.counterWatchIds || []).includes(bought.id), `${route.label} route primary did not gain Counter Watch after starter cache prep`);
    assertOpeningDeckhandCounterCheck((G.counterWatchIds || []).includes(pirate.id), `${route.label} starter Counter Watch did not survive pass-off`);
    assertOpeningDeckhandCounterCheck((G.cacheDrillMusterIds || []).includes(pirate.id), `${route.label} starter early report moved during pass-off`);
    const marks = G.cacheDrillBountyMarks || [];
    assertOpeningDeckhandCounterCheck(marks.length === 1, `${route.label} pass-off marker count ${JSON.stringify(marks)}`);
    assertOpeningDeckhandCounterCheck(marks[0].pirateId === bought.id && marks[0].mainKey === route.mainKey, `${route.label} pass-off marker did not move to bought primary: ${JSON.stringify(marks)}`);
    assertOpeningDeckhandCounterCheck((pirate.might || 0) === 1, `${route.label} starter lost Cache Drill Might`);
    assertOpeningDeckhandCounterCheck(G.openingRouteCounterBoughtMainKey === route.mainKey, `${route.label} route primary was not marked secured`);

    G.res = { wood: 0, stone: 0, gold: 0 };
    let combat = setupPassOffCombat(G, route, pirate, bought);
    combat.playerSetupRows = scene.combatDefaultPlayerSetupRows(combat);
    assertOpeningDeckhandCounterCheck(combat.playerSetupRows[0][0] === bought.id, `${route.label} bought primary did not default front-left after pass-off`);
    assertOpeningDeckhandCounterCheck(combat.playerSetupRows[0].includes(pirate.id), `${route.label} starter missing from default setup`);
    combat.playerFighters = scene.buildPlayerCombatFighters(combat.playerSetupRows, combat);
    const primaryAmbush = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningDeckhandCounterCheck(primaryAmbush && primaryAmbush.pirateId === bought.id, `${route.label} bought primary did not Counter Ambush from default setup`);
    combat.result = 'win';
    const primaryBounty = scene.grantAmbushBounty(combat);
    assertOpeningDeckhandCounterCheck(primaryBounty && primaryBounty.pirateId === bought.id && primaryBounty.count === 2 && primaryBounty.drilled, `${route.label} bought primary did not earn doubled bounty: ${JSON.stringify(primaryBounty)}`);
    assertOpeningDeckhandCounterCheck(G.res[route.bountyRes] === 2, `${route.label} doubled bounty resource wrong: ${JSON.stringify(G.res)}`);

    G.res = { wood: 0, stone: 0, gold: 0 };
    combat = setupPassOffCombat(G, route, pirate, bought);
    combat.playerSetupRows = [[pirate.id], [bought.id], []];
    combat.playerFighters = scene.buildPlayerCombatFighters(combat.playerSetupRows, combat);
    const starterAmbush = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningDeckhandCounterCheck(starterAmbush && starterAmbush.pirateId === pirate.id, `${route.label} moved starter did not Counter Ambush`);
    combat.result = 'win';
    const starterBounty = scene.grantAmbushBounty(combat);
    assertOpeningDeckhandCounterCheck(starterBounty && starterBounty.pirateId === pirate.id && starterBounty.count === 1 && !starterBounty.drilled, `${route.label} starter kept doubled bounty after pass-off: ${JSON.stringify(starterBounty)}`);
    assertOpeningDeckhandCounterCheck(G.res[route.bountyRes] === 1, `${route.label} starter normal bounty resource wrong: ${JSON.stringify(G.res)}`);
    results.push({ name: `${route.label} route primary spends starter Cache Drill Opening Prep, takes the bounty mark, defaults front-left, and pays doubled Ambush Bounty`, ok: true });
  });

  const setupSecuredPrimaryBeforeCache = (route) => {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.map = makeScoutedCounterTestMap(route.mainKey);
    G.round = 1;
    G.boardingCount = 0;
    G.phase = 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 1;
    G.openingCounterPlan = false;
    G.enthusiasm = api.TYPES[route.primary].cost;
    G.shop = api.normalizeOpeningRouteShop(
      [route.primary, 'drummer', 'herald', 'trainer'],
      G.round,
      { map: G.map, mode: G.mode, boardingCount: G.boardingCount }
    );
    const starter = (G.allCrew || []).find(pirate => pirate && pirate.type === route.starterType) || G.allCrew[0];
    const quote = scene.shopPurchaseQuote(route.primary);
    assertOpeningDeckhandCounterCheck(
      quote.canBuy && quote.topDeck && quote.counter && quote.discount === 1 && !quote.openingCounterPrepMight && !quote.preparedCounter,
      `${route.label} secured-primary setup quote mismatch: ${JSON.stringify(quote)}`
    );
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningDeckhandCounterCheck(bought && bought.type === route.primary, `${route.label} secured-primary setup buy failed`);
    assertOpeningDeckhandCounterCheck(G.openingRouteCounterBoughtMainKey === route.mainKey && G.openingRouteCounterBoughtPirateId === bought.id, `${route.label} secured-primary marker missing`);
    assertOpeningDeckhandCounterCheck((G.counterWatchIds || []).includes(bought.id), `${route.label} secured primary did not gain Counter Watch`);
    assertOpeningDeckhandCounterCheck(G.deck.includes(bought) && !G.discard.includes(bought), `${route.label} secured primary did not top-deck`);
    assertOpeningDeckhandCounterCheck(!bought.weaponKey && (bought.might || 0) === 0 && (bought.tempo || 0) === 0, `${route.label} secured primary gained prep/prepared stats`);

    G.map.currentNodeId = 1;
    G.map.currentLayer = 0;
    G.map.visited = [1];
    G.round = 2;
    G.phase = 'sending';
    G.island = scene.buildIslandState(api.ISLANDS[route.islandIdx]);
    G.island.scoutedCacheDrill = {
      mainKey: route.mainKey,
      granted: false,
      cachePending: true,
      cacheClaimed: false,
      cacheNodeId: null,
      openerId: null,
      res: route.bountyRes,
      amount: 1,
      enthusiasm: 0,
      alert: route.cacheAlert,
      alertRefundAmount: route.cacheAlert,
      alertFloorBeforeCache: 0,
      alertRefunded: false,
    };
    starter.weaponKey = null;
    starter.might = 0;
    starter.tempo = 0;
    starter.wounded = false;
    G.hand = [starter];
    G.sent = [0];
    G.deck = (G.deck || []).filter(pirate => pirate && pirate.id !== starter.id);
    G.discard = (G.discard || []).filter(pirate => pirate && pirate.id !== starter.id);
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.boardingAlert = 2;
    G.cacheDrillMusterIds = [];
    G.counterWatchIds = Array.from(new Set([...(G.counterWatchIds || []), starter.id]));
    scene._sacrificedIds.clear();
    return { G, starter, bought };
  };

  routes.forEach((route) => {
    const { G, starter, bought } = setupSecuredPrimaryBeforeCache(route);
    const reward = applyScoutedCacheDrillForSim(scene, starter);
    assertOpeningDeckhandCounterCheck(reward && reward.applied, `${route.label} secured-primary starter did not claim Cache Drill`);
    assertOpeningDeckhandCounterCheck(!reward.openingCounterPrep && G.openingCounterPlan === false, `${route.label} secured-primary drill granted new Opening Prep`);
    assertOpeningDeckhandCounterCheck(reward.securedRouteCachePassOff && reward.securedRouteCachePassOff.toPirateId === bought.id, `${route.label} secured-primary drill did not pass mark to bought primary: ${JSON.stringify(reward)}`);
    assertOpeningDeckhandCounterCheck((starter.might || 0) === 1, `${route.label} starter did not keep Cache Drill Might`);
    assertOpeningDeckhandCounterCheck(reward.alertRefund && reward.alertRefund.amount === cacheDrillAlertRefundCap(route.cacheAlert), `${route.label} starter did not keep Alert refund: ${JSON.stringify(reward.alertRefund)}`);
    assertOpeningDeckhandCounterCheck((G.cacheDrillMusterIds || []).includes(starter.id) && !(G.cacheDrillMusterIds || []).includes(bought.id), `${route.label} early report moved off starter`);
    assertOpeningDeckhandCounterCheck((G.counterWatchIds || []).includes(starter.id) && (G.counterWatchIds || []).includes(bought.id), `${route.label} Counter Watch markers changed during pass-off`);
    assertOpeningDeckhandCounterCheck(!bought.weaponKey && (bought.might || 0) === 0 && (bought.tempo || 0) === 0, `${route.label} bought primary gained stats during secured pass-off`);
    const marks = G.cacheDrillBountyMarks || [];
    assertOpeningDeckhandCounterCheck(marks.length === 1 && marks[0].pirateId === bought.id && marks[0].mainKey === route.mainKey, `${route.label} secured pass-off marker mismatch: ${JSON.stringify(marks)}`);
    assertOpeningDeckhandCounterCheck(G.boardingAlert === alertAfterCacheDrill(2, route.cacheAlert), `${route.label} secured-primary Alert refund mismatch: ${G.boardingAlert}`);

    G.res = { wood: 0, stone: 0, gold: 0 };
    const combat = setupPassOffCombat(G, route, starter, bought);
    combat.playerSetupRows = scene.combatDefaultPlayerSetupRows(combat);
    assertOpeningDeckhandCounterCheck(combat.playerSetupRows[0][0] === bought.id, `${route.label} secured primary did not default front-left after cache pass-off`);
    combat.playerFighters = scene.buildPlayerCombatFighters(combat.playerSetupRows, combat);
    const ambush = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningDeckhandCounterCheck(ambush && ambush.pirateId === bought.id, `${route.label} secured primary did not Counter Ambush after cache pass-off`);
    combat.result = 'win';
    const bounty = scene.grantAmbushBounty(combat);
    assertOpeningDeckhandCounterCheck(bounty && bounty.pirateId === bought.id && bounty.count === 2 && bounty.drilled, `${route.label} secured primary did not get doubled bounty: ${JSON.stringify(bounty)}`);
    assertOpeningDeckhandCounterCheck(G.res[route.bountyRes] === 2, `${route.label} secured-primary doubled bounty resource wrong: ${JSON.stringify(G.res)}`);
    results.push({ name: `${route.label} already-secured route primary receives the starter Cache Drill bounty mark and pays doubled Ambush Bounty`, ok: true });
  });

  {
    const route = routes[1];
    const { G, pirate } = setupCache(route, route.starterType, { round: 2 });
    const earlierPrimary = {
      id: 9400,
      type: route.primary,
      weaponKey: null,
      might: 0,
      tempo: 0,
      wounded: false,
    };
    G.allCrew.push(earlierPrimary);
    G.discard.push(earlierPrimary);
    G.openingRouteCounterBoughtMainKey = null;
    G.openingRouteCounterBoughtPirateId = null;
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(reward && reward.openingCounterPrep, 'discard-only prior primary blocked starter Cache Prep');
    assertOpeningDeckhandCounterCheck(!reward.securedRouteCachePassOff, 'discard-only prior primary received secured pass-off');
    assertOpeningDeckhandCounterCheck((G.cacheDrillBountyMarks || [])[0].pirateId === pirate.id, 'starter did not retain bounty mark after prior discard primary');
    G.counterWatchIds = [pirate.id];
    G.phase = 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.enthusiasm = api.TYPES[route.primary].cost;
    G.shop = api.normalizeOpeningRouteShop(
      [route.primary, 'drummer', 'herald', 'trainer'],
      G.round,
      { map: G.map, mode: G.mode, boardingCount: G.boardingCount }
    );
    const quote = scene.shopPurchaseQuote(route.primary);
    assertOpeningDeckhandCounterCheck(
      quote.canBuy && quote.topDeck && quote.openingCounterPrepMight && quote.openingCounterPrepDiscount === 1,
      `prior discard primary blocked prep quote: ${JSON.stringify(quote)}`
    );
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningDeckhandCounterCheck(bought && bought.type === route.primary && bought.id !== earlierPrimary.id, 'prep buy after prior discard primary failed');
    assertOpeningDeckhandCounterCheck(G.deck[G.deck.length - 1] === bought && !G.deck.includes(earlierPrimary), 'prep buy after prior discard primary did not top-deck only the new counter');
    assertOpeningDeckhandCounterCheck(G.discard.includes(earlierPrimary), 'prior discard primary was moved by later prep purchase');
    assertOpeningDeckhandCounterCheck((bought.might || 0) === 1 && (G.counterWatchIds || []).includes(bought.id), 'prep buy after prior discard primary missed Might or Watch');
    assertOpeningDeckhandCounterCheck(G.openingRouteCounterBoughtMainKey === route.mainKey && G.openingRouteCounterBoughtPirateId === bought.id, 'prep buy after prior discard primary did not secure route');
    assertOpeningDeckhandCounterCheck((G.cacheDrillBountyMarks || [])[0].pirateId === bought.id, 'Route Starter Pass-Off did not move mark after prior discard primary');
    results.push({ name: 'discard-only route-primary investment does not block later Route Starter Cache Prep or Pass-Off', ok: true, quote });
  }

  {
    const route = routes[0];
    const { G, pirate } = setupCache(route, route.starterType, { round: 2 });
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(reward && reward.openingCounterPrep, 'negative setup did not grant starter cache prep');
    G.phase = 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.enthusiasm = 10;
    G.shop = ['drummer', route.primary, 'herald', 'trainer'];
    const nonPrimaryQuote = scene.shopPurchaseQuote('drummer');
    assertOpeningDeckhandCounterCheck(
      nonPrimaryQuote.canBuy && nonPrimaryQuote.openingSidePrep && nonPrimaryQuote.consumesOpeningCounterPlan && !nonPrimaryQuote.counter,
      `side-prep quote missed support prep or gained counter status: ${JSON.stringify(nonPrimaryQuote)}`
    );
    const nonPrimary = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningDeckhandCounterCheck(nonPrimary && nonPrimary.type === 'drummer', 'non-primary buy failed');
    assertOpeningDeckhandCounterCheck(G.openingCounterPlan === false, 'side-prep buy did not consume starter Cache Prep');
    assertOpeningDeckhandCounterCheck(G.deck[G.deck.length - 1] === nonPrimary && !G.discard.includes(nonPrimary), 'side-prep buy did not top-deck');
    assertOpeningDeckhandCounterCheck((nonPrimary.tempo || 0) === 1 && (nonPrimary.might || 0) === 0, `side-prep Drummer support buff wrong: ${JSON.stringify(nonPrimary)}`);
    assertOpeningDeckhandCounterCheck(!(G.counterWatchIds || []).includes(nonPrimary.id), 'side-prep non-primary gained Counter Watch');
    assertOpeningDeckhandCounterCheck(!G.openingRouteCounterBoughtMainKey && G.openingRouteCounterBoughtPirateId == null, 'side-prep non-primary secured route');
    assertOpeningDeckhandCounterCheck((G.cacheDrillBountyMarks || [])[0].pirateId === pirate.id, 'non-primary buy transferred the starter bounty mark');
    results.push({ name: 'Opening Side Prep spends starter Cache Prep without triggering Route Starter Pass-Off', ok: true });
  }

  {
    const route = routes[1];
    const { G, pirate } = setupCache(route, route.starterType, { round: 2 });
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(reward && reward.openingCounterPrep, 'Full Crew negative setup did not grant starter cache prep');
    G.phase = 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 1;
    G.openingCounterPlan = false;
    G.enthusiasm = api.TYPES[route.primary].cost;
    G.shop = [route.primary, 'drummer', 'herald', 'trainer'];
    const quote = scene.shopPurchaseQuote(route.primary);
    assertOpeningDeckhandCounterCheck(quote.canBuy && quote.topDeck && !quote.openingCounterPrepMight, `Full Crew-only route primary quote mismatch: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningDeckhandCounterCheck(bought && bought.type === route.primary, 'Full Crew-only primary buy failed');
    assertOpeningDeckhandCounterCheck((G.cacheDrillBountyMarks || [])[0].pirateId === pirate.id, 'Full Crew-only primary transferred the starter bounty mark');
    results.push({ name: 'route-primary buys without Opening Counter Prep do not trigger Route Starter Pass-Off', ok: true });
  }

  {
    const route = routes[2];
    const { G, pirate } = setupCache(route, route.starterType, { round: 2 });
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(reward && reward.openingCounterPrep, 'wrong-main negative setup did not grant starter cache prep');
    G.cacheDrillBountyMarks = [{ pirateId: pirate.id, mainKey: 'shellback' }];
    G.phase = 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.enthusiasm = api.TYPES[route.primary].cost;
    G.shop = [route.primary, 'drummer', 'herald', 'trainer'];
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningDeckhandCounterCheck(bought && bought.type === route.primary, 'wrong-main primary buy failed');
    assertOpeningDeckhandCounterCheck((G.cacheDrillBountyMarks || [])[0].pirateId === pirate.id && G.cacheDrillBountyMarks[0].mainKey === 'shellback', 'wrong-main marker transferred during Route Starter Pass-Off');
    results.push({ name: 'wrong-main Cache Drill bounty marks do not pass off to route primaries', ok: true });
  }

  {
    const route = routes[0];
    const { G, pirate } = setupCache(route, route.starterType, { round: 2 });
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(reward && reward.openingCounterPrep, 'removed-starter negative setup did not grant starter cache prep');
    removePirateById(G, pirate.id);
    G.phase = 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.enthusiasm = api.TYPES[route.primary].cost;
    G.shop = [route.primary, 'drummer', 'herald', 'trainer'];
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningDeckhandCounterCheck(bought && bought.type === route.primary, 'removed-starter primary buy failed');
    assertOpeningDeckhandCounterCheck(!(G.cacheDrillBountyMarks || []).some(mark => mark.pirateId === bought.id), 'removed starter marker transferred to bought primary');
    results.push({ name: 'removed starter bounty marks do not pass off to bought primaries', ok: true });
  }

  {
    const route = routes[1];
    const { G, pirate } = setupCache(route, route.starterType, {
      round: 2,
      boughtMainKey: route.mainKey,
      boughtPirateId: 99999,
    });
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(reward && reward.applied, 'missing bought-primary setup did not drill');
    assertOpeningDeckhandCounterCheck(!reward.securedRouteCachePassOff, 'missing bought primary received secured pass-off');
    assertOpeningDeckhandCounterCheck((G.cacheDrillBountyMarks || [])[0].pirateId === pirate.id, 'missing bought primary moved starter bounty mark');
    results.push({ name: 'missing secured route-primary pirates do not receive Cache Drill pass-off', ok: true });
  }

  {
    const route = routes[2];
    const bought = {
      id: 9600,
      type: route.primary,
      weaponKey: null,
      might: 0,
      tempo: 0,
      wounded: false,
    };
    const { G, pirate } = setupCache(route, route.starterType, {
      round: 2,
      boughtMainKey: 'shellback',
      boughtPirateId: bought.id,
    });
    G.allCrew.push(bought);
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(reward && reward.applied, 'wrong-main secured-primary setup did not drill');
    assertOpeningDeckhandCounterCheck(!reward.securedRouteCachePassOff, 'wrong-main secured primary received pass-off');
    assertOpeningDeckhandCounterCheck((G.cacheDrillBountyMarks || [])[0].pirateId === pirate.id && G.cacheDrillBountyMarks[0].mainKey === route.mainKey, 'wrong-main secured primary moved starter bounty mark');
    results.push({ name: 'wrong-main secured route primaries do not receive Cache Drill pass-off', ok: true });
  }

  {
    const route = routes[0];
    const bought = {
      id: 9700,
      type: route.primary,
      weaponKey: null,
      might: 0,
      tempo: 0,
      wounded: false,
    };
    const { G, pirate } = setupCache(route, 'needler', {
      round: 2,
      boughtMainKey: route.mainKey,
      boughtPirateId: bought.id,
    });
    G.allCrew.push(bought);
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(reward && reward.applied, 'non-starter counter opener did not drill');
    assertOpeningDeckhandCounterCheck(!reward.securedRouteCachePassOff, 'non-starter counter opener passed bounty mark to secured primary');
    assertOpeningDeckhandCounterCheck((G.cacheDrillBountyMarks || [])[0].pirateId === pirate.id, 'non-starter counter opener lost its own bounty mark');
    results.push({ name: 'non-starter cache openers do not pass Cache Drill marks to secured route primaries', ok: true });
  }

  {
    const route = routes[0];
    const { G, pirate } = setupCache(route, route.nonmatchingType);
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(!reward, 'nonmatching starter claimed Cache Drill');
    assertOpeningDeckhandCounterCheck((pirate.might || 0) === 0, 'nonmatching starter gained Cache Drill Might');
    assertOpeningDeckhandCounterCheck(G.island.scoutedCacheDrill.cacheClaimed === true && G.island.scoutedCacheDrill.granted === false, 'nonmatching starter did not open cache without drill');
    assertOpeningDeckhandCounterCheck(G.boardingAlert === 2 + route.cacheAlert, 'nonmatching starter refunded cache Alert');
    assertOpeningDeckhandCounterCheck(G.res[route.bountyRes] === 1, `nonmatching starter did not receive cache payload ${JSON.stringify(G.res)}`);
    assertOpeningDeckhandCounterCheck(G.openingCounterPlan === true, 'nonmatching starter did not arm cache Opening Prep');
    assertOpeningDeckhandCounterCheck((G.cacheDrillMusterIds || []).length === 0, 'nonmatching starter created Cache Drill early report');
    assertOpeningDeckhandCounterCheck((G.cacheDrillBountyMarks || []).length === 0, 'nonmatching starter created Cache Drill bounty mark');
    G.phase = 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.enthusiasm = api.TYPES[route.primary].cost;
    G.shop = [route.primary, 'drummer', 'herald', 'trainer'];
    const quote = scene.shopPurchaseQuote(route.primary);
    assertOpeningDeckhandCounterCheck(
      quote.canBuy && quote.topDeck && quote.openingCounterPrepMight && quote.openingCounterPrepDiscount === 1,
      `nonmatching cache opener did not expose route primary Opening Prep: ${JSON.stringify(quote)}`
    );
    results.push({ name: 'nonmatching first starter opens Boarding 1 cache and arms Opening Prep without Cache Drill', ok: true, quote });
  }

  {
    const route = routes[1];
    const { G, pirate } = setupCache(route, route.starterType, { boughtMainKey: route.mainKey });
    const drillDesc = scene.scoutedCacheDrillDescription();
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(reward && reward.applied, 'already-bought route starter did not claim normal Cache Drill');
    assertOpeningDeckhandCounterCheck(!reward.openingCounterPrep && G.openingCounterPlan === false, 'already-bought route primary still granted Opening Prep');
    assertOpeningDeckhandCounterCheck(!drillDesc.includes('Opening Prep'), `already-bought route primary still previewed Opening Prep: ${drillDesc}`);
    results.push({ name: 'already-secured route primary prevents route starter Cache Drill from granting Opening Prep', ok: true });
  }

  {
    const route = routes[2];
    const { G, pirate } = setupCache(route, route.primary, { round: 2 });
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(reward && reward.applied, 'shop counter opener did not claim normal Cache Drill');
    assertOpeningDeckhandCounterCheck(reward.openingCounterPrep && G.openingCounterPlan === true, 'shop counter opener did not receive cache-granted Opening Prep');
    assertOpeningDeckhandCounterCheck((G.cacheDrillBountyMarks || [])[0].pirateId === pirate.id, 'shop counter opener lost its own Cache Drill bounty mark');
    results.push({ name: 'bought shop-counter cache openers keep normal Cache Drill and receive non-stacking cache Opening Prep', ok: true });
  }

  {
    const route = routes[0];
    const { G, pirate } = setupCache(route, route.starterType, { mode: 'battleTest', round: 2 });
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(!reward && G.openingCounterPlan === false, 'Battle Test granted starter cache prep');
    results.push({ name: 'Battle Test never grants route starter Cache Prep', ok: true });
  }

  {
    const route = routes[0];
    const { G, pirate } = setupCache(route, route.starterType, { round: 2 });
    removePirateById(G, pirate.id);
    scene._sacrificedIds.add(pirate.id);
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(!reward && G.openingCounterPlan === true, 'removed starter opener did not keep cache prep without Cache Drill');
    assertOpeningDeckhandCounterCheck(G.island.scoutedCacheDrill.cacheClaimed === true && G.island.scoutedCacheDrill.granted === false, 'removed starter did not merely open the cache');
    results.push({ name: 'removed route starter openers claim cache Opening Prep without Cache Drill', ok: true });
  }

  {
    const route = routes[0];
    const { G, pirate } = setupCache(route, route.starterType, { boardingCount: 1, round: 3 });
    G.map = {
      layers: [
        [{ id: 1, type: 'ship', strength: 6, encounter: { mainKey: 'shellback', supportKeys: [], totalCount: 1 }, conns: [2] }],
        [{ id: 2, type: 'island', islandIdx: route.islandIdx, conns: [3] }],
        [{ id: 3, type: 'ship', strength: 8, encounter: { mainKey: route.mainKey, supportKeys: [], totalCount: 1 }, conns: [] }],
      ],
      visited: [1, 2],
      currentNodeId: 2,
      currentLayer: 1,
    };
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(!reward && G.openingCounterPlan === false, 'Boarding 2+ route starter granted Cache Drill or prep');
    results.push({ name: 'Boarding 2+ never grants route starter Cache Prep', ok: true });
  }

  {
    const route = routes[0];
    const { G, pirate } = setupCache(route, route.starterType, { openingCounterPlan: true, boughtMainKey: route.mainKey });
    const reward = applyScoutedCacheDrillForSim(scene, pirate);
    assertOpeningDeckhandCounterCheck(reward && reward.applied && !reward.openingCounterPrep, 'bought-primary starter setup did not claim normal Cache Drill without new prep');
    assertOpeningDeckhandCounterCheck(G.openingCounterPlan === true, 'Cache Drill handling cleared an existing Opening Counter Prep flag');
    results.push({ name: 'Cache Drill handling preserves an existing Opening Counter Prep flag without stacking a new one', ok: true });
  }

  const enemyFor = (key, row, rowOrder, idSuffix = 0) => {
    const archetype = api.COMBAT.enemyArchetypes.find((entry) => entry && entry.key === key);
    assertOpeningDeckhandCounterCheck(!!archetype, `missing archetype ${key}`);
    const member = scene.buildCombatEnemyMember(archetype, `${key}_deckhand_${idSuffix}`);
    return scene.buildEnemyCombatFighter(member, row, rowOrder);
  };

  const setupBoarding = (route, opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.phase = 'boarding';
    G.boardingCount = Math.max(1, Math.floor(Number(opts.boardingNo) || 1));
    G.enemyShip = {
      strength: 6,
      encounterNo: G.boardingCount,
      encounter: {
        mainKey: route.mainKey,
        supportKeys: ['bilgeRat', 'cabinBoy'],
        totalCount: 3,
      },
    };
    const starter = G.allCrew[0];
    starter.type = route.starterType;
    starter.weaponKey = null;
    starter.might = Math.max(0, Math.floor(Number(opts.might) || 0));
    starter.tempo = 0;
    starter.wounded = false;
    G.hand = [starter];
    G.deck = [];
    G.discard = [];
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.combat = {
      mode: 'fighting',
      encounterMainKey: null,
      enemyParty: [],
      playerFighters: [],
      enemyFighters: [],
      boardingAlert: 0,
      boardingAlertGuards: 0,
      returnedPirateIds: [],
      reinforcementCount: 0,
      watchReadyCounterIds: [],
    };
    G.combat.playerFighters = [scene.buildPlayerCombatFighter(starter, 0, 0, G.combat)];
    G.combat.enemyFighters = [
      enemyFor(route.mainKey, 0, 2, 0),
      enemyFor('cabinBoy', 0, 1, 1),
      enemyFor('bilgeRat', 0, 0, 2),
    ];
    return { G, starter, combat: G.combat };
  };

  routes.forEach((route) => {
    const { G, starter, combat } = setupBoarding(route);
    assertOpeningDeckhandCounterCheck(scene.counterAmbushTypes(combat).includes(route.starterType), `${route.label} starter missing from Counter Ambush types`);
    assertOpeningDeckhandCounterCheck(scene.combatCounterEdgeDamageForPirate(starter, combat) === 1, `${route.label} starter did not receive Counter Edge`);
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertOpeningDeckhandCounterCheck(result && result.applied && result.pirateId === starter.id, `${route.label} starter did not Counter Ambush`);
    combat.result = 'win';
    const trophy = scene.grantCounterTrophy(combat);
    const bounty = scene.grantAmbushBounty(combat);
    assertOpeningDeckhandCounterCheck(trophy && trophy.pirateId === starter.id && (starter.tempo || 0) === 1, `${route.label} starter did not gain Counter Trophy`);
    assertOpeningDeckhandCounterCheck(bounty && bounty.pirateId === starter.id && bounty.resource === route.bountyRes, `${route.label} starter Ambush Bounty ${JSON.stringify(bounty)}`);
    assertOpeningDeckhandCounterCheck(G.res[route.bountyRes] === 1, `${route.label} bounty resource not granted: ${JSON.stringify(G.res)}`);
    results.push({ name: `${route.label} ${starterName(route.starterType)} triggers Ambush, Counter Edge, Counter Trophy, and Ambush Bounty`, ok: true });
  });

  {
    const route = routes[0];
    const { starter, combat } = setupBoarding(route, { boardingNo: 2 });
    assertOpeningDeckhandCounterCheck(!scene.counterAmbushTypes(combat).includes(route.starterType), 'Boarding 2 included Opening Deckhand counter type');
    assertOpeningDeckhandCounterCheck(scene.combatCounterEdgeDamageForPirate(starter, combat) === 0, 'Boarding 2 gave starter Counter Edge');
    assertOpeningDeckhandCounterCheck(!scene.applyCounterAmbush(combat, { silent: true }), 'Boarding 2 starter triggered Counter Ambush');
    combat.result = 'win';
    assertOpeningDeckhandCounterCheck(!scene.grantCounterTrophy(combat), 'Boarding 2 starter gained Counter Trophy');
    assertOpeningDeckhandCounterCheck(!scene.grantAmbushBounty(combat), 'Boarding 2 starter gained Ambush Bounty without ambush');
    results.push({ name: 'Opening Deckhand counters do not leak into Boarding 2+', ok: true });
  }

  {
    const route = routes[1];
    const { G, starter, combat } = setupBoarding(route, { mode: 'battleTest' });
    assertOpeningDeckhandCounterCheck(G.mode === 'battleTest', 'Battle Test setup failed');
    assertOpeningDeckhandCounterCheck(!scene.counterAmbushTypes(combat).includes(route.starterType), 'Battle Test included Opening Deckhand counter type');
    assertOpeningDeckhandCounterCheck(scene.combatCounterEdgeDamageForPirate(starter, combat) === 0, 'Battle Test gave starter Counter Edge');
    assertOpeningDeckhandCounterCheck(!scene.applyCounterAmbush(combat, { silent: true }), 'Battle Test starter triggered Counter Ambush');
    results.push({ name: 'Opening Deckhand counters do not apply in Battle Test', ok: true });
  }

  {
    const route = routes[0];
    const battleAid = setupSending(route, { mode: 'battleTest', sentCount: 0 });
    assertOpeningDeckhandCounterCheck(!scene.openingRouteCounterState(), 'Battle Test exposed route-counter sending aid');
    assertOpeningDeckhandCounterCheck(!scene.routeCounterBadgeForCard(battleAid.pirates[0]), 'Battle Test badged starter route counter');
    const laterAid = setupSending(route, { boardingCount: 1, sentCount: 0 });
    assertOpeningDeckhandCounterCheck(!scene.openingRouteCounterState(), 'Boarding 2+ exposed route-counter sending aid');
    assertOpeningDeckhandCounterCheck(!scene.routeCounterBadgeForCard(laterAid.pirates[0]), 'Boarding 2+ badged starter route counter');
    results.push({ name: 'route-counter sending aid stays out of Battle Test and Boarding 2+', ok: true });
  }

  {
    const map = makeScoutedCounterTestMap('shellback');
    const shopCounters = api.scoutedCounterTypesForMap(map, { mode: 'run' });
    const gameplayCounters = api.gameplayCounterTypes('shellback', 1, { mode: 'run' });
    const battleCounters = api.gameplayCounterTypes('shellback', 1, { mode: 'battleTest' });
    assertOpeningDeckhandCounterCheck(!shopCounters.includes('lumberjack'), `shop counters leaked starter: ${shopCounters.join(',')}`);
    assertOpeningDeckhandCounterCheck(gameplayCounters.includes('lumberjack') && gameplayCounters.includes('poisoner'), `gameplay counters missing starter/shop mix: ${gameplayCounters.join(',')}`);
    assertOpeningDeckhandCounterCheck(battleCounters.length === 0, `Battle Test gameplay counters mismatch: ${battleCounters.join(',')}`);
    results.push({ name: 'starter counters stay out of shop-only counter helpers', ok: true, shopCounters, gameplayCounters });
  }

  return { ok: true, checks: results };
}

function runOpeningRouteMusterChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  const routes = [
    { label: 'Forest/Shellback', islandIdx: 0, mainKey: 'shellback', primary: 'poisoner', starterType: 'lumberjack', nonmatchingType: 'miner', res: 'wood' },
    { label: 'Rocky/Powder Bomber', islandIdx: 1, mainKey: 'powderBomber', primary: 'sawbones', starterType: 'miner', nonmatchingType: 'lumberjack', res: 'stone' },
    { label: 'Port/Deck Sniper', islandIdx: 3, mainKey: 'deckSniper', primary: 'needler', starterType: 'armsman', nonmatchingType: 'miner', res: 'gold' },
  ];
  const starterName = (type) => (api.TYPES[type] && api.TYPES[type].name) || type;

  const makeRouteMap = (route) => ({
    layers: [
      [{
        id: 1,
        type: 'island',
        islandIdx: route.islandIdx,
        conns: [2],
        scoutedCache: {
          mainKey: route.mainKey,
          res: route.res,
          amount: 1,
          enthusiasm: 1,
          alert: 1,
          claimed: false,
        },
      }],
      [{
        id: 2,
        type: 'ship',
        strength: 6,
        encounter: api.firstBoardingEncounterBlueprint('shellback'),
        conns: [],
      }],
    ],
    visited: [],
    currentNodeId: null,
    currentLayer: -1,
  });

  const makePirate = (id, type, opts = {}) => ({
    id,
    type,
    weaponKey: opts.weaponKey || null,
    might: Math.max(0, Math.floor(Number(opts.might) || 0)),
    tempo: Math.max(0, Math.floor(Number(opts.tempo) || 0)),
    wounded: !!opts.wounded,
  });

  const setupRouteSelection = (route, opts = {}) => {
    api.initState();
    const G = api.getG();
    const starter = makePirate(9300, route.starterType, opts.starter || {});
    const deckStarter = makePirate(9301, route.starterType);
    const fillerA = makePirate(9302, route.nonmatchingType);
    const fillerB = makePirate(9303, route.starterType === 'armsman' ? 'lumberjack' : 'armsman');
    const fillerC = makePirate(9304, 'herald');
    const fillerD = makePirate(9305, 'trainer');
    let hand = opts.handHasStarter === false
      ? [fillerA, fillerB, fillerC]
      : [starter, fillerA, fillerB];
    if (opts.handHasStarter !== false && opts.starterHandIndex != null) {
      const fillers = [fillerA, fillerB, fillerC];
      const starterIndex = Math.max(0, Math.min(fillers.length, Math.floor(Number(opts.starterHandIndex) || 0)));
      hand = fillers.slice();
      hand.splice(starterIndex, 0, starter);
      hand = hand.slice(0, 3);
    }
    const deck = opts.deckHasStarter === false ? [fillerD] : [deckStarter, fillerD];
    const discard = opts.discardHasStarter ? [starter] : [];
    const all = [starter, deckStarter, fillerA, fillerB, fillerC, fillerD];
    G.mode = opts.mode || 'run';
    G.map = makeRouteMap(route);
    G.allCrew = all;
    G.hand = hand;
    G.deck = deck;
    G.discard = discard;
    G.sent = [];
    G.round = 0;
    G.boardingCount = Math.max(0, Math.floor(Number(opts.boardingCount) || 0));
    G.phase = 'map';
    G.island = null;
    G.enemyShip = null;
    G.openingRouteMuster = null;
    G.openingRouteMusterUsed = false;
    G.cacheDrillMusterIds = [];
    G.shortCrewReportIds = [];
    G.counterWatchIds = [];
    scene._sacrificedIds.clear();
    scene._sendingToIsland.clear();
    const selected = scene.applyMapNodeSelection(1);
    return { G, starter, deckStarter, fillerA, fillerB, fillerC, fillerD, selected };
  };

  const zoneCount = (G, pirate) => [...(G.hand || []), ...(G.deck || []), ...(G.discard || [])]
    .filter(card => card && pirate && card.id === pirate.id)
    .length;

  routes.forEach((route) => {
    const { G, starter, selected } = setupRouteSelection(route);
    const marker = G.openingRouteMuster;
    assertOpeningRouteMusterCheck(selected, `${route.label} route selection failed`);
    assertOpeningRouteMusterCheck(marker && marker.pirateId === starter.id, `${route.label} did not mark the visible starter: ${JSON.stringify(marker)}`);
    assertOpeningRouteMusterCheck(marker.mainKey === route.mainKey && marker.type === route.starterType, `${route.label} marker mismatch: ${JSON.stringify(marker)}`);
    assertOpeningRouteMusterCheck(G.hand[0] === starter, `${route.label} did not immediately muster starter to hand[0]`);
    assertOpeningRouteMusterCheck(zoneCount(G, starter) === 1, `${route.label} immediate muster duplicated starter ${zoneCount(G, starter)} times`);
    assertOpeningRouteMusterCheck((starter.might || 0) === 0 && !starter.weaponKey && (starter.tempo || 0) === 0, `${route.label} starter was upgraded on mark`);
    assertOpeningRouteMusterCheck((G.counterWatchIds || []).length === 1 && G.counterWatchIds[0] === starter.id, `${route.label} did not grant exactly one starter Watch: ${JSON.stringify(G.counterWatchIds)}`);
    assertOpeningRouteMusterCheck(scene.nextShipIntelText().includes(`Route counter: ${starterName(route.starterType)} · Watch`), `${route.label} intel did not expose route Watch: ${scene.nextShipIntelText()}`);
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertOpeningRouteMusterCheck(G.hand[0] === starter, `${route.label} mustered starter did not return first after Shop Continue`);
    assertOpeningRouteMusterCheck(zoneCount(G, starter) === 1, `${route.label} starter duplicated after Shop Continue ${zoneCount(G, starter)} times`);
    assertOpeningRouteMusterCheck(!G.openingRouteMuster, `${route.label} marker did not clear after Shop Continue`);
    results.push({ name: `${route.label} immediately musters one visible matching starter to hand[0]`, ok: true, marker });
  });

  {
    const route = routes[2];
    const { G, starter, fillerA } = setupRouteSelection(route, { starterHandIndex: 2 });
    assertOpeningRouteMusterCheck(G.openingRouteMuster && G.openingRouteMuster.pirateId === starter.id, `hand reorder marker ${JSON.stringify(G.openingRouteMuster)}`);
    assertOpeningRouteMusterCheck(G.hand[0] === starter, 'in-hand starter was not swapped to hand[0]');
    assertOpeningRouteMusterCheck(G.hand[2] === fillerA, 'slot-0 pirate was not swapped into the starter hand slot');
    [starter, fillerA].forEach((pirate) => {
      assertOpeningRouteMusterCheck(zoneCount(G, pirate) === 1, `hand swap duplicated ${pirate.id}: ${zoneCount(G, pirate)}`);
    });
    results.push({ name: 'Opening Route Muster swaps an in-hand matching starter to hand[0] without duplication', ok: true });
  }

  {
    const route = routes[0];
    const { G, deckStarter, fillerA } = setupRouteSelection(route, { handHasStarter: false });
    assertOpeningRouteMusterCheck(G.openingRouteMuster && G.openingRouteMuster.pirateId === deckStarter.id, `deck fallback marker ${JSON.stringify(G.openingRouteMuster)}`);
    assertOpeningRouteMusterCheck((G.counterWatchIds || []).length === 1 && G.counterWatchIds[0] === deckStarter.id, `deck fallback Watch ${JSON.stringify(G.counterWatchIds)}`);
    assertOpeningRouteMusterCheck(G.hand[0] === deckStarter, 'deck fallback starter was not mustered immediately to hand[0]');
    assertOpeningRouteMusterCheck(G.deck[0] === fillerA, 'displaced hand[0] pirate was not placed into the starter deck slot');
    assertOpeningRouteMusterCheck(zoneCount(G, deckStarter) === 1, `deck fallback immediate starter duplicated ${zoneCount(G, deckStarter)} times`);
    assertOpeningRouteMusterCheck(zoneCount(G, fillerA) === 1, `deck fallback displaced pirate duplicated ${zoneCount(G, fillerA)} times`);
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertOpeningRouteMusterCheck(G.hand[0] === deckStarter, 'deck fallback starter was not drawn first');
    assertOpeningRouteMusterCheck(zoneCount(G, deckStarter) === 1, `deck fallback starter duplicated ${zoneCount(G, deckStarter)} times`);
    assertOpeningRouteMusterCheck((G.openingRouteMuster || null) === null, 'deck fallback marker was not cleared');
    results.push({ name: 'Opening Route Muster can pull the matching starter from the draw pile without duplication', ok: true });
  }

  routes.forEach((route) => {
    const { G } = setupRouteSelection(route, { handHasStarter: false });
    const starter = G.hand[0];
    const maxSend = scene.maxSend();
    assertOpeningRouteMusterCheck(starter && starter.type === route.starterType, `${route.label} did not muster deck starter for full-send line`);
    assertOpeningRouteMusterCheck(maxSend > 0 && G.hand.length >= maxSend, `${route.label} full-send setup lacks hand size ${G.hand.length}/${maxSend}`);
    for (let handIdx = 0; handIdx < maxSend; handIdx++) {
      const pirate = G.hand[handIdx];
      G.sent.push(handIdx);
      scene.resolveIsland(pirate);
      const cacheClaim = handIdx === 0 ? scene.claimScoutedCounterCache(pirate, { silent: true }) : null;
      if (handIdx === 0) {
        assertOpeningRouteMusterCheck(cacheClaim && cacheClaim.drill && cacheClaim.drill.applied, `${route.label} mustered starter missed Cache Drill`);
      } else {
        assertOpeningRouteMusterCheck(!cacheClaim, `${route.label} non-first pirate reopened the cache`);
      }
    }
    applyPortDrillForSim(scene);
    updateFullCrewDiscountForSim(scene, G);
    updateOpeningCounterPlanForSim(scene, G);
    applyShipWagesForSim(scene, G);
    G.phase = 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.shopCreditUsed = false;
    G.shop = api.normalizeOpeningRouteShop(
      [route.primary, 'drummer', 'herald', 'trainer'],
      G.round,
      { map: G.map, mode: G.mode, boardingCount: G.boardingCount }
    );
    const quote = scene.shopPurchaseQuote(route.primary);
    assertOpeningRouteMusterCheck(G.fullCrewDiscount === 1, `${route.label} full-send did not earn Full Crew Discount`);
    assertOpeningRouteMusterCheck(G.openingCounterPlan === true, `${route.label} starter Cache Drill did not arm Opening Counter Prep`);
    assertOpeningRouteMusterCheck(quote.canBuy && !quote.credit && quote.topDeck && quote.openingCounterPrepMight, `${route.label} route primary not affordable as prepped top-deck counter: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(G.shop.indexOf(route.primary), { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertOpeningRouteMusterCheck(bought && bought.type === route.primary, `${route.label} route primary buy failed`);
    assertOpeningRouteMusterCheck(G.deck[G.deck.length - 1] === bought && !G.discard.includes(bought), `${route.label} route primary did not top-deck`);
    assertOpeningRouteMusterCheck((G.counterWatchIds || []).includes(bought.id), `${route.label} route primary did not gain Counter Watch`);
    assertOpeningRouteMusterCheck((bought.might || 0) === 1, `${route.label} prepped route primary missed +Might`);
    [starter, bought].forEach((pirate) => {
      assertOpeningRouteMusterCheck(zoneCount(G, pirate) === 1, `${route.label} full-send line duplicated ${pirate.id}: ${zoneCount(G, pirate)}`);
    });
    results.push({ name: `${route.label} mustered-starter full-send affords a prepped watched route-primary counter`, ok: true, quote });
  });

  {
    const route = routes[0];
    api.initState();
    const G = api.getG();
    const starter = makePirate(9330, route.starterType);
    const fillerA = makePirate(9331, route.nonmatchingType);
    const fillerB = makePirate(9332, 'armsman');
    const fillerC = makePirate(9333, 'trainer');
    const firstNode = { id: 1, type: 'island', islandIdx: route.islandIdx, conns: [2] };
    const cacheNode = {
      id: 2,
      type: 'island',
      islandIdx: route.islandIdx,
      conns: [3],
      scoutedCache: { mainKey: route.mainKey, res: route.res, amount: 1, enthusiasm: 1, alert: 1, claimed: false },
    };
    G.mode = 'run';
    G.map = {
      layers: [
        [firstNode],
        [cacheNode],
        [{ id: 3, type: 'ship', strength: 6, encounter: api.firstBoardingEncounterBlueprint('shellback'), conns: [] }],
      ],
      visited: [],
      currentNodeId: null,
      currentLayer: -1,
    };
    G.allCrew = [starter, fillerA, fillerB, fillerC];
    G.hand = [starter, fillerA, fillerB];
    G.deck = [fillerC];
    G.discard = [];
    G.phase = 'map';
    G.boardingCount = 0;
    G.openingRouteMuster = null;
    G.openingRouteMusterUsed = false;
    assertOpeningRouteMusterCheck(scene.applyMapNodeSelection(firstNode.id), 'first island route selection failed');
    assertOpeningRouteMusterCheck(G.openingRouteMuster && G.openingRouteMuster.pirateId === starter.id, 'first route did not mark starter');
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertOpeningRouteMusterCheck(G.hand[0] === starter, 'first route muster did not return starter');
    assertOpeningRouteMusterCheck(G.openingRouteMusterUsed === true, 'Opening Route Muster did not remember it was used');
    assertOpeningRouteMusterCheck(scene.applyMapNodeSelection(cacheNode.id), 'second pre-boarding island selection failed');
    assertOpeningRouteMusterCheck(!G.openingRouteMuster, 'Opening Route Muster marked a second time before Boarding 1');
    results.push({ name: 'Opening Route Muster happens once even if another pre-Boarding-1 island is selected', ok: true });
  }

  {
    const route = routes[1];
    const { G, starter, fillerA } = setupRouteSelection(route, {
      handHasStarter: false,
      deckHasStarter: false,
      discardHasStarter: true,
    });
    assertOpeningRouteMusterCheck(G.openingRouteMuster && G.openingRouteMuster.pirateId === starter.id, `discard fallback marker ${JSON.stringify(G.openingRouteMuster)}`);
    assertOpeningRouteMusterCheck(G.hand[0] === starter, 'discard fallback starter was not mustered immediately to hand[0]');
    assertOpeningRouteMusterCheck(G.discard[0] === fillerA, 'displaced hand[0] pirate was not placed into the starter discard slot');
    assertOpeningRouteMusterCheck(zoneCount(G, starter) === 1, `discard fallback immediate starter duplicated ${zoneCount(G, starter)} times`);
    assertOpeningRouteMusterCheck(zoneCount(G, fillerA) === 1, `discard fallback displaced pirate duplicated ${zoneCount(G, fillerA)} times`);
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertOpeningRouteMusterCheck(G.hand[0] === starter, 'discard fallback starter was not drawn first');
    assertOpeningRouteMusterCheck(zoneCount(G, starter) === 1, `discard fallback starter duplicated ${zoneCount(G, starter)} times`);
    results.push({ name: 'Opening Route Muster can pull the matching starter from discard without duplication', ok: true });
  }

  {
    const route = routes[2];
    const { G, starter } = setupRouteSelection(route);
    G.sent = [0];
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertOpeningRouteMusterCheck(G.hand[0] === starter, 'sent visible starter did not muster into the next hand');
    assertOpeningRouteMusterCheck(zoneCount(G, starter) === 1, `sent visible starter duplicated ${zoneCount(G, starter)} times`);
    results.push({ name: 'Opening Route Muster separates a sent matching starter from discard and draws it next', ok: true });
  }

  {
    const route = routes[0];
    const { G, starter } = setupRouteSelection(route, { starter: { might: 2, tempo: 1, weaponKey: 'rustyPistol' } });
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertOpeningRouteMusterCheck(G.hand[0] === starter, 'upgraded starter did not muster');
    assertOpeningRouteMusterCheck(starter.might === 2 && starter.tempo === 1 && starter.weaponKey === 'rustyPistol', `muster mutated upgrades: ${JSON.stringify(starter)}`);
    assertOpeningRouteMusterCheck((G.counterWatchIds || []).includes(starter.id), 'muster did not keep starter Counter Watch');
    results.push({ name: 'Opening Route Muster grants Counter Watch without changing weapons or buffs', ok: true });
  }

  {
    const route = routes[0];
    const { G, starter } = setupRouteSelection(route);
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertOpeningRouteMusterCheck(G.hand[0] === starter, 'watched held starter did not muster into hand');
    assertOpeningRouteMusterCheck((G.counterWatchIds || []).includes(starter.id), 'watched held starter lost Counter Watch before Boarding 1');
    const shipSelected = scene.applyMapNodeSelection(2);
    assertOpeningRouteMusterCheck(shipSelected && G.phase === 'boarding', 'watched held starter Boarding 1 selection failed');
    assertOpeningRouteMusterCheck((G.enemyShip.watchReadyCounterIds || []).includes(starter.id), 'held watched starter did not become Watch Ready');
    assertOpeningRouteMusterCheck((G.counterWatchIds || []).length === 0, 'Boarding 1 did not clear route Counter Watch');
    results.push({ name: 'held Opening Route Muster starter becomes Watch Ready at Boarding 1', ok: true });
  }

  {
    const route = routes[0];
    const { G, starter } = setupRouteSelection(route);
    G.sent = [0];
    scene.spendCounterWatch(starter);
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertOpeningRouteMusterCheck(G.hand[0] === starter, 'sent starter did not still muster back to hand');
    assertOpeningRouteMusterCheck(!(G.counterWatchIds || []).includes(starter.id), 'sent starter kept original muster Watch');
    const shipSelected = scene.applyMapNodeSelection(2);
    assertOpeningRouteMusterCheck(shipSelected && G.phase === 'boarding', 'sent starter Boarding 1 selection failed');
    assertOpeningRouteMusterCheck(!(G.enemyShip.watchReadyCounterIds || []).includes(starter.id), 'sent starter became Watch Ready from spent muster Watch');
    results.push({ name: 'sending the mustered starter spends the original route Watch before Boarding 1', ok: true });
  }

  {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.map = makeScoutedCounterTestMap('shellback');
    G.phase = 'shopping';
    G.boardingCount = 0;
    const cachePirate = makePirate(9310, 'poisoner');
    const shortPirate = makePirate(9311, 'trainer');
    const routePirate = makePirate(9312, 'lumberjack');
    const watchedPirate = makePirate(9313, 'sawbones');
    const shopTop = makePirate(9314, 'needler');
    G.allCrew = [cachePirate, shortPirate, routePirate, watchedPirate, shopTop];
    G.hand = [cachePirate, shortPirate, routePirate, watchedPirate];
    G.deck = [shopTop];
    G.discard = [];
    G.sent = [0, 1];
    G.cacheDrillMusterIds = [cachePirate.id];
    G.shortCrewReportIds = [shortPirate.id];
    G.openingRouteMuster = { pirateId: routePirate.id, mainKey: 'shellback', type: 'lumberjack' };
    G.counterWatchIds = [routePirate.id, watchedPirate.id];
    prepareNextRoundForSim(api, scene);
    assertOpeningRouteMusterCheck(G.hand[0] === cachePirate, 'Cache Drill report did not draw first');
    assertOpeningRouteMusterCheck(G.hand[1] === shortPirate, 'Short Crew report did not draw second');
    assertOpeningRouteMusterCheck(G.hand[2] === routePirate, 'Opening Route Muster did not draw after early reports');
    assertOpeningRouteMusterCheck(G.hand[3] === watchedPirate, 'Counter Watch did not draw after Opening Route Muster');
    assertOpeningRouteMusterCheck(G.hand[4] === shopTop, 'shop top-deck card did not draw last');
    [cachePirate, shortPirate, routePirate, watchedPirate, shopTop].forEach((pirate) => {
      assertOpeningRouteMusterCheck(zoneCount(G, pirate) === 1, `priority card ${pirate.id} duplicated ${zoneCount(G, pirate)} times`);
    });
    assertOpeningRouteMusterCheck((G.counterWatchIds || []).includes(routePirate.id), 'Opening Route Muster overlap spent the route Watch');
    results.push({ name: 'draw priority keeps a mustered watched starter above other Counter Watch cards without duplication', ok: true });
  }

  {
    const route = routes[0];
    const { G, starter } = setupRouteSelection(route);
    G.cacheDrillMusterIds = [starter.id];
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertOpeningRouteMusterCheck(G.hand[0] === starter, 'Cache Drill starter did not return');
    assertOpeningRouteMusterCheck(zoneCount(G, starter) === 1, `Cache Drill starter duplicated ${zoneCount(G, starter)} times`);
    assertOpeningRouteMusterCheck((G.openingRouteMuster || null) === null, 'Cache Drill overlap left route marker');
    results.push({ name: 'Opening Route Muster skips a starter already returned by Cache Drill', ok: true });
  }

  {
    const route = routes[1];
    const { G, starter } = setupRouteSelection(route);
    G.shortCrewReportIds = [starter.id];
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertOpeningRouteMusterCheck(G.hand[0] === starter, 'Short Crew starter did not return');
    assertOpeningRouteMusterCheck(zoneCount(G, starter) === 1, `Short Crew starter duplicated ${zoneCount(G, starter)} times`);
    assertOpeningRouteMusterCheck((G.openingRouteMuster || null) === null, 'Short Crew overlap left route marker');
    results.push({ name: 'Opening Route Muster skips a starter already returned by Short Crew', ok: true });
  }

  {
    const route = routes[0];
    const { G, starter } = setupRouteSelection(route);
    G.allCrew = G.allCrew.filter(pirate => pirate.id !== starter.id);
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertOpeningRouteMusterCheck(zoneCount(G, starter) === 0, 'removed starter was returned by Opening Route Muster');
    assertOpeningRouteMusterCheck((G.openingRouteMuster || null) === null, 'removed starter left a stale marker');
    results.push({ name: 'Opening Route Muster ignores a marker whose pirate is no longer owned', ok: true });
  }

  {
    api.initBattleTestState();
    const G = api.getG();
    const marked = scene.markOpeningRouteMuster('shellback');
    assertOpeningRouteMusterCheck(!marked && !G.openingRouteMuster, 'Battle Test created an Opening Route Muster marker');
    assertOpeningRouteMusterCheck((G.counterWatchIds || []).length === 0, 'Battle Test created an Opening Route Muster Watch');
    results.push({ name: 'Opening Route Muster does not apply in Battle Test', ok: true });
  }

  {
    const route = routes[0];
    const { G, starter } = setupRouteSelection(route);
    G.phase = 'map';
    G.map.currentLayer = 0;
    G.map.currentNodeId = 1;
    const shipSelected = scene.applyMapNodeSelection(2);
    assertOpeningRouteMusterCheck(shipSelected && G.phase === 'boarding', 'Boarding 1 selection failed');
    assertOpeningRouteMusterCheck((G.openingRouteMuster || null) === null, 'Opening Route Muster marker did not clear when Boarding 1 started');
    G.phase = 'shopping';
    const fillers = [0, 1, 2, 3, 4].map(i => makePirate(9320 + i, i % 2 === 0 ? 'miner' : 'armsman'));
    G.allCrew.push(...fillers);
    G.deck = fillers.slice();
    G.discard = [];
    G.hand = [starter];
    G.openingRouteMuster = { pirateId: starter.id, mainKey: route.mainKey, type: route.starterType };
    G.boardingCount = 1;
    prepareNextRoundForSim(api, scene);
    assertOpeningRouteMusterCheck(G.discard.includes(starter), 'post-Boarding stale route marker returned a starter');
    assertOpeningRouteMusterCheck(!G.hand.includes(starter), 'post-Boarding stale route marker drew a starter');
    assertOpeningRouteMusterCheck((G.openingRouteMuster || null) === null, 'post-Boarding stale route marker was not cleared');
    results.push({ name: 'Opening Route Muster clears at Boarding 1 and cannot fire after Boarding starts', ok: true });
  }

  return { ok: true, checks: results };
}

function runCounterRecruitsReportEarlyChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  const powderMap = makeScoutedCounterTestMap('powderBomber');

  const setupPurchase = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.map = opts.map === undefined ? powderMap : opts.map;
    G.round = Math.max(0, Math.floor(Number(opts.round) || 2));
    G.boardingCount = Math.max(0, Math.floor(Number(opts.boardingCount) || 0));
    G.phase = 'shopping';
    G.busy = false;
    G.shopAnimating = false;
    G.enthusiasm = Math.max(0, Math.floor(Number(opts.enthusiasm) || 0));
    G.boardingAlert = Math.max(0, Math.floor(Number(opts.boardingAlert) || 0));
    G.fullCrewDiscount = Math.max(0, Math.floor(Number(opts.fullCrewDiscount) || 0));
    G.shopCreditUsed = !!opts.shopCreditUsed;
    G.res = Object.assign({ wood: 0, stone: 0, gold: 0 }, opts.res || {});
    const islandTarget = opts.islandTarget ? G.allCrew[0] : null;
    if (islandTarget) {
      islandTarget.weaponKey = null;
      islandTarget.might = 0;
      islandTarget.tempo = 0;
    }
    G.hand = islandTarget ? [islandTarget] : [];
    G.sent = islandTarget ? [0] : [];
    G.discard = [];
    const oldTop = G.allCrew[0];
    G.deck = oldTop && !islandTarget ? [oldTop] : [];
    G.shop = [opts.type || 'sawbones'];
    return { G, oldTop: islandTarget ? null : oldTop, islandTarget };
  };

  {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.map = powderMap;
    G.round = 2;
    G.boardingCount = 0;
    G.phase = 'sending';
    G.island = scene.buildIslandState(api.ISLANDS[0]);
    G.shop = ['sawbones'];
    G.enthusiasm = 0;
    G.boardingAlert = 0;
    G.fullCrewDiscount = 0;
    G.shopCreditUsed = false;
    G.sent = [];
    const endLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(0));
    const partialLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(1));
    const fullLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(2, { includePortDrill: true }));
    assertCounterRecruitsReportEarlyCheck(!endLine.includes('top deck') && !endLine.includes('Opening Prep') && !endLine.includes('prepared'), `End-now cash plan should discard without setup perks: ${endLine}`);
    assertCounterRecruitsReportEarlyCheck(partialLine.includes('Opening Counter Prep') && partialLine.includes('Opening Prep -1☠️ +💪') && partialLine.includes('top deck') && !partialLine.includes('prepared'), `partial plan should expose Opening Counter Prep discount and Might: ${partialLine}`);
    assertCounterRecruitsReportEarlyCheck(fullLine.includes('Full Crew -1☠️') && !fullLine.includes('prepared') && fullLine.includes('top deck'), `pre-boarding full-send plan should top-deck without preparation: ${fullLine}`);
    assertCounterRecruitsReportEarlyCheck(endLine.includes('Vs Powder Bomber') && endLine.includes('Ambush 3') && endLine.includes('cut 1 guard') && endLine.includes('+🪨') && !endLine.includes('+2🪨'), `End-now cash plan should show normal bounty only: ${endLine}`);
    assertCounterRecruitsReportEarlyCheck(partialLine.includes('Vs Powder Bomber') && partialLine.includes('Ambush 5') && partialLine.includes('cut 2 guards') && partialLine.includes('+🪨') && !partialLine.includes('+2🪨'), `partial plan should stay normal bounty until Cache Drill: ${partialLine}`);
    assertCounterRecruitsReportEarlyCheck(fullLine.includes('Vs Powder Bomber') && fullLine.includes('Ambush 3') && fullLine.includes('cut 1 guard') && fullLine.includes('+🪨') && !fullLine.includes('+2🪨'), `full-send plan should show normal watched bounty before Boarding 1: ${fullLine}`);
    results.push({ name: 'sending plan separates cash discard, Opening Prep setup, and Full Crew watched counters before Boarding 1', ok: true, endLine, partialLine, fullLine });
  }

  {
    const { G, oldTop } = setupPurchase({
      type: 'herald',
      enthusiasm: 1,
      fullCrewDiscount: 1,
      round: 1,
    });
    const quote = scene.shopPurchaseQuote('herald');
    const directQuote = shopPurchaseQuote(api, G, 'herald');
    assertCounterRecruitsReportEarlyCheck(quote.canBuy && !quote.credit, `opening Full Crew non-counter quote was not affordable normally: ${JSON.stringify(quote)}`);
    assertCounterRecruitsReportEarlyCheck(!quote.counter && !quote.topDeck && !quote.openingFullCrewReport && !quote.openingCommissionReport, `opening non-counter quote incorrectly reported: ${JSON.stringify(quote)}`);
    assertCounterRecruitsReportEarlyCheck(!quote.counterPayoff && !quote.openingCounterPrepMight && !quote.preparedCounter, `opening non-counter gained counter perks: ${JSON.stringify(quote)}`);
    assertCounterRecruitsReportEarlyCheck(!directQuote.topDeck && !directQuote.openingFullCrewReport && !directQuote.counter, `sim helper reported opening non-counter: ${JSON.stringify(directQuote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.type === 'herald', 'opening Full Crew non-counter buy failed');
    assertCounterRecruitsReportEarlyCheck(G.discard.includes(bought), 'opening Full Crew non-counter did not go to discard');
    assertCounterRecruitsReportEarlyCheck(!G.deck.includes(bought), 'opening Full Crew non-counter went to deck');
    assertCounterRecruitsReportEarlyCheck((G.counterWatchIds || []).length === 0, 'opening non-counter report gained Counter Watch');
    assertCounterRecruitsReportEarlyCheck(G.fullCrewDiscount === 0 && G.enthusiasm === 0, `opening report did not spend discount/currency: discount=${G.fullCrewDiscount} enthusiasm=${G.enthusiasm}`);
    prepareNextRoundForSim(api, scene);
    assertCounterRecruitsReportEarlyCheck(!oldTop || G.hand[0] === oldTop, 'opening Full Crew non-counter jumped above the previous deck top');
    assertCounterRecruitsReportEarlyCheck((G.counterWatchIds || []).length === 0, 'opening Full Crew non-counter created Counter Watch after Continue');
    results.push({ name: 'round-1 Full Crew Discount non-counter discards normally without Counter Watch or counter perks', ok: true });
  }

  {
    const { G } = setupPurchase({
      type: 'trainer',
      enthusiasm: 1,
      fullCrewDiscount: 1,
      round: 2,
    });
    const quote = scene.shopPurchaseQuote('trainer');
    assertCounterRecruitsReportEarlyCheck(quote.canBuy && quote.credit && quote.discount === 1 && !quote.topDeck && !quote.openingFullCrewReport, `opening credit non-counter quote mismatch: ${JSON.stringify(quote)}`);
    assertCounterRecruitsReportEarlyCheck(quote.alert === 1 && !quote.counter && !quote.preparedCounter && !quote.openingCounterPrepMight, `opening credit non-counter gained wrong perks/Alert: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(G.discard.includes(bought) && !G.deck.includes(bought), 'Dockside Credit Full Crew non-counter did not go to discard');
    assertCounterRecruitsReportEarlyCheck(G.boardingAlert === 1, `Dockside Credit Full Crew report Alert ${G.boardingAlert} !== 1`);
    assertCounterRecruitsReportEarlyCheck(G.shopCreditUsed === true, 'Dockside Credit Full Crew report did not consume shop credit');
    assertCounterRecruitsReportEarlyCheck((G.counterWatchIds || []).length === 0, 'Dockside Credit non-counter report gained Counter Watch');
    prepareNextRoundForSim(api, scene);
    assertCounterRecruitsReportEarlyCheck((G.counterWatchIds || []).length === 0, 'Dockside Credit Full Crew non-counter created Counter Watch after Continue');
    results.push({ name: 'round-2 Dockside Credit can cover a Full Crew non-counter discard buy and still adds normal Alert', ok: true });
  }

  {
    const { G, oldTop } = setupPurchase({ type: 'needler', enthusiasm: 3, map: makeScoutedCounterTestMap('shellback') });
    const quote = scene.shopPurchaseQuote('needler');
    assertCounterRecruitsReportEarlyCheck(quote.canBuy && quote.counter && quote.topDeck && !quote.openingFullCrewReport && !quote.preparedCounter, `eligible quote was ${JSON.stringify(quote)}`);
    assertCounterRecruitsReportEarlyCheck(quote.counterPayoff && quote.counterPayoff.damage === 3 && quote.counterPayoff.guardsRemoved === 1 && quote.counterPayoff.bountyRes === 'wood', `eligible quote payoff mismatch: ${JSON.stringify(quote.counterPayoff)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.type === 'needler', 'eligible counter buy failed');
    assertCounterRecruitsReportEarlyCheck(G.deck[G.deck.length - 1] === bought, 'eligible counter was not placed on top of deck');
    assertCounterRecruitsReportEarlyCheck((G.counterWatchIds || []).includes(bought.id), 'eligible top-deck counter did not gain Counter Watch');
    assertCounterRecruitsReportEarlyCheck(!bought.weaponKey, `no-discount Needler was prepared with ${bought.weaponKey}`);
    assertCounterRecruitsReportEarlyCheck(!G.discard.includes(bought), 'eligible counter also appeared in discard');
    const drawn = api.drawCards(1)[0];
    assertCounterRecruitsReportEarlyCheck(drawn === bought, 'next draw did not return the bought counter');
    assertCounterRecruitsReportEarlyCheck(!oldTop || G.deck[G.deck.length - 1] === oldTop, 'older deck card did not remain below bought counter');
    results.push({ name: 'eligible nearby non-primary scouted counter top-decks and draws first without discount preparation', ok: true });
  }

  {
    const { G } = setupPurchase({ type: 'needler', enthusiasm: 3, map: makeScoutedCounterTestMap('shellback') });
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck((G.counterWatchIds || []).includes(bought.id), 'Counter Watch setup did not mark bought counter');
    prepareNextRoundForSim(api, scene);
    assertCounterRecruitsReportEarlyCheck(G.hand[0] === bought, 'watched top-deck counter was not drawn next round');
    assertCounterRecruitsReportEarlyCheck((G.counterWatchIds || []).includes(bought.id), 'Counter Watch did not persist after first draw');
    G.phase = 'shopping';
    G.sent = [];
    G.deck = [];
    G.discard = [];
    prepareNextRoundForSim(api, scene);
    assertCounterRecruitsReportEarlyCheck(G.hand[0] === bought, 'held watched counter was not returned to next hand');
    assertCounterRecruitsReportEarlyCheck((G.counterWatchIds || []).includes(bought.id), 'held watched counter lost watch before boarding');
    const zones = [...(G.hand || []), ...(G.deck || []), ...(G.discard || [])].filter(p => p && p.id === bought.id);
    assertCounterRecruitsReportEarlyCheck(zones.length === 1, `held watched counter duplicated across zones ${zones.length} times`);
    results.push({ name: 'Counter Watch keeps a held top-deck counter in the next hand without duplication', ok: true });
  }

  {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.map = powderMap;
    G.phase = 'shopping';
    const cachePirate = { id: 9201, type: 'poisoner', weaponKey: null, might: 0, tempo: 0, wounded: false };
    const shortPirate = { id: 9202, type: 'trainer', weaponKey: null, might: 0, tempo: 0, wounded: false };
    const watchedPirate = { id: 9203, type: 'sawbones', weaponKey: null, might: 0, tempo: 0, wounded: false };
    const shopTop = { id: 9204, type: 'needler', weaponKey: null, might: 0, tempo: 0, wounded: false };
    G.allCrew = [cachePirate, shortPirate, watchedPirate, shopTop];
    G.hand = [cachePirate, shortPirate, watchedPirate];
    G.deck = [shopTop];
    G.discard = [];
    G.sent = [0, 1];
    G.cacheDrillMusterIds = [cachePirate.id];
    G.shortCrewReportIds = [shortPirate.id];
    G.counterWatchIds = [watchedPirate.id];
    prepareNextRoundForSim(api, scene);
    assertCounterRecruitsReportEarlyCheck(G.hand[0] === cachePirate, 'Cache Drill report was not drawn before Counter Watch');
    assertCounterRecruitsReportEarlyCheck(G.hand[1] === shortPirate, 'Short Crew report was not drawn before Counter Watch');
    assertCounterRecruitsReportEarlyCheck(G.hand[2] === watchedPirate, 'Counter Watch was not drawn after report groups');
    assertCounterRecruitsReportEarlyCheck(G.hand[3] === shopTop, 'ordinary shop top-deck card was not drawn after Counter Watch');
    const ids = [cachePirate.id, shortPirate.id, watchedPirate.id, shopTop.id];
    ids.forEach((id) => {
      const zones = [...(G.hand || []), ...(G.deck || []), ...(G.discard || [])].filter(p => p && p.id === id);
      assertCounterRecruitsReportEarlyCheck(zones.length === 1, `draw-priority card ${id} duplicated across zones ${zones.length} times`);
    });
    results.push({ name: 'draw priority is Cache Drill, Short Crew, Counter Watch, then shop top-deck', ok: true });
  }

  {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.map = powderMap;
    G.phase = 'shopping';
    const watchedPirate = { id: 9211, type: 'sawbones', weaponKey: null, might: 0, tempo: 0, wounded: false };
    const fillers = [0, 1, 2, 3, 4].map(i => ({
      id: 9212 + i,
      type: i % 2 === 0 ? 'lumberjack' : 'miner',
      weaponKey: null,
      might: 0,
      tempo: 0,
      wounded: false,
    }));
    G.allCrew = [watchedPirate, ...fillers];
    G.hand = [watchedPirate];
    G.deck = fillers.slice();
    G.discard = [];
    G.sent = [0];
    G.cacheDrillMusterIds = [];
    G.shortCrewReportIds = [];
    G.counterWatchIds = [watchedPirate.id];
    prepareNextRoundForSim(api, scene);
    assertCounterRecruitsReportEarlyCheck(!(G.counterWatchIds || []).includes(watchedPirate.id), 'sent watched counter kept Counter Watch');
    assertCounterRecruitsReportEarlyCheck(G.discard.includes(watchedPirate), 'sent watched counter without report did not go to discard');
    assertCounterRecruitsReportEarlyCheck(!G.hand.includes(watchedPirate), 'sent watched counter without report was drawn as a priority return');
    results.push({ name: 'sending a watched counter spends Counter Watch and discards normally without a report', ok: true });
  }

  {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.map = powderMap;
    G.phase = 'shopping';
    const watchedPirate = { id: 9221, type: 'sawbones', weaponKey: null, might: 0, tempo: 0, wounded: false };
    const shopTop = { id: 9222, type: 'needler', weaponKey: null, might: 0, tempo: 0, wounded: false };
    G.allCrew = [watchedPirate, shopTop];
    G.hand = [watchedPirate];
    G.deck = [shopTop];
    G.discard = [];
    G.sent = [0];
    G.cacheDrillMusterIds = [];
    G.shortCrewReportIds = [watchedPirate.id];
    G.counterWatchIds = [watchedPirate.id];
    prepareNextRoundForSim(api, scene);
    assertCounterRecruitsReportEarlyCheck(G.hand[0] === watchedPirate, 'sent watched counter with Short Crew report did not report early');
    assertCounterRecruitsReportEarlyCheck(G.hand[1] === shopTop, 'reported watched counter did not stay above normal top deck');
    assertCounterRecruitsReportEarlyCheck((G.counterWatchIds || []).includes(watchedPirate.id), 'eligible Counter Short Crew report did not keep Counter Watch');
    const zones = [...(G.hand || []), ...(G.deck || []), ...(G.discard || [])].filter(p => p && p.id === watchedPirate.id);
    assertCounterRecruitsReportEarlyCheck(zones.length === 1, `reported watched counter duplicated across zones ${zones.length} times`);
    results.push({ name: 'sent watched counters with an eligible Short Crew report stay watched without duplicating', ok: true });
  }

  {
    const { G, islandTarget } = setupPurchase({
      type: 'needler',
      enthusiasm: 2,
      fullCrewDiscount: 1,
      boardingCount: 1,
      map: makeScoutedCounterTestMap('deckSniper'),
      islandTarget: true,
    });
    const beforeRes = { ...G.res };
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.weaponKey === 'toxinPistol', `prepared Needler weapon was ${bought && bought.weaponKey}`);
    assertCounterRecruitsReportEarlyCheck(G.deck[G.deck.length - 1] === bought, 'prepared Needler was not placed on top of deck');
    assertCounterRecruitsReportEarlyCheck(G.enthusiasm === 0, `prepared Needler granted ship enthusiasm or failed to spend: ${G.enthusiasm}`);
    assertCounterRecruitsReportEarlyCheck(JSON.stringify(G.res) === JSON.stringify(beforeRes), `prepared Needler changed resources: ${JSON.stringify(G.res)}`);
    assertCounterRecruitsReportEarlyCheck(islandTarget.weaponKey == null && islandTarget.might === 0 && islandTarget.tempo === 0, 'prepared Needler targeted island pirate');
    results.push({ name: 'prepared Needler gets Toxin Pistol without ship output, costs, or island targeting', ok: true });
  }

  {
    const { G } = setupPurchase({ type: 'drummer', enthusiasm: 1, fullCrewDiscount: 1, boardingCount: 1, map: makeScoutedCounterTestMap('netter') });
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.tempo === 1, `prepared Drummer tempo was ${bought && bought.tempo}`);
    assertCounterRecruitsReportEarlyCheck(G.enthusiasm === 0 && G.res.wood === 0, 'prepared Drummer paid ship cost or output');
    results.push({ name: 'prepared Drummer gains +1 Tempo only', ok: true });
  }

  {
    const { G } = setupPurchase({ type: 'trainer', enthusiasm: 2, fullCrewDiscount: 1, boardingCount: 1, map: makeScoutedCounterTestMap('netter') });
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.might === 1, `prepared Trainer might was ${bought && bought.might}`);
    assertCounterRecruitsReportEarlyCheck(G.enthusiasm === 0 && G.res.stone === 0, 'prepared Trainer paid ship cost or output');
    results.push({ name: 'prepared Trainer gains +1 Might only', ok: true });
  }

  {
    const { G } = setupPurchase({ type: 'flagbearer', enthusiasm: 6, fullCrewDiscount: 1, boardingCount: 1, map: makeScoutedCounterTestMap('netter') });
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.might === 1 && bought.tempo === 1, `prepared Flagbearer buffs were might=${bought && bought.might} tempo=${bought && bought.tempo}`);
    assertCounterRecruitsReportEarlyCheck(G.enthusiasm === 0 && G.res.wood === 0 && G.res.stone === 0, 'prepared Flagbearer paid ship costs or output');
    results.push({ name: 'prepared multi-gain counter receives every personal gain only', ok: true });
  }

  {
    const { G } = setupPurchase({ type: 'plagueCaptain', enthusiasm: 9, fullCrewDiscount: 1, boardingCount: 1, map: makeScoutedCounterTestMap('shellback') });
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.weaponKey === 'toxinPistol' && bought.might === 1, `prepared Plague Captain gains were weapon=${bought && bought.weaponKey} might=${bought && bought.might}`);
    assertCounterRecruitsReportEarlyCheck(G.enthusiasm === 0 && G.res.gold === 0, 'prepared Plague Captain paid ship cost or output');
    results.push({ name: 'prepared mixed weapon/buff counter receives all personal gains only', ok: true });
  }

  {
    const { G } = setupPurchase({ type: 'trainer', enthusiasm: 3 });
    const quote = scene.shopPurchaseQuote('trainer');
    assertCounterRecruitsReportEarlyCheck(!quote.counter && !quote.topDeck && !quote.openingFullCrewReport && !quote.counterPayoff, `non-counter quote exposed report/payoff: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.type === 'trainer', 'non-counter buy failed');
    assertCounterRecruitsReportEarlyCheck(G.discard.includes(bought), 'non-counter did not go to discard');
    assertCounterRecruitsReportEarlyCheck(!G.deck.includes(bought), 'non-counter went to deck');
    assertCounterRecruitsReportEarlyCheck((bought.might || 0) === 0, `non-counter was prepared with might=${bought.might}`);
    results.push({ name: 'non-counter purchases still go to discard', ok: true });
  }

  {
    const { G } = setupPurchase({
      type: 'sawbones',
      enthusiasm: 3,
      map: makeDistantScoutedCounterTestMap('powderBomber'),
    });
    const quote = scene.shopPurchaseQuote('sawbones');
    assertCounterRecruitsReportEarlyCheck(quote.counter && !quote.topDeck, `distant quote was ${JSON.stringify(quote)}`);
    assertCounterRecruitsReportEarlyCheck(quote.counterPayoff && quote.counterPayoff.damage === 3 && quote.counterPayoff.guardsRemoved === 1 && quote.counterPayoff.bountyRes === 'stone', `distant counter quote payoff mismatch: ${JSON.stringify(quote.counterPayoff)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(G.discard.includes(bought), 'distant counter did not go to discard');
    assertCounterRecruitsReportEarlyCheck(!G.deck.includes(bought), 'distant counter went to deck');
    assertCounterRecruitsReportEarlyCheck(!bought.weaponKey, `distant counter was prepared with ${bought.weaponKey}`);
    results.push({ name: 'counter purchases more than 3 turns from ship still go to discard', ok: true });
  }

  {
    const { G } = setupPurchase({
      type: 'sawbones',
      enthusiasm: 3,
      map: { layers: [[{ id: 1, type: 'island', islandIdx: 0, conns: [] }]], visited: [1], currentNodeId: 1, currentLayer: 0 },
    });
    const quote = scene.shopPurchaseQuote('sawbones');
    assertCounterRecruitsReportEarlyCheck(!quote.counter && !quote.counterPayoff, `no-ship quote exposed payoff: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(G.discard.includes(bought), 'no-ship purchase did not go to discard');
    assertCounterRecruitsReportEarlyCheck(!G.deck.includes(bought), 'no-ship purchase went to deck');
    assertCounterRecruitsReportEarlyCheck(!bought.weaponKey, `no-ship purchase was prepared with ${bought.weaponKey}`);
    results.push({ name: 'purchases with no scouted ship still go to discard', ok: true });
  }

  {
    const { G } = setupPurchase({
      type: 'sawbones',
      enthusiasm: 3,
      mode: 'battleTest',
    });
    const quote = scene.shopPurchaseQuote('sawbones');
    assertCounterRecruitsReportEarlyCheck(!quote.counter && !quote.counterPayoff, `Battle Test quote exposed payoff: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(G.discard.includes(bought), 'Battle Test purchase did not go to discard');
    assertCounterRecruitsReportEarlyCheck(!G.deck.includes(bought), 'Battle Test purchase went to deck');
    assertCounterRecruitsReportEarlyCheck((G.counterWatchIds || []).length === 0, 'Battle Test purchase created Counter Watch');
    assertCounterRecruitsReportEarlyCheck(!bought.weaponKey, `Battle Test purchase was prepared with ${bought.weaponKey}`);
    results.push({ name: 'Battle Test purchases still go to discard', ok: true });
  }

  {
    const { G } = setupPurchase({
      type: 'needler',
      map: makeScoutedCounterTestMap('shellback'),
      enthusiasm: 1,
      boardingAlert: 1,
    });
    const quote = scene.shopPurchaseQuote('needler');
    assertCounterRecruitsReportEarlyCheck(quote.canBuy && quote.credit && quote.topDeck && !quote.preparedCounter && quote.alert === 2, `credit quote was ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(G.deck[G.deck.length - 1] === bought, 'credit counter was not placed on top of deck');
    assertCounterRecruitsReportEarlyCheck(!bought.weaponKey, `no-discount credit counter was prepared: ${bought.weaponKey}`);
    assertCounterRecruitsReportEarlyCheck(G.enthusiasm === 0, `credit did not spend all enthusiasm: ${G.enthusiasm}`);
    assertCounterRecruitsReportEarlyCheck(G.boardingAlert === 3, `credit Alert ${G.boardingAlert} !== 3`);
    assertCounterRecruitsReportEarlyCheck(G.shopCreditUsed === true, 'credit flag was not consumed');
    results.push({ name: 'eligible Dockside Credit counter top-decks without discount preparation and still adds Alert', ok: true });
  }

  {
    const { G } = setupPurchase({
      type: 'sawbones',
      enthusiasm: 0,
      fullCrewDiscount: 1,
      boardingCount: 1,
      boardingAlert: 1,
    });
    const quote = scene.shopPurchaseQuote('sawbones');
    assertCounterRecruitsReportEarlyCheck(quote.canBuy && quote.credit && quote.discount === 1 && quote.topDeck && quote.preparedCounter && quote.alert === 2, `discount credit quote was ${JSON.stringify(quote)}`);
    assertCounterRecruitsReportEarlyCheck(quote.counterPayoff && quote.counterPayoff.damage === 5 && quote.counterPayoff.guardsRemoved === 2, `discount credit quote payoff mismatch: ${JSON.stringify(quote.counterPayoff)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(G.deck[G.deck.length - 1] === bought, 'discount credit counter was not placed on top of deck');
    assertCounterRecruitsReportEarlyCheck(bought.weaponKey === 'barbedBlade', `discount credit counter was not prepared: ${bought.weaponKey}`);
    assertCounterRecruitsReportEarlyCheck(G.enthusiasm === 0, `discount credit did not spend all enthusiasm: ${G.enthusiasm}`);
    assertCounterRecruitsReportEarlyCheck(G.boardingAlert === 3, `discount credit Alert ${G.boardingAlert} !== 3`);
    assertCounterRecruitsReportEarlyCheck(G.fullCrewDiscount === 0, 'discount credit did not consume Full Crew Discount');
    assertCounterRecruitsReportEarlyCheck(G.shopCreditUsed === true, 'discount credit flag was not consumed');
    results.push({ name: 'Full Crew Discount plus Dockside Credit prepares an eligible top-deck counter', ok: true });
  }

  {
    const { G } = setupPurchase({
      type: 'sawbones',
      enthusiasm: 2,
      fullCrewDiscount: 1,
      boardingCount: 1,
    });
    const quote = scene.shopPurchaseQuote('sawbones');
    assertCounterRecruitsReportEarlyCheck(quote.canBuy && quote.discount === 1 && quote.topDeck && quote.preparedCounter, `discount quote was ${JSON.stringify(quote)}`);
    assertCounterRecruitsReportEarlyCheck(quote.counterPayoff && quote.counterPayoff.damage === 5 && quote.counterPayoff.guardsRemoved === 2, `discount quote payoff mismatch: ${JSON.stringify(quote.counterPayoff)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(G.deck[G.deck.length - 1] === bought, 'discount counter was not placed on top of deck');
    assertCounterRecruitsReportEarlyCheck(bought.weaponKey === 'barbedBlade', `discount counter was not prepared: ${bought.weaponKey}`);
    assertCounterRecruitsReportEarlyCheck(G.enthusiasm === 0, `discount spend left ${G.enthusiasm} enthusiasm`);
    assertCounterRecruitsReportEarlyCheck(G.fullCrewDiscount === 0, 'discount was not consumed');
    results.push({ name: 'Full Crew Discount prepares eligible top-deck buys', ok: true });
  }

  {
    const { G } = setupPurchase({
      type: 'herald',
      enthusiasm: 4,
      fullCrewDiscount: 1,
      boardingCount: 1,
    });
    G.shop = ['herald', 'sawbones'];
    const firstQuote = scene.shopPurchaseQuote('herald');
    assertCounterRecruitsReportEarlyCheck(firstQuote.canBuy && firstQuote.discount === 1 && !firstQuote.topDeck && !firstQuote.preparedCounter, `non-counter quote was ${JSON.stringify(firstQuote)}`);
    const first = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(first && first.type === 'herald', 'discount non-counter buy failed');
    assertCounterRecruitsReportEarlyCheck(G.discard.includes(first) && !G.deck.includes(first), 'post-boarding discount non-counter did not go to discard');
    assertCounterRecruitsReportEarlyCheck(G.fullCrewDiscount === 0, 'non-counter buy did not consume Full Crew Discount');
    assertCounterRecruitsReportEarlyCheck(G.enthusiasm === 3, `non-counter discount spend left ${G.enthusiasm} enthusiasm`);
    const quote = scene.shopPurchaseQuote('sawbones');
    assertCounterRecruitsReportEarlyCheck(quote.canBuy && quote.topDeck && !quote.preparedCounter && quote.discount === 0, `post-discount counter quote was ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.type === 'sawbones', 'post-discount counter buy failed');
    assertCounterRecruitsReportEarlyCheck(G.deck[G.deck.length - 1] === bought, 'post-discount counter was not placed on top of deck');
    assertCounterRecruitsReportEarlyCheck(!bought.weaponKey, `post-discount counter was prepared: ${bought.weaponKey}`);
    results.push({ name: 'spending Full Crew Discount on a non-counter prevents later top-deck preparation', ok: true });
  }

  {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.map = makeScoutedCounterTestMap('powderBomber');
    G.phase = 'map';
    G.counterWatchIds = [G.allCrew[0].id];
    scene.applyMapNodeSelection(2);
    assertCounterRecruitsReportEarlyCheck(G.phase === 'boarding', 'ship selection did not start boarding');
    assertCounterRecruitsReportEarlyCheck((G.counterWatchIds || []).length === 0, 'boarding start did not clear Counter Watch');
    results.push({ name: 'boarding start clears stale Counter Watch markers', ok: true });
  }

  return { ok: true, checks: results };
}

function runAlertTierChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];

  const expectedCounts = [
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [10, 3],
  ];
  expectedCounts.forEach(([alert, expected]) => {
    const actual = scene.boardingAlertGuardCount(alert);
    assertAlertTierCheck(actual === expected, `Alert ${alert} guard count ${actual} !== ${expected}`);
    results.push({ name: `Alert ${alert} guard count`, ok: true, actual });
  });

  const rosters = [
    [1, ['cabinBoy']],
    [2, ['cabinBoy', 'bilgeRat']],
    [3, ['cabinBoy', 'bilgeRat', 'cabinBoy']],
  ];
  rosters.forEach(([guardCount, expected]) => {
    const actual = scene.boardingAlertGuardArchetypes(guardCount).map((a) => a.key);
    assertAlertTierCheck(JSON.stringify(actual) === JSON.stringify(expected), `guard ${guardCount} roster ${actual.join(',')} !== ${expected.join(',')}`);
    const plunder = scene.boardingAlertGuardPlunder(guardCount);
    const expectedWood = guardCount === 3 ? 2 : 1;
    const expectedStone = guardCount >= 2 ? 1 : 0;
    assertAlertTierCheck(plunder.wood === expectedWood, `guard ${guardCount} wood ${plunder.wood} !== ${expectedWood}`);
    assertAlertTierCheck(plunder.stone === expectedStone, `guard ${guardCount} stone ${plunder.stone} !== ${expectedStone}`);
    results.push({ name: `guard ${guardCount} roster and plunder`, ok: true, actual, plunder });
  });

  api.initState();
  const G = api.getG();
  G.mode = 'run';
  G.round = 2;
  G.boardingCount = 0;
  G.phase = 'sending';
  G.island = scene.buildIslandState(api.ISLANDS[3]);
  G.sent = [];
  G.boardingAlert = 0;
  G.fullCrewDiscount = 0;
  scene._sendingToIsland.clear();

  const endLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(0));
  const fillLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(3, { includePortDrill: true }));
  assertAlertTierCheck(endLine.includes('+4☠️ Wages'), `End now line misses +4 wages: ${endLine}`);
  assertAlertTierCheck(endLine.includes('Alert +3'), `End now line misses Alert +3: ${endLine}`);
  assertAlertTierCheck(endLine.includes('+2 guards'), `End now line misses two-guard tier: ${endLine}`);
  assertAlertTierCheck(endLine.includes('win +🪵 +🪨'), `End now line misses alert plunder: ${endLine}`);
  assertAlertTierCheck(fillLine.includes('Alert +0'), `Fill crew line misses Alert +0: ${fillLine}`);
  assertAlertTierCheck(fillLine.includes('Full Crew -1☠️'), `Fill crew line misses Full Crew Discount: ${fillLine}`);
  assertAlertTierCheck(fillLine.includes('Port Drill +⚡'), `Fill crew line misses Port Drill: ${fillLine}`);
  assertAlertTierCheck(!/Alert \+0 \([^)]*win \+/.test(fillLine), `Fill crew line implies alert plunder: ${fillLine}`);
  results.push({ name: 'round 2 Port plan text', ok: true, endLine, fillLine });

  return { ok: true, checks: results };
}

function assertBoardingTrophyCheck(condition, message) {
  if (!condition) throw new Error(`boarding trophy check failed: ${message}`);
}

function runBoardingTrophyChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];

  const fighterFor = (pirate, row, rowOrder, alive = true) => ({
    id: `player_${pirate.id}`,
    side: 'player',
    pirateId: pirate.id,
    type: pirate.type,
    row,
    rowOrder,
    alive,
    hp: alive ? 5 : 0,
    maxHp: 9,
    damage: 3,
    attackMs: 1350,
    attackRange: 'melee',
  });

  const setupRegular = (guardCount = 0) => {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.phase = 'boarding';
    G.busy = false;
    G.enemyShip = { strength: 6, encounterNo: 1 };
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.discard = [];
    G.deck = [];
    const pirates = G.allCrew.slice(0, 4);
    pirates.forEach((pirate) => {
      pirate.might = 0;
      pirate.wounded = false;
    });
    G.hand = pirates.slice(0, 3);
    G.combat = {
      mode: 'fighting',
      playerFighters: [
        fighterFor(pirates[0], 1, 0),
        fighterFor(pirates[1], 0, 1),
        fighterFor(pirates[2], 0, 0),
      ],
      enemyFighters: [],
      boardingAlertGuards: guardCount,
      returnedPirateIds: [],
    };
    return { G, pirates };
  };

  {
    const { G, pirates } = setupRegular(2);
    const result = finishSimBoardingWin(api, scene);
    assertBoardingTrophyCheck(result.state === 'continue', `regular win state ${result.state}`);
    assertBoardingTrophyCheck((pirates[2].might || 0) === 1, 'front-left survivor did not gain Might');
    assertBoardingTrophyCheck((pirates[0].might || 0) === 0 && (pirates[1].might || 0) === 0, 'wrong survivor gained Might');
    assertBoardingTrophyCheck(G.phase === 'map', 'regular win did not continue to map');
    assertBoardingTrophyCheck(G.res.wood === 1 && G.res.stone === 1, `guard plunder was not preserved: ${JSON.stringify(G.res)}`);
    results.push({ name: 'regular win grants front-left survivor trophy and guard plunder', ok: true, target: pirates[2].id, res: { ...G.res } });
  }

  {
    const { G, pirates } = setupRegular(0);
    scene.finishBoardingCombat('win');
    scene.finishBoardingCombat('win');
    scene.grantBoardingTrophy(G.combat);
    assertBoardingTrophyCheck((pirates[2].might || 0) === 1, `idempotent trophy gave ${pirates[2].might || 0}`);
    assertBoardingTrophyCheck(!!G.combat.boardingTrophyGranted, 'combat did not record trophy grant');
    results.push({ name: 'trophy is idempotent on resolved combat', ok: true, might: pirates[2].might || 0 });
  }

  {
    const { G, pirates } = setupRegular(0);
    scene.finishBoardingCombat('loss');
    assertBoardingTrophyCheck(pirates.every((pirate) => (pirate.might || 0) === 0), 'loss granted trophy');
    assertBoardingTrophyCheck(!G.combat.boardingTrophy, 'loss stored trophy data');
    results.push({ name: 'loss grants no trophy', ok: true });
  }

  {
    const { G, pirates } = setupRegular(0);
    G.combat.playerFighters = G.combat.playerFighters.map((fighter) => ({ ...fighter, alive: false, hp: 0 }));
    scene.finishBoardingCombat('win');
    assertBoardingTrophyCheck(pirates.every((pirate) => (pirate.might || 0) === 0), 'all-defeated win granted trophy');
    assertBoardingTrophyCheck(!G.combat.boardingTrophy, 'all-defeated win stored trophy data');
    results.push({ name: 'win with no survivor grants no trophy', ok: true });
  }

  {
    api.initBattleTestState();
    const G = api.getG();
    const pirate = G.hand[0];
    pirate.might = 0;
    G.combat = {
      mode: 'fighting',
      playerFighters: [fighterFor(pirate, 0, 0)],
      enemyFighters: [],
      boardingAlertGuards: 3,
      returnedPirateIds: [],
    };
    scene.finishBoardingCombat('win');
    assertBoardingTrophyCheck((pirate.might || 0) === 0, 'Battle Test granted trophy');
    assertBoardingTrophyCheck(!G.combat.boardingTrophy, 'Battle Test stored trophy data');
    results.push({ name: 'Battle Test grants no trophy', ok: true });
  }

  {
    const { G, pirates } = setupRegular(0);
    const oldHandPirate = pirates[0];
    const finalHandPirate = pirates[3];
    oldHandPirate.might = 0;
    finalHandPirate.might = 0;
    G.discard = [oldHandPirate];
    G.hand = [finalHandPirate];
    G.combat.playerFighters = [fighterFor(finalHandPirate, 0, 0)];
    scene.finishBoardingCombat('win');
    assertBoardingTrophyCheck((finalHandPirate.might || 0) === 1, 'final reinforcement hand survivor did not gain trophy');
    assertBoardingTrophyCheck((oldHandPirate.might || 0) === 0, 'previous defeated hand gained trophy');
    results.push({ name: 'reinforcement win rewards only final combat hand', ok: true, target: finalHandPirate.id });
  }

  return { ok: true, checks: results };
}

function assertCounterTrophyCheck(condition, message) {
  if (!condition) throw new Error(`counter trophy check failed: ${message}`);
}

function runCounterTrophyChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];

  const fighterFor = (pirate, row, rowOrder, alive = true) => ({
    id: `player_${pirate.id}`,
    side: 'player',
    pirateId: pirate.id,
    type: pirate.type,
    row,
    rowOrder,
    alive,
    hp: alive ? 5 : 0,
    maxHp: 9,
    damage: 3,
    attackMs: 1350,
    attackRange: 'melee',
  });

  const setupRegular = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.phase = 'boarding';
    G.busy = false;
    G.enemyShip = {
      strength: 6,
      encounterNo: 1,
      encounter: {
        mainKey: opts.mainKey || 'powderBomber',
        supportKeys: ['bilgeRat', 'cabinBoy'],
        totalCount: 3,
      },
    };
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.discard = [];
    G.deck = [];
    const pirates = G.allCrew.slice(0, 5);
    const types = opts.types || ['poisoner', 'sawbones', 'scarwright', 'drummer', 'trainer'];
    pirates.forEach((pirate, i) => {
      pirate.type = types[i] || pirate.type;
      pirate.might = 0;
      pirate.tempo = 0;
      pirate.wounded = false;
    });
    G.hand = pirates.slice(0, 3);
    G.combat = {
      mode: 'fighting',
      playerFighters: opts.playerFighters
        ? opts.playerFighters(pirates, fighterFor)
        : [
          fighterFor(pirates[0], 0, 0),
          fighterFor(pirates[1], 0, 1),
          fighterFor(pirates[2], 1, 0),
        ],
      enemyFighters: [],
      boardingAlertGuards: opts.guardCount || 0,
      returnedPirateIds: [],
    };
    return { G, pirates };
  };

  {
    const { G, pirates } = setupRegular({ guardCount: 2 });
    scene.finishBoardingCombat('win');
    assertCounterTrophyCheck((pirates[0].might || 0) === 1, 'Boarding Trophy did not stack on front survivor');
    assertCounterTrophyCheck((pirates[1].tempo || 0) === 1, 'front-left matching counter did not gain Tempo');
    assertCounterTrophyCheck((pirates[2].tempo || 0) === 0, 'back-row counter gained Tempo over front-row counter');
    assertCounterTrophyCheck(G.res.wood === 1 && G.res.stone === 1, `Alert plunder did not stack: ${JSON.stringify(G.res)}`);
    assertCounterTrophyCheck(G.combat.counterTrophy && G.combat.counterTrophy.pirateId === pirates[1].id, 'combat did not record the correct counter trophy target');
    results.push({ name: 'regular win grants front-left matching counter trophy with other win rewards', ok: true, target: pirates[1].id, res: { ...G.res } });
  }

  {
    const { G, pirates } = setupRegular();
    scene.finishBoardingCombat('win');
    scene.finishBoardingCombat('win');
    scene.grantCounterTrophy(G.combat);
    assertCounterTrophyCheck((pirates[1].tempo || 0) === 1, `idempotent counter trophy gave ${pirates[1].tempo || 0}`);
    assertCounterTrophyCheck(!!G.combat.counterTrophyGranted, 'combat did not record counter trophy grant attempt');
    results.push({ name: 'counter trophy is idempotent on resolved combat', ok: true, tempo: pirates[1].tempo || 0 });
  }

  {
    const { G, pirates } = setupRegular({
      mainKey: 'deckSniper',
      types: ['poisoner', 'sawbones', 'scarwright'],
    });
    scene.finishBoardingCombat('win');
    assertCounterTrophyCheck(pirates.every((pirate) => (pirate.tempo || 0) === 0), 'no-counter win granted Tempo');
    assertCounterTrophyCheck(!G.combat.counterTrophy, 'no-counter win stored counter trophy data');
    results.push({ name: 'regular win with no matching counter grants no counter trophy', ok: true });
  }

  {
    const { G, pirates } = setupRegular({
      playerFighters: (crew, makeFighter) => [
        makeFighter(crew[0], 0, 0),
        makeFighter(crew[1], 0, 1, false),
      ],
    });
    scene.finishBoardingCombat('win');
    assertCounterTrophyCheck(pirates.every((pirate) => (pirate.tempo || 0) === 0), 'defeated matching counter gained Tempo');
    assertCounterTrophyCheck(!G.combat.counterTrophy, 'defeated-counter win stored counter trophy data');
    results.push({ name: 'defeated matching counter is not eligible', ok: true });
  }

  {
    const { G, pirates } = setupRegular();
    scene.finishBoardingCombat('loss');
    assertCounterTrophyCheck(pirates.every((pirate) => (pirate.tempo || 0) === 0), 'loss granted counter trophy');
    assertCounterTrophyCheck(!G.combat.counterTrophy, 'loss stored counter trophy data');
    results.push({ name: 'loss grants no counter trophy', ok: true });
  }

  {
    api.initBattleTestState();
    const G = api.getG();
    G.enemyShip = {
      strength: 6,
      encounterNo: 1,
      encounter: { mainKey: 'powderBomber', supportKeys: [], totalCount: 1 },
    };
    const pirate = G.hand[0];
    pirate.type = 'sawbones';
    pirate.tempo = 0;
    G.combat = {
      mode: 'fighting',
      playerFighters: [fighterFor(pirate, 0, 0)],
      enemyFighters: [],
      boardingAlertGuards: 0,
      returnedPirateIds: [],
    };
    scene.finishBoardingCombat('win');
    assertCounterTrophyCheck((pirate.tempo || 0) === 0, 'Battle Test granted counter trophy');
    assertCounterTrophyCheck(!G.combat.counterTrophy, 'Battle Test stored counter trophy data');
    results.push({ name: 'Battle Test grants no counter trophy', ok: true });
  }

  return { ok: true, checks: results };
}

function assertCounterEdgeCheck(condition, message) {
  if (!condition) throw new Error(`counter edge check failed: ${message}`);
}

function runCounterEdgeChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];

  const setupRegular = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.phase = 'boarding';
    G.busy = false;
    G.enemyShip = {
      strength: 6,
      encounterNo: 1,
      encounter: {
        mainKey: opts.mainKey || 'deckSniper',
        supportKeys: ['bilgeRat', 'cabinBoy'],
        totalCount: 3,
      },
    };
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.discard = [];
    G.deck = [];
    G.sent = [];
    const pirates = G.allCrew.slice(0, 5);
    const types = opts.types || ['needler', 'sawbones', 'bandmaster', 'poisoner', 'trainer'];
    pirates.forEach((pirate, i) => {
      pirate.type = types[i] || pirate.type;
      pirate.weaponKey = null;
      pirate.might = 0;
      pirate.tempo = 0;
      pirate.wounded = false;
    });
    G.hand = pirates.slice(0, opts.handCount || 3);
    G.combat = {
      mode: opts.combatMode || 'setup',
      encounterMainKey: opts.combatMainKey || null,
      enemyParty: [],
      playerSetupRows: [G.hand.map((pirate) => pirate.id), [], []],
      enemySetupRows: [],
      playerFighters: null,
      enemyFighters: [],
      boardingAlertGuards: 0,
      returnedPirateIds: [],
    };
    return { G, pirates, combat: G.combat };
  };

  const normalDamageFor = (pirate) => {
    const weapon = scene.combatWeaponByKey(pirate && pirate.weaponKey);
    const baseDamage = Number(api.COMBAT.pirateDamage) || 0;
    const might = Math.max(0, Math.floor(Number(pirate && pirate.might) || 0));
    const tempo = Math.max(0, Math.floor(Number(pirate && pirate.tempo) || 0));
    const buffCount = might + tempo;
    let damage = scene.combatWeaponBaseDamage(baseDamage, weapon) + might;
    if (weapon && weapon.damagePerBuff) damage += buffCount * weapon.damagePerBuff;
    return Math.max(0, Math.floor(damage));
  };

  {
    const { pirates, combat } = setupRegular();
    const needler = pirates[0];
    needler.weaponKey = 'officerSabre';
    needler.might = 2;
    needler.tempo = 1;
    const normalDamage = normalDamageFor(needler);
    const stats = scene.combatPirateStats(needler, combat);
    assertCounterEdgeCheck(stats.counterEdgeDamage === 1, `Needler edge ${stats.counterEdgeDamage} !== 1`);
    assertCounterEdgeCheck(stats.damage === normalDamage + 1, `Needler damage ${stats.damage} !== ${normalDamage + 1}`);
    assertCounterEdgeCheck(stats.might === 2 && stats.tempo === 1 && stats.buffCount === 3, `Needler buffs mutated in stats ${JSON.stringify(stats)}`);
    assertCounterEdgeCheck(needler.might === 2 && needler.tempo === 1, 'Needler stored buffs changed');
    const fighter = scene.buildPlayerCombatFighter(needler, 0, 0, combat);
    assertCounterEdgeCheck(fighter.counterEdgeDamage === 1, `fighter edge ${fighter.counterEdgeDamage} !== 1`);
    assertCounterEdgeCheck(scene.combatFighterDescription(fighter).includes('Counter Edge +1 damage'), 'fighter detail lacks Counter Edge text');
    results.push({ name: 'regular Deck Sniper boarding gives Needler exactly +1 combat damage without mutating buffs', ok: true, normalDamage, edgeDamage: stats.damage });
  }

  {
    const { pirates, combat } = setupRegular();
    const sawbones = pirates[1];
    sawbones.weaponKey = 'barbedBlade';
    sawbones.might = 1;
    sawbones.tempo = 1;
    const normalDamage = normalDamageFor(sawbones);
    const stats = scene.combatPirateStats(sawbones, combat);
    assertCounterEdgeCheck(stats.counterEdgeDamage === 0, `non-counter edge ${stats.counterEdgeDamage} !== 0`);
    assertCounterEdgeCheck(stats.damage === normalDamage, `non-counter damage ${stats.damage} !== ${normalDamage}`);
    assertCounterEdgeCheck(!scene.combatFighterDescription({ ...stats, id: 'x', side: 'player', type: sawbones.type }).includes('Counter Edge'), 'non-counter detail shows Counter Edge');
    results.push({ name: 'non-counter in the same boarding receives no Counter Edge', ok: true, damage: stats.damage });
  }

  {
    const { G, pirates, combat } = setupRegular({ mode: 'battleTest' });
    const needler = pirates[0];
    needler.weaponKey = 'toxinPistol';
    needler.might = 2;
    const normalDamage = normalDamageFor(needler);
    const stats = scene.combatPirateStats(needler, combat);
    assertCounterEdgeCheck(G.mode === 'battleTest', 'Battle Test setup mode mismatch');
    assertCounterEdgeCheck(stats.counterEdgeDamage === 0, `Battle Test edge ${stats.counterEdgeDamage} !== 0`);
    assertCounterEdgeCheck(stats.damage === normalDamage, `Battle Test damage ${stats.damage} !== ${normalDamage}`);
    results.push({ name: 'Battle Test excludes Counter Edge even for matching counters', ok: true, damage: stats.damage });
  }

  {
    const { pirates, combat } = setupRegular();
    const needler = pirates[0];
    needler.weaponKey = 'bannerAxe';
    needler.might = 1;
    needler.tempo = 1;
    const stats = scene.combatPirateStats(needler, combat);
    assertCounterEdgeCheck(stats.counterEdgeDamage === 1, 'Banner Axe counter did not get edge damage');
    assertCounterEdgeCheck(stats.buffCount === 2, `edge changed buff count to ${stats.buffCount}`);
    assertCounterEdgeCheck(stats.targetMode === 'frontBand', `edge counted toward Banner Axe threshold: ${stats.targetMode}`);
    assertCounterEdgeCheck(stats.damage === normalDamageFor(needler) + 1, `Banner Axe damage ${stats.damage} did not stack normally`);
    results.push({ name: 'Counter Edge stacks with weapon/Might damage but not buff-count thresholds', ok: true, damage: stats.damage, targetMode: stats.targetMode });
  }

  {
    const { pirates, combat } = setupRegular();
    const needler = pirates[0];
    needler.weaponKey = 'toxinPistol';
    needler.wounded = true;
    const stats = scene.combatPirateStats(needler, combat);
    const fighters = scene.buildPlayerCombatFighters([[needler.id], [], []], combat);
    assertCounterEdgeCheck(stats.counterEdgeDamage === 0, `wounded edge ${stats.counterEdgeDamage} !== 0`);
    assertCounterEdgeCheck(fighters.length === 0, `wounded pirate built ${fighters.length} fighters`);
    results.push({ name: 'wounded matching counters sit out and receive no Counter Edge fighter', ok: true });
  }

  {
    const { G, pirates, combat } = setupRegular({ combatMode: 'fighting', handCount: 1 });
    const oldPirate = pirates[1];
    const reinforcement = pirates[0];
    oldPirate.type = 'sawbones';
    oldPirate.wounded = true;
    reinforcement.type = 'needler';
    reinforcement.weaponKey = 'toxinPistol';
    reinforcement.might = 1;
    assertCounterEdgeCheck(reinforcement.might === 1, `reinforcement setup Might ${reinforcement.might} !== 1`);
    G.hand = [oldPirate];
    G.deck = [reinforcement];
    G.discard = [];
    combat.playerSetupRows = [[oldPirate.id], [], []];
    combat.playerFighters = [];
    combat.enemyFighters = [{
      id: 'dummy_enemy',
      side: 'enemy',
      row: 0,
      rowOrder: 0,
      alive: true,
      hp: 99,
      maxHp: 99,
      damage: 0,
      attackMs: 999999,
      attackRange: 'melee',
    }];
    assertCounterEdgeCheck(scene.drawBoardingReinforcements(combat), 'failed to draw reinforcement hand');
    const fighter = (combat.playerFighters || []).find((candidate) => candidate && candidate.pirateId === reinforcement.id);
    assertCounterEdgeCheck(!!fighter, 'reinforcement Needler was not built as a fighter');
    assertCounterEdgeCheck(fighter.counterEdgeDamage === 1, `reinforcement edge ${fighter.counterEdgeDamage} !== 1`);
    assertCounterEdgeCheck(reinforcement.might === 1, `reinforcement stored Might changed to ${reinforcement.might}`);
    assertCounterEdgeCheck(fighter.damage === 5, `reinforcement damage ${fighter.damage} !== 5`);
    results.push({ name: 'reinforcement hands keep the same boarding Counter Edge', ok: true, damage: fighter.damage });
  }

  return { ok: true, checks: results };
}

function assertCounterAmbushCheck(condition, message) {
  if (!condition) throw new Error(`counter ambush check failed: ${message}`);
}

function runCounterAmbushChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];

  const enemyFor = (key, row, rowOrder, idSuffix = 0) => {
    const archetype = api.COMBAT.enemyArchetypes.find((entry) => entry && entry.key === key);
    assertCounterAmbushCheck(!!archetype, `missing archetype ${key}`);
    const member = scene.buildCombatEnemyMember(archetype, `${key}_ambush_${idSuffix}`);
    return scene.buildEnemyCombatFighter(member, row, rowOrder);
  };

  const alertGuardFor = (key, row, rowOrder, idSuffix = 0) => {
    const archetype = api.COMBAT.enemyArchetypes.find((entry) => entry && entry.key === key);
    assertCounterAmbushCheck(!!archetype, `missing alert guard archetype ${key}`);
    const member = scene.buildCombatEnemyMember(
      archetype,
      `alertGuard_${key}_ambush_${idSuffix}`,
      { alertGuard: true }
    );
    return scene.buildEnemyCombatFighter(member, row, rowOrder);
  };

  const fighterFor = (pirate, row, rowOrder, combat) =>
    scene.buildPlayerCombatFighter(pirate, row, rowOrder, combat);

  const setupRegular = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.phase = 'boarding';
    G.busy = false;
    const encounterNo = Math.max(1, Math.floor(Number(opts.encounterNo) || 1));
    G.boardingCount = Math.max(0, Math.floor(Number(opts.boardingCount != null ? opts.boardingCount : encounterNo) || 0));
    G.enemyShip = {
      strength: 6,
      encounterNo,
      encounter: {
        mainKey: opts.mainKey || 'powderBomber',
        supportKeys: [],
        totalCount: 1,
      },
    };
    const pirates = G.allCrew.slice(0, 5);
    const types = opts.types || ['sawbones', 'needler', 'bandmaster', 'poisoner', 'trainer'];
    const pirateUpgrades = Array.isArray(opts.pirateUpgrades) ? opts.pirateUpgrades : [];
    pirates.forEach((pirate, i) => {
      pirate.type = types[i] || pirate.type;
      pirate.weaponKey = null;
      pirate.might = 0;
      pirate.tempo = 0;
      pirate.wounded = false;
      const upgrade = pirateUpgrades[i] || {};
      if (upgrade.weaponKey !== undefined) pirate.weaponKey = upgrade.weaponKey || null;
      if (upgrade.might !== undefined) pirate.might = Math.max(0, Math.floor(Number(upgrade.might) || 0));
      if (upgrade.tempo !== undefined) pirate.tempo = Math.max(0, Math.floor(Number(upgrade.tempo) || 0));
    });
    G.hand = pirates.slice(0, opts.handCount || 3);
    G.deck = [];
    G.discard = [];
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.combat = {
      mode: 'fighting',
      encounterMainKey: opts.combatMainKey || null,
      enemyParty: [],
      playerFighters: [],
      enemyFighters: [],
      boardingAlert: Math.max(0, Math.floor(Number(opts.boardingAlert) || 0)),
      boardingAlertGuards: Math.max(0, Math.floor(Number(opts.guardCount) || 0)),
      returnedPirateIds: [],
      reinforcementCount: Math.max(0, Math.floor(Number(opts.reinforcementCount) || 0)),
    };
    const watchReadyCounterIds = (Array.isArray(opts.watchReadyIndices) ? opts.watchReadyIndices : [])
      .map(index => pirates[Math.max(0, Math.floor(Number(index) || 0))])
      .filter(Boolean)
      .map(pirate => pirate.id);
    G.enemyShip.watchReadyCounterIds = watchReadyCounterIds;
    G.combat.watchReadyCounterIds = [...watchReadyCounterIds];
    const playerRows = opts.playerRows || [[0, 0], [1, 1], [2, 2]];
    G.combat.playerFighters = playerRows
      .map(([pirateIdx, row, rowOrder]) => {
        const pirate = pirates[pirateIdx];
        return pirate ? fighterFor(pirate, row, rowOrder, G.combat) : null;
      })
      .filter(Boolean);
    G.combat.enemyFighters = (opts.enemies || [['powderBomber', 0, 0]])
      .map(([key, row, rowOrder, marker], idx) =>
        marker === 'alert' ? alertGuardFor(key, row, rowOrder, idx) : enemyFor(key, row, rowOrder, idx)
      );
    return { G, pirates, enemies: G.combat.enemyFighters, combat: G.combat };
  };

  {
    const { G, pirates, enemies, combat } = setupRegular({
      mainKey: 'deckSniper',
      types: ['lumberjack', 'needler', 'miner'],
      playerRows: [],
      enemies: [['deckSniper', 0, 0], ['bilgeRat', 1, 0]],
      pirateUpgrades: [{}, { weaponKey: 'toxinPistol' }, {}],
    });
    combat.playerSetupRows = scene.combatDefaultPlayerSetupRows(combat);
    assertCounterAmbushCheck(combat.playerSetupRows[0][0] === pirates[1].id, 'ranged Needler counter was not defaulted to front row');
    assertCounterAmbushCheck(combat.playerSetupRows[0][1] === pirates[0].id, 'first melee pirate did not remain behind defaulted counter');
    combat.playerFighters = scene.buildPlayerCombatFighters(combat.playerSetupRows, combat);
    const target = enemies[0];
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(result && result.applied, 'defaulted Needler did not ambush on Fight');
    assertCounterAmbushCheck(result.pirateId === pirates[1].id, `default ambusher ${result.pirateId} !== ${pirates[1].id}`);
    assertCounterAmbushCheck(result.armedAmbush && result.damage === 5, 'defaulted prepared Needler did not Armed Ambush');
    assertCounterAmbushCheck(target.hp === target.maxHp - 5 && target.wounds === 1, 'defaulted ambush did not wound Deck Sniper');
    results.push({ name: 'regular Deck Sniper boarding defaults prepared ranged Needler to front row and Armed Ambushes', ok: true });
  }

  {
    const { G, pirates, enemies, combat } = setupRegular({
      mainKey: 'deckSniper',
      types: ['lumberjack', 'needler', 'miner'],
      playerRows: [],
      enemies: [['deckSniper', 0, 0]],
      pirateUpgrades: [{}, { weaponKey: 'toxinPistol' }, {}],
    });
    combat.playerSetupRows = [[pirates[0].id, pirates[2].id], [pirates[1].id], []];
    combat.playerFighters = scene.buildPlayerCombatFighters(combat.playerSetupRows, combat);
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(!result, 'moved-back Needler still ambushed');
    assertCounterAmbushCheck(enemies[0].hp === enemies[0].maxHp && !enemies[0].wounds, 'moved-back Needler changed Deck Sniper');
    results.push({ name: 'moving defaulted counter out of front row prevents Counter Ambush', ok: true });
  }

  {
    const { pirates, combat } = setupRegular({
      mode: 'battleTest',
      mainKey: 'deckSniper',
      types: ['lumberjack', 'needler', 'miner'],
      playerRows: [],
      pirateUpgrades: [{}, { weaponKey: 'toxinPistol' }, {}],
    });
    const rows = scene.combatDefaultPlayerSetupRows(combat);
    assertCounterAmbushCheck(rows[0][0] === pirates[0].id && rows[0][1] === pirates[2].id, 'Battle Test did not keep melee front default');
    assertCounterAmbushCheck(rows[1][0] === pirates[1].id, 'Battle Test did not keep ranged Needler behind melee');
    results.push({ name: 'Battle Test keeps ordinary ranged default placement', ok: true });
  }

  {
    const { pirates, combat } = setupRegular({
      mainKey: 'deckSniper',
      types: ['lumberjack', 'sawbones', 'miner'],
      playerRows: [],
      pirateUpgrades: [{}, { weaponKey: 'toxinPistol' }, {}],
    });
    const rows = scene.combatDefaultPlayerSetupRows(combat);
    assertCounterAmbushCheck(rows[0][0] === pirates[0].id && rows[0][1] === pirates[2].id, 'no-counter setup changed melee front default');
    assertCounterAmbushCheck(rows[1][0] === pirates[1].id, 'no-counter setup changed ranged back default');
    results.push({ name: 'boarding with no ready matching counter keeps ordinary ranged default placement', ok: true });
  }

  {
    const { G, pirates, enemies, combat } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0], [1, 1, 0]],
      enemies: [['powderBomber', 0, 0], ['bilgeRat', 0, 1]],
    });
    const target = enemies[0];
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(result && result.applied, 'front-row matching counter did not ambush');
    assertCounterAmbushCheck(result.pirateId === pirates[0].id, `ambusher ${result.pirateId} !== ${pirates[0].id}`);
    assertCounterAmbushCheck(!result.armedAmbush && !result.upgradedAmbush, 'unupgraded ambush was marked armed');
    assertCounterAmbushCheck(result.damage === 3, `unupgraded damage ${result.damage} !== 3`);
    assertCounterAmbushCheck(target.hp === target.maxHp - 3, `target hp ${target.hp} !== ${target.maxHp - 3}`);
    assertCounterAmbushCheck(target.wounds === 1, `target wounds ${target.wounds} !== 1`);
    assertCounterAmbushCheck((result.removedAlertGuardCount || 0) === 0, 'normal non-alert enemy was removed as an Alert guard');
    assertCounterAmbushCheck(!result.openingCounterBreak && !result.routedSupport, 'unarmed ambush routed support');
    assertCounterAmbushCheck(enemies[1].alive, 'unarmed ambush defeated non-alert support');
    const hpAfter = target.hp;
    const second = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(!second && target.hp === hpAfter && target.wounds === 1, 'Counter Ambush repeated');
    scene.finishBoardingCombat('win');
    assertCounterAmbushCheck(!G.combat.openingBreakPlunder, 'unarmed ambush stored Opening plunder');
    assertCounterAmbushCheck(G.res.wood === 0 && G.res.stone === 1, `unarmed ambush bounty ${JSON.stringify(G.res)} !== +1 stone`);
    assertCounterAmbushCheck(combat.ambushBounty && combat.ambushBounty.resource === 'stone', 'unarmed ambush did not store stone Ambush Bounty');
    assertCounterAmbushCheck(combat.ambushBounty.pirateId === pirates[0].id, 'Ambush Bounty was not tied to the ambusher');
    results.push({ name: 'front-row matching counter ambushes once and surviving ambusher wins mapped Ambush Bounty', ok: true, res: { ...G.res } });
  }

  {
    const { G, pirates, enemies, combat } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 3], ['cabinBoy', 0, 2, 'alert'], ['bilgeRat', 0, 1, 'alert'], ['cabinBoy', 0, 0]],
      boardingAlert: 3,
      guardCount: 2,
      watchReadyIndices: [0],
    });
    const watched = pirates[0];
    const before = {
      weaponKey: watched.weaponKey || null,
      might: watched.might || 0,
      tempo: watched.tempo || 0,
    };
    const target = enemies[0];
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbushCheck(result && result.applied, 'Watch Ready counter did not ambush');
    assertCounterAmbushCheck(result.pirateId === watched.id, `Watch Ready ambusher ${result && result.pirateId} !== ${watched.id}`);
    assertCounterAmbushCheck(result.armedAmbush && result.watchReadyAmbush, 'Watch Ready counter was not treated as armed for ambush');
    assertCounterAmbushCheck(!result.permanentArmedAmbush, 'Watch Ready counter was marked permanently armed');
    assertCounterAmbushCheck(result.damage === 5, `Watch Ready damage ${result.damage} !== 5`);
    assertCounterAmbushCheck(target.hp === target.maxHp - 5 && target.wounds === 1, 'Watch Ready ambush did not wound and deal 5 damage');
    assertCounterAmbushCheck((result.removedAlertGuards || []).length === 2, 'Watch Ready ambush did not use the armed Alert guard removal limit');
    assertCounterAmbushCheck((watched.weaponKey || null) === before.weaponKey, 'Watch Ready ambush mutated weaponKey');
    assertCounterAmbushCheck((watched.might || 0) === before.might, 'Watch Ready ambush mutated Might');
    assertCounterAmbushCheck((watched.tempo || 0) === before.tempo, 'Watch Ready ambush mutated Tempo');
    assertCounterAmbushCheck(!result.openingCounterBreak && !result.routedSupport, 'Watch Ready with Alert guards triggered Opening Counter Break');
    const normalSupport = enemies.find((fighter) => fighter && !fighter.alertGuard && scene.combatEnemyArchetypeKey(fighter) === 'cabinBoy');
    assertCounterAmbushCheck(normalSupport && normalSupport.alive, 'Watch Ready with Alert guards routed non-Alert support');
    assertCounterAmbushCheck(G.counterWatchIds.length === 0, 'Watch Ready ambush recreated Counter Watch markers');
    results.push({ name: 'Watch Ready counters use Armed Counter Ambush damage and guard removal without permanent upgrades', ok: true });
  }

  {
    const { G, pirates, enemies, combat } = setupRegular({
      mainKey: 'shellback',
      types: ['poisoner', 'sawbones', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['shellback', 0, 2], ['cabinBoy', 0, 1], ['bilgeRat', 0, 0]],
      boardingAlert: 0,
      guardCount: 0,
      watchReadyIndices: [0],
    });
    const watched = pirates[0];
    const before = {
      weaponKey: watched.weaponKey || null,
      might: watched.might || 0,
      tempo: watched.tempo || 0,
    };
    const target = enemies[0];
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbushCheck(result && result.applied, 'Watch Ready no-Alert counter did not ambush');
    assertCounterAmbushCheck(result.pirateId === watched.id, `Watch Ready no-Alert ambusher ${result && result.pirateId} !== ${watched.id}`);
    assertCounterAmbushCheck(result.armedAmbush && result.watchReadyAmbush, 'Watch Ready no-Alert counter was not treated as armed');
    assertCounterAmbushCheck(!result.permanentArmedAmbush, 'Watch Ready no-Alert counter was marked permanently armed');
    assertCounterAmbushCheck(result.damage === 5, `Watch Ready no-Alert damage ${result.damage} !== 5`);
    assertCounterAmbushCheck(target.hp === target.maxHp - 5 && target.wounds === 1, 'Watch Ready no-Alert ambush did not wound and deal 5 damage');
    assertCounterAmbushCheck((result.removedAlertGuards || []).length === 0, 'Watch Ready no-Alert ambush removed Alert guards');
    assertCounterAmbushCheck(result.openingCounterBreak && result.routedSupport, 'Watch Ready no-Alert ambush did not trigger Opening Counter Break');
    assertCounterAmbushCheck(result.routedSupport.key === 'bilgeRat', `Watch Ready no-Alert routed ${result.routedSupport.key} instead of front-left Bilge Rat`);
    assertCounterAmbushCheck(!scene.combatFindFighter(result.routedSupport.id).alive, 'Watch Ready no-Alert routed support is still alive');
    assertCounterAmbushCheck((watched.weaponKey || null) === before.weaponKey, 'Watch Ready no-Alert ambush mutated weaponKey');
    assertCounterAmbushCheck((watched.might || 0) === before.might, 'Watch Ready no-Alert ambush mutated Might');
    assertCounterAmbushCheck((watched.tempo || 0) === before.tempo, 'Watch Ready no-Alert ambush mutated Tempo');
    combat.result = 'win';
    const openingPlunder = scene.grantOpeningBreakPlunder(combat);
    const ambushBounty = scene.grantAmbushBounty(combat);
    assertCounterAmbushCheck(openingPlunder && openingPlunder.resource === 'stone', 'Watch Ready no-Alert Opening plunder did not pay Bilge Rat stone');
    assertCounterAmbushCheck(ambushBounty && ambushBounty.resource === 'wood', 'Watch Ready no-Alert Ambush Bounty did not pay Shellback wood');
    assertCounterAmbushCheck(G.res.wood === 1 && G.res.stone === 1, `Watch Ready no-Alert plunder mismatch ${JSON.stringify(G.res)}`);
    results.push({ name: 'Watch Ready no-Alert Boarding 1 triggers Opening Counter Break without permanent upgrades', ok: true, res: { ...G.res } });
  }

  {
    const { G, pirates, enemies, combat } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 1, 0], [1, 0, 0]],
      enemies: [['powderBomber', 0, 0]],
      watchReadyIndices: [0],
    });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbushCheck(!result, 'Watch Ready counter moved out of front row still ambushed');
    assertCounterAmbushCheck(enemies[0].hp === enemies[0].maxHp && !enemies[0].wounds, 'moved Watch Ready counter changed target');
    assertCounterAmbushCheck(pirates[0].weaponKey == null && (pirates[0].might || 0) === 0 && (pirates[0].tempo || 0) === 0, 'moved Watch Ready counter gained permanent upgrades');
    results.push({ name: 'moving a Watch Ready counter out of the front row prevents the ambush benefit', ok: true });
  }

  {
    const { G, enemies, combat } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 1], ['cabinBoy', 0, 0, 'alert']],
      boardingAlert: 1,
      guardCount: 1,
    });
    G.enemyShip.watchReadyCounterIds = [999999];
    combat.watchReadyCounterIds = [999999];
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbushCheck(result && result.applied, 'non-watch control did not ambush');
    assertCounterAmbushCheck(!result.armedAmbush && !result.watchReadyAmbush, 'non-hand Watch Ready id armed the ambush');
    assertCounterAmbushCheck(result.damage === 3, `non-hand Watch Ready id damage ${result.damage} !== 3`);
    assertCounterAmbushCheck((result.removedAlertGuards || []).length === 1, 'non-hand Watch Ready id used armed guard removal');
    assertCounterAmbushCheck(enemies[0].hp === enemies[0].maxHp - 3, 'non-hand Watch Ready id dealt armed damage');
    results.push({ name: 'Watch Ready ids outside the current hand do not arm Counter Ambush', ok: true });
  }

  {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.map = makeScoutedCounterTestMap('powderBomber');
    G.phase = 'map';
    const eligible = G.allCrew[0];
    const wrongCounter = G.allCrew[1];
    const wounded = G.allCrew[2];
    const absent = G.allCrew[3];
    const sentEarlier = G.allCrew[4];
    eligible.type = 'sawbones';
    wrongCounter.type = 'poisoner';
    wounded.type = 'sawbones';
    wounded.wounded = true;
    absent.type = 'sawbones';
    sentEarlier.type = 'sawbones';
    G.hand = [eligible, wrongCounter, wounded, sentEarlier];
    G.deck = [absent];
    G.discard = [];
    G.sent = [3];
    G.counterWatchIds = [eligible.id, wrongCounter.id, wounded.id, absent.id, sentEarlier.id];
    scene.applyMapNodeSelection(2);
    const readyIds = (G.enemyShip && G.enemyShip.watchReadyCounterIds) || [];
    assertCounterAmbushCheck(G.phase === 'boarding', 'watch-ready snapshot did not enter boarding');
    assertCounterAmbushCheck(readyIds.length === 1 && readyIds[0] === eligible.id, `watch-ready snapshot kept ${JSON.stringify(readyIds)} instead of only eligible counter`);
    assertCounterAmbushCheck((G.counterWatchIds || []).length === 0, 'Counter Watch did not clear at boarding start');
    results.push({ name: 'boarding start snapshots only owned, hand-held, unwounded watched counters for Watch Ready', ok: true });
  }

  {
    const { G, combat } = setupRegular({
      mainKey: 'deckSniper',
      types: ['needler', 'sawbones', 'trainer'],
      playerRows: [[0, 0, 0], [1, 1, 0]],
      enemies: [['deckSniper', 0, 0]],
    });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbushCheck(result && result.applied, 'Ambush Bounty death setup did not ambush');
    scene.defeatCombatFighter(combat.playerFighters[0], []);
    scene.finishBoardingCombat('win');
    assertCounterAmbushCheck(G.res.gold === 0, `defeated ambusher granted Ambush Bounty ${JSON.stringify(G.res)}`);
    assertCounterAmbushCheck(!combat.ambushBounty, 'defeated ambusher stored Ambush Bounty');
    results.push({ name: 'defeated ambusher wins no Ambush Bounty', ok: true });
  }

  {
    const { G, pirates, combat } = setupRegular({
      mainKey: 'deckSniper',
      types: ['needler', 'sawbones', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['deckSniper', 0, 0]],
    });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbushCheck(result && result.applied, 'reinforcement bounty setup did not ambush');
    G.hand = [pirates[1]];
    combat.playerFighters = [fighterFor(pirates[1], 0, 0, combat)];
    combat.reinforcementCount = 1;
    scene.finishBoardingCombat('win');
    assertCounterAmbushCheck(G.res.gold === 0, `reinforcement win granted Ambush Bounty ${JSON.stringify(G.res)}`);
    assertCounterAmbushCheck(!combat.ambushBounty, 'reinforcement win stored Ambush Bounty');
    results.push({ name: 'reinforcement winning hand grants no Ambush Bounty', ok: true });
  }

  {
    const { G, combat } = setupRegular({
      mainKey: 'deckSniper',
      types: ['needler', 'sawbones', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['deckSniper', 0, 0]],
    });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbushCheck(result && result.applied, 'reinforcement loss bounty setup did not ambush');
    combat.reinforcementCount = 1;
    scene.finishBoardingCombat('loss');
    assertCounterAmbushCheck(G.res.gold === 0, `reinforcement loss granted Ambush Bounty ${JSON.stringify(G.res)}`);
    assertCounterAmbushCheck(!combat.ambushBounty, 'reinforcement loss stored Ambush Bounty');
    results.push({ name: 'reinforcement losses grant no Ambush Bounty', ok: true });
  }

  {
    const { G, pirates, combat } = setupRegular({
      mode: 'battleTest',
      mainKey: 'deckSniper',
      types: ['needler', 'sawbones', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['deckSniper', 0, 0]],
    });
    combat.counterAmbush = {
      applied: true,
      pirateId: pirates[0].id,
      type: pirates[0].type,
      mainKey: 'deckSniper',
    };
    scene.finishBoardingCombat('win');
    assertCounterAmbushCheck(G.res.gold === 0, `Battle Test granted Ambush Bounty ${JSON.stringify(G.res)}`);
    assertCounterAmbushCheck(!combat.ambushBounty, 'Battle Test stored Ambush Bounty');
    results.push({ name: 'Battle Test never grants Ambush Bounty', ok: true });
  }

  const checkArmedAmbush = (name, opts = {}) => {
    const { G, pirates, enemies } = setupRegular({
      mainKey: opts.mainKey,
      types: opts.types,
      playerRows: opts.playerRows || [[0, 0, 0]],
      enemies: opts.enemies,
      pirateUpgrades: opts.pirateUpgrades,
    });
    const target = enemies[Math.max(0, Math.floor(Number(opts.targetIndex) || 0))];
    const beforeNextAttackAt = target.nextAttackAt;
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(result && result.applied, `${name} did not ambush`);
    assertCounterAmbushCheck(result.pirateId === pirates[0].id, `${name} ambusher ${result.pirateId} !== ${pirates[0].id}`);
    assertCounterAmbushCheck(result.armedAmbush && result.upgradedAmbush, `${name} was not marked armed`);
    assertCounterAmbushCheck(result.damage === 5, `${name} damage ${result.damage} !== 5`);
    assertCounterAmbushCheck(target.hp === target.maxHp - 5, `${name} target hp ${target.hp} !== ${target.maxHp - 5}`);
    assertCounterAmbushCheck(target.wounds === 1, `${name} target wounds ${target.wounds} !== 1`);
    assertCounterAmbushCheck((target.poison || 0) === 0, `${name} applied weapon poison ${target.poison || 0}`);
    assertCounterAmbushCheck(target.nextAttackAt === beforeNextAttackAt, `${name} triggered enemy hit reaction`);
    results.push({ name, ok: true, damage: result.damage, wounds: target.wounds });
  };

  checkArmedAmbush('Prepared Sawbones-style Barbed Blade arms Counter Ambush for 5 without extra weapon Wound', {
    mainKey: 'powderBomber',
    types: ['sawbones', 'poisoner', 'trainer'],
    enemies: [['powderBomber', 0, 0]],
    pirateUpgrades: [{ weaponKey: 'barbedBlade' }],
  });

  checkArmedAmbush('Toxin Pistol armed counter ambushes for 5 without poison on-hit', {
    mainKey: 'deckSniper',
    types: ['needler', 'sawbones', 'trainer'],
    enemies: [['deckSniper', 0, 0]],
    pirateUpgrades: [{ weaponKey: 'toxinPistol' }],
  });

  checkArmedAmbush('Might-upgraded counter ambushes for exactly 5 without Counter Edge stacking', {
    mainKey: 'flintDuelist',
    types: ['poisoner', 'sawbones', 'trainer'],
    enemies: [['flintDuelist', 0, 0]],
    pirateUpgrades: [{ might: 1 }],
  });

  checkArmedAmbush('Tempo-upgraded counter ambushes for exactly 5', {
    mainKey: 'netter',
    types: ['drummer', 'sawbones', 'trainer'],
    enemies: [['netter', 0, 0]],
    pirateUpgrades: [{ tempo: 1 }],
  });

  {
    const { G, enemies, combat } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 2], ['cabinBoy', 0, 1], ['bilgeRat', 0, 0], ['cabinBoy', 1, 0]],
      pirateUpgrades: [{ might: 1 }],
      boardingAlert: 0,
      guardCount: 0,
    });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbushCheck(result && result.applied && result.armedAmbush, 'Opening Counter Break setup did not Armed Ambush');
    assertCounterAmbushCheck((result.removedAlertGuardCount || 0) === 0, 'Opening Counter Break removed Alert guards');
    assertCounterAmbushCheck(result.openingCounterBreak && result.routedSupport, 'Opening Counter Break did not route support');
    assertCounterAmbushCheck(result.routedSupport.key === 'bilgeRat', `Opening Counter Break routed ${result.routedSupport.key} instead of front-left Bilge Rat`);
    assertCounterAmbushCheck(!scene.combatFindFighter(result.routedSupport.id).alive, 'Opening Counter Break routed support is still alive');
    assertCounterAmbushCheck(enemies.filter((fighter) => fighter && !fighter.alertGuard && ['bilgeRat', 'cabinBoy'].includes(scene.combatEnemyArchetypeKey(fighter)) && !fighter.alive).length === 1, 'Opening Counter Break routed more than one weak support');
    const plunder = scene.grantBoardingAlertPlunder(combat);
    assertCounterAmbushCheck(plunder && plunder.total === 0, `Opening Counter Break created Alert plunder ${JSON.stringify(plunder)}`);
    assertCounterAmbushCheck(G.res.wood === 0 && G.res.stone === 0, `Opening Counter Break changed resources ${JSON.stringify(G.res)}`);
    scene.finishBoardingCombat('win');
    scene.finishBoardingCombat('win');
    scene.grantOpeningBreakPlunder(combat);
    assertCounterAmbushCheck(G.res.wood === 0 && G.res.stone === 2, `Opening Break plus Ambush Bounty ${JSON.stringify(G.res)} !== +2 stone`);
    assertCounterAmbushCheck(combat.openingBreakPlunder && combat.openingBreakPlunder.supportKey === 'bilgeRat', 'Opening Break did not store Bilge Rat plunder');
    assertCounterAmbushCheck(combat.openingBreakPlunderGranted, 'Opening Break plunder was not marked granted');
    assertCounterAmbushCheck(combat.ambushBounty && combat.ambushBounty.resource === 'stone', 'Opening Break stack did not store Ambush Bounty');
    results.push({ name: 'Boarding 1 Opening Break Bilge Rat plunder stacks with stone Ambush Bounty', ok: true, res: { ...G.res } });
  }

  {
    const { G, combat } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 2], ['cabinBoy', 0, 0], ['bilgeRat', 0, 1]],
      pirateUpgrades: [{ weaponKey: 'barbedBlade' }],
      boardingAlert: 0,
      guardCount: 0,
    });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbushCheck(result && result.routedSupport && result.routedSupport.key === 'cabinBoy', 'Opening Counter Break did not route front-left Cabin Boy');
    scene.finishBoardingCombat('win');
    assertCounterAmbushCheck(G.res.wood === 1 && G.res.stone === 1, `Opening Break Cabin Boy plus Ambush Bounty ${JSON.stringify(G.res)} !== +1 wood +1 stone`);
    assertCounterAmbushCheck(combat.openingBreakPlunder && combat.openingBreakPlunder.resource === 'wood', 'Opening Break did not store Cabin Boy wood plunder');
    assertCounterAmbushCheck(combat.ambushBounty && combat.ambushBounty.resource === 'stone', 'Cabin Boy Opening Break did not store Ambush Bounty');
    results.push({ name: 'Boarding 1 Opening Counter Break Cabin Boy win grants +1 wood and Ambush Bounty stone', ok: true, res: { ...G.res } });
  }

  {
    const { G, combat } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 1], ['bilgeRat', 0, 0]],
      pirateUpgrades: [{ might: 1 }],
      boardingAlert: 0,
      guardCount: 0,
    });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbushCheck(result && result.routedSupport, 'loss setup did not route support');
    scene.finishBoardingCombat('loss');
    assertCounterAmbushCheck(G.res.wood === 0 && G.res.stone === 0, `loss granted Opening plunder ${JSON.stringify(G.res)}`);
    assertCounterAmbushCheck(!combat.openingBreakPlunder, 'loss stored Opening plunder');
    assertCounterAmbushCheck(!combat.ambushBounty, 'loss stored Ambush Bounty');
    results.push({ name: 'Opening Counter Break losses grant no Opening plunder', ok: true });
  }

  {
    const { enemies, combat } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 3], ['cabinBoy', 0, 2], ['cabinBoy', 0, 1, 'alert'], ['bilgeRat', 0, 0, 'alert']],
      pirateUpgrades: [{ might: 1 }],
      boardingAlert: 3,
      guardCount: 2,
    });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbushCheck(result && result.armedAmbush, 'Armed Alert guard setup did not ambush');
    assertCounterAmbushCheck((result.removedAlertGuards || []).length === 2, 'Armed Alert guard setup did not cut both guards');
    assertCounterAmbushCheck(!result.openingCounterBreak && !result.routedSupport, 'Armed Ambush with Alert guards also routed support');
    assertCounterAmbushCheck(scene.grantOpeningBreakPlunder(combat) === null, 'Armed Ambush with Alert guards granted Opening plunder');
    const normalSupport = enemies.find((fighter) => fighter && !fighter.alertGuard && scene.combatEnemyArchetypeKey(fighter) === 'cabinBoy');
    assertCounterAmbushCheck(normalSupport && normalSupport.alive, 'Armed Ambush with Alert guards defeated normal support');
    results.push({ name: 'Armed Counter Ambush with Alert guards does not also trigger Opening Counter Break', ok: true });
  }

  {
    const { G, enemies, combat } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 1], ['cabinBoy', 0, 0]],
      pirateUpgrades: [{ weaponKey: 'barbedBlade' }],
      encounterNo: 2,
    });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbushCheck(result && result.armedAmbush, 'Boarding 2 Armed Counter Ambush did not ambush');
    assertCounterAmbushCheck(!result.openingCounterBreak && !result.routedSupport, 'Boarding 2 triggered Opening Counter Break');
    assertCounterAmbushCheck(enemies[1].alive, 'Boarding 2 routed weak support');
    scene.finishBoardingCombat('win');
    assertCounterAmbushCheck(!combat.openingBreakPlunder && G.res.wood === 0 && G.res.stone === 1, `Boarding 2 Ambush Bounty result mismatch ${JSON.stringify(G.res)}`);
    assertCounterAmbushCheck(combat.ambushBounty && combat.ambushBounty.resource === 'stone', 'Boarding 2 did not store Ambush Bounty');
    results.push({ name: 'Boarding 2 Armed Counter Ambush does not trigger Opening Counter Break', ok: true });
  }

  {
    const { G, enemies, combat } = setupRegular({
      mode: 'battleTest',
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 1], ['cabinBoy', 0, 0]],
      pirateUpgrades: [{ weaponKey: 'barbedBlade' }],
    });
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(!result, 'Battle Test triggered Opening Counter Break ambush');
    assertCounterAmbushCheck(enemies[0].hp === enemies[0].maxHp && enemies[1].alive, 'Battle Test Opening Counter Break changed fighters');
    assertCounterAmbushCheck(!combat.counterAmbush, 'Battle Test stored Opening Counter Break data');
    assertCounterAmbushCheck(scene.grantOpeningBreakPlunder(combat) === null, 'Battle Test granted Opening plunder');
    results.push({ name: 'Battle Test never triggers Opening Counter Break', ok: true });
  }

  {
    const { G, enemies, combat } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 1], ['bilgeRat', 0, 0]],
      pirateUpgrades: [{ might: 1 }],
      reinforcementCount: 1,
    });
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(!result, 'reinforcement hand triggered Opening Counter Break ambush');
    assertCounterAmbushCheck(enemies[0].hp === enemies[0].maxHp && enemies[1].alive, 'reinforcement Opening Counter Break changed fighters');
    assertCounterAmbushCheck(!combat.counterAmbush, 'reinforcement stored Opening Counter Break data');
    assertCounterAmbushCheck(scene.grantOpeningBreakPlunder(combat) === null, 'reinforcement hand granted Opening plunder');
    results.push({ name: 'reinforcement hands never trigger Opening Counter Break', ok: true });
  }

  const checkAlertGuardRemoval = (name, alert, enemies, expectedRemovedKeys, expectedRes, opts = {}) => {
    const guardCount = scene.boardingAlertGuardCount(alert);
    const expectedKeys = Array.isArray(expectedRemovedKeys) ? expectedRemovedKeys : [expectedRemovedKeys];
    const expectedDamage = opts.expectedDamage != null ? Math.max(0, Math.floor(Number(opts.expectedDamage) || 0)) : 3;
    const { G, combat, enemies: builtEnemies } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies,
      pirateUpgrades: opts.pirateUpgrades,
      boardingAlert: alert,
      guardCount,
    });
    const target = builtEnemies.find((fighter) => scene.combatEnemyArchetypeKey(fighter) === 'powderBomber');
    const result = scene.applyCounterAmbush(combat, { silent: true });
    const removed = (result && result.removedAlertGuards) || [];
    assertCounterAmbushCheck(result && result.applied, `${name} did not ambush`);
    assertCounterAmbushCheck(result.damage === expectedDamage, `${name} damage ${result.damage} !== ${expectedDamage}`);
    assertCounterAmbushCheck(target && target.hp === target.maxHp - expectedDamage, `${name} target hp ${target && target.hp} !== ${target && target.maxHp - expectedDamage}`);
    assertCounterAmbushCheck(target && target.wounds === 1, `${name} target wounds ${target && target.wounds} !== 1`);
    assertCounterAmbushCheck(removed.length === expectedKeys.length, `${name} removed ${removed.length} guards`);
    expectedKeys.forEach((expectedKey, idx) => {
      const guard = removed[idx];
      assertCounterAmbushCheck(guard && guard.key === expectedKey, `${name} removed ${guard && guard.key} at ${idx} !== ${expectedKey}`);
      assertCounterAmbushCheck(!scene.combatFindFighter(guard.id).alive, `${name} removed guard ${idx} still alive`);
    });
    assertCounterAmbushCheck(
      scene.combatLiving('enemy').filter((fighter) => scene.isBoardingAlertGuardFighter(fighter)).length === Math.max(0, guardCount - expectedKeys.length),
      `${name} living guard count mismatch`
    );
    const plunder = scene.grantBoardingAlertPlunder(combat);
    assertCounterAmbushCheck(G.res.wood === expectedRes.wood, `${name} wood ${G.res.wood} !== ${expectedRes.wood}`);
    assertCounterAmbushCheck(G.res.stone === expectedRes.stone, `${name} stone ${G.res.stone} !== ${expectedRes.stone}`);
    assertCounterAmbushCheck(scene.grantOpeningBreakPlunder(combat) === null, `${name} granted Opening plunder`);
    assertCounterAmbushCheck(G.res.wood === expectedRes.wood && G.res.stone === expectedRes.stone, `${name} Opening plunder changed guard totals to ${JSON.stringify(G.res)}`);
    expectedKeys.forEach((expectedKey) => {
      assertCounterAmbushCheck((plunder.removedByCounterAmbush || []).includes(expectedKey), `${name} plunder did not record removed guard ${expectedKey}`);
    });
    results.push({
      name,
      ok: true,
      alert,
      guardCount,
      removed: removed.map((guard) => guard.key),
      plunder: { wood: plunder.wood, stone: plunder.stone },
    });
  };

  checkAlertGuardRemoval(
    'Alert 1 Counter Ambush removes the lone Cabin Boy and still pays Cabin Boy plunder',
    1,
    [['powderBomber', 0, 1], ['cabinBoy', 0, 0, 'alert']],
    'cabinBoy',
    { wood: 1, stone: 0 }
  );
  checkAlertGuardRemoval(
    'Alert 3 unarmed Counter Ambush removes one front-left Bilge Rat and still pays full guard plunder',
    3,
    [['powderBomber', 0, 2], ['cabinBoy', 0, 1, 'alert'], ['bilgeRat', 0, 0, 'alert']],
    'bilgeRat',
    { wood: 1, stone: 1 },
    { expectedDamage: 3 }
  );
  checkAlertGuardRemoval(
    'Alert 3 Armed Counter Ambush removes both Alert guards and still pays full guard plunder',
    3,
    [['powderBomber', 0, 2], ['cabinBoy', 0, 1, 'alert'], ['bilgeRat', 0, 0, 'alert']],
    ['bilgeRat', 'cabinBoy'],
    { wood: 1, stone: 1 },
    { expectedDamage: 5, pirateUpgrades: [{ might: 1 }] }
  );
  checkAlertGuardRemoval(
    'Alert 6 Armed Counter Ambush removes two of three Alert guards and still pays full guard plunder',
    6,
    [['powderBomber', 0, 3], ['cabinBoy', 1, 0, 'alert'], ['bilgeRat', 0, 1, 'alert'], ['cabinBoy', 0, 0, 'alert']],
    ['cabinBoy', 'bilgeRat'],
    { wood: 2, stone: 1 },
    { expectedDamage: 5, pirateUpgrades: [{ weaponKey: 'barbedBlade' }] }
  );

  {
    const { G, combat } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      enemies: [['powderBomber', 0, 3], ['cabinBoy', 1, 0, 'alert'], ['bilgeRat', 0, 1, 'alert'], ['cabinBoy', 0, 0, 'alert']],
      boardingAlert: 6,
      guardCount: 3,
    });
    scene.finishBoardingCombat('loss');
    assertCounterAmbushCheck(G.res.wood === 0 && G.res.stone === 0, `loss granted guard plunder: ${JSON.stringify(G.res)}`);
    assertCounterAmbushCheck(!combat.alertGuardPlunderGranted, 'loss marked guard plunder as granted');
    results.push({ name: 'losses grant no Alert guard plunder', ok: true });
  }

  {
    const { G, combat } = setupRegular({
      mode: 'battleTest',
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      enemies: [['powderBomber', 0, 3], ['cabinBoy', 1, 0, 'alert'], ['bilgeRat', 0, 1, 'alert'], ['cabinBoy', 0, 0, 'alert']],
      boardingAlert: 6,
      guardCount: 3,
    });
    const plunder = scene.grantBoardingAlertPlunder(combat);
    assertCounterAmbushCheck(plunder === null, 'Battle Test returned Alert guard plunder');
    assertCounterAmbushCheck(G.res.wood === 0 && G.res.stone === 0, `Battle Test granted guard plunder: ${JSON.stringify(G.res)}`);
    results.push({ name: 'Battle Test grants no Alert guard plunder', ok: true });
  }

  {
    const { G, enemies } = setupRegular({
      mainKey: 'deckSniper',
      types: ['sawbones', 'needler', 'trainer'],
      playerRows: [[0, 0, 0], [1, 1, 0]],
      enemies: [['deckSniper', 0, 0]],
    });
    const target = enemies[0];
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(!result, 'middle-row-only counter ambushed');
    assertCounterAmbushCheck(target.hp === target.maxHp && !target.wounds, 'middle-row-only counter changed target');
    results.push({ name: 'counters outside the front row do not ambush', ok: true });
  }

  {
    const { G, enemies } = setupRegular({
      mainKey: 'deckSniper',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0], [1, 0, 1]],
      enemies: [['deckSniper', 0, 0]],
    });
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(!result, 'non-counter front row ambushed');
    assertCounterAmbushCheck(enemies[0].hp === enemies[0].maxHp, 'non-counter changed target HP');
    results.push({ name: 'front row without a matching counter does not ambush', ok: true });
  }

  {
    const { G, enemies } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['shellback', 0, 0]],
    });
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(!result, 'ambushed without a living main enemy target');
    assertCounterAmbushCheck(enemies[0].hp === enemies[0].maxHp && !enemies[0].wounds, 'non-main enemy was hit');
    results.push({ name: 'no living main-archetype enemy means no ambush', ok: true });
  }

  {
    const { G, enemies } = setupRegular({
      mode: 'battleTest',
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 0]],
    });
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(!result, 'Battle Test ambushed');
    assertCounterAmbushCheck(enemies[0].hp === enemies[0].maxHp, 'Battle Test ambush changed target');
    results.push({ name: 'Battle Test excludes Counter Ambush', ok: true });
  }

  {
    const { G, enemies, combat } = setupRegular({
      mode: 'battleTest',
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 2], ['cabinBoy', 0, 1, 'alert'], ['bilgeRat', 0, 0, 'alert']],
      boardingAlert: 3,
      guardCount: 2,
      watchReadyIndices: [0],
    });
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(!result, 'Battle Test Watch Ready ambushed');
    assertCounterAmbushCheck(enemies[0].hp === enemies[0].maxHp, 'Battle Test Watch Ready changed target HP');
    assertCounterAmbushCheck(
      scene.combatLiving('enemy').filter((fighter) => scene.isBoardingAlertGuardFighter(fighter)).length === 2,
      'Battle Test Watch Ready changed Alert guards'
    );
    assertCounterAmbushCheck(!combat.counterAmbush, 'Battle Test stored Watch Ready Counter Ambush data');
    results.push({ name: 'Battle Test ignores Watch Ready Counter Ambush state', ok: true });
  }

  {
    const { G, enemies, combat } = setupRegular({
      mode: 'battleTest',
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 2], ['cabinBoy', 0, 1, 'alert'], ['bilgeRat', 0, 0, 'alert']],
      pirateUpgrades: [{ might: 1 }],
      boardingAlert: 3,
      guardCount: 2,
    });
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(!result, 'Battle Test armed counter removed guards');
    assertCounterAmbushCheck(enemies[0].hp === enemies[0].maxHp, 'Battle Test armed counter changed target HP');
    assertCounterAmbushCheck(
      scene.combatLiving('enemy').filter((fighter) => scene.isBoardingAlertGuardFighter(fighter)).length === 2,
      'Battle Test armed counter changed Alert guards'
    );
    assertCounterAmbushCheck(!combat.counterAmbush, 'Battle Test stored Counter Ambush data');
    results.push({ name: 'Battle Test armed counters do not cut Alert guards', ok: true });
  }

  {
    const { G, enemies } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 0]],
      reinforcementCount: 1,
    });
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(!result, 'reinforcement hand ambushed');
    assertCounterAmbushCheck(enemies[0].hp === enemies[0].maxHp, 'reinforcement ambush changed target');
    results.push({ name: 'reinforcement hands do not trigger Counter Ambush', ok: true });
  }

  {
    const { G, enemies, combat } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 2], ['cabinBoy', 0, 1, 'alert'], ['bilgeRat', 0, 0, 'alert']],
      pirateUpgrades: [{ weaponKey: 'barbedBlade' }],
      boardingAlert: 3,
      guardCount: 2,
      reinforcementCount: 1,
    });
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(!result, 'reinforcement armed counter removed guards');
    assertCounterAmbushCheck(enemies[0].hp === enemies[0].maxHp, 'reinforcement armed counter changed target HP');
    assertCounterAmbushCheck(
      scene.combatLiving('enemy').filter((fighter) => scene.isBoardingAlertGuardFighter(fighter)).length === 2,
      'reinforcement armed counter changed Alert guards'
    );
    assertCounterAmbushCheck(!combat.counterAmbush, 'reinforcement stored Counter Ambush data');
    results.push({ name: 'reinforcement armed counters do not cut Alert guards', ok: true });
  }

  {
    const { G, pirates, enemies } = setupRegular({
      mainKey: 'deckSniper',
      types: ['bandmaster', 'needler', 'trainer'],
      playerRows: [[0, 0, 0], [1, 0, 1], [2, 1, 0]],
      enemies: [['deckSniper', 0, 1], ['deckSniper', 0, 0], ['bilgeRat', 1, 0]],
    });
    const target = enemies[1];
    const otherMain = enemies[0];
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(result && result.pirateId === pirates[0].id, `leftmost ambusher ${result && result.pirateId} !== ${pirates[0].id}`);
    assertCounterAmbushCheck(result.targetId === target.id, `front-left target ${result.targetId} !== ${target.id}`);
    assertCounterAmbushCheck(target.hp === target.maxHp - 3 && target.wounds === 1, 'front-left main target was not hit correctly');
    assertCounterAmbushCheck(otherMain.hp === otherMain.maxHp && !otherMain.wounds, 'later main target was hit');
    results.push({ name: 'multiple qualifiers use front-left counter and front-left main enemy', ok: true });
  }

  {
    const { G, enemies, combat } = setupRegular({
      mainKey: 'powderBomber',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
      enemies: [['powderBomber', 0, 0]],
    });
    const bomber = enemies[0];
    const player = combat.playerFighters[0];
    bomber.hp = 3;
    const beforePlayerHp = player.hp;
    const result = scene.applyCounterAmbush(G.combat, { silent: true });
    assertCounterAmbushCheck(result && result.defeated, 'lethal ambush did not defeat Powder Bomber');
    assertCounterAmbushCheck(bomber.wounds === 1, `lethal bomber wounds ${bomber.wounds} !== 1`);
    assertCounterAmbushCheck(player.hp === beforePlayerHp, `wounded bomber blast changed player HP ${player.hp} !== ${beforePlayerHp}`);
    assertCounterAmbushCheck((result.blastEvents || []).some((event) => event && event.disarmed), 'wounded bomber did not fizzle');
    results.push({ name: 'ambush-wounded Powder Bomber fizzles on death', ok: true });
  }

  return { ok: true, checks: results };
}

function assertDrilledAmbusherBountyCheck(condition, message) {
  if (!condition) throw new Error(`drilled ambusher bounty check failed: ${message}`);
}

function runDrilledAmbusherBountyChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];

  const enemyFor = (key, row, rowOrder, idSuffix = 0) => {
    const archetype = api.COMBAT.enemyArchetypes.find((entry) => entry && entry.key === key);
    assertDrilledAmbusherBountyCheck(!!archetype, `missing archetype ${key}`);
    const member = scene.buildCombatEnemyMember(archetype, `${key}_drilled_bounty_${idSuffix}`);
    return scene.buildEnemyCombatFighter(member, row, rowOrder);
  };

  const fighterFor = (pirate, row, rowOrder, combat) =>
    scene.buildPlayerCombatFighter(pirate, row, rowOrder, combat);

  const setupBoarding = (opts = {}) => {
    api.initState();
    const G = api.getG();
    const mainKey = opts.mainKey || 'deckSniper';
    G.mode = opts.mode || 'run';
    G.phase = 'boarding';
    G.busy = false;
    G.boardingCount = Math.max(1, Math.floor(Number(opts.boardingCount) || 1));
    G.enemyShip = {
      strength: 6,
      encounterNo: G.boardingCount,
      encounter: { mainKey, supportKeys: [], totalCount: 1 },
    };

    const pirates = G.allCrew.slice(0, 5);
    const types = opts.types || ['needler', 'sawbones', 'trainer', 'lumberjack', 'miner'];
    pirates.forEach((pirate, index) => {
      pirate.type = types[index] || pirate.type;
      pirate.weaponKey = null;
      pirate.might = 0;
      pirate.tempo = 0;
      pirate.wounded = false;
    });
    G.hand = pirates.slice(0, opts.handCount || 3);
    G.deck = [];
    G.discard = [];
    G.sent = [];
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.cacheDrillBountyMarks = (Array.isArray(opts.markers) ? opts.markers : [])
      .map((marker) => {
        const pirate = pirates[Math.max(0, Math.floor(Number(marker.pirateIndex) || 0))];
        return pirate && marker.mainKey ? { pirateId: pirate.id, mainKey: marker.mainKey } : null;
      })
      .filter(Boolean);
    if (opts.activateMarks) scene.activateCacheDrillBountyMarksForBoarding({ encounter: { mainKey } });
    G.enemyShip.cacheDrillBountyMarks = Array.isArray(G.cacheDrillBountyMarks)
      ? [...G.cacheDrillBountyMarks]
      : [];

    G.combat = {
      mode: 'fighting',
      encounterMainKey: mainKey,
      enemyParty: [],
      playerFighters: [],
      enemyFighters: [],
      boardingAlert: 0,
      boardingAlertGuards: 0,
      returnedPirateIds: [],
      reinforcementCount: Math.max(0, Math.floor(Number(opts.reinforcementCount) || 0)),
    };
    G.combat.playerFighters = (opts.playerRows || [[0, 0, 0], [1, 1, 0]])
      .map(([pirateIdx, row, rowOrder]) => {
        const pirate = pirates[pirateIdx];
        return pirate ? fighterFor(pirate, row, rowOrder, G.combat) : null;
      })
      .filter(Boolean);
    G.combat.enemyFighters = (opts.enemies || [[mainKey, 0, 0]])
      .map(([key, row, rowOrder], idx) => enemyFor(key, row, rowOrder, idx));
    return { G, pirates, combat: G.combat };
  };

  {
    api.initState();
    const G = api.getG();
    G.mode = 'run';
    G.phase = 'sending';
    G.boardingCount = 0;
    G.island = scene.buildIslandState(api.ISLANDS[0]);
    G.island.scoutedCacheDrill = {
      mainKey: 'deckSniper',
      granted: false,
      alertRefundAmount: 0,
      alertFloorBeforeCache: 0,
      alertRefunded: false,
    };
    const pirate = G.allCrew[0];
    pirate.type = 'needler';
    pirate.might = 0;
    G.hand = [pirate];
    G.deck = [];
    G.discard = [];
    G.cacheDrillBountyMarks = [];
    const reward = scene.applyScoutedCacheDrill(pirate, { silent: true });
    assertDrilledAmbusherBountyCheck(reward && reward.applied, 'Cache Drill setup did not reward matching Needler');
    assertDrilledAmbusherBountyCheck((G.cacheDrillBountyMarks || []).length === 1, `Cache Drill marker count ${JSON.stringify(G.cacheDrillBountyMarks)}`);
    assertDrilledAmbusherBountyCheck(G.cacheDrillBountyMarks[0].pirateId === pirate.id && G.cacheDrillBountyMarks[0].mainKey === 'deckSniper', 'Cache Drill marker did not store pirate/main key');
    results.push({ name: 'Cache Drill marks its pirate for the next matching boarding bounty', ok: true });
  }

  {
    const { G, pirates, combat } = setupBoarding({
      mainKey: 'deckSniper',
      markers: [{ pirateIndex: 0, mainKey: 'deckSniper' }],
      activateMarks: true,
    });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertDrilledAmbusherBountyCheck(result && result.pirateId === pirates[0].id, 'marked Needler did not Counter Ambush');
    scene.finishBoardingCombat('win');
    assertDrilledAmbusherBountyCheck(G.res.gold === 2, `drilled Ambush Bounty gold ${G.res.gold} !== 2`);
    assertDrilledAmbusherBountyCheck(combat.ambushBounty && combat.ambushBounty.count === 2 && combat.ambushBounty.drilled, `drilled bounty payload ${JSON.stringify(combat.ambushBounty)}`);
    assertDrilledAmbusherBountyCheck((G.cacheDrillBountyMarks || []).length === 0, 'drilled bounty marker survived resolved boarding');
    results.push({ name: 'matching drilled ambusher wins doubled Ambush Bounty and consumes the marker', ok: true, res: { ...G.res } });
  }

  {
    const { G, pirates, combat } = setupBoarding({ mainKey: 'deckSniper' });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertDrilledAmbusherBountyCheck(result && result.pirateId === pirates[0].id, 'unmarked Needler did not Counter Ambush');
    scene.finishBoardingCombat('win');
    assertDrilledAmbusherBountyCheck(G.res.gold === 1, `normal Ambush Bounty gold ${G.res.gold} !== 1`);
    assertDrilledAmbusherBountyCheck(combat.ambushBounty && combat.ambushBounty.count === 1 && !combat.ambushBounty.drilled, `normal bounty payload ${JSON.stringify(combat.ambushBounty)}`);
    results.push({ name: 'unmarked surviving ambusher still wins normal +1 Ambush Bounty', ok: true, res: { ...G.res } });
  }

  {
    const { G, combat } = setupBoarding({
      mainKey: 'deckSniper',
      markers: [{ pirateIndex: 0, mainKey: 'shellback' }],
      activateMarks: true,
    });
    assertDrilledAmbusherBountyCheck((G.cacheDrillBountyMarks || []).length === 0, 'wrong-main marker did not expire at boarding start');
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('win');
    assertDrilledAmbusherBountyCheck(G.res.gold === 1, `wrong-main marker doubled bounty: ${JSON.stringify(G.res)}`);
    assertDrilledAmbusherBountyCheck(combat.ambushBounty && combat.ambushBounty.count === 1, 'wrong-main marker changed bounty count');
    results.push({ name: 'wrong-main Cache Drill marker expires before the next boarding payout', ok: true });
  }

  {
    const { G, combat } = setupBoarding({
      mainKey: 'deckSniper',
      types: ['sawbones', 'poisoner', 'trainer'],
      markers: [{ pirateIndex: 0, mainKey: 'deckSniper' }],
      activateMarks: true,
    });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertDrilledAmbusherBountyCheck(!result, 'non-counter triggered Counter Ambush');
    scene.finishBoardingCombat('win');
    assertDrilledAmbusherBountyCheck(G.res.gold === 0 && !combat.ambushBounty, `missing ambush granted bounty ${JSON.stringify(G.res)}`);
    results.push({ name: 'drilled marker alone grants no bounty without Counter Ambush', ok: true });
  }

  {
    const { G, combat } = setupBoarding({
      mainKey: 'deckSniper',
      markers: [{ pirateIndex: 0, mainKey: 'deckSniper' }],
      activateMarks: true,
    });
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('loss');
    assertDrilledAmbusherBountyCheck(G.res.gold === 0 && !combat.ambushBounty, `loss granted drilled bounty ${JSON.stringify(G.res)}`);
    assertDrilledAmbusherBountyCheck((G.cacheDrillBountyMarks || []).length === 0, 'loss did not clear drilled marker');
    results.push({ name: 'losses clear drilled markers and grant no Ambush Bounty', ok: true });
  }

  {
    const { G, combat } = setupBoarding({
      mainKey: 'deckSniper',
      markers: [{ pirateIndex: 0, mainKey: 'deckSniper' }],
      activateMarks: true,
    });
    scene.applyCounterAmbush(combat, { silent: true });
    scene.defeatCombatFighter(combat.playerFighters[0], []);
    scene.finishBoardingCombat('win');
    assertDrilledAmbusherBountyCheck(G.res.gold === 0 && !combat.ambushBounty, `defeated ambusher granted drilled bounty ${JSON.stringify(G.res)}`);
    results.push({ name: 'defeated drilled ambushers grant no bounty', ok: true });
  }

  {
    const { G, pirates, combat } = setupBoarding({
      mainKey: 'deckSniper',
      markers: [{ pirateIndex: 0, mainKey: 'deckSniper' }],
      activateMarks: true,
    });
    scene.applyCounterAmbush(combat, { silent: true });
    G.hand = [pirates[1]];
    combat.playerFighters = [fighterFor(pirates[1], 0, 0, combat)];
    combat.reinforcementCount = 1;
    scene.finishBoardingCombat('win');
    assertDrilledAmbusherBountyCheck(G.res.gold === 0 && !combat.ambushBounty, `reinforcement win granted drilled bounty ${JSON.stringify(G.res)}`);
    results.push({ name: 'reinforcement-hand wins never pay drilled Ambush Bounty', ok: true });
  }

  {
    const { G, pirates, combat } = setupBoarding({
      mode: 'battleTest',
      mainKey: 'deckSniper',
      markers: [{ pirateIndex: 0, mainKey: 'deckSniper' }],
      activateMarks: false,
    });
    combat.counterAmbush = {
      applied: true,
      pirateId: pirates[0].id,
      type: pirates[0].type,
      mainKey: 'deckSniper',
    };
    scene.finishBoardingCombat('win');
    assertDrilledAmbusherBountyCheck(G.res.gold === 0 && !combat.ambushBounty, `Battle Test granted drilled bounty ${JSON.stringify(G.res)}`);
    results.push({ name: 'Battle Test excludes drilled Ambush Bounty even with defensive marker state', ok: true });
  }

  return { ok: true, checks: results };
}

function assertCounterAmbusherReportCheck(condition, message) {
  if (!condition) throw new Error(`counter ambusher report check failed: ${message}`);
}

function runCounterAmbusherReportChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];

  const enemyFor = (key, row, rowOrder, idx = 0) => {
    const archetype = api.COMBAT.enemyArchetypes.find((entry) => entry && entry.key === key);
    assertCounterAmbusherReportCheck(!!archetype, `missing enemy archetype ${key}`);
    const member = scene.buildCombatEnemyMember(archetype, `${key}_report_${idx}`);
    return scene.buildEnemyCombatFighter(member, row, rowOrder);
  };

  const fighterFor = (pirate, row, rowOrder, combat) =>
    scene.buildPlayerCombatFighter(pirate, row, rowOrder, combat);

  const setupRegular = (opts = {}) => {
    api.initState();
    const G = api.getG();
    const mode = opts.mode || 'run';
    const mainKey = opts.mainKey || 'deckSniper';
    const encounterNo = Math.max(1, Math.floor(Number(opts.encounterNo) || 1));
    G.mode = mode;
    G.phase = 'boarding';
    G.busy = false;
    G.boardingCount = opts.boardingCount != null
      ? Math.max(0, Math.floor(Number(opts.boardingCount) || 0))
      : encounterNo;
    G.enemyShip = {
      strength: 6,
      encounterNo,
      encounter: { mainKey, supportKeys: [], totalCount: 1 },
    };
    if (G.map) {
      const finalLayer = Math.max(0, ((api.MAP_LAYERS || (G.map.layers && G.map.layers.length) || 40) - 1));
      if (opts.finalBoarding) {
        const finalNodes = (G.map.layers && G.map.layers[finalLayer]) || [];
        G.map.currentLayer = finalLayer;
        G.map.currentNodeId = (finalNodes[0] && finalNodes[0].id) || 'report-final-ship';
      } else {
        G.map.currentLayer = Math.min(2, Math.max(0, finalLayer - 1));
        G.map.currentNodeId = G.map.currentNodeId || 'report-test-ship';
      }
    }

    const pirates = G.allCrew.slice(0, 5);
    const types = opts.types || ['needler', 'sawbones', 'trainer', 'lumberjack', 'miner'];
    pirates.forEach((pirate, index) => {
      pirate.type = types[index] || pirate.type;
      pirate.weaponKey = null;
      pirate.might = 0;
      pirate.tempo = 0;
      pirate.wounded = false;
    });
    const upgrades = Array.isArray(opts.pirateUpgrades) ? opts.pirateUpgrades : [];
    upgrades.forEach((upgrade, index) => {
      const pirate = pirates[index];
      if (!pirate || !upgrade) return;
      if (upgrade.weaponKey !== undefined) pirate.weaponKey = upgrade.weaponKey || null;
      if (upgrade.might !== undefined) pirate.might = Math.max(0, Math.floor(Number(upgrade.might) || 0));
      if (upgrade.tempo !== undefined) pirate.tempo = Math.max(0, Math.floor(Number(upgrade.tempo) || 0));
    });

    G.hand = pirates.slice(0, opts.handCount || 3);
    G.deck = [pirates[3], pirates[4]].filter(Boolean);
    G.discard = [];
    G.sent = [];
    G.res = { wood: 0, stone: 0, gold: 0 };
    G.combat = {
      mode: 'fighting',
      encounterMainKey: mainKey,
      enemyParty: [],
      playerFighters: [],
      enemyFighters: [],
      boardingAlert: 0,
      boardingAlertGuards: 0,
      returnedPirateIds: [],
      reinforcementCount: Math.max(0, Math.floor(Number(opts.reinforcementCount) || 0)),
    };
    G.combat.playerFighters = (opts.playerRows || [[0, 0, 0], [1, 1, 0]])
      .map(([pirateIdx, row, rowOrder]) => {
        const pirate = pirates[pirateIdx];
        return pirate ? fighterFor(pirate, row, rowOrder, G.combat) : null;
      })
      .filter(Boolean);
    G.combat.enemyFighters = (opts.enemies || [[mainKey, 0, 0]])
      .map(([key, row, rowOrder], idx) => enemyFor(key, row, rowOrder, idx));
    return { G, pirates, combat: G.combat };
  };

  const continueBoardingImmediately = (G) => {
    scene.snapshotHandCardsForDiscard = () => (G.hand || []).filter(Boolean).map((pirate) => ({
      id: pirate.id,
      type: pirate.type,
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
    }));
    scene.animateCardsToDiscard = () => 0;
    scene.animateCardsToDraw = () => 0;
    scene.animateReshuffleToDraw = () => 0;
    scene.time.delayedCall = (_delay, cb) => {
      if (typeof cb === 'function') cb();
      return { hasDispatched: true, remove: () => {} };
    };
    scene.continueFromResolvedBoarding();
  };

  const countRefs = (G, pirate) => [G.hand, G.deck, G.discard]
    .reduce((count, pile) => count + (Array.isArray(pile) ? pile.filter((entry) => entry === pirate).length : 0), 0);

  {
    const { G, pirates, combat } = setupRegular({
      mainKey: 'deckSniper',
      encounterNo: 2,
      boardingCount: 2,
      types: ['needler', 'sawbones', 'trainer', 'lumberjack', 'miner'],
      playerRows: [[0, 0, 0], [1, 1, 0]],
      pirateUpgrades: [{ weaponKey: 'toxinPistol', might: 1, tempo: 1 }],
    });
    const ambusher = pirates[0];
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbusherReportCheck(result && result.pirateId === ambusher.id, 'positive setup did not ambush with the expected pirate');
    scene.finishBoardingCombat('win');
    assertCounterAmbusherReportCheck(combat.counterAmbusherReport && combat.counterAmbusherReport.pirateId === ambusher.id, 'winning Boarding 2 did not mark ambusher report');
    assertCounterAmbusherReportCheck((ambusher.might || 0) === 2 && (ambusher.tempo || 0) === 2, 'ambusher did not keep trophy buffs before report');
    continueBoardingImmediately(G);
    assertCounterAmbusherReportCheck(G.hand[0] === ambusher, 'reported ambusher was not drawn first next hand');
    assertCounterAmbusherReportCheck(!G.deck.includes(ambusher) && !G.discard.includes(ambusher), 'reported ambusher remained in deck or discard');
    assertCounterAmbusherReportCheck(countRefs(G, ambusher) === 1, 'reported ambusher duplicated across piles');
    assertCounterAmbusherReportCheck((ambusher.weaponKey || null) === 'toxinPistol' && (ambusher.might || 0) === 2 && (ambusher.tempo || 0) === 2, 'reported ambusher lost weapon or buffs');
    results.push({ name: 'Boarding 2 surviving ambusher reports next, draws first, and keeps upgrades', ok: true });
  }

  {
    const { pirates, combat } = setupRegular({
      mainKey: 'shellback',
      types: ['lumberjack', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0], [1, 1, 0]],
    });
    const starter = pirates[0];
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbusherReportCheck(result && result.pirateId === starter.id, 'Opening Deckhand Counter starter did not ambush');
    scene.finishBoardingCombat('win');
    assertCounterAmbusherReportCheck(combat.counterAmbusherReport && combat.counterAmbusherReport.pirateId === starter.id, 'Opening Deckhand Counter starter did not mark report');
    results.push({ name: 'Opening Deckhand Counter starters can be the reporting ambusher', ok: true });
  }

  {
    const { G, combat } = setupRegular();
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('loss');
    assertCounterAmbusherReportCheck(!combat.counterAmbusherReport, 'loss marked ambusher report');
    assertCounterAmbusherReportCheck(G.res.gold === 0, 'loss granted ambush bounty while checking report exclusion');
    results.push({ name: 'losses do not mark ambusher report', ok: true });
  }

  {
    const { combat } = setupRegular();
    scene.applyCounterAmbush(combat, { silent: true });
    scene.defeatCombatFighter(combat.playerFighters[0], []);
    scene.finishBoardingCombat('win');
    assertCounterAmbusherReportCheck(!combat.counterAmbusherReport, 'defeated ambusher marked report');
    results.push({ name: 'defeated ambushers do not report next', ok: true });
  }

  {
    const { G, pirates, combat } = setupRegular();
    scene.applyCounterAmbush(combat, { silent: true });
    G.hand = [pirates[1]];
    combat.playerFighters = [fighterFor(pirates[1], 0, 0, combat)];
    combat.reinforcementCount = 1;
    scene.finishBoardingCombat('win');
    assertCounterAmbusherReportCheck(!combat.counterAmbusherReport, 'reinforcement win marked ambusher report');
    results.push({ name: 'reinforcement-hand wins do not report the opening-hand ambusher', ok: true });
  }

  {
    const { G, pirates, combat } = setupRegular({
      mode: 'battleTest',
      mainKey: 'deckSniper',
      types: ['needler', 'sawbones', 'trainer'],
      playerRows: [[0, 0, 0]],
    });
    combat.counterAmbush = {
      applied: true,
      pirateId: pirates[0].id,
      type: pirates[0].type,
      mainKey: 'deckSniper',
    };
    scene.finishBoardingCombat('win');
    assertCounterAmbusherReportCheck(!combat.counterAmbusherReport, 'Battle Test marked ambusher report');
    assertCounterAmbusherReportCheck(G.phase === 'boarding', 'Battle Test report check unexpectedly left boarding');
    results.push({ name: 'Battle Test never marks ambusher report', ok: true });
  }

  {
    const { combat } = setupRegular({
      mainKey: 'deckSniper',
      encounterNo: 8,
      boardingCount: 8,
      finalBoarding: true,
      types: ['needler', 'sawbones', 'trainer'],
      playerRows: [[0, 0, 0]],
    });
    scene.applyCounterAmbush(combat, { silent: true });
    scene.finishBoardingCombat('win');
    assertCounterAmbusherReportCheck(!combat.counterAmbusherReport, 'final boarding marked ambusher report');
    results.push({ name: 'final victory boardings do not mark a useless ambusher report', ok: true });
  }

  {
    const { combat } = setupRegular({
      mainKey: 'deckSniper',
      types: ['sawbones', 'poisoner', 'trainer'],
      playerRows: [[0, 0, 0]],
    });
    const result = scene.applyCounterAmbush(combat, { silent: true });
    assertCounterAmbusherReportCheck(!result, 'missing-ambush setup unexpectedly ambushed');
    scene.finishBoardingCombat('win');
    assertCounterAmbusherReportCheck(!combat.counterAmbusherReport, 'missing ambush marked report');
    results.push({ name: 'wins without Counter Ambush do not report a pirate', ok: true });
  }

  {
    const { G, pirates, combat } = setupRegular();
    scene.applyCounterAmbush(combat, { silent: true });
    G.allCrew = G.allCrew.filter((pirate) => pirate && pirate.id !== pirates[0].id);
    scene.finishBoardingCombat('win');
    assertCounterAmbusherReportCheck(!combat.counterAmbusherReport, 'removed ambusher marked report');
    results.push({ name: 'ambushers no longer in crew do not report next', ok: true });
  }

  return { ok: true, checks: results };
}

function assertRouteSidekickReportCheck(condition, message) {
  if (!condition) throw new Error(`route sidekick report check failed: ${message}`);
}

function runRouteSidekickReportChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  const routes = [
    {
      label: 'Forest',
      mainKey: 'shellback',
      starterType: 'lumberjack',
      primary: 'poisoner',
      sideOffer: 'drummer',
      bountyRes: 'wood',
    },
    {
      label: 'Rocky',
      mainKey: 'powderBomber',
      starterType: 'miner',
      primary: 'sawbones',
      sideOffer: 'trainer',
      bountyRes: 'stone',
    },
    {
      label: 'Port',
      mainKey: 'deckSniper',
      starterType: 'armsman',
      primary: 'needler',
      sideOffer: 'survivalist',
      bountyRes: 'gold',
    },
  ];

  const routeFirstIsland = (map, mainKey) => {
    const firstShipLayer = map.layers.findIndex(layer => layer && layer.length === 1 && layer[0].type === 'ship');
    const routeCache = map.layers[firstShipLayer - 1].find(node => node && node.scoutedCache && node.scoutedCache.mainKey === mainKey);
    const firstIsland = routeCache && map.layers[0].includes(routeCache)
      ? routeCache
      : map.layers[0].find(node => node && Array.isArray(node.conns) && routeCache && node.conns.includes(routeCache.id));
    return { firstShipLayer, routeCache, firstIsland };
  };

  const resourceCount = (G, res) => Math.max(0, Math.floor(Number(G.res && G.res[res]) || 0));

  const buyOpeningSidekick = (route, seed = 0x51de51de) => {
    runtime.setSeed(seed >>> 0);
    api.initState();
    const G = api.getG();
    const { firstIsland } = routeFirstIsland(G.map, route.mainKey);
    assertRouteSidekickReportCheck(firstIsland && scene.applyMapNodeSelection(firstIsland.id), `${route.label} route selection failed`);
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = 0;
    G.openingCounterPlan = true;
    G.openingRouteCacheClaimedMainKey = route.mainKey;
    G.enthusiasm = api.TYPES[route.sideOffer].cost;
    G.shop = [route.primary, route.sideOffer, 'herald', 'survivalist'];
    const quote = scene.shopPurchaseQuote(route.sideOffer);
    const bountyRes = api.SCOUTED_COUNTER_CACHE_RES[route.mainKey];
    const bountyText = openingSidekickBountyTextForQuote(api, quote);
    assertRouteSidekickReportCheck(
      quote.canBuy
        && quote.openingSidePrep
        && quote.topDeck
        && !quote.counter
        && quote.openingSidekickBountyRes === bountyRes
        && bountyText.includes(api.RES_EMOJI[bountyRes]),
      `${route.label} sidekick quote mismatch: ${JSON.stringify(quote)}`
    );
    const sidekick = scene.buyPirate(1, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertRouteSidekickReportCheck(sidekick && sidekick.type === route.sideOffer, `${route.label} Opening Side Prep buy failed`);
    assertRouteSidekickReportCheck(G.openingRouteSidekick && G.openingRouteSidekick.pirateId === sidekick.id && G.openingRouteSidekick.mainKey === route.mainKey && G.openingRouteSidekick.type === route.sideOffer, `${route.label} wrong sidekick marker: ${JSON.stringify(G.openingRouteSidekick)}`);
    assertRouteSidekickReportCheck(!G.openingRouteCounterBoughtMainKey && G.openingRouteCounterBoughtPirateId == null, `${route.label} sidekick buy secured the route primary`);
    assertRouteSidekickReportCheck(!(G.counterWatchIds || []).includes(sidekick.id), `${route.label} sidekick gained Counter Watch`);
    return { G, sidekick };
  };

  const countRefs = (G, pirate) => [G.hand, G.deck, G.discard]
    .reduce((count, pile) => count + (Array.isArray(pile) ? pile.filter((entry) => entry === pirate).length : 0), 0);

  const continueBoardingImmediately = (G) => {
    scene.snapshotHandCardsForDiscard = () => (G.hand || []).filter(Boolean).map((pirate) => ({
      id: pirate.id,
      type: pirate.type,
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
    }));
    scene.animateCardsToDiscard = () => 0;
    scene.animateCardsToDraw = () => 0;
    scene.animateReshuffleToDraw = () => 0;
    scene.time.delayedCall = (_delay, cb) => {
      if (typeof cb === 'function') cb();
      return { hasDispatched: true, remove: () => {} };
    };
    scene.continueFromResolvedBoarding();
  };

  const setupBoarding = (route, opts = {}) => {
    const { G, sidekick } = buyOpeningSidekick(route, opts.seed || 0x51de51de);
    const ambusher = (G.allCrew || []).find(pirate => pirate && pirate.type === route.starterType && pirate.id !== sidekick.id);
    const filler = (G.allCrew || []).find(pirate => pirate && pirate.id !== sidekick.id && (!ambusher || pirate.id !== ambusher.id));
    [sidekick, ambusher, filler].filter(Boolean).forEach((pirate) => {
      pirate.wounded = false;
      pirate.weaponKey = null;
      pirate.might = 0;
      pirate.tempo = 0;
    });
    G.mode = opts.mode || 'run';
    G.phase = 'boarding';
    G.boardingCount = Math.max(1, Math.floor(Number(opts.boardingCount != null ? opts.boardingCount : 1) || 1));
    G.enemyShip = {
      strength: 6,
      encounterNo: G.boardingCount,
      encounter: { mainKey: route.mainKey, supportKeys: [], totalCount: 1 },
      boardingAlert: 0,
      boardingAlertGuards: 0,
    };
    G.deck = (G.deck || []).filter(pirate => pirate && pirate.id !== sidekick.id && (!ambusher || pirate.id !== ambusher.id));
    G.discard = [];
    G.hand = opts.hand || [sidekick, filler].filter(Boolean);
    G.sent = [];
    G.combat = {
      mode: 'fighting',
      encounterMainKey: route.mainKey,
      enemyParty: [],
      playerFighters: [],
      enemyFighters: [],
      boardingAlert: 0,
      boardingAlertGuards: 0,
      returnedPirateIds: [],
      reinforcementCount: Math.max(0, Math.floor(Number(opts.reinforcementCount) || 0)),
    };
    G.combat.playerFighters = (opts.playerPirates || [sidekick])
      .filter(Boolean)
      .map((pirate, index) => scene.buildPlayerCombatFighter(pirate, 0, index, G.combat));
    if (opts.counterAmbush && ambusher) {
      G.hand = [ambusher, sidekick, filler].filter(Boolean);
      G.deck = (G.deck || []).filter(pirate => pirate && pirate.id !== ambusher.id);
      G.combat.playerFighters = [ambusher, sidekick]
        .map((pirate, index) => scene.buildPlayerCombatFighter(pirate, 0, index, G.combat));
      G.combat.counterAmbush = {
        applied: true,
        pirateId: ambusher.id,
        type: ambusher.type,
        name: api.TYPES[ambusher.type].name,
        mainKey: route.mainKey,
      };
    }
    return { G, sidekick, ambusher, filler, combat: G.combat };
  };

  routes.forEach((route, index) => {
    const { G, sidekick, combat } = setupBoarding(route, { seed: 0x51de5101 + index });
    const before = resourceCount(G, route.bountyRes);
    scene.finishBoardingCombat('win');
    assertRouteSidekickReportCheck(combat.routeSidekickReport && combat.routeSidekickReport.pirateId === sidekick.id, `${route.label} winning Boarding 1 did not mark Route Sidekick Report`);
    assertRouteSidekickReportCheck(combat.routeSidekickBounty && combat.routeSidekickBounty.pirateId === sidekick.id, `${route.label} winning Boarding 1 did not mark Route Sidekick Bounty`);
    assertRouteSidekickReportCheck(combat.routeSidekickBounty.resource === route.bountyRes && combat.routeSidekickBounty.count === 1, `${route.label} wrong sidekick bounty: ${JSON.stringify(combat.routeSidekickBounty)}`);
    assertRouteSidekickReportCheck(resourceCount(G, route.bountyRes) === before + 1, `${route.label} sidekick bounty did not pay exactly +1 ${route.bountyRes}`);
    scene.markRouteSidekickReport(combat, 'win');
    assertRouteSidekickReportCheck(resourceCount(G, route.bountyRes) === before + 1, `${route.label} sidekick bounty duplicated on remark`);
    assertRouteSidekickReportCheck(!G.openingRouteSidekick, `${route.label} Route Sidekick marker did not clear after Boarding 1 resolved`);
    continueBoardingImmediately(G);
    assertRouteSidekickReportCheck(G.hand[0] === sidekick, `${route.label} reported sidekick was not drawn first`);
    assertRouteSidekickReportCheck(!G.deck.includes(sidekick) && !G.discard.includes(sidekick), `${route.label} reported sidekick remained in deck or discard`);
    assertRouteSidekickReportCheck(countRefs(G, sidekick) === 1, `${route.label} reported sidekick duplicated across piles`);
    results.push({ name: `${route.label} Opening Side Prep sidekick reports next and pays +1 ${route.bountyRes}`, ok: true });
  });

  {
    const route = routes[1];
    const { G, sidekick, ambusher, combat } = setupBoarding(route, { seed: 0x51de5104, counterAmbush: true });
    assertRouteSidekickReportCheck(ambusher, 'missing starter ambusher for priority setup');
    scene.finishBoardingCombat('win');
    assertRouteSidekickReportCheck(combat.counterAmbusherReport && combat.counterAmbusherReport.pirateId === ambusher.id, 'ambusher report was not marked');
    assertRouteSidekickReportCheck(combat.routeSidekickReport && combat.routeSidekickReport.pirateId === sidekick.id, 'sidekick report was not marked alongside ambusher');
    assertRouteSidekickReportCheck(combat.routeSidekickBounty && combat.routeSidekickBounty.resource === route.bountyRes, 'sidekick bounty was not marked alongside ambusher');
    continueBoardingImmediately(G);
    assertRouteSidekickReportCheck(G.hand[0] === ambusher && G.hand[1] === sidekick, 'ambusher did not draw above Route Sidekick');
    assertRouteSidekickReportCheck(countRefs(G, ambusher) === 1 && countRefs(G, sidekick) === 1, 'priority reports duplicated a pirate');
    results.push({ name: 'Counter Ambusher Report draws above Route Sidekick Report', ok: true });
  }

  {
    const route = routes[1];
    const { G, sidekick } = buyOpeningSidekick(route, 0x51de5105);
    scene.sacrificePirate(sidekick, 0, 0);
    assertRouteSidekickReportCheck(!G.openingRouteSidekick, 'removed sidekick left its marker active');
    results.push({ name: 'removed Route Sidekick markers clear immediately', ok: true });
  }

  const negativeRoute = routes[1];
  [
    {
      name: 'losses',
      setup: () => setupBoarding(negativeRoute, { seed: 0x51de5106 }),
      result: 'loss',
      check: ({ combat }) => !combat.routeSidekickReport,
    },
    {
      name: 'reinforcement-hand wins',
      setup: () => setupBoarding(negativeRoute, { seed: 0x51de5107, reinforcementCount: 1 }),
      result: 'win',
      check: ({ combat }) => !combat.routeSidekickReport,
    },
    {
      name: 'Battle Test',
      setup: () => setupBoarding(negativeRoute, { seed: 0x51de5108, mode: 'battleTest' }),
      result: 'win',
      check: ({ combat }) => !combat.routeSidekickReport,
    },
    {
      name: 'Boarding 2+',
      setup: () => setupBoarding(negativeRoute, { seed: 0x51de5109, boardingCount: 2 }),
      result: 'win',
      check: ({ combat }) => !combat.routeSidekickReport,
    },
    {
      name: 'wounded sidekicks',
      setup: () => {
        const setup = setupBoarding(negativeRoute, { seed: 0x51de5110 });
        setup.sidekick.wounded = true;
        setup.G.hand = [setup.sidekick, setup.filler].filter(Boolean);
        setup.combat.playerFighters = setup.filler
          ? [scene.buildPlayerCombatFighter(setup.filler, 0, 0, setup.combat)]
          : [];
        return setup;
      },
      result: 'win',
      check: ({ combat }) => !combat.routeSidekickReport,
    },
    {
      name: 'defeated sidekicks',
      setup: () => {
        const setup = setupBoarding(negativeRoute, { seed: 0x51de5111 });
        const fighter = setup.combat.playerFighters.find(entry => entry && entry.pirateId === setup.sidekick.id);
        if (fighter) scene.defeatCombatFighter(fighter, []);
        return setup;
      },
      result: 'win',
      check: ({ combat }) => !combat.routeSidekickReport,
    },
    {
      name: 'absent sidekicks',
      setup: () => {
        const setup = setupBoarding(negativeRoute, { seed: 0x51de5112 });
        setup.G.hand = [setup.filler].filter(Boolean);
        setup.combat.playerFighters = setup.filler
          ? [scene.buildPlayerCombatFighter(setup.filler, 0, 0, setup.combat)]
          : [];
        return setup;
      },
      result: 'win',
      check: ({ combat }) => !combat.routeSidekickReport,
    },
    {
      name: 'removed sidekicks',
      setup: () => {
        const setup = setupBoarding(negativeRoute, { seed: 0x51de5113 });
        setup.G.allCrew = (setup.G.allCrew || []).filter(pirate => pirate && pirate.id !== setup.sidekick.id);
        return setup;
      },
      result: 'win',
      check: ({ combat }) => !combat.routeSidekickReport,
    },
  ].forEach((negative) => {
    const setup = negative.setup();
    const before = resourceCount(setup.G, negativeRoute.bountyRes);
    scene.finishBoardingCombat(negative.result);
    assertRouteSidekickReportCheck(negative.check(setup), `${negative.name} marked Route Sidekick Report`);
    assertRouteSidekickReportCheck(!setup.combat.routeSidekickBounty, `${negative.name} marked Route Sidekick Bounty`);
    assertRouteSidekickReportCheck(resourceCount(setup.G, negativeRoute.bountyRes) === before, `${negative.name} paid Route Sidekick Bounty`);
    assertRouteSidekickReportCheck(!setup.G.openingRouteSidekick, `${negative.name} did not clear Route Sidekick marker`);
    results.push({ name: `${negative.name} do not Route Sidekick Report or Bounty`, ok: true });
  });

  {
    const route = routes[1];
    const { G } = buyOpeningSidekick(route, 0x51de5114);
    G.openingRouteSidekick = null;
    G.phase = 'shopping';
    G.openingCounterPlan = false;
    G.enthusiasm = api.TYPES[route.sideOffer].cost;
    G.shop = [route.sideOffer, route.primary, 'herald', 'survivalist'];
    const quote = scene.shopPurchaseQuote(route.sideOffer);
    assertRouteSidekickReportCheck(quote.canBuy && !quote.openingSidePrep && !quote.topDeck, `ordinary side offer quote unexpectedly used Side Prep: ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertRouteSidekickReportCheck(bought && bought.type === route.sideOffer, 'ordinary side offer buy failed');
    assertRouteSidekickReportCheck(!G.openingRouteSidekick, `ordinary side offer marked Route Sidekick: ${JSON.stringify(G.openingRouteSidekick)}`);
    const before = resourceCount(G, route.bountyRes);
    G.phase = 'boarding';
    G.boardingCount = 1;
    G.enemyShip = {
      strength: 6,
      encounterNo: 1,
      encounter: { mainKey: route.mainKey, supportKeys: [], totalCount: 1 },
      boardingAlert: 0,
      boardingAlertGuards: 0,
    };
    G.hand = [bought];
    G.combat = {
      mode: 'fighting',
      encounterMainKey: route.mainKey,
      enemyParty: [],
      playerFighters: [],
      enemyFighters: [],
      boardingAlert: 0,
      boardingAlertGuards: 0,
      returnedPirateIds: [],
      reinforcementCount: 0,
    };
    G.combat.playerFighters = [scene.buildPlayerCombatFighter(bought, 0, 0, G.combat)];
    scene.finishBoardingCombat('win');
    assertRouteSidekickReportCheck(!G.combat.routeSidekickReport && !G.combat.routeSidekickBounty, 'ordinary side offer triggered sidekick report or bounty');
    assertRouteSidekickReportCheck(resourceCount(G, route.bountyRes) === before, 'ordinary side offer paid Route Sidekick Bounty');
    results.push({ name: 'ordinary side-offer buys do not mark Route Sidekick Report or Bounty', ok: true });
  }

  return { ok: true, checks: results };
}

function runPortDrillChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];

  const setup = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.round = 1;
    G.boardingCount = 0;
    G.phase = opts.phase || 'sending';
    G.island = scene.buildIslandState(api.ISLANDS[opts.islandIdx != null ? opts.islandIdx : 3]);
    G.sent = [];
    const sentCount = Math.max(0, Math.floor(Number(opts.sent) || 0));
    for (let i = 0; i < sentCount; i++) G.sent.push(i);
    scene._sacrificedIds.clear();
    if (opts.sacrificeFirst && G.hand[0]) scene._sacrificedIds.add(G.hand[0].id);
    G.hand.forEach((pirate, index) => {
      pirate.tempo = index === 0 ? 2 : 0;
      pirate.might = 0;
    });
    return G;
  };

  const check = (name, opts, expectedTempos) => {
    const G = setup(opts);
    const before = G.hand.map(p => p.tempo || 0);
    const result = applyPortDrillForSim(scene);
    expectedTempos.forEach((tempo, index) => {
      assertPortDrillCheck((G.hand[index].tempo || 0) === tempo, `${name} hand ${index} tempo ${G.hand[index].tempo || 0} !== ${tempo}`);
    });
    results.push({
      name,
      ok: true,
      applied: !!(result && result.applied),
      before: before.slice(0, expectedTempos.length),
      after: G.hand.slice(0, expectedTempos.length).map(p => p.tempo || 0),
    });
  };

  check('full regular port stacks leftmost tempo', { islandIdx: 3, sent: 3 }, [3, 0, 0]);
  check('partial port does not drill', { islandIdx: 3, sent: 2 }, [2, 0, 0]);
  check('full non-port does not drill', { islandIdx: 0, sent: 2 }, [2, 0, 0]);
  check('battle test port does not drill', { mode: 'battleTest', islandIdx: 3, sent: 3 }, [2, 0, 0]);
  check('infirmary does not drill', { islandIdx: 6, sent: 5 }, [2, 0, 0]);
  check('drill skips removed leftmost sent pirate', { islandIdx: 3, sent: 3, sacrificeFirst: true }, [2, 1, 0]);

  const G = setup({ islandIdx: 3, sent: 2 });
  const endLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(2));
  const fillLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(3, { includePortDrill: true }));
  assertPortDrillCheck(!endLine.includes('Port Drill'), 'partial End now line mentions Port Drill');
  assertPortDrillCheck(fillLine.includes('Port Drill +⚡'), 'Fill crew line does not mention Port Drill');
  assertPortDrillCheck(scene.islandDescription().includes('Full crew'), 'island description does not mention full crew drill');
  results.push({
    name: 'projection text gates drill reward',
    ok: true,
    endLine,
    fillLine,
    islandDescription: scene.islandDescription(),
    sent: G.sent.length,
  });

  return { ok: true, checks: results };
}

function runShortCrewDrillChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];

  const setup = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.map = Object.prototype.hasOwnProperty.call(opts, 'map')
      ? opts.map
      : makeScoutedCounterTestMap('powderBomber');
    G.round = Math.max(1, Math.floor(Number(opts.round) || 3));
    G.boardingCount = 0;
    G.phase = opts.phase || 'sending';
    G.island = scene.buildIslandState(api.ISLANDS[opts.islandIdx != null ? opts.islandIdx : 0]);
    G.sent = [];
    const sentCount = Math.max(0, Math.floor(Number(opts.sent) || 0));
    for (let i = 0; i < sentCount; i++) G.sent.push(i);
    G.enthusiasm = 0;
    G.boardingAlert = Math.max(0, Math.floor(Number(opts.alert) || 0));
    G.fullCrewDiscount = 0;
    G.shortCrewReportIds = [];
    G.counterWatchIds = [];
    scene._sendingToIsland.clear();
    scene._sacrificedIds.clear();
    G.hand.forEach((pirate, index) => {
      pirate.might = index === 0 ? 2 : 0;
      pirate.tempo = 0;
    });
    if (G.hand[0] && !opts.keepFirstType) G.hand[0].type = opts.firstType || 'lumberjack';
    if (opts.removeSent) {
      G.sent.forEach((handIdx) => {
        const pirate = G.hand[handIdx];
        if (!pirate) return;
        removePirateById(G, pirate.id);
        scene._sacrificedIds.add(pirate.id);
      });
    }
    return G;
  };

  const checkMight = (name, opts, expectedMights, expectedApplied) => {
    const G = setup(opts);
    const before = G.hand.map(p => p.might || 0);
    const result = applyShortCrewDrillForSim(scene);
    assertShortCrewDrillCheck(!!(result && result.applied) === expectedApplied, `${name} applied ${!!(result && result.applied)} !== ${expectedApplied}`);
    const expectedReport = opts.expectedReport != null ? !!opts.expectedReport : !!(expectedApplied && scene.shortCrewReportsEarly && scene.shortCrewReportsEarly());
    assertShortCrewDrillCheck(!!(result && result.reportEarly) === expectedReport, `${name} reportEarly ${!!(result && result.reportEarly)} !== ${expectedReport}`);
    const expectedWatch = opts.expectedWatch != null ? !!opts.expectedWatch : false;
    assertShortCrewDrillCheck(!!(result && result.counterWatch) === expectedWatch, `${name} counterWatch ${!!(result && result.counterWatch)} !== ${expectedWatch}`);
    const reportIds = Array.isArray(G.shortCrewReportIds) ? G.shortCrewReportIds : [];
    assertShortCrewDrillCheck(reportIds.length === (expectedReport ? 1 : 0), `${name} report ids ${reportIds.length} !== ${expectedReport ? 1 : 0}`);
    const watchIds = Array.isArray(G.counterWatchIds) ? G.counterWatchIds : [];
    assertShortCrewDrillCheck(watchIds.length === (expectedWatch ? 1 : 0), `${name} watch ids ${watchIds.length} !== ${expectedWatch ? 1 : 0}`);
    expectedMights.forEach((might, index) => {
      assertShortCrewDrillCheck((G.hand[index].might || 0) === might, `${name} hand ${index} might ${G.hand[index].might || 0} !== ${might}`);
    });
    results.push({
      name,
      ok: true,
      applied: !!(result && result.applied),
      reportEarly: !!(result && result.reportEarly),
      before: before.slice(0, expectedMights.length),
      after: G.hand.slice(0, expectedMights.length).map(p => p.might || 0),
    });
    return { G, result };
  };

  const settleShipWagesWithShortCrewRefund = (G, result) => {
    const alertFloorBeforeWages = Math.max(0, Math.floor(Number(G.boardingAlert) || 0));
    applyShipWagesForSim(scene, G);
    return applyShortCrewCounterAlertRefundForSim(scene, result, alertFloorBeforeWages);
  };

  {
    const { G, result } = checkMight('normal 1-of-2 grants leftmost Might', { islandIdx: 0, sent: 1 }, [3, 0], true);
    const drilled = G.hand[0];
    const refund = settleShipWagesWithShortCrewRefund(G, result);
    assertShortCrewDrillCheck(G.enthusiasm === 2, `normal 1-of-2 wages ${G.enthusiasm} !== 2`);
    assertShortCrewDrillCheck(G.boardingAlert === 1, `normal 1-of-2 alert ${G.boardingAlert} !== 1`);
    assertShortCrewDrillCheck(!refund || refund.amount === 0, `normal non-counter refunded alert ${refund && refund.amount}`);
    results.push({ name: 'normal 1-of-2 non-counter still pays normal Ship Wages and Alert', ok: true, enthusiasm: G.enthusiasm, boardingAlert: G.boardingAlert });
    const shopTop = { id: 9100, type: 'sawbones', weaponKey: null, might: 0, tempo: 0, wounded: false };
    G.allCrew.push(shopTop);
    G.deck = [shopTop];
    G.discard = [];
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertShortCrewDrillCheck(G.hand[0] === drilled, 'nearby Short Crew drilled pirate was not drawn first after Shop Continue');
    assertShortCrewDrillCheck(G.hand[1] === shopTop, 'nearby Short Crew report did not stay above existing top-deck shop purchase');
    assertShortCrewDrillCheck((G.shortCrewReportIds || []).length === 0, 'Short Crew report marker was not cleared on Continue');
    const zones = [...(G.hand || []), ...(G.deck || []), ...(G.discard || [])].filter(p => p && p.id === drilled.id);
    assertShortCrewDrillCheck(zones.length === 1, `Short Crew drilled pirate duplicated across zones ${zones.length} times`);
    results.push({ name: 'nearby Short Crew report places the drilled pirate above shop top-deck cards without duplication', ok: true });
  }

  {
    const G = setup({ islandIdx: 0, sent: 1, alert: 2 });
    G.hand[0].type = 'sawbones';
    G.hand[0].might = 2;
    G.shortCrewReportIds = [];
    const result = applyShortCrewDrillForSim(scene);
    assertShortCrewDrillCheck(result && result.applied && result.reportEarly, 'counter 1-of-2 did not gain Might and report early');
    assertShortCrewDrillCheck((G.hand[0].might || 0) === 3, `counter 1-of-2 might ${G.hand[0].might || 0} !== 3`);
    assertShortCrewDrillCheck(result.counterAlertRefund && result.counterAlertRefund.eligible, 'counter 1-of-2 did not qualify for Alert refund');
    assertShortCrewDrillCheck(result.counterWatch, 'counter 1-of-2 did not gain Counter Watch');
    assertShortCrewDrillCheck((G.counterWatchIds || []).includes(G.hand[0].id), 'counter 1-of-2 did not keep Counter Watch marker');
    const refund = settleShipWagesWithShortCrewRefund(G, result);
    assertShortCrewDrillCheck(G.enthusiasm === 2, `counter 1-of-2 wages ${G.enthusiasm} !== 2`);
    assertShortCrewDrillCheck(G.boardingAlert === 2, `counter 1-of-2 alert ${G.boardingAlert} did not return to pre-wage floor 2`);
    assertShortCrewDrillCheck(refund && refund.amount === 1 && refund.floor === 2, `counter 1-of-2 refund ${JSON.stringify(refund)}`);
    assertShortCrewDrillCheck((G.shortCrewReportIds || []).includes(G.hand[0].id), 'counter 1-of-2 did not keep report marker');
    const drilled = G.hand[0];
    const shopTop = { id: 9102, type: 'needler', weaponKey: null, might: 0, tempo: 0, wounded: false };
    G.allCrew.push(shopTop);
    G.deck = [shopTop];
    G.discard = [];
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertShortCrewDrillCheck(G.hand[0] === drilled, 'counter Short Crew report did not draw drilled pirate first');
    assertShortCrewDrillCheck(G.hand[1] === shopTop, 'counter Short Crew report duplicated or skipped the existing top-deck card');
    assertShortCrewDrillCheck((G.counterWatchIds || []).includes(drilled.id), 'counter Short Crew Watch did not persist after report draw');
    G.phase = 'shopping';
    G.sent = [];
    G.deck = [];
    G.discard = [];
    prepareNextRoundForSim(api, scene);
    assertShortCrewDrillCheck(G.hand[0] === drilled, 'held Counter Short Crew Watch did not return drilled pirate first on later Continue');
    assertShortCrewDrillCheck((G.counterWatchIds || []).includes(drilled.id), 'Counter Short Crew Watch did not persist while held before boarding');
    const zones = [...(G.hand || []), ...(G.deck || []), ...(G.discard || [])].filter(p => p && p.id === drilled.id);
    assertShortCrewDrillCheck(zones.length === 1, `counter Short Crew watched pirate duplicated across zones ${zones.length} times`);
    results.push({ name: 'counter 1-of-2 refunds Alert, reports once, and keeps Counter Watch for later Shop Continues', ok: true, refund, boardingAlert: G.boardingAlert });
  }

  checkMight('port 2-of-3 grants Short Crew Might', { islandIdx: 3, sent: 2 }, [3, 0, 0], true);
  {
    const G = setup({ islandIdx: 3, sent: 2, alert: 4, map: makeScoutedCounterTestMap('shellback') });
    G.hand[0].type = 'poisoner';
    G.hand[0].might = 0;
    G.hand[1].type = 'rigger';
    const result = applyShortCrewDrillForSim(scene);
    assertShortCrewDrillCheck(result && result.applied, 'counter Port 2-of-3 did not trigger Short Crew Drill');
    assertShortCrewDrillCheck((G.hand[0].might || 0) === 1, `counter Port 2-of-3 might ${G.hand[0].might || 0} !== 1`);
    const refund = settleShipWagesWithShortCrewRefund(G, result);
    assertShortCrewDrillCheck(G.enthusiasm === 2, `counter Port 2-of-3 wages ${G.enthusiasm} !== 2`);
    assertShortCrewDrillCheck(G.boardingAlert === 4, `counter Port 2-of-3 alert ${G.boardingAlert} did not return to pre-wage floor 4`);
    assertShortCrewDrillCheck(refund && refund.amount === 1, `counter Port 2-of-3 refund ${JSON.stringify(refund)}`);
    results.push({ name: 'counter Port 2-of-3 refunds exactly one Ship Wages Alert', ok: true, refund, boardingAlert: G.boardingAlert });
  }
  checkMight('distant 1-of-2 grants Might without report', { islandIdx: 0, sent: 1, map: makeDistantScoutedCounterTestMap('powderBomber'), expectedReport: false }, [3, 0], true);
  checkMight('full normal send does not drill', { islandIdx: 0, sent: 2 }, [2, 0], false);
  checkMight('empty normal send does not drill', { islandIdx: 0, sent: 0 }, [2, 0], false);
  checkMight('port 1-of-3 leaves two unused slots and does not drill', { islandIdx: 3, sent: 1 }, [2, 0, 0], false);
  checkMight('battle test partial send does not drill', { mode: 'battleTest', islandIdx: 0, sent: 1 }, [2, 0], false);
  checkMight('infirmary sending state does not drill', { islandIdx: 6, sent: 4 }, [2, 0], false);
  checkMight('healing phase does not drill', { phase: 'healing', islandIdx: 6, sent: 4 }, [2, 0], false);
  checkMight('Siren-removed sent pirate does not drill', { islandIdx: 5, sent: 1, removeSent: true }, [2, 0], false);

  {
    const G = setup({ islandIdx: 3, sent: 3 });
    const shortResult = applyShortCrewDrillForSim(scene);
    const portResult = applyPortDrillForSim(scene);
    assertShortCrewDrillCheck(!shortResult, 'full Port send received Short Crew Drill');
    assertShortCrewDrillCheck(portResult && portResult.applied, 'full Port send did not receive Port Drill');
    assertShortCrewDrillCheck((G.hand[0].might || 0) === 2, `full Port changed Might to ${G.hand[0].might || 0}`);
    assertShortCrewDrillCheck((G.hand[0].tempo || 0) === 1, `full Port tempo ${G.hand[0].tempo || 0} !== 1`);
    results.push({ name: 'full Port send triggers Port Drill instead of Short Crew Drill', ok: true });
  }

  {
    setup({ islandIdx: 0, sent: 0 });
    const rows = scene.sendingPlanRows();
    const labels = rows.map(row => row.label).join('|');
    assertShortCrewDrillCheck(labels === 'End now|One short|Fill crew', `initial plan labels ${labels}`);
    const oneShortLine = scene.formatSendingPlanLine(rows[1].plan);
    assertShortCrewDrillCheck(oneShortLine.includes('Short Crew +💪'), 'initial One short row does not expose Short Crew Might');
    assertShortCrewDrillCheck(oneShortLine.includes('counter refunds Alert'), `initial One short row does not explain counter refund: ${oneShortLine}`);

    const G = setup({ islandIdx: 0, sent: 1 });
    const line = scene.formatSendingPlanLine(scene.sendingPlanProjection(1));
    assertShortCrewDrillCheck(line.includes('Short Crew +💪'), 'partial plan line does not expose Short Crew Might');
    assertShortCrewDrillCheck(line.includes('reports next'), `nearby partial plan line does not expose Short Crew report: ${line}`);
    assertShortCrewDrillCheck(line.includes('leftmost counter refunds Alert'), `nearby partial plan line does not explain counter refund condition: ${line}`);
    G.hand[0].type = 'sawbones';
    const counterLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(1));
    assertShortCrewDrillCheck(counterLine.includes('Alert +1->+0'), `counter partial line does not show net Alert refund: ${counterLine}`);
    assertShortCrewDrillCheck(counterLine.includes('counter refunds Alert'), `counter partial line does not show active counter refund: ${counterLine}`);
    assertShortCrewDrillCheck(counterLine.includes('Watch'), `counter partial line does not expose Counter Watch: ${counterLine}`);
    const fullLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(2, { includePortDrill: true }));
    assertShortCrewDrillCheck(!fullLine.includes('Short Crew'), 'full-send line mentions Short Crew');
    setup({ islandIdx: 3, sent: 2 });
    const portLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(2));
    assertShortCrewDrillCheck(portLine.includes('Short Crew +💪') && portLine.includes('reports next'), 'Port partial plan line does not expose Short Crew report');
    setup({ islandIdx: 0, sent: 1, map: makeDistantScoutedCounterTestMap('powderBomber') });
    const distantLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(1));
    assertShortCrewDrillCheck(distantLine.includes('Short Crew +💪') && !distantLine.includes('reports next'), `distant partial plan line should not report next: ${distantLine}`);
    results.push({ name: 'projection text exposes initial One short row, Short Crew report, and counter Alert refund', ok: true, oneShortLine, line, counterLine, fullLine, portLine, distantLine });
  }

  {
    const G = setup({ islandIdx: 3, sent: 2, map: makeScoutedCounterTestMap('shellback') });
    const shortPirate = G.hand[0];
    const cachePirate = G.hand[1];
    shortPirate.type = 'lumberjack';
    cachePirate.type = 'poisoner';
    shortPirate.might = 0;
    cachePirate.might = 0;
    G.island.scoutedCacheDrill = {
      mainKey: 'shellback',
      granted: false,
      alertRefunded: false,
      alertRefundAmount: 0,
      alertFloorBeforeCache: 0,
    };
    const cacheReward = applyScoutedCacheDrillForSim(scene, cachePirate);
    const shortReward = applyShortCrewDrillForSim(scene);
    assertShortCrewDrillCheck(cacheReward && cacheReward.applied, 'coexisting Cache Drill setup did not mark cache pirate');
    assertShortCrewDrillCheck(shortReward && shortReward.applied && shortReward.reportEarly, 'coexisting Short Crew setup did not mark short pirate');
    const shopTop = { id: 9101, type: 'sawbones', weaponKey: null, might: 0, tempo: 0, wounded: false };
    G.allCrew.push(shopTop);
    G.deck = [shopTop];
    G.discard = [];
    G.phase = 'shopping';
    prepareNextRoundForSim(api, scene);
    assertShortCrewDrillCheck(G.hand[0] === cachePirate, 'Cache Drill report was not drawn before Short Crew report');
    assertShortCrewDrillCheck(G.hand[1] === shortPirate, 'Short Crew report was not drawn after Cache Drill report');
    assertShortCrewDrillCheck(G.hand[2] === shopTop, 'shop top-deck card was not drawn after both report cards');
    const cacheZones = [...(G.hand || []), ...(G.deck || []), ...(G.discard || [])].filter(p => p && p.id === cachePirate.id);
    const shortZones = [...(G.hand || []), ...(G.deck || []), ...(G.discard || [])].filter(p => p && p.id === shortPirate.id);
    assertShortCrewDrillCheck(cacheZones.length === 1 && shortZones.length === 1, `coexisting reports duplicated cards cache=${cacheZones.length} short=${shortZones.length}`);
    results.push({ name: 'Cache Drill reports draw before Short Crew reports and both stay above shop top-deck cards', ok: true });
  }

  return { ok: true, checks: results };
}

function prepareNextRoundForSim(api, scene) {
  const G = api.getG();
  if (G.phase !== 'shopping') return;

  const allCrewIds = new Set((G.allCrew || []).filter(Boolean).map(p => p.id));
  const reports = scene && typeof scene.consumeEarlyReportPirates === 'function'
    ? scene.consumeEarlyReportPirates()
    : {
      cache: scene && typeof scene.consumeCacheDrillMusterPirates === 'function'
        ? scene.consumeCacheDrillMusterPirates()
        : [],
      shortCrew: [],
      ids: new Set(),
    };
  if (!reports.ids || typeof reports.ids.has !== 'function') {
    reports.ids = new Set([...(reports.cache || []), ...(reports.shortCrew || [])].map(p => p && p.id));
  }
  const openingRouteMuster = scene && typeof scene.consumeOpeningRouteMusterPirates === 'function'
    ? scene.consumeOpeningRouteMusterPirates(reports.ids)
    : [];
  const watchSkipIds = new Set(reports.ids);
  (openingRouteMuster || []).forEach(p => {
    if (p && p.id != null) watchSkipIds.add(p.id);
  });
  const counterWatch = scene && typeof scene.consumeCounterWatchPirates === 'function'
    ? scene.consumeCounterWatchPirates(watchSkipIds, {
      preserveSentIds: new Set((reports.shortCrew || []).map(p => p && p.id)),
    })
    : [];
  const topDeckReturnIds = new Set(reports.ids);
  (openingRouteMuster || []).forEach(p => {
    if (p && p.id != null) topDeckReturnIds.add(p.id);
  });
  (counterWatch || []).forEach(p => {
    if (p && p.id != null) topDeckReturnIds.add(p.id);
  });
  G.discard.push(...(G.hand || []).filter(p => p && allCrewIds.has(p.id) && !topDeckReturnIds.has(p.id)));
  if (scene && typeof scene.placeCounterWatchPiratesOnDeck === 'function') {
    scene.placeCounterWatchPiratesOnDeck(counterWatch || []);
  } else if (counterWatch && counterWatch.length) {
    const watchIds = new Set(counterWatch.map(p => p.id));
    G.deck = (G.deck || []).filter(p => p && !watchIds.has(p.id));
    G.discard = (G.discard || []).filter(p => p && !watchIds.has(p.id));
    counterWatch.forEach(p => G.deck.push(p));
  }
  if (scene && typeof scene.placeOpeningRouteMusterPiratesOnDeck === 'function') {
    scene.placeOpeningRouteMusterPiratesOnDeck(openingRouteMuster || []);
  } else if (openingRouteMuster && openingRouteMuster.length) {
    const musterIds = new Set(openingRouteMuster.map(p => p.id));
    G.deck = (G.deck || []).filter(p => p && !musterIds.has(p.id));
    G.discard = (G.discard || []).filter(p => p && !musterIds.has(p.id));
    openingRouteMuster.forEach(p => G.deck.push(p));
  }
  if (scene && typeof scene.placeShortCrewReportPiratesOnDeck === 'function') {
    scene.placeShortCrewReportPiratesOnDeck(reports.shortCrew || []);
  } else if (reports.shortCrew && reports.shortCrew.length) {
    const shortCrewIds = new Set(reports.shortCrew.map(p => p.id));
    G.deck = (G.deck || []).filter(p => p && !shortCrewIds.has(p.id));
    G.discard = (G.discard || []).filter(p => p && !shortCrewIds.has(p.id));
    reports.shortCrew.forEach(p => G.deck.push(p));
  }
  if (scene && typeof scene.placeCacheDrillMusterPiratesOnDeck === 'function') {
    scene.placeCacheDrillMusterPiratesOnDeck(reports.cache || []);
  } else if (reports.cache && reports.cache.length) {
    const cacheIds = new Set(reports.cache.map(p => p.id));
    G.deck = (G.deck || []).filter(p => p && !cacheIds.has(p.id));
    G.discard = (G.discard || []).filter(p => p && !cacheIds.has(p.id));
    reports.cache.forEach(p => G.deck.push(p));
  }
  G.hand = [];
  G.sent = [];
  G.enthusiasm = 0;
  G.busy = false;
  G.enemyShip = null;
  G.island = null;
  G.healing = null;
  G.combat = null;
  G.fullCrewDiscount = 0;
  G.openingCounterPlan = false;
  if (scene && scene._sendingToIsland) scene._sendingToIsland.clear();
  if (scene) scene._pendingEndSending = false;
  G.hand = api.drawCards(5);
  G.phase = 'map';
}

function runHeuristicSendingAndShipPhase(runtime, api, scene) {
  const G = api.getG();
  const maxSend = scene.maxSend();

  while (G.sent.length < maxSend) {
    const sentSet = new Set(G.sent);
    const candidates = [];
    for (let i = 0; i < G.hand.length; i++) {
      if (sentSet.has(i)) continue;
      if (!canSend(api, G, i)) continue;
      candidates.push(i);
    }
    if (!candidates.length) break;

    const handIdx = pickRandom(runtime, candidates);
    G.sent.push(handIdx);
    const pirate = G.hand[handIdx];
    scene.resolveIsland(pirate);

    if (G.island && G.island.sacrifice) {
      removePirateById(G, pirate.id);
      scene._sacrificedIds.add(pirate.id);
    }
    applyScoutedCacheDrillForSim(scene, pirate);
  }

  applyPortDrillForSim(scene);
  const shortCrewResult = applyShortCrewDrillForSim(scene);
  const alertFloorBeforeWages = Math.max(0, Math.floor(Number(G.boardingAlert) || 0));
  updateFullCrewDiscountForSim(scene, G);
  updateOpeningCounterPlanForSim(scene, G);
  applyShipWagesForSim(scene, G);
  applyShortCrewCounterAlertRefundForSim(scene, shortCrewResult, alertFloorBeforeWages);

  const queue = [];
  for (let i = 0; i < G.hand.length; i++) {
    if (!G.sent.includes(i)) queue.push(i);
  }

  for (const hi of queue) {
    const pirate = G.hand[hi];
    if (!pirate) continue;
    const def = api.TYPES[pirate.type];
    if (!def || !def.ship) continue;

    if (def.ship.removeSelf) {
      removePirateById(G, pirate.id);
      continue;
    }

    if (def.ship.removeFromDeck) {
      if (def.ship.cRes && (G.res[def.ship.cRes] || 0) < def.ship.cN) continue;
      const handIds = new Set(G.hand.map(p => p.id));
      const candidates = G.allCrew.filter(p => !handIds.has(p.id));
      if (!candidates.length) continue;
      if (def.ship.cRes) G.res[def.ship.cRes] -= def.ship.cN;
      const target = pickRandom(runtime, candidates);
      removePirateById(G, target.id);
      continue;
    }

    scene.resolveShip(pirate);
  }

  G.phase = 'shopping';
  G.shopCreditUsed = false;
  G.fullCrewDiscount = Math.max(0, Math.min(1, Math.floor(Number(G.fullCrewDiscount) || 0)));
}

async function runModelMapChoice(runtime, api, scene, policy, actionCap, decisions) {
  const G = api.getG();
  const ctx = buildMapDecision(api, G, actionCap);
  if (!ctx || !ctx.options.length) return false;
  const actionId = await decideAction(runtime, policy, ctx);
  const selected = ctx.options[actionId];
  decisions.push({
    kind: 'map',
    tokens: ctx.tokens,
    mask: ctx.mask,
    action: actionId,
    round: G.round,
    policy: policy.name,
    nodeId: selected.nodeId,
  });
  if (!scene.applyMapNodeSelection(selected.nodeId)) {
    throw new Error(`failed to apply map node=${selected.nodeId}`);
  }
  return true;
}

async function runModelSendingAndShipPhase(runtime, api, scene, policy, typeIndexMap, actionCap, decisions) {
  const G = api.getG();

  let sendGuard = 0;
  while (sendGuard < 32) {
    sendGuard++;
    const ctx = buildSendingDecision(api, G, scene, typeIndexMap, actionCap);
    const actionId = await decideAction(runtime, policy, ctx);
    const selected = ctx.options[actionId];
    decisions.push({
      kind: 'sending',
      tokens: ctx.tokens,
      mask: ctx.mask,
      action: actionId,
      round: G.round,
      policy: policy.name,
      sentCount: G.sent.length,
      selected: selected.type,
    });

    if (selected.type === 'end_sending') break;

    const handIdx = selected.handIdx;
    G.sent.push(handIdx);
    const pirate = G.hand[handIdx];
    scene.resolveIsland(pirate);
    if (G.island && G.island.sacrifice) {
      removePirateById(G, pirate.id);
      scene._sacrificedIds.add(pirate.id);
    }
    applyScoutedCacheDrillForSim(scene, pirate);
    if (G.sent.length >= scene.maxSend()) break;
  }

  applyPortDrillForSim(scene);
  const shortCrewResult = applyShortCrewDrillForSim(scene);
  const alertFloorBeforeWages = Math.max(0, Math.floor(Number(G.boardingAlert) || 0));
  updateFullCrewDiscountForSim(scene, G);
  updateOpeningCounterPlanForSim(scene, G);
  applyShipWagesForSim(scene, G);
  applyShortCrewCounterAlertRefundForSim(scene, shortCrewResult, alertFloorBeforeWages);

  const queue = [];
  for (let i = 0; i < G.hand.length; i++) {
    if (!G.sent.includes(i)) queue.push(i);
  }

  for (const hi of queue) {
    const pirate = G.hand[hi];
    if (!pirate) continue;
    const def = api.TYPES[pirate.type];
    if (!def || !def.ship) continue;

    if (def.ship.removeSelf) {
      removePirateById(G, pirate.id);
      continue;
    }

    if (def.ship.removeFromDeck) {
      if (def.ship.cRes && (G.res[def.ship.cRes] || 0) < def.ship.cN) continue;
      const handIds = new Set(G.hand.map(p => p.id));
      const targets = G.allCrew.filter(p => !handIds.has(p.id));
      if (!targets.length) continue;

      const ctx = buildRemoveDecision(api, G, pirate.type, targets, typeIndexMap, actionCap);
      const actionId = await decideAction(runtime, policy, ctx);
      const chosen = ctx.options[actionId].pirate;
      decisions.push({
        kind: 'remove',
        tokens: ctx.tokens,
        mask: ctx.mask,
        action: actionId,
        round: G.round,
        policy: policy.name,
        removerType: pirate.type,
        removedType: chosen.type,
      });
      if (def.ship.cRes) G.res[def.ship.cRes] -= def.ship.cN;
      removePirateById(G, chosen.id);
      continue;
    }

    scene.resolveShip(pirate);
  }

  G.phase = 'shopping';
  G.shopCreditUsed = false;
  G.fullCrewDiscount = Math.max(0, Math.min(1, Math.floor(Number(G.fullCrewDiscount) || 0)));
}

async function runShoppingPhase(
  runtime,
  api,
  scene,
  purchases,
  policy,
  datasetWriter,
  typeIndexMap,
  actionCap,
  decisions
) {
  const G = api.getG();
  let buysThisShop = 0;

  while (true) {
    const ctx = buildShopDecision(api, G, buysThisShop, typeIndexMap, actionCap);
    if (policy.name === 'heuristic') {
      ctx.heuristicAction = pickHeuristicShopAction(runtime, api, G, buysThisShop);
    }
    const actionId = await decideAction(runtime, policy, ctx);
    const selected = ctx.options[actionId];

    if (datasetWriter) {
      datasetWriter.write({
        tokens: ctx.tokens,
        mask: ctx.mask,
        action: actionId,
        round: G.round,
        buysThisShop,
        policy: policy.name,
      });
    }
    decisions.push({
      kind: 'shop',
      tokens: ctx.tokens,
      mask: ctx.mask,
      action: actionId,
      round: G.round,
      buysThisShop,
      policy: policy.name,
      selected: selected.type,
    });

    if (selected.type === 'skip_shop') break;
    if (selected.type === 'quiet_docks') {
      const used = scene.useQuietDocks({
        deferRender: true,
        silent: true,
        skipPanelRefresh: true,
      });
      if (!used) break;
      purchases.push('Quiet Docks');
      continue;
    }
    const idx = selected.slot;
    const boughtType = G.shop[idx];
    const quote = boughtType ? shopPurchaseQuote(api, G, boughtType) : null;
    const bought = scene.buyPirate(idx, {
      deferRender: true,
      silent: true,
      ignoreAnimating: true,
      skipModalRefresh: true,
    });
    if (!bought) break;
    if (boughtType) {
      const label = api.TYPES[boughtType].name || boughtType;
      const coverText = quote && quote.routeCounterCover > 0 ? `, Cover -${quote.routeCounterCover} Alert` : '';
      if (quote && quote.alarmRushedRouteCounter && quote.credit) purchases.push(`${label} (Alarm rush +${quote.alert} Alert${coverText})`);
      else if (quote && quote.alarmRushedRouteCounter) purchases.push(`${label} (Alarm rush${coverText})`);
      else if (quote && quote.credit) purchases.push(`${label} (Credit +${quote.alert} Alert${coverText})`);
      else if (quote && quote.openingCounterPrepMight) purchases.push(`${label} (Opening Prep -${quote.openingCounterPrepDiscount || 0}☠️ +💪${coverText})`);
      else if (quote && quote.openingSidePrep) {
        const sidekickBountyText = openingSidekickBountyTextForQuote(api, quote);
        purchases.push(`${label} (Side Prep -${quote.openingCounterPrepDiscount || 0}☠️, ${[openingSidePrepSupportTextForQuote(api, quote), sidekickBountyText].filter(Boolean).join(', ')}${coverText})`);
      }
      else if (quote && quote.fullCrewCoverage > 0) purchases.push(`${label} (Full Crew covers ${quote.fullCrewCoverage}☠️${coverText})`);
      else if (quote && quote.discount > 0) purchases.push(`${label} (Full Crew -${quote.discount}☠️${coverText})`);
      else if (coverText) purchases.push(`${label} (${coverText.slice(2)})`);
      else purchases.push(label);
    }
    buysThisShop++;
  }

  if (G.shop.length) {
    G.shop.shift();
    G.shop.push(api.randomShopType(G.round + 1, G.shop, { map: G.map, mode: G.mode }));
    if (typeof api.normalizeOpeningRouteShop === 'function') {
      G.shop = api.normalizeOpeningRouteShop(G.shop, G.round + 1, {
        map: G.map,
        mode: G.mode,
        boardingCount: G.boardingCount,
        newSlotIndex: G.shop.length - 1,
      });
    }
  }
  prepareNextRoundForSim(api, scene);
}

function initializeSimCombatTimings(runtime, api, fighters, now) {
  const combat = api.COMBAT || {};
  const minDelay = Math.max(0, combat.initialDelayMin || 0);
  const maxDelay = Math.max(minDelay, combat.initialDelayMax || minDelay);
  fighters.forEach((fighter) => {
    if (!fighter) return;
    const span = maxDelay - minDelay + 1;
    fighter.nextAttackAt = now + minDelay + (span > 0 ? runtime.randInt(span) : 0);
    fighter.incomingUntil = 0;
    fighter.attacksMade = 0;
  });
}

function finishSimBoardingWin(api, scene) {
  const G = api.getG();
  if (G.combat) G.combat.result = 'win';
  if (scene && typeof scene.grantBoardingAlertPlunder === 'function') {
    scene.grantBoardingAlertPlunder(G.combat);
  }
  if (scene && typeof scene.grantOpeningBreakPlunder === 'function') {
    scene.grantOpeningBreakPlunder(G.combat);
  }
  if (scene && typeof scene.grantBoardingTrophy === 'function') {
    scene.grantBoardingTrophy(G.combat);
  }
  if (scene && typeof scene.grantCounterTrophy === 'function') {
    scene.grantCounterTrophy(G.combat);
  }
  if (scene && typeof scene.grantAmbushBounty === 'function') {
    scene.grantAmbushBounty(G.combat);
  }
  if (scene && typeof scene.markCounterAmbusherReport === 'function') {
    scene.markCounterAmbusherReport(G.combat, 'win');
  } else if (scene && typeof scene.markOpeningAmbusherReport === 'function') {
    scene.markOpeningAmbusherReport(G.combat, 'win');
  }
  const reportPirates = scene && typeof scene.consumeCounterAmbusherReportPirates === 'function'
    ? scene.consumeCounterAmbusherReportPirates(G.combat)
    : scene && typeof scene.consumeOpeningAmbusherReportPirates === 'function'
      ? scene.consumeOpeningAmbusherReportPirates(G.combat)
      : [];
  const reportIds = new Set(reportPirates.map((pirate) => pirate && pirate.id));
  const allCrewIds = new Set((G.allCrew || []).filter(Boolean).map(p => p.id));
  G.discard.push(...(G.hand || []).filter(p => p && allCrewIds.has(p.id) && !reportIds.has(p.id)));
  if (scene && typeof scene.placeCounterAmbusherReportPiratesOnDeck === 'function') {
    scene.placeCounterAmbusherReportPiratesOnDeck(reportPirates);
  } else if (scene && typeof scene.placeOpeningAmbusherReportPiratesOnDeck === 'function') {
    scene.placeOpeningAmbusherReportPiratesOnDeck(reportPirates);
  }
  G.hand = [];
  G.sent = [];

  if (G.map.currentLayer >= api.MAP_LAYERS - 1) return { state: 'win' };

  G.enemyShip = null;
  G.combat = null;
  G.phase = 'map';
  G.busy = false;
  if (scene && scene._sendingToIsland) scene._sendingToIsland.clear();
  if (scene) scene._pendingEndSending = false;
  G.hand = api.drawCards(5);
  return { state: 'continue' };
}

function drawSimBoardingReinforcements(runtime, api, scene, combat, now) {
  scene.discardBoardingHand();
  const cards = scene.drawReadyBoardingHand(5);
  if (!cards.length) return false;

  combat.playerSetupRows = scene.combatDefaultPlayerSetupRows(combat);
  combat.playerFighters = scene.buildPlayerCombatFighters(combat.playerSetupRows, combat);
  combat.reinforcementCount = Math.max(0, Math.floor(Number(combat.reinforcementCount) || 0)) + 1;
  initializeSimCombatTimings(runtime, api, combat.playerFighters || [], now);
  combat.nextAttackStartAt = Math.max(combat.nextAttackStartAt || 0, now + ((api.COMBAT && api.COMBAT.attackStartGapMs) || 300));
  return true;
}

function performSimCombatAttack(api, scene, attacker, now) {
  const combat = api.getG().combat;
  if (!combat || !attacker || !attacker.alive || !scene.combatCanAttack(attacker)) return null;

  const plan = scene.combatTargetPlanFor(attacker);
  if (!plan || !plan.targets || !plan.targets.length) {
    return attacker.side === 'player' ? 'win' : 'loss';
  }

  const weapon = scene.combatWeaponForFighter(attacker);
  const combatRules = api.COMBAT || {};
  const attackFxMs = combatRules.attackFxMs || 420;
  const attackStartGapMs = combatRules.attackStartGapMs || 300;

  attacker.nextAttackAt = now + Math.max(0, attacker.attackMs || 0);
  combat.nextAttackStartAt = now + attackStartGapMs;
  attacker.attacksMade = (attacker.attacksMade || 0) + 1;

  const damage = scene.combatAttackDamage(attacker);
  const deathPositions = [];
  const defeatedTargets = [];
  const addStatusText = () => {};
  const damageByTargetId = {};

  plan.targets.forEach((target) => {
    if (!target || !target.id) return;
    damageByTargetId[target.id] = scene.combatAdjustedDamage(attacker, target, damage, plan);
  });

  plan.targets.forEach((target) => {
    if (!target || !target.alive) return;
    const targetDamage = damageByTargetId[target.id] != null ? damageByTargetId[target.id] : damage;
    target.incomingUntil = now + attackFxMs;
    target.hp = Math.max(0, target.hp - targetDamage);
    if (target.hp <= 0 && scene.defeatCombatFighter(target, deathPositions)) {
      defeatedTargets.push(target);
      return;
    }

    scene.combatApplyAttackerOnHitEffect(attacker, target, now, addStatusText);
    scene.combatApplyTargetReaction(target, targetDamage, plan, now, addStatusText);

    if (weapon && weapon.woundsOnHit) scene.combatApplyWounds(target, weapon.woundsOnHit);
    if (weapon && weapon.poisonOnHit) {
      const poisonResult = scene.combatApplyPoison(target, weapon.poisonOnHit, deathPositions);
      if (poisonResult.defeated) defeatedTargets.push(target);
    }
  });

  scene.resolveCombatDeathEffects(defeatedTargets, now, deathPositions);
  if (plan.pullTarget && plan.pullTarget.alive) scene.combatMoveFighterToFrontRow(plan.pullTarget);
  if (weapon && weapon.healRowBehindOnHit) scene.healCombatRowBehind(attacker, weapon.healRowBehindOnHit);
  return scene.combatResultFromLiving();
}

function runBoardingPhase(runtime, api, scene) {
  const G = api.getG();
  const combat = scene.ensureBoardingCombat();
  if (!combat) return { state: 'error' };

  combat.mode = 'fighting';
  combat.playerSetupRows = scene.combatSetupRows('player', combat);
  combat.enemySetupRows = scene.combatSetupRows('enemy', combat);
  combat.playerFighters = scene.buildPlayerCombatFighters(combat.playerSetupRows, combat);
  combat.enemyFighters = scene.buildEnemyCombatFighters(combat.enemySetupRows, combat);
  combat.nextAttackStartAt = 0;
  if (scene && typeof scene.applyCounterAmbush === 'function') {
    scene.applyCounterAmbush(combat, { silent: true });
    const ambushResult = scene.combatResultFromLiving();
    if (ambushResult === 'win') return finishSimBoardingWin(api, scene);
    if (ambushResult === 'loss') return { state: 'loss' };
    if (ambushResult === 'reinforce' && !drawSimBoardingReinforcements(runtime, api, scene, combat, 0)) {
      return { state: 'loss' };
    }
  }

  let now = 0;
  initializeSimCombatTimings(runtime, api, [
    ...(combat.playerFighters || []),
    ...(combat.enemyFighters || []),
  ], now);

  const maxTicks = 20000;
  for (let tick = 0; tick < maxTicks; tick++) {
    let result = scene.combatResultFromLiving();
    if (result === 'win') return finishSimBoardingWin(api, scene);
    if (result === 'loss') return { state: 'loss' };
    if (result === 'reinforce') {
      if (!drawSimBoardingReinforcements(runtime, api, scene, combat, now)) return { state: 'loss' };
      continue;
    }

    const candidates = [
      ...scene.combatLiving('player'),
      ...scene.combatLiving('enemy'),
    ].filter((fighter) => scene.combatCanAttack(fighter));
    if (!candidates.length) return { state: 'error' };

    const nextGlobalAttackAt = combat.nextAttackStartAt || 0;
    candidates.sort((a, b) => {
      const aAt = Math.max(nextGlobalAttackAt, a.nextAttackAt || 0, a.incomingUntil || 0);
      const bAt = Math.max(nextGlobalAttackAt, b.nextAttackAt || 0, b.incomingUntil || 0);
      if (aAt !== bAt) return aAt - bAt;
      return String(a.id).localeCompare(String(b.id));
    });

    const attacker = candidates[0];
    now = Math.max(nextGlobalAttackAt, attacker.nextAttackAt || 0, attacker.incomingUntil || 0);
    scene.time.now = now;
    result = performSimCombatAttack(api, scene, attacker, now);

    if (result === 'win') return finishSimBoardingWin(api, scene);
    if (result === 'loss') return { state: 'loss' };
    if (result === 'reinforce' && !drawSimBoardingReinforcements(runtime, api, scene, combat, now)) {
      return { state: 'loss' };
    }
  }

  return { state: 'error' };
}

function mixSeed(base, a, b, c = 0) {
  let x = base >>> 0;
  x ^= Math.imul((a + 1) >>> 0, 0x9e3779b1);
  x = (x ^ (x >>> 16)) >>> 0;
  x ^= Math.imul((b + 1) >>> 0, 0x85ebca6b);
  x = (x ^ (x >>> 13)) >>> 0;
  x ^= Math.imul((c + 1) >>> 0, 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

async function simulateAttempt(runtime, api, scene, maxSteps, purchases, policy, datasetWriter, typeIndexMap, actionCap) {
  let outcome = 'unknown';
  let steps = 0;
  const roundStart = api.getG().round;
  const boardingStart = api.getG().boardingCount;
  const decisions = [];

  while (steps < maxSteps) {
    steps++;
    const G = api.getG();

    if (G.phase === 'map') {
      if (!api.getAvailableNodes(G.map).length) {
        outcome = 'stalled';
        break;
      }
      if (policy.name === 'ml') {
        try {
          await runModelMapChoice(runtime, api, scene, policy, actionCap, decisions);
        } catch (_) {
          outcome = 'error';
          break;
        }
      } else {
        const available = api.getAvailableNodes(G.map);
        const nodeId = pickRandom(runtime, available);
        if (!scene.applyMapNodeSelection(nodeId)) {
          outcome = 'error';
          break;
        }
      }
      continue;
    }

    if (G.phase === 'sending') {
      if (policy.name === 'ml') {
        try {
          await runModelSendingAndShipPhase(runtime, api, scene, policy, typeIndexMap, actionCap, decisions);
        } catch (_) {
          outcome = 'error';
          break;
        }
      } else {
        runHeuristicSendingAndShipPhase(runtime, api, scene);
      }
      continue;
    }

    if (G.phase === 'shopping') {
      await runShoppingPhase(
        runtime,
        api,
        scene,
        purchases,
        policy,
        datasetWriter,
        typeIndexMap,
        actionCap,
        decisions
      );
      continue;
    }

    if (G.phase === 'healing') {
      const limit = scene.healingLimit();
      const wounded = scene.woundedCrew();
      wounded.slice(0, limit).forEach((pirate) => {
        pirate.wounded = false;
      });
      G.healing = null;
      G.island = null;
      G.phase = 'map';
      continue;
    }

    if (G.phase === 'boarding') {
      const res = runBoardingPhase(runtime, api, scene);
      if (res.state === 'win') {
        outcome = 'win';
        break;
      }
      if (res.state === 'loss') {
        outcome = 'loss';
        break;
      }
      if (res.state === 'continue') {
        continue;
      }
      outcome = 'error';
      break;
    }

    outcome = 'error';
    break;
  }

  if (steps >= maxSteps && outcome === 'unknown') {
    outcome = 'max_steps';
  }

  const G = api.getG();
  return {
    outcome,
    rounds: G.round,
    simRounds: Math.max(0, G.round - roundStart),
    simBoardings: Math.max(0, G.boardingCount - boardingStart),
    simSteps: steps,
    boardingCount: G.boardingCount,
    crewLeft: G.allCrew.length,
    deathRound: outcome === 'loss' ? G.round : null,
    deathLayer: outcome === 'loss' ? (G.map.currentLayer + 1) : null,
    deathBoarding: outcome === 'loss' ? G.boardingCount : null,
    deathEnemyStrength: outcome === 'loss' && G.enemyShip ? G.enemyShip.strength : null,
    purchases,
    decisions,
  };
}

function maybeWriteBestPurchases(bestTracker, attemptResult) {
  if (attemptResult.rounds <= bestTracker.bestRoundSeen) return;
  bestTracker.bestRoundSeen = attemptResult.rounds;
  const line = attemptResult.purchases.length > 0
    ? attemptResult.purchases.join(', ')
    : '(no purchases)';
  bestTracker.lines.push(line);
}

function writeTrajectoryAttempt(trajectoryWriter, meta, attemptResult) {
  if (!trajectoryWriter) return;
  const steps = attemptResult.decisions || [];
  if (!steps.length) return;

  const episodeBoardings = attemptResult.boardingCount || 0;
  const simBoardings = attemptResult.simBoardings || 0;
  const lostLastBoarding = attemptResult.outcome === 'loss';
  const episodeBoardingsPassed = lostLastBoarding
    ? Math.max(0, episodeBoardings - 1)
    : episodeBoardings;
  const simBoardingsPassed = lostLastBoarding
    ? Math.max(0, simBoardings - 1)
    : simBoardings;

  // Default reward for online training: "how far survived" + "won boardings".
  const reward = (attemptResult.rounds || 0) + episodeBoardingsPassed;

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    trajectoryWriter.write({
      kind: `${s.kind || 'decision'}_step`,
      runIndex: meta.runIndex,
      runSeed: meta.runSeed,
      epoch: meta.epoch,
      attemptInEpoch: meta.attemptInEpoch,
      attemptGlobal: meta.attemptGlobal,
      stepInAttempt: i + 1,
      tokens: s.tokens,
      mask: s.mask,
      action: s.action,
      round: s.round,
      buysThisShop: s.buysThisShop,
      policy: s.policy,
      selected: s.selected,
      nodeId: s.nodeId,
      sentCount: s.sentCount,
      removerType: s.removerType,
      removedType: s.removedType,
      outcome: attemptResult.outcome,
      episodeRounds: attemptResult.rounds,
      episodeBoardings: attemptResult.boardingCount,
      episodeBoardingsPassed,
      episodeSimRounds: attemptResult.simRounds,
      episodeSimBoardings: attemptResult.simBoardings,
      episodeSimBoardingsPassed: simBoardingsPassed,
      reward,
    });
  }
}

async function simulateRunWithRetries(
  runtime,
  runIndex,
  runSeed,
  opts,
  bestTracker,
  policy,
  datasetWriter,
  trajectoryWriter,
  typeIndexMap
) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  runtime.setSeed(mixSeed(runSeed, runIndex, 0, 0));
  api.initState();
  scene.enterMapPhase();
  scene._sendingToIsland.clear();
  scene._sacrificedIds.clear();

  const purchases = [];
  const attemptMeta = {
    runIndex,
    runSeed,
    epoch: 1,
    attemptInEpoch: 1,
    attemptGlobal: 1,
  };
  const attemptResult = await simulateAttempt(
    runtime,
    api,
    scene,
    opts.maxSteps,
    purchases,
    policy,
    datasetWriter,
    typeIndexMap,
    opts.policyActions
  );
  maybeWriteBestPurchases(bestTracker, attemptResult);
  writeTrajectoryAttempt(trajectoryWriter, attemptMeta, attemptResult);

  return {
    outcome: attemptResult.outcome,
    rounds: attemptResult.rounds,
    boardingCount: attemptResult.boardingCount,
    crewLeft: attemptResult.crewLeft,
    deathRound: attemptResult.deathRound,
    deathLayer: attemptResult.deathLayer,
    deathBoarding: attemptResult.deathBoarding,
    deathEnemyStrength: attemptResult.deathEnemyStrength,
    attemptsUsed: 1,
    failEpoch: attemptResult.outcome === 'loss' ? attemptResult.deathBoarding : null,
    epochsCleared: attemptResult.outcome === 'loss'
      ? Math.max(0, (attemptResult.deathBoarding || 0) - 1)
      : (attemptResult.boardingCount || 0),
    simRoundsTotal: attemptResult.simRounds || 0,
    simStepsTotal: attemptResult.simSteps || 0,
  };
}

function countByNumericKey(values) {
  const map = new Map();
  for (const v of values) {
    if (v == null) continue;
    map.set(v, (map.get(v) || 0) + 1);
  }
  const out = {};
  const sorted = [...map.entries()].sort((a, b) => a[0] - b[0]);
  for (const [k, cnt] of sorted) out[k] = cnt;
  return out;
}

function formatCountsInline(obj) {
  const keys = Object.keys(obj);
  if (keys.length === 0) return 'none';
  return keys.map(k => `${k}:${obj[k]}`).join(' ');
}

function summarize(results, opts, elapsedMs) {
  const games = results.length;
  let wins = 0;
  let losses = 0;
  let stalled = 0;
  let errors = 0;
  let maxSteps = 0;
  let roundsSum = 0;
  let boardingsSum = 0;
  let attemptsSum = 0;
  let simRoundsSum = 0;
  let simStepsSum = 0;
  const deathRounds = [];
  const deathLayers = [];
  const deathBoardings = [];
  const deathEnemyStrengths = [];
  const failEpochs = [];

  for (const r of results) {
    roundsSum += r.rounds;
    boardingsSum += r.boardingCount;
    attemptsSum += (r.attemptsUsed || 0);
    simRoundsSum += (r.simRoundsTotal || 0);
    simStepsSum += (r.simStepsTotal || 0);
    if (r.outcome === 'win') wins++;
    else if (r.outcome === 'loss') {
      losses++;
      deathRounds.push(r.deathRound);
      deathLayers.push(r.deathLayer);
      deathBoardings.push(r.deathBoarding);
      deathEnemyStrengths.push(r.deathEnemyStrength);
      failEpochs.push(r.failEpoch);
    }
    else if (r.outcome === 'stalled') stalled++;
    else if (r.outcome === 'max_steps') maxSteps++;
    else errors++;
  }

  const avgRounds = roundsSum / games;
  const avgBoardings = boardingsSum / games;
  const gamesPerSec = (games / elapsedMs) * 1000;
  const roundsPerSec = (simRoundsSum / elapsedMs) * 1000;
  const finalRoundsPerSec = (roundsSum / elapsedMs) * 1000;
  const attemptsPerSec = (attemptsSum / elapsedMs) * 1000;
  const stepsPerSec = (simStepsSum / elapsedMs) * 1000;
  const lossByRound = countByNumericKey(deathRounds);
  const lossByLayer = countByNumericKey(deathLayers);
  const lossByBoarding = countByNumericKey(deathBoardings);
  const lossByEnemyStrength = countByNumericKey(deathEnemyStrengths);
  const lossByEpoch = countByNumericKey(failEpochs);

  return {
    config: opts,
    perf: {
      elapsedMs: Number(elapsedMs.toFixed(2)),
      gamesPerSec: Number(gamesPerSec.toFixed(2)),
      roundsPerSec: Number(roundsPerSec.toFixed(2)),
      finalRoundsPerSec: Number(finalRoundsPerSec.toFixed(2)),
      attemptsPerSec: Number(attemptsPerSec.toFixed(2)),
      stepsPerSec: Number(stepsPerSec.toFixed(2)),
    },
    outcomes: {
      wins,
      losses,
      stalled,
      maxSteps,
      errors,
      winRate: Number((wins / games).toFixed(4)),
    },
    averages: {
      rounds: Number(avgRounds.toFixed(3)),
      boardings: Number(avgBoardings.toFixed(3)),
    },
    retries: {
      attemptsTotal: attemptsSum,
      avgAttemptsPerRun: Number((attemptsSum / games).toFixed(3)),
    },
    lossDistributions: {
      byRound: lossByRound,
      byLayer: lossByLayer,
      byBoarding: lossByBoarding,
      byEnemyStrength: lossByEnemyStrength,
      byEpoch: lossByEpoch,
    },
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.policy !== 'heuristic' && opts.policy !== 'ml') {
    throw new Error(`unsupported --policy=${opts.policy}; expected heuristic|ml`);
  }
  const runtime = buildRuntime();
  if (opts.checkOpeningCommission) {
    const result = runOpeningCommissionChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkPortDrill) {
    const result = runPortDrillChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkShortCrewDrill) {
    const result = runShortCrewDrillChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkAlertTiers) {
    const result = runAlertTierChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkScoutedCounterShop) {
    const result = runScoutedCounterShopChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkScoutedCounterCache) {
    const result = runScoutedCounterCacheChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkOpeningCounterSubsidy) {
    const result = runOpeningCounterSubsidyChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkOpeningCounterPlan) {
    const result = runOpeningCounterPlanChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkOpeningSidePrep) {
    const result = runOpeningRouteCounterShopChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkOpeningShellbackCounter) {
    const result = runOpeningRouteCounterShopChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkOpeningDeckhandCounters) {
    const result = runOpeningDeckhandCounterChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkOpeningCachePurse) {
    const result = runOpeningCachePurseChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkOpeningRouteMuster) {
    const result = runOpeningRouteMusterChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkOpeningRoutePrize) {
    const result = runOpeningRoutePrizeChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkOpeningRoutePromotion) {
    const result = runOpeningRoutePromotionChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkRouteSidekickReport) {
    const result = runRouteSidekickReportChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkAlarmRushedRouteCounter) {
    const result = runAlarmRushedRouteCounterChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkRouteCounterCover) {
    const result = runRouteCounterCoverChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkCounterAmbusherReport || opts.checkOpeningAmbusherReport) {
    const result = runCounterAmbusherReportChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkDrilledAmbusherBounty) {
    const result = runDrilledAmbusherBountyChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkCounterRecruitsReportEarly) {
    const result = runCounterRecruitsReportEarlyChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkMapSchedule) {
    const result = runMapScheduleChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkBoardingTrophy) {
    const result = runBoardingTrophyChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkCounterTrophy) {
    const result = runCounterTrophyChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkCounterEdge) {
    const result = runCounterEdgeChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkCounterAmbush) {
    const result = runCounterAmbushChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkEncounterScaling) {
    const result = runEncounterScalingChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkOpeningRouteCaptains) {
    const result = runOpeningRouteCaptainsChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  if (opts.checkFirstShellback) {
    const result = runFirstShellbackChecks(runtime);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  const typeIndexMap = buildTypeIndexMap(runtime.api);
  const logDir = path.dirname(opts.bestLog);
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(opts.bestLog, '', 'utf8');
  let datasetWriter = null;
  if (opts.datasetOut) datasetWriter = new JsonlWriter(opts.datasetOut);
  let trajectoryWriter = null;
  if (opts.trajectoryOut) trajectoryWriter = new JsonlWriter(opts.trajectoryOut);

  let shopPolicy;
  if (opts.policy === 'heuristic') {
    shopPolicy = new HeuristicShopPolicy();
  } else {
    const serverPath = path.join(ROOT, 'sim', 'ml', 'policy_server.py');
    if (!fs.existsSync(serverPath)) {
      throw new Error(`policy server not found: ${serverPath}`);
    }
    if (!fs.existsSync(opts.modelPath)) {
      throw new Error(`model checkpoint not found: ${opts.modelPath}`);
    }
    shopPolicy = new PythonShopPolicy({
      pythonBin: opts.pythonBin,
      serverPath,
      modelPath: opts.modelPath,
      sample: opts.mlSample,
      temperature: opts.mlTemperature,
      epsilon: opts.mlEpsilon,
    });
  }

  const t0 = process.hrtime.bigint();
  const results = [];
  const bestTracker = { path: opts.bestLog, bestRoundSeen: -1, lines: [] };
  try {
    for (let i = 0; i < opts.games; i++) {
      const gameSeed = (opts.seed + Math.imul(i + 1, 0x9e3779b1)) >>> 0;
      const result = await simulateRunWithRetries(
        runtime,
        i + 1,
        gameSeed,
        opts,
        bestTracker,
        shopPolicy,
        datasetWriter,
        trajectoryWriter,
        typeIndexMap
      );
      results.push(result);
    }
    fs.writeFileSync(
      opts.bestLog,
      bestTracker.lines.length ? (bestTracker.lines.join('\n') + '\n') : '',
      'utf8'
    );
  } finally {
    await shopPolicy.close();
    if (datasetWriter) await datasetWriter.close();
    if (trajectoryWriter) await trajectoryWriter.close();
  }

  const t1 = process.hrtime.bigint();
  const elapsedMs = Number(t1 - t0) / 1e6;

  const summary = summarize(results, opts, elapsedMs);
  if (opts.json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
    return;
  }

  process.stdout.write('Fast simulator summary\n');
  process.stdout.write(
    `runs=${opts.games} seed=${opts.seed} maxSteps=${opts.maxSteps} policy=${opts.policy}\n`
  );
  process.stdout.write(`elapsed=${summary.perf.elapsedMs}ms\n`);
  process.stdout.write(`runs/sec=${summary.perf.gamesPerSec} rounds/sec=${summary.perf.roundsPerSec}\n`);
  process.stdout.write(
    `attempts/sec=${summary.perf.attemptsPerSec} steps/sec=${summary.perf.stepsPerSec}` +
    ` finalRounds/sec=${summary.perf.finalRoundsPerSec}\n`
  );
  process.stdout.write(
    `wins=${summary.outcomes.wins} losses=${summary.outcomes.losses}` +
    ` stalled=${summary.outcomes.stalled} maxSteps=${summary.outcomes.maxSteps}` +
    ` errors=${summary.outcomes.errors} winRate=${summary.outcomes.winRate}\n`
  );
  process.stdout.write(
    `avgRounds=${summary.averages.rounds} avgBoardings=${summary.averages.boardings}\n`
  );
  process.stdout.write(
    `attemptsTotal=${summary.retries.attemptsTotal} avgAttemptsPerRun=${summary.retries.avgAttemptsPerRun}\n`
  );
  process.stdout.write(`bestLog=${opts.bestLog}\n`);
  if (opts.datasetOut) process.stdout.write(`datasetOut=${opts.datasetOut}\n`);
  if (opts.trajectoryOut) process.stdout.write(`trajectoryOut=${opts.trajectoryOut}\n`);
  process.stdout.write(`lossByRound=${formatCountsInline(summary.lossDistributions.byRound)}\n`);
  process.stdout.write(`lossByLayer=${formatCountsInline(summary.lossDistributions.byLayer)}\n`);
  process.stdout.write(`lossByEpoch=${formatCountsInline(summary.lossDistributions.byEpoch)}\n`);
  process.stdout.write(`lossByBoarding=${formatCountsInline(summary.lossDistributions.byBoarding)}\n`);
  process.stdout.write(
    `lossByEnemyStrength=${formatCountsInline(summary.lossDistributions.byEnemyStrength)}\n`
  );
}

main().catch((err) => {
  process.stderr.write((err && err.stack) ? err.stack + '\n' : String(err) + '\n');
  process.exit(1);
});
