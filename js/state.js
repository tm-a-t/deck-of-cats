/* ============================================================
   PIRATES — Game State
   ============================================================ */

let uid = 0;
function mkP(type) { return { id: uid++, type }; }

function randomShopType() {
  return Phaser.Utils.Array.GetRandom(SHOP_POOL);
}

function initialShop(n) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(randomShopType());
  return arr;
}

let G = {};

function initState() {
  const crew = [];
  for (let i = 0; i < 3; i++) crew.push(mkP('lumberjack'));
  for (let i = 0; i < 3; i++) crew.push(mkP('miner'));
  for (let i = 0; i < 2; i++) crew.push(mkP('adventurer'));
  for (let i = 0; i < 2; i++) crew.push(mkP('slacker'));

  G = {
    allCrew: [...crew],
    deck: Phaser.Utils.Array.Shuffle([...crew]),
    discard: [],
    hand: [],
    res: { wood: 0, stone: 0, gold: 0, map: 0 },
    weapons: 0,
    cannons: 0,
    enthusiasm: 0,
    round: 0,
    phase: 'sending',
    sent: [],
    island: null,
    enemyShip: null,
    boardingCount: 0,
    gameOver: false,
    shop: initialShop(4),
    shopAnimating: false,
    busy: false,
  };
}
