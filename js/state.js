/* ============================================================
   PIRATES — Game State
   ============================================================ */

let uid = 0;
function mkP(type) { return { id: uid++, type }; }

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
  return Object.keys(TYPES).filter(type => !type.startsWith('tutorial'));
}

function randomBattleTestType() {
  const pool = battleTestTypePool();
  return Phaser.Utils.Array.GetRandom(pool.length ? pool : Object.keys(TYPES));
}

function buildBattleTestCrew(count) {
  const crew = [];
  const fighterCount = Math.max(3, Number(count) || 0);
  for (let i = 0; i < fighterCount; i++) crew.push(mkP(randomBattleTestType()));

  if (!crew.some(pirate => (TYPES[pirate.type] && TYPES[pirate.type].str) > 0)) {
    const damagingPool = battleTestTypePool().filter(type => (TYPES[type] && TYPES[type].str) > 0);
    if (damagingPool.length) {
      crew[0] = mkP(Phaser.Utils.Array.GetRandom(damagingPool));
    }
  }

  return crew;
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
    weapons: createWeaponInventory(),
    cannons: 0,
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
    tutorial: null,
  };

  G.hand = drawCards(5);
}

function initBattleTestState() {
  const fighterCount = 5;
  const crew = buildBattleTestCrew(fighterCount);
  const encounterNo = Phaser.Math.Between(1, 6);
  const weaponCount = Phaser.Math.Between(1, crew.length);
  const weapons = rollWeaponDrops(weaponCount, { ensureDistinct: true });

  G = {
    mode: 'battleTest',
    allCrew: [...crew],
    deck: [],
    discard: [],
    hand: [...crew],
    res: { wood: 0, stone: 0, gold: 0, map: 0 },
    weapons,
    cannons: 0,
    enthusiasm: 0,
    round: encounterNo,
    phase: 'boarding',
    sent: [],
    island: null,
    enemyShip: { encounterNo, strength: encounterNo },
    combat: null,
    boardingCount: encounterNo,
    gameOver: false,
    shop: [],
    shopAnimating: false,
    busy: false,
    map: null,
    tutorial: null,
  };
}

