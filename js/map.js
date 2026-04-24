/* ============================================================
   PIRATES — Map Generation
   ============================================================ */

const MAP_LAYERS = 30;
const EARLY_SEGMENTS = 2;
const EARLY_PATHS = 3;
const STEPS_PER_SEGMENT = 4;
const EARLY_LAYER_COUNT = EARLY_SEGMENTS * (STEPS_PER_SEGMENT + 1);
const FIRST_LINEAR_SEGMENTS = 1;
const TOTAL_BATTLES = 6;
const HEAL_LAYER_INDICES = new Set([10, 20]);

function healingIslandIndex() {
  return ISLANDS.findIndex(island => island && island.healWounded);
}

function regularIslandIndices(opts = {}) {
  const allowSacrifice = !!opts.allowSacrifice;
  return ISLANDS
    .map((_, i) => i)
    .filter((i) => {
      const island = ISLANDS[i];
      if (!island) return false;
      if (island.healWounded) return false;
      if (island.sacrifice && !allowSacrifice) return false;
      return true;
    });
}

function earlyPathCount(seg) {
  return seg < FIRST_LINEAR_SEGMENTS ? 1 : EARLY_PATHS;
}

function shipStrength(shipNumber) {
  return Math.trunc(Math.pow(shipNumber, 1.2) * 2 + 4);
}

function generateEncounterBlueprint(boardingNo) {
  const archetypes = COMBAT.enemyArchetypes;
  const weak = archetypes.filter(a => a.tier === 'weak');
  const strong = archetypes.filter(a => a.tier === 'strong');

  const eligibleStrong = strong.filter(a =>
    boardingNo >= Math.max(1, Math.floor(Number(a.unlockAt) || 1))
  );

  let mainKey, supportKeys, totalCount, desc;

  if (boardingNo <= 2) {
    totalCount = 3;
    const strongCount = Math.min(boardingNo, 2);
    const weakCount = totalCount - strongCount;
    const mainArch = eligibleStrong.length
      ? eligibleStrong[Math.floor(Math.random() * eligibleStrong.length)]
      : weak[Math.floor(Math.random() * weak.length)];
    mainKey = mainArch.key;
    desc = mainArch.encounterDesc || mainArch.summary;
    supportKeys = [];
    for (let i = 1; i < strongCount; i++) supportKeys.push(mainKey);
    for (let i = 0; i < weakCount; i++) {
      supportKeys.push(weak[Math.floor(Math.random() * weak.length)].key);
    }
  } else if (boardingNo <= 4) {
    totalCount = 3 + Math.floor(boardingNo / 3);
    const mainArch = eligibleStrong.length
      ? eligibleStrong[Math.floor(Math.random() * eligibleStrong.length)]
      : strong[Math.floor(Math.random() * strong.length)];
    mainKey = mainArch.key;
    desc = mainArch.encounterDesc || mainArch.summary;
    const strongCount = Math.min(totalCount - 1, 1 + Math.floor(boardingNo / 2));
    const weakCount = totalCount - strongCount;
    const otherStrong = eligibleStrong.filter(a => a.key !== mainKey);
    const secondaryCount = Math.random() < 0.5 && otherStrong.length ? 1 : 0;
    const secondaryArch = otherStrong.length
      ? otherStrong[Math.floor(Math.random() * otherStrong.length)]
      : null;
    supportKeys = [];
    for (let i = 1; i < strongCount - secondaryCount; i++) supportKeys.push(mainKey);
    if (secondaryArch) {
      for (let i = 0; i < secondaryCount; i++) supportKeys.push(secondaryArch.key);
    }
    for (let i = 0; i < weakCount; i++) {
      supportKeys.push(weak[Math.floor(Math.random() * weak.length)].key);
    }
  } else {
    totalCount = Math.min(COMBAT.enemyCountMax, 3 + Math.floor(boardingNo / 2));
    const mainArch = eligibleStrong.length
      ? eligibleStrong[Math.floor(Math.random() * eligibleStrong.length)]
      : strong[Math.floor(Math.random() * strong.length)];
    mainKey = mainArch.key;
    desc = mainArch.encounterDesc || mainArch.summary;
    supportKeys = [];
    const otherStrong = eligibleStrong.filter(a => a.key !== mainKey);
    const secondaryCount = Math.random() < 0.5 && otherStrong.length ? 1 : 0;
    const secondaryArch = otherStrong.length
      ? otherStrong[Math.floor(Math.random() * otherStrong.length)]
      : null;
    const strongFill = totalCount - 1 - secondaryCount;
    for (let i = 0; i < strongFill; i++) supportKeys.push(mainKey);
    if (secondaryArch) {
      for (let i = 0; i < secondaryCount; i++) supportKeys.push(secondaryArch.key);
    }
  }

  return {
    mainKey,
    supportKeys,
    totalCount,
    encounterDesc: desc || null,
  };
}

