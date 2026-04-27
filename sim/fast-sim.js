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
    checkCounterRecruitsReportEarly: false,
    checkMapSchedule: false,
    checkBoardingTrophy: false,
    checkCounterTrophy: false,
    checkCounterEdge: false,
    checkCounterAmbush: false,
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
      scoutedCounterTypesForMap,
      isScoutedCounterShopType,
      drawCards,
      getAvailableNodes,
      mapNodeById,
      MAP_LAYERS,
      COMBAT,
      TYPES,
      ISLANDS,
      QUIET_DOCKS,
      SHOP_CREDIT,
      SCOUTED_SHIP_COUNTERS,
      SCOUTED_COUNTER_CACHE_RES,
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

function activeFullCrewDiscount(G) {
  if (!G || G.mode === 'battleTest' || G.phase !== 'shopping') return 0;
  return Math.max(0, Math.min(1, Math.floor(Number(G.fullCrewDiscount) || 0)));
}

function shopPurchaseQuote(api, G, type) {
  const def = api.TYPES[type];
  const cost = Math.max(0, Math.floor(Number(def && def.cost) || 0));
  const counter = !!(
    def
    && typeof api.isScoutedCounterShopType === 'function'
    && api.isScoutedCounterShopType(type, G && G.map, { mode: G && G.mode })
  );
  const discount = Math.min(cost, activeFullCrewDiscount(G));
  const effectiveCost = Math.max(0, cost - discount);
  const enthusiasm = Math.max(0, Math.floor(Number(G && G.enthusiasm) || 0));
  if (!G || !def) {
    return { canBuy: false, credit: false, counter: false, cost, effectiveCost, discount: 0, missing: 0, alert: 0 };
  }
  if (enthusiasm >= effectiveCost) {
    return { canBuy: true, credit: false, counter, cost, effectiveCost, discount, missing: 0, alert: 0 };
  }
  const missing = effectiveCost - enthusiasm;
  const canCredit = G.mode !== 'battleTest'
    && G.phase === 'shopping'
    && !G.shopCreditUsed
    && missing >= 1
    && missing <= shopCreditMaxMissing(api);
  return {
    canBuy: canCredit,
    credit: canCredit,
    counter,
    cost,
    effectiveCost,
    discount,
    missing,
    alert: canCredit ? missing * shopCreditAlertPerMissing(api) : 0,
  };
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
    buyable.push({ idx: i, cost: quote.cost, credit: quote.credit ? 1 : 0, counter: quote.counter ? 1 : 0, quote });
  }
  if (!buyable.length) return -1;
  buyable.sort((a, b) => a.credit - b.credit || b.counter - a.counter || b.cost - a.cost);

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

function assertCounterRecruitsReportEarlyCheck(condition, message) {
  if (!condition) throw new Error(`counter recruits report early check failed: ${message}`);
}

function assertMapScheduleCheck(condition, message) {
  if (!condition) throw new Error(`map schedule check failed: ${message}`);
}

function runMapScheduleChecks(runtime) {
  const api = runtime.api;
  const results = [];
  const expectedShipLayers = [3, 9, 14, 19, 24, 29, 34, 39];
  const earlyIslandLayers = [0, 1, 2, 4, 5, 6, 7, 8];
  const expectedEarlyIslandIdx = [0, 1, 3];
  const earlySegments = [
    { base: 0, length: 3 },
    { base: 4, length: 5 },
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
    name: '40-layer map schedule with early 3/5 islands and straight early paths',
    ok: true,
    samples: 12,
    shipLayers: expectedShipLayers,
    earlyIslandLayers,
  });
  return { ok: true, checks: results };
}

