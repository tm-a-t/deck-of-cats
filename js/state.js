/* ============================================================
   PIRATES — Game State
   ============================================================ */

let uid = 0;
function mkP(type, opts = {}) {
  return {
    id: uid++,
    type,
    weaponKey: WEAPON_TYPES[opts.weaponKey] ? opts.weaponKey : null,
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

function randomShopType(round) {
  const maxCost = Math.max(3, round + 1);
  const pool = SHOP_POOL.filter(t => TYPES[t].cost <= maxCost);
  return Phaser.Utils.Array.GetRandom(pool.length ? pool : SHOP_POOL);
}

function initialShop(n, round) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(randomShopType(round));
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

  G = {
    mode: 'run',
    allCrew: [...crew],
    deck: Phaser.Utils.Array.Shuffle([...crew]),
    discard: [],
    hand: [],
    res: { wood: 0, stone: 0, gold: 0, map: 0 },
    enthusiasm: 0,
    round: 0,
    phase: 'map',
    sent: [],
    island: null,
    enemyShip: null,
    combat: null,
    boardingCount: 0,
    gameOver: false,
    shop: initialShop(4, 0),
    shopAnimating: false,
    busy: false,
    map: generateMap(),
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
    : Phaser.Math.Between(1, 6);
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

  // TEST: Force reshuffle scenario with split deck/discard
  const testReshuffleSplit = crew.length >= 5;
  G = {
    mode: 'battleTest',
    allCrew: [...crew],
    deck: testReshuffleSplit ? [crew[0], crew[1]] : [],
    discard: testReshuffleSplit ? crew.slice(2) : [],
    hand: testReshuffleSplit ? [] : [...crew],
    res: { wood: 0, stone: 0, gold: 0, map: 0 },
    enthusiasm: 0,
    round: encounterNo,
    phase: 'boarding',
    sent: [],
    island: null,
    enemyShip,
    combat: useRepeatState ? repeatCombat : null,
    boardingCount: encounterNo,
    gameOver: false,
    shop: [],
    shopAnimating: false,
    busy: false,
    map: null,
  };
}