function generateMap() {
  const layers = [];
  let nextId = 0;
  let battlesSoFar = 0;

  // Early game: first segment is linear, later segments use 3 non-intersecting paths
  for (let seg = 0; seg < EARLY_SEGMENTS; seg++) {
    const pathCount = earlyPathCount(seg);
    for (let step = 0; step < STEPS_PER_SEGMENT; step++) {
      const li = seg * (STEPS_PER_SEGMENT + 1) + step;
      const available = (li < 9)
        ? regularIslandIndices().filter(i => i !== 2 && i !== 4)
        : regularIslandIndices();
      const layer = [];
      for (let pi = 0; pi < pathCount; pi++) {
        const islandIdx = available[Math.floor(Math.random() * available.length)];
        layer.push({ id: nextId++, type: 'island', islandIdx, conns: [] });
      }
      layers.push(layer);
    }
    battlesSoFar++;
    const bp = generateEncounterBlueprint(battlesSoFar);
    layers.push([{
      id: nextId++, type: 'ship',
      strength: shipStrength(battlesSoFar),
      encounter: bp,
      conns: [],
    }]);
  }

  // Remaining layers: place ship every 5th layer, island layers in between
  for (let li = EARLY_LAYER_COUNT; li < MAP_LAYERS; li++) {
    const healIdx = healingIslandIndex();
    if (HEAL_LAYER_INDICES.has(li) && healIdx >= 0) {
      layers.push([{ id: nextId++, type: 'island', islandIdx: healIdx, conns: [] }]);
      continue;
    }

    const isShip = (li + 1) % 5 === 0;
    if (isShip) {
      battlesSoFar++;
      const bp = generateEncounterBlueprint(battlesSoFar);
      layers.push([{
        id: nextId++, type: 'ship',
        strength: shipStrength(battlesSoFar),
        encounter: bp,
        conns: [],
      }]);
    } else {
      const count = 2 + Math.floor(Math.random() * 2);
      const allowSacrifice = li >= 10 && Math.random() < 0.5;
      const available = regularIslandIndices({ allowSacrifice });
      const layer = [];
      for (let ni = 0; ni < count; ni++) {
        const islandIdx = available[Math.floor(Math.random() * available.length)];
        layer.push({ id: nextId++, type: 'island', islandIdx, conns: [] });
      }
      layers.push(layer);
    }
  }

  // Connections: early segments — straight non-intersecting paths
  for (let seg = 0; seg < EARLY_SEGMENTS; seg++) {
    const base = seg * (STEPS_PER_SEGMENT + 1);
    const pathCount = earlyPathCount(seg);
    for (let step = 0; step < STEPS_PER_SEGMENT - 1; step++) {
      const cur = layers[base + step];
      const nxt = layers[base + step + 1];
      for (let pi = 0; pi < pathCount; pi++) {
        cur[pi].conns = [nxt[pi].id];
      }
    }
    const lastIslands = layers[base + STEPS_PER_SEGMENT - 1];
    const battle = layers[base + STEPS_PER_SEGMENT];
    for (const node of lastIslands) {
      node.conns = [battle[0].id];
    }
    const nextBase = base + STEPS_PER_SEGMENT + 1;
    if (nextBase < layers.length) {
      battle[0].conns = layers[nextBase].map(n => n.id);
    }
  }

  // Connections: remaining layers
  for (let li = EARLY_LAYER_COUNT; li < MAP_LAYERS - 1; li++) {
    const cur = layers[li];
    const nxt = layers[li + 1];
    const nextIsShip = nxt.length === 1 && nxt[0].type === 'ship';
    const prevIsShip = cur.length === 1 && cur[0].type === 'ship';

    if (nextIsShip) {
      for (const node of cur) {
        node.conns = [nxt[0].id];
      }
    } else if (prevIsShip) {
      cur[0].conns = nxt.map(n => n.id);
    } else {
      assignConnections(cur, nxt);
    }
  }

  return {
    layers,
    visited: [],
    currentNodeId: null,
    currentLayer: -1,
  };
}

