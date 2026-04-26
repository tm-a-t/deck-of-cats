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
    checkAlertTiers: false,
    checkScoutedCounterShop: false,
    checkMapSchedule: false,
    checkBoardingTrophy: false,
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
    if (a === '--check-alert-tiers') {
      out.checkAlertTiers = true;
      continue;
    }
    if (a === '--check-scouted-counter-shop') {
      out.checkScoutedCounterShop = true;
      continue;
    }
    if (a === '--check-map-schedule') {
      out.checkMapSchedule = true;
      continue;
    }
    if (a === '--check-boarding-trophy') {
      out.checkBoardingTrophy = true;
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

  checkProjection('normal round 1 full send', { round: 1, islandIdx: 0, sent: 2 }, { wages: 2, alert: 0, commission: 1, discount: 1 });
  checkProjection('normal round 2 full send', { round: 2, islandIdx: 0, sent: 2 }, { wages: 2, alert: 0, commission: 1, discount: 1 });
  checkProjection('port round 1 full send', { round: 1, islandIdx: 3, sent: 3 }, { wages: 2, alert: 0, commission: 1, discount: 1 });
  checkProjection('normal round 1 empty send', { round: 1, islandIdx: 0, sent: 0 }, { wages: 3, alert: 2, commission: 0, discount: 0 });
  checkProjection('normal round 1 partial send', { round: 1, islandIdx: 0, sent: 1 }, { wages: 2, alert: 1, commission: 0, discount: 0 });
  checkProjection('port round 1 partial send', { round: 1, islandIdx: 3, sent: 2 }, { wages: 2, alert: 1, commission: 0, discount: 0 });
  checkProjection('normal round 3 full send', { round: 3, islandIdx: 0, sent: 2 }, { wages: 1, alert: 0, commission: 0, discount: 1 });
  checkProjection('battle test no commission', { mode: 'battleTest', round: 1, islandIdx: 0, sent: 2 }, { wages: 0, alert: 0, commission: 0, discount: 0 });
  checkProjection('after boarding no commission', { round: 2, boardingCount: 1, islandIdx: 0, sent: 2 }, { wages: 1, alert: 0, commission: 0, discount: 1 });

  const shopCase = checkProjection('opening shop buyable cost 2', { round: 1, islandIdx: 0, sent: 2 }, { wages: 2, alert: 0, commission: 1, discount: 1 });
  shopCase.G.phase = 'shopping';
  const costTwoType = shopCase.G.shop.find(type => api.TYPES[type] && api.TYPES[type].cost === 2);
  assertOpeningCommissionCheck(!!costTwoType, 'starter shop has no cost-2 pirate');
  const quote = scene.shopPurchaseQuote(costTwoType);
  assertOpeningCommissionCheck(quote.canBuy && !quote.credit, `cost-2 ${costTwoType} was not buyable without credit`);
  results.push({ name: 'starter cost-2 buyable without credit', ok: true, type: costTwoType, quote });

  const uiCase = setup({ round: 1, islandIdx: 0, sent: 2 });
  const planLine = scene.formatSendingPlanLine(scene.sendingPlanProjection(2));
  const action = scene.currentIslandAction();
  assertOpeningCommissionCheck(planLine.includes('+2☠️ Wages') && planLine.includes('Opening'), 'plan line does not expose opening commission total');
  assertOpeningCommissionCheck(action && action.label.includes('+2☠️'), `work button label mismatch: ${action && action.label}`);
  results.push({ name: 'projection UI totals agree', ok: true, planLine, actionLabel: action.label, sent: uiCase.sent.length });

  return { ok: true, checks: results };
}

function assertPortDrillCheck(condition, message) {
  if (!condition) throw new Error(`port drill check failed: ${message}`);
}

function assertAlertTierCheck(condition, message) {
  if (!condition) throw new Error(`alert tier check failed: ${message}`);
}

function assertScoutedCounterShopCheck(condition, message) {
  if (!condition) throw new Error(`scouted counter shop check failed: ${message}`);
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

function prepareNextRoundForSim(api, scene) {
  const G = api.getG();
  if (G.phase !== 'shopping') return;

  const allCrewIds = new Set((G.allCrew || []).filter(Boolean).map(p => p.id));
  G.discard.push(...(G.hand || []).filter(p => p && allCrewIds.has(p.id)));
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
  }

  applyPortDrillForSim(scene);
  updateFullCrewDiscountForSim(scene, G);
  applyShipWagesForSim(scene, G);

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
    if (G.sent.length >= scene.maxSend()) break;
  }

  applyPortDrillForSim(scene);
  updateFullCrewDiscountForSim(scene, G);
  applyShipWagesForSim(scene, G);

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
  if (scene && typeof scene.grantBoardingTrophy === 'function') {
    scene.grantBoardingTrophy(G.combat);
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
