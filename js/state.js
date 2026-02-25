/* ============================================================
   PIRATES — Game State
   ============================================================ */

let uid = 0;
function mkP(type) { return { id: uid++, type }; }

function randomShopType(round) {
  const maxCost = Math.max(4, round);
  const pool = SHOP_POOL.filter(t => TYPES[t].cost <= maxCost);
  return Phaser.Utils.Array.GetRandom(pool.length ? pool : SHOP_POOL);
}

function initialShop(n, round) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(randomShopType(round));
  return arr;
}

let G = {};

function drawCards(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (G.deck.length === 0) {
      if (G.discard.length === 0) break;
      G.deck = Phaser.Utils.Array.Shuffle([...G.discard]);
      G.discard = [];
    }
    out.push(G.deck.pop());
  }
  return out;
}

function initState() {
  const crew = [];
  for (let i = 0; i < 5; i++) crew.push(mkP('lumberjack'));
  for (let i = 0; i < 5; i++) crew.push(mkP('miner'));

  G = {
    allCrew: [...crew],
    deck: Phaser.Utils.Array.Shuffle([...crew]),
    discard: [],
    hand: [],
    res: { wood: 0, stone: 0, gold: 0, map: 0 },
    weapons: 0,
    cannons: 1,
    enthusiasm: 0,
    round: 0,
    phase: 'map',
    sent: [],
    island: null,
    enemyShip: null,
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

function initTutorialState() {
  const crew = [
    mkP('tutorialForager'),
    mkP('tutorialSwabbie'),
    mkP('tutorialSwabbie'),
    mkP('tutorialSwabbie'),
    mkP('tutorialSwabbie'),
  ];

  G = {
    allCrew: [...crew],
    deck: Phaser.Utils.Array.Shuffle([...crew]),
    discard: [],
    hand: [],
    res: { wood: 0, stone: 0, gold: 0, map: 0 },
    weapons: 0,
    cannons: 0,
    enthusiasm: 0,
    round: 1,
    phase: 'sending',
    sent: [],
    island: {
      name: 'Training Cove',
      emoji: '🏝️',
      accent: 0x4b7d42,
      maxSend: 1,
      tutorialDesc: 'only 1 pirate can land',
    },
    enemyShip: null,
    boardingCount: 0,
    gameOver: false,
    shop: ['carpenter', 'quartermaster', 'masterLumberjack', 'masterMiner'],
    shopAnimating: false,
    busy: false,
    map: null,
    tutorial: {
      active: true,
      step: 'landing',
      recommendedType: 'carpenter',
      recommendedBought: false,
      boss1Strength: 0,
      boss2Strength: 0,
    },
  };

  G.hand = drawCards(5);
}