function assignConnections(cur, nxt) {
  // Every cur node gets 1-2 connections, every nxt node must be reachable
  const nxtCount = nxt.length;

  for (const node of cur) {
    node.conns = [];
  }

  // First pass: guarantee every nxt node is reachable by at least one cur node.
  // Assign each nxt node to the cur node closest in relative position.
  for (let ni = 0; ni < nxtCount; ni++) {
    const idealCur = Math.round(ni * (cur.length - 1) / Math.max(nxtCount - 1, 1));
    const ci = Math.min(idealCur, cur.length - 1);
    if (!cur[ci].conns.includes(nxt[ni].id)) {
      cur[ci].conns.push(nxt[ni].id);
    }
  }

  // Second pass: each cur node should have at least 1 connection.
  // If it has none, connect to the nearest nxt node by index.
  for (let ci = 0; ci < cur.length; ci++) {
    if (cur[ci].conns.length === 0) {
      const ni = Math.min(ci, nxtCount - 1);
      cur[ci].conns.push(nxt[ni].id);
    }
  }

  // Third pass: randomly add a second connection to nodes that only have 1,
  // picking an adjacent nxt node to avoid crossings.
  for (let ci = 0; ci < cur.length; ci++) {
    if (cur[ci].conns.length < 2 && Math.random() < 0.6) {
      const currentTargetIdx = nxt.findIndex(n => n.id === cur[ci].conns[0]);
      const candidates = [];
      if (currentTargetIdx + 1 < nxtCount) candidates.push(currentTargetIdx + 1);
      if (currentTargetIdx - 1 >= 0) candidates.push(currentTargetIdx - 1);
      // Filter candidates to avoid crossings: only pick adjacent that doesn't
      // jump over another node's connections
      for (const cand of candidates) {
        const candId = nxt[cand].id;
        if (!cur[ci].conns.includes(candId)) {
          if (!wouldCross(cur, ci, cand, nxt)) {
            cur[ci].conns.push(candId);
            break;
          }
        }
      }
    }
  }

  // Sort each node's connections by nxt index for consistent rendering
  for (const node of cur) {
    node.conns.sort((a, b) => {
      const ai = nxt.findIndex(n => n.id === a);
      const bi = nxt.findIndex(n => n.id === b);
      return ai - bi;
    });
  }
}

function wouldCross(cur, ciSource, niTarget, nxt) {
  // Check if adding an edge from cur[ciSource] -> nxt[niTarget]
  // would cross any existing edge from another cur node
  for (let ci = 0; ci < cur.length; ci++) {
    if (ci === ciSource) continue;
    for (const connId of cur[ci].conns) {
      const ni = nxt.findIndex(n => n.id === connId);
      // Crossing happens when cur indices and nxt indices are in opposite order
      if ((ci < ciSource && ni > niTarget) || (ci > ciSource && ni < niTarget)) {
        return true;
      }
    }
  }
  return false;
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
  if (map.currentLayer < 0) {
    return map.layers[0].map(n => n.id);
  }
  if (map.currentLayer >= MAP_LAYERS - 1) {
    return [];
  }
  const curNode = mapNodeById(map, map.currentNodeId);
  return curNode ? curNode.conns : [];
}