function initTutorialState() {
  const cards = {};
  const mkTutorialCard = (ref, type) => {
    const card = mkP(type);
    card.ref = ref;
    cards[ref] = card;
    return card;
  };

  const L1 = mkTutorialCard('L1', 'lumberjack');
  const L2 = mkTutorialCard('L2', 'lumberjack');
  const L3 = mkTutorialCard('L3', 'lumberjack');
  const M1 = mkTutorialCard('M1', 'miner');
  const M2 = mkTutorialCard('M2', 'miner');
  const M3 = mkTutorialCard('M3', 'miner');
  const S1 = mkTutorialCard('S1', 'tutorialSwabbie');
  const S2 = mkTutorialCard('S2', 'tutorialSwabbie');
  const S3 = mkTutorialCard('S3', 'tutorialSwabbie');
  cards.FEATURED = null;

  const crew = [L1, L2, L3, M1, M2, M3, S1, S2, S3];
  const featuredName = TYPES.tutorialAdmiralBlackpowder.name;

  const turns = [
    {
      round: 1,
      phase: 'sending',
      requiredSent: 2,
      island: {
        ...ISLANDS[0],
      },
      handRefs: ['L1', 'M1', 'L2', 'M2', 'S1'],
      blockedIslandRefs: ['L2', 'M2'],
      shop: [],
      hints: {
        sending: 'Send 2 pirates for resources',
        shopping: 'Continue to shop',
      },
    },
    {
      round: 2,
      phase: 'sending',
      requiredSent: 2,
      island: {
        ...ISLANDS[1],
      },
      handRefs: ['L2', 'M2', 'L3', 'M3', 'S2'],
      blockedIslandRefs: ['L3', 'M3'],
      shop: [],
      hints: {
        sending: 'Send 2 pirates for resources',
        ship: 'Nice! You got the expected loot.',
        shopping: 'Continue to shop',
      },
    },
    {
      round: 3,
      phase: 'sending',
      requiredSent: 2,
      island: {
        name: 'Calm Atoll',
        emoji: '🏝️',
        bonus: null,
        accent: 0x3f6d86,
      },
      handRefs: ['L1', 'M1', 'L3', 'M3', 'S3'],
      blockedIslandRefs: ['L3', 'M3'],
      shop: ['tutorialAdmiralBlackpowder'],
      requireFeaturedPurchase: true,
      hints: {
        sending: 'Send 2 pirates for resources',
        shopping: 'Buy a pirate to strengthen your deck',
      },
    },
    {
      round: 4,
      phase: 'sending',
      requiredSent: 2,
      startRes: { gold: 0 },
      island: {
        name: 'Calm Atoll',
        emoji: '🏝️',
        bonus: null,
        accent: 0x5e6b7d,
      },
      handRefs: ['FEATURED', 'S3', 'L3', 'M3', 'S1'],
      blockedIslandRefs: ['FEATURED'],
      forcedMismatch: { cardRef: 'L3', res: 'gold', n: 1, targetRes: 'wood' },
      shop: [],
      hints: {
        sending: 'Send 2 pirates; keep your new pirate on ship',
        ship: 'Use ship skills from your bought pirate',
        shopping: 'Continue to shop',
      },
    },
    {
      round: 5,
      phase: 'boarding',
      handRefs: ['FEATURED', 'L1', 'L2', 'M1', 'M2'],
      startWeapons: { hammer: 1, axe: 1, bow: 1, musket: 1, hookshot: 1 },
      shop: [],
      enemyShip: { preset: 'tutorial-final' },
      hints: {
        boarding: 'Arm pirates, then Fight',
      },
    },
  ];

  const featured = {
    ref: 'FEATURED',
    cardRef: 'FEATURED',
    type: 'tutorialAdmiralBlackpowder',
    name: featuredName,
    label: featuredName,
    cost: TYPES.tutorialAdmiralBlackpowder.cost,
    str: TYPES.tutorialAdmiralBlackpowder.str,
    buyTurn: 3,
    playTurn: 4,
  };

  const forcedMismatch = {
    turn: 4,
    cardRef: 'L3',
    expected: { res: 'wood', amt: 1 },
    actual: { res: 'gold', amt: 1 },
    lore: 'Sometimes pirates bring different loot on any island.',
  };

  const initialDrawTopToBottom = ['L1', 'M1', 'L2', 'M2', 'S1', 'S2', 'S3', 'L3', 'M3'];
  const firstTurn = turns[0];
  const firstHand = firstTurn.handRefs.map(ref => cards[ref]).filter(Boolean);
  const firstHandRefs = new Set(firstTurn.handRefs);
  const remainingTopToBottom = initialDrawTopToBottom.filter(ref => !firstHandRefs.has(ref));
  const drawPile = [...remainingTopToBottom].reverse().map(ref => cards[ref]);

  G = {
    mode: 'tutorial',
    allCrew: [...crew],
    deck: drawPile,
    discard: [],
    hand: firstHand,
    res: { wood: 0, stone: 0, gold: 0, map: 0 },
    weapons: createWeaponInventory(),
    cannons: 0,
    enthusiasm: 0,
    round: 1,
    phase: 'sending',
    sent: [],
    island: { ...firstTurn.island },
    enemyShip: null,
    combat: null,
    boardingCount: 0,
    gameOver: false,
    shop: [],
    shopAnimating: false,
    busy: false,
    map: null,
    tutorial: {
      active: true,
      currentTurn: 1,
      turns,
      cards,
      featured,
      forcedMismatch,
      runtime: {
        featuredBought: false,
        featuredPlayed: false,
        mismatchApplied: false,
        drawPlan: {
          initialTopToBottom: initialDrawTopToBottom,
          reshuffleA: ['S1', 'L1', 'M1', 'L2', 'M2'],
          reshuffleB: ['S2', 'S3', 'L3', 'M3', 'S1'],
          turn5HandRefs: ['FEATURED', 'L1', 'L2', 'M1', 'M2'],
        },
      },
    },
  };
}