function makeScoutedCounterTestMap(mainKey) {
  return {
    layers: [
      [{ id: 1, type: 'island', islandIdx: 0, conns: [2] }],
      [{ id: 2, type: 'ship', strength: 6, encounter: { mainKey, supportKeys: ['bilgeRat', 'cabinBoy'], totalCount: 3 }, conns: [] }],
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
      [{ id: 5, type: 'ship', strength: 6, encounter: { mainKey, supportKeys: ['bilgeRat', 'cabinBoy'], totalCount: 3 }, conns: [] }],
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

function expectedScoutedCounterCacheNode(api, layer, res) {
  const candidates = (Array.isArray(layer) ? layer : []).filter((node) => {
    const island = node && node.type === 'island' ? api.ISLANDS[node.islandIdx] : null;
    return island && !island.healWounded;
  });
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

function runScoutedCounterCacheChecks(runtime) {
  const api = runtime.api;
  const scene = makeSimScene(api);
  const results = [];
  let generatedCacheCount = 0;

  for (let sample = 0; sample < 12; sample++) {
    runtime.setSeed((0x8f53a31d + sample * 7919) >>> 0);
    api.initState();
    const G = api.getG();
    const map = G.map;
    assertScoutedCounterCacheCheck(map && Array.isArray(map.layers), `sample ${sample} did not generate map`);

    const shipCacheLayers = [];
    for (let li = 1; li < map.layers.length; li++) {
      const layer = map.layers[li];
      if (!layer || layer.length !== 1 || layer[0].type !== 'ship') continue;

      const ship = layer[0];
      const mainKey = ship.encounter && ship.encounter.mainKey;
      const res = api.SCOUTED_COUNTER_CACHE_RES[mainKey];
      const expectedNode = expectedScoutedCounterCacheNode(api, map.layers[li - 1], res);
      if (!expectedNode) continue;

      const cacheNodes = map.layers[li - 1].filter((node) => node && node.scoutedCache);
      assertScoutedCounterCacheCheck(cacheNodes.length === 1, `sample ${sample} layer ${li - 1} has ${cacheNodes.length} caches`);
      const cacheNode = cacheNodes[0];
      const cache = cacheNode.scoutedCache;
      assertScoutedCounterCacheCheck(cacheNode.id === expectedNode.id, `sample ${sample} cache node ${cacheNode.id} !== preferred ${expectedNode.id}`);
      assertScoutedCounterCacheCheck(cache.mainKey === mainKey, `sample ${sample} cache main ${cache.mainKey} !== ${mainKey}`);
      assertScoutedCounterCacheCheck(cache.res === res, `sample ${sample} cache res ${cache.res} !== ${res}`);
      assertScoutedCounterCacheCheck(cache.amount === 1 && cache.enthusiasm === 1 && cache.alert === 1, `sample ${sample} cache amount/enthusiasm/alert ${cache.amount}/${cache.enthusiasm}/${cache.alert}`);
      assertScoutedCounterCacheCheck(cache.claimed === false, `sample ${sample} cache starts claimed`);
      shipCacheLayers.push(li - 1);
      generatedCacheCount++;
    }

    const firstShipLayer = map.layers.findIndex(layer => layer && layer.length === 1 && layer[0].type === 'ship');
    const firstCache = firstShipLayer > 0
      ? map.layers[firstShipLayer - 1].find((node) => node && node.scoutedCache)
      : null;
    assertScoutedCounterCacheCheck(firstCache && !firstCache.scoutedCache.claimed, `sample ${sample} first ship cache is missing before route selection`);
    assertScoutedCounterCacheCheck(shipCacheLayers.length === 8, `sample ${sample} generated ${shipCacheLayers.length} caches`);
  }
  results.push({ name: 'generated regular maps mark one preferred cache before every ship', ok: true, samples: 12, generatedCacheCount });

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
    assertScoutedCounterCacheCheck(G.res.wood === 1, `cache granted wood ${G.res.wood}`);
    assertScoutedCounterCacheCheck(G.enthusiasm === 1, `cache granted enthusiasm ${G.enthusiasm}`);
    assertScoutedCounterCacheCheck(G.boardingAlert === 3, `cache alert ${G.boardingAlert} !== 3`);
    assertScoutedCounterCacheCheck(node.scoutedCache.claimed === true, 'cache was not claimed');
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill && G.island.scoutedCacheDrill.mainKey === 'shellback', 'cache island did not arm Cache Drill');
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill.alertRefundAmount === 1, `cache refund amount ${G.island.scoutedCacheDrill.alertRefundAmount} !== 1`);
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill.alertFloorBeforeCache === 2, `cache refund floor ${G.island.scoutedCacheDrill.alertFloorBeforeCache} !== 2`);
    scene.applyMapNodeSelection(node.id);
    assertScoutedCounterCacheCheck(G.res.wood === 1, `claimed cache granted again to wood ${G.res.wood}`);
    assertScoutedCounterCacheCheck(G.enthusiasm === 0, `claimed cache granted again to enthusiasm ${G.enthusiasm}`);
    assertScoutedCounterCacheCheck(G.boardingAlert === 3, `claimed cache alerted again to ${G.boardingAlert}`);
    assertScoutedCounterCacheCheck(!G.island.scoutedCacheDrill, 'claimed cache armed Cache Drill again');
    results.push({ name: 'cache selection grants mapped resource, enthusiasm, and Alert exactly once', ok: true });
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
    assertScoutedCounterCacheCheck(quote.counter && quote.topDeck && quote.preparedCounter, `cache bounty quote was not prepared top-deck counter: ${JSON.stringify(quote)}`);
    assertScoutedCounterCacheCheck(quote.effectiveCost === 2 && quote.spend === 2, `cache bounty quote cost/spend ${quote.effectiveCost}/${quote.spend}`);
    assertScoutedCounterCacheCheck(plan.includes('prepared') && plan.includes('top deck') && !plan.includes('credit'), `cache bounty plan missing prepared top deck without credit: ${plan}`);
    results.push({ name: 'cache bounty plus full-send discount makes a cost-3 counter prepared and affordable without Dockside Credit', ok: true, plan });
  }

  const setupDrill = (opts = {}) => {
    api.initState();
    const G = api.getG();
    G.mode = opts.mode || 'run';
    G.round = 1;
    G.phase = 'sending';
    G.island = scene.buildIslandState(api.ISLANDS[opts.islandIdx != null ? opts.islandIdx : 0]);
    if (opts.cache !== false) {
      G.island.scoutedCacheDrill = {
        mainKey: opts.mainKey || 'shellback',
        granted: false,
        alertRefundAmount: Math.max(0, Math.floor(Number(opts.alertRefundAmount) || 0)),
        alertFloorBeforeCache: Math.max(0, Math.floor(Number(opts.alertFloorBeforeCache) || 0)),
        alertRefunded: false,
      };
    }
    const pirates = [
      { id: 9001, type: 'poisoner', weaponKey: null, might: 2, tempo: 0, wounded: false },
      { id: 9002, type: 'needler', weaponKey: null, might: 0, tempo: 0, wounded: false },
      { id: 9003, type: 'lumberjack', weaponKey: null, might: 0, tempo: 0, wounded: false },
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
    const { G, pirates } = setupDrill({ enthusiasm: 1, boardingAlert: 3, alertRefundAmount: 1, alertFloorBeforeCache: 2 });
    const reward = sendForDrill(G, pirates[0], 0);
    assertScoutedCounterCacheCheck(reward && reward.applied, 'matching counter did not receive Cache Drill');
    assertScoutedCounterCacheCheck((pirates[0].might || 0) === 3, `matching counter might ${pirates[0].might || 0} !== 3`);
    assertScoutedCounterCacheCheck(reward.alertRefund && reward.alertRefund.amount === 1, `matching counter refund ${reward.alertRefund && reward.alertRefund.amount} !== 1`);
    assertScoutedCounterCacheCheck(G.boardingAlert === 2, `matching counter alert ${G.boardingAlert} !== 2`);
    assertScoutedCounterCacheCheck(G.enthusiasm === 3, `Cache Drill refund removed cache enthusiasm or island gain ${G.enthusiasm}`);
    assertScoutedCounterCacheCheck((G.cacheDrillMusterIds || []).includes(pirates[0].id), 'matching counter did not create Cache Drill muster marker');
    const second = sendForDrill(G, pirates[1], 1);
    assertScoutedCounterCacheCheck(!second, 'second matching counter received another Cache Drill');
    assertScoutedCounterCacheCheck((pirates[1].might || 0) === 0, 'second matching counter gained Might');
    assertScoutedCounterCacheCheck(G.boardingAlert === 2, `second matching counter changed alert to ${G.boardingAlert}`);
    results.push({ name: 'Cache Drill grants +1 Might and refunds its cache Alert to the first surviving matching counter only', ok: true });
  }

  {
    const { G, pirates } = setupDrill({ boardingAlert: 3, alertRefundAmount: 1, alertFloorBeforeCache: 2 });
    const reward = sendForDrill(G, pirates[2], 2);
    assertScoutedCounterCacheCheck(!reward, 'non-counter received Cache Drill');
    assertScoutedCounterCacheCheck((pirates[2].might || 0) === 0, 'non-counter gained Might');
    assertScoutedCounterCacheCheck(G.boardingAlert === 3, `non-counter changed alert to ${G.boardingAlert}`);
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill.granted === false, 'non-counter consumed Cache Drill');
    assertScoutedCounterCacheCheck(G.island.scoutedCacheDrill.alertRefunded === false, 'non-counter consumed cache Alert refund');
    assertScoutedCounterCacheCheck((G.cacheDrillMusterIds || []).length === 0, 'non-counter created Cache Drill muster marker');
    results.push({ name: 'Cache Drill ignores non-counter pirates without consuming the drill', ok: true });
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
    const { G, pirates } = setupDrill({ islandIdx: 5, boardingAlert: 3, alertRefundAmount: 1, alertFloorBeforeCache: 2 });
    const reward = sendForDrill(G, pirates[0], 0, { removeAfterIsland: true });
    assertScoutedCounterCacheCheck(!reward, 'Siren-removed counter received Cache Drill');
    assertScoutedCounterCacheCheck((pirates[0].might || 0) === 2, 'Siren-removed counter gained Might');
    assertScoutedCounterCacheCheck(G.boardingAlert === 3, `Siren-removed counter changed alert to ${G.boardingAlert}`);
    assertScoutedCounterCacheCheck(!G.allCrew.some(p => p.id === pirates[0].id), 'Siren setup failed to remove pirate');
    assertScoutedCounterCacheCheck((G.cacheDrillMusterIds || []).length === 0, 'Siren-removed counter created Cache Drill muster marker');
    results.push({ name: 'Cache Drill skips pirates removed by Siren Island', ok: true });
  }

  {
    const { G, pirates } = setupDrill({ boardingAlert: 3, alertRefundAmount: 1, alertFloorBeforeCache: 2 });
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
    const { G, pirates } = setupDrill({ boardingAlert: 3, alertRefundAmount: 1, alertFloorBeforeCache: 2 });
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
    assertCounterRecruitsReportEarlyCheck(endLine.includes('top deck') && !endLine.includes('prepared'), `End-now plan should top-deck without prepared: ${endLine}`);
    assertCounterRecruitsReportEarlyCheck(partialLine.includes('top deck') && !partialLine.includes('prepared'), `partial plan should top-deck without prepared: ${partialLine}`);
    assertCounterRecruitsReportEarlyCheck(fullLine.includes('Full Crew -1☠️') && fullLine.includes('prepared') && fullLine.includes('top deck'), `full-send plan should prepare and top-deck: ${fullLine}`);
    results.push({ name: 'sending plan separates no-discount top-deck counters from full-send prepared counters', ok: true, endLine, partialLine, fullLine });
  }

  {
    const { G, oldTop } = setupPurchase({ type: 'sawbones', enthusiasm: 3 });
    const quote = scene.shopPurchaseQuote('sawbones');
    assertCounterRecruitsReportEarlyCheck(quote.canBuy && quote.counter && quote.topDeck && !quote.preparedCounter, `eligible quote was ${JSON.stringify(quote)}`);
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.type === 'sawbones', 'eligible counter buy failed');
    assertCounterRecruitsReportEarlyCheck(G.deck[G.deck.length - 1] === bought, 'eligible counter was not placed on top of deck');
    assertCounterRecruitsReportEarlyCheck((G.counterWatchIds || []).includes(bought.id), 'eligible top-deck counter did not gain Counter Watch');
    assertCounterRecruitsReportEarlyCheck(!bought.weaponKey, `no-discount Sawbones was prepared with ${bought.weaponKey}`);
    assertCounterRecruitsReportEarlyCheck(!G.discard.includes(bought), 'eligible counter also appeared in discard');
    const drawn = api.drawCards(1)[0];
    assertCounterRecruitsReportEarlyCheck(drawn === bought, 'next draw did not return the bought counter');
    assertCounterRecruitsReportEarlyCheck(!oldTop || G.deck[G.deck.length - 1] === oldTop, 'older deck card did not remain below bought counter');
    results.push({ name: 'eligible nearby scouted counter top-decks and draws first without discount preparation', ok: true });
  }

  {
    const { G } = setupPurchase({ type: 'sawbones', enthusiasm: 3 });
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
    const { G } = setupPurchase({ type: 'drummer', enthusiasm: 1, fullCrewDiscount: 1, map: makeScoutedCounterTestMap('netter') });
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.tempo === 1, `prepared Drummer tempo was ${bought && bought.tempo}`);
    assertCounterRecruitsReportEarlyCheck(G.enthusiasm === 0 && G.res.wood === 0, 'prepared Drummer paid ship cost or output');
    results.push({ name: 'prepared Drummer gains +1 Tempo only', ok: true });
  }

  {
    const { G } = setupPurchase({ type: 'trainer', enthusiasm: 2, fullCrewDiscount: 1, map: makeScoutedCounterTestMap('netter') });
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.might === 1, `prepared Trainer might was ${bought && bought.might}`);
    assertCounterRecruitsReportEarlyCheck(G.enthusiasm === 0 && G.res.stone === 0, 'prepared Trainer paid ship cost or output');
    results.push({ name: 'prepared Trainer gains +1 Might only', ok: true });
  }

  {
    const { G } = setupPurchase({ type: 'flagbearer', enthusiasm: 6, fullCrewDiscount: 1, map: makeScoutedCounterTestMap('netter') });
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.might === 1 && bought.tempo === 1, `prepared Flagbearer buffs were might=${bought && bought.might} tempo=${bought && bought.tempo}`);
    assertCounterRecruitsReportEarlyCheck(G.enthusiasm === 0 && G.res.wood === 0 && G.res.stone === 0, 'prepared Flagbearer paid ship costs or output');
    results.push({ name: 'prepared multi-gain counter receives every personal gain only', ok: true });
  }

  {
    const { G } = setupPurchase({ type: 'plagueCaptain', enthusiasm: 9, fullCrewDiscount: 1, map: makeScoutedCounterTestMap('shellback') });
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(bought && bought.weaponKey === 'toxinPistol' && bought.might === 1, `prepared Plague Captain gains were weapon=${bought && bought.weaponKey} might=${bought && bought.might}`);
    assertCounterRecruitsReportEarlyCheck(G.enthusiasm === 0 && G.res.gold === 0, 'prepared Plague Captain paid ship cost or output');
    results.push({ name: 'prepared mixed weapon/buff counter receives all personal gains only', ok: true });
  }

  {
    const { G } = setupPurchase({ type: 'trainer', enthusiasm: 3 });
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
    const bought = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(G.discard.includes(bought), 'Battle Test purchase did not go to discard');
    assertCounterRecruitsReportEarlyCheck(!G.deck.includes(bought), 'Battle Test purchase went to deck');
    assertCounterRecruitsReportEarlyCheck((G.counterWatchIds || []).length === 0, 'Battle Test purchase created Counter Watch');
    assertCounterRecruitsReportEarlyCheck(!bought.weaponKey, `Battle Test purchase was prepared with ${bought.weaponKey}`);
    results.push({ name: 'Battle Test purchases still go to discard', ok: true });
  }

  {
    const { G } = setupPurchase({
      type: 'sawbones',
      enthusiasm: 1,
      boardingAlert: 1,
    });
    const quote = scene.shopPurchaseQuote('sawbones');
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
      boardingAlert: 1,
    });
    const quote = scene.shopPurchaseQuote('sawbones');
    assertCounterRecruitsReportEarlyCheck(quote.canBuy && quote.credit && quote.discount === 1 && quote.topDeck && quote.preparedCounter && quote.alert === 2, `discount credit quote was ${JSON.stringify(quote)}`);
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
    });
    const quote = scene.shopPurchaseQuote('sawbones');
    assertCounterRecruitsReportEarlyCheck(quote.canBuy && quote.discount === 1 && quote.topDeck && quote.preparedCounter, `discount quote was ${JSON.stringify(quote)}`);
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
    });
    G.shop = ['herald', 'sawbones'];
    const firstQuote = scene.shopPurchaseQuote('herald');
    assertCounterRecruitsReportEarlyCheck(firstQuote.canBuy && firstQuote.discount === 1 && !firstQuote.topDeck && !firstQuote.preparedCounter, `non-counter quote was ${JSON.stringify(firstQuote)}`);
    const first = scene.buyPirate(0, { deferRender: true, silent: true, ignoreAnimating: true, skipPanelRefresh: true });
    assertCounterRecruitsReportEarlyCheck(first && first.type === 'herald', 'discount non-counter buy failed');
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
  assertAlertTierCheck(!fillLine.includes('win +'), `Fill crew line implies alert plunder: ${fillLine}`);
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
      enemies: [['powderBomber', 0, 2], ['cabinBoy', 0, 1, 'alert'], ['bilgeRat', 0, 0, 'alert']],
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
    assertCounterAmbushCheck(!result.openingCounterBreak && !result.routedSupport, 'Watch Ready without permanent upgrades triggered Opening Counter Break');
    assertCounterAmbushCheck(G.counterWatchIds.length === 0, 'Watch Ready ambush recreated Counter Watch markers');
    results.push({ name: 'Watch Ready counters use Armed Counter Ambush damage and guard removal without permanent upgrades', ok: true });
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
  const counterWatch = scene && typeof scene.consumeCounterWatchPirates === 'function'
    ? scene.consumeCounterWatchPirates(reports.ids, {
      preserveSentIds: new Set((reports.shortCrew || []).map(p => p && p.id)),
    })
    : [];
  const topDeckReturnIds = new Set(reports.ids);
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
      if (quote && quote.credit) purchases.push(`${label} (Credit +${quote.alert} Alert)`);
      else if (quote && quote.discount > 0) purchases.push(`${label} (Full Crew -${quote.discount}☠️)`);
      else purchases.push(label);
    }
    buysThisShop++;
  }

  if (G.shop.length) {
    G.shop.shift();
    G.shop.push(api.randomShopType(G.round + 1, G.shop, { map: G.map, mode: G.mode }));
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
  const allCrewIds = new Set((G.allCrew || []).filter(Boolean).map(p => p.id));
  G.discard.push(...(G.hand || []).filter(p => p && allCrewIds.has(p.id)));
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
