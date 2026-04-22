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
      randomShopType,
      drawCards,
      getAvailableNodes,
      mapNodeById,
      MAP_LAYERS,
      TYPES,
      ISLANDS,
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
  t.push(440 + islandCode(api, G));
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

function buildShopDecision(api, G, buysThisShop, typeIndexMap, actionCap) {
  if (actionCap < 5) {
    throw new Error(`policy action cap too small for shop: ${actionCap}`);
  }
  const options = [
    { type: 'buy_slot', slot: 0 },
    { type: 'buy_slot', slot: 1 },
    { type: 'buy_slot', slot: 2 },
    { type: 'buy_slot', slot: 3 },
    { type: 'skip_shop' },
  ];
  const tokens = baseDecisionTokens(api, G, DECISION_KIND.shop);
  tokens.push(600 + clamp(buysThisShop, 0, 15));
  for (let slot = 0; slot < 4; slot++) {
    const type = G.shop[slot] || null;
    const typeIdx = type ? (typeIndexMap[type] || 0) : 0;
    const cost = type ? (api.TYPES[type].cost || 0) : 0;
    const affordable = type && cost <= G.enthusiasm ? 1 : 0;
    tokens.push(1600 + clamp(typeIdx, 0, 380));
    tokens.push(1800 + bucket(cost, [0, 1, 2, 3, 4, 5, 7, 10, 13, 17, 24]));
    tokens.push(1900 + affordable);
  }
  tokens.push(1999); // explicit skip marker

  const valid = [4];
  for (let i = 0; i < 4; i++) {
    const type = G.shop[i];
    if (!type) continue;
    const cost = api.TYPES[type].cost || 0;
    if (cost <= G.enthusiasm) valid.push(i);
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

function pickProbabilisticShopIndex(runtime, api, G, buysThisShop) {
  const affordable = [];
  for (let i = 0; i < G.shop.length; i++) {
    const type = G.shop[i];
    const cost = api.TYPES[type].cost || 0;
    if (cost > G.enthusiasm) continue;
    affordable.push({ idx: i, cost });
  }
  if (!affordable.length) return -1;
  affordable.sort((a, b) => b.cost - a.cost);

  for (const item of affordable) {
    const type = G.shop[item.idx];
    const pBuy = buyProbability(api, G, type, buysThisShop);
    const roll = runtime ? runtime.rand() : Math.random();
    if (roll <= pBuy) return item.idx;
  }
  return -1;
}

function makeSimScene(api) {
  const scene = new api.GameScene();
  scene.ct = {
    tip: { setVisible: () => {} },
    gameover: { list: [] },
  };
  scene._sendingToIsland = new Set();
  scene._sacrificedIds = new Set();
  scene.renderAll = () => {};
  // Headless sim can still hit direct UI refresh calls from GameScene.
  scene.renderNav = () => {};
  scene.float = () => {};
  scene.showGameOver = () => {};
  scene.showVictory = () => {};
  scene.L = { k: 1, Y_ISL_CY: 0, cx: 0 };
  return scene;
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
      const h = pickProbabilisticShopIndex(runtime, api, G, buysThisShop);
      ctx.heuristicAction = (h != null && h >= 0) ? h : 4;
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
    const idx = selected.slot;
    const boughtType = G.shop[idx];
    if (boughtType) purchases.push(api.TYPES[boughtType].name || boughtType);
    scene.buyPirate(idx, {
      deferRender: true,
      silent: true,
      ignoreAnimating: true,
      skipModalRefresh: true,
    });
    buysThisShop++;
  }

  if (G.shop.length) {
    G.shop.shift();
    G.shop.push(api.randomShopType(G.round + 1));
  }
  scene.prepareNextRound();
}

function runBoardingPhase(api, scene) {
  const G = api.getG();
  const crewStr = G.hand.reduce((sum, p) => sum + (api.TYPES[p.type].str || 0), 0);
  const totalStr = crewStr + scene.shipBonusStr();
  const shipStr = G.enemyShip.strength;

  if (totalStr >= shipStr) {
    G.weapons = clearWeapons(G.weapons);
    G.discard.push(...G.hand);
    G.hand = [];

    if (G.map.currentLayer >= api.MAP_LAYERS - 1) return { state: 'win', totalStr, shipStr };

    G.hand = api.drawCards(5);
    scene.enterMapPhase();
    return { state: 'continue', totalStr, shipStr };
  }

  G.weapons = clearWeapons(G.weapons);
  return { state: 'loss', totalStr, shipStr };
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

    if (G.phase === 'boarding') {
      const res = runBoardingPhase(api, scene);
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
