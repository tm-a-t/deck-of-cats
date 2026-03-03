/* ============================================================
   PIRATES — Linear Route Generation
   ============================================================ */

const INITIAL_MAP_LAYERS = 25;
const MAP_EXTEND_AHEAD = 8;

function shipStrength(shipNumber) {
  return Math.trunc(Math.pow(shipNumber, 1.2) * 4 + 2);
}

function pickIslandIndex(layerIdx) {
  const isEarly = layerIdx < 9;
  const allowSacrifice = layerIdx >= 15 && Math.random() < 0.5;
  return Phaser.Utils.Array.GetRandom(
    ISLANDS
      .map((_, i) => i)
      .filter((i) => {
        if (ISLANDS[i].sacrifice && !allowSacrifice) return false;
        if (isEarly && (i === 2 || i === 4)) return false;
        return true;
      })
  );
}

function buildLinearNode(map, layerIdx) {
  const isShip = (layerIdx + 1) % 5 === 0;
  const id = map.nextId++;
  if (isShip) {
    map.nextBoardingNumber += 1;
    return {
      id,
      type: 'ship',
      strength: shipStrength(map.nextBoardingNumber),
      conns: [],
    };
  }

  return {
    id,
    type: 'island',
    islandIdx: pickIslandIndex(layerIdx),
    conns: [],
  };
}

function appendLinearLayers(map, count) {
  for (let i = 0; i < count; i++) {
    const prevLayer = map.layers.length > 0 ? map.layers[map.layers.length - 1] : null;
    const layerIdx = map.layers.length;
    const node = buildLinearNode(map, layerIdx);
    map.layers.push([node]);
    if (prevLayer && prevLayer[0]) {
      prevLayer[0].conns = [node.id];
    }
  }
}

function ensureLinearMapAhead(map, minAhead = MAP_EXTEND_AHEAD) {
  if (!map || !Array.isArray(map.layers)) return;
  const remainingAhead = map.layers.length - (map.currentLayer + 1);
  if (remainingAhead >= minAhead) return;
  appendLinearLayers(map, minAhead - remainingAhead);
}

function generateMap() {
  const map = {
    layers: [],
    visited: [],
    currentNodeId: null,
    currentLayer: -1,
    nextId: 0,
    nextBoardingNumber: 0,
  };
  appendLinearLayers(map, INITIAL_MAP_LAYERS);
  return map;
}

function mapNodeById(map, id) {
  for (const layer of map.layers) {
    for (const node of layer) {
      if (node.id === id) return node;
    }
  }
  return null;
}

function getAvailableNodes(map) {
  if (!map || !Array.isArray(map.layers) || map.layers.length === 0) return [];
  if (map.currentLayer < 0) return map.layers[0].map((n) => n.id);

  ensureLinearMapAhead(map);
  const curNode = mapNodeById(map, map.currentNodeId);
  return curNode ? [...curNode.conns] : [];
}
