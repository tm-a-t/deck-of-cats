/* ============================================================
   PIRATES — Map Generation
   ============================================================ */

const MAP_LAYERS = 40;
const EARLY_SEGMENT_LENGTHS = [3, 5];
const EARLY_SEGMENTS = EARLY_SEGMENT_LENGTHS.length;
const EARLY_PATHS = 3;
const EARLY_LAYER_COUNT = EARLY_SEGMENT_LENGTHS.reduce((sum, length) => sum + length + 1, 0);
const FIRST_LINEAR_SEGMENTS = 0;
const TOTAL_BATTLES = 8;
const HEAL_LAYER_INDICES = new Set([10, 20, 30]);

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

function chooseIslandIndices(available, count, dealWithoutReplacement = false) {
  const picked = [];
  const bag = dealWithoutReplacement ? available.slice() : [];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }

  for (let i = 0; i < count; i++) {
    const islandIdx = bag.length
      ? bag.pop()
      : available[Math.floor(Math.random() * available.length)];
    picked.push(islandIdx);
  }
  return picked;
}

function scoutedCounterCacheResource(mainKey) {
  return (SCOUTED_COUNTER_CACHE_RES && SCOUTED_COUNTER_CACHE_RES[mainKey]) || null;
}

function scoutedCounterCacheNode(prevLayer, res) {
  const candidates = (Array.isArray(prevLayer) ? prevLayer : []).filter((node) => {
    if (!node || node.type !== 'island') return false;
    const island = ISLANDS[node.islandIdx];
    return island && !island.healWounded;
  });
  if (!candidates.length) return null;

  const matchingBonus = candidates.find((node) => {
    const island = ISLANDS[node.islandIdx];
    return island && island.bonus === res;
  });
  if (matchingBonus) return matchingBonus;

  const port = candidates.find((node) => {
    const island = ISLANDS[node.islandIdx];
    return island && island.extraSend;
  });
  return port || candidates[0];
}

function markScoutedCounterCaches(layers) {
  if (!Array.isArray(layers)) return;
  for (let li = 1; li < layers.length; li++) {
    const layer = layers[li];
    if (!layer || layer.length !== 1 || layer[0].type !== 'ship') continue;

    const ship = layer[0];
    const mainKey = ship.encounter && ship.encounter.mainKey;
    const res = scoutedCounterCacheResource(mainKey);
    if (!res) continue;

    const node = scoutedCounterCacheNode(layers[li - 1], res);
    if (!node) continue;
    node.scoutedCache = {
      mainKey,
      res,
      amount: 1,
      enthusiasm: 1,
      alert: 1,
      claimed: false,
    };
  }
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

  if (boardingNo === 1) {
    totalCount = 3;
    const mainArch = eligibleStrong.length
      ? eligibleStrong[Math.floor(Math.random() * eligibleStrong.length)]
      : weak[Math.floor(Math.random() * weak.length)];
    mainKey = mainArch.key;
    desc = mainArch.encounterDesc || mainArch.summary;
    supportKeys = ['bilgeRat', 'cabinBoy'];
  } else if (boardingNo <= 2) {
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

  // Early game: parallel route forks with straight non-intersecting paths.
  let segmentBase = 0;
  for (let seg = 0; seg < EARLY_SEGMENTS; seg++) {
    const segmentLength = EARLY_SEGMENT_LENGTHS[seg];
    const pathCount = earlyPathCount(seg);
    for (let step = 0; step < segmentLength; step++) {
      const li = segmentBase + step;
      const earlyRestricted = li < 9;
      const available = earlyRestricted
        ? regularIslandIndices().filter(i => i !== 2 && i !== 4)
        : regularIslandIndices();
      const islandChoices = chooseIslandIndices(
        available,
        pathCount,
        earlyRestricted && pathCount >= available.length
      );
      const layer = [];
      for (let pi = 0; pi < pathCount; pi++) {
        layer.push({ id: nextId++, type: 'island', islandIdx: islandChoices[pi], conns: [] });
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
    segmentBase += segmentLength + 1;
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
  segmentBase = 0;
  for (let seg = 0; seg < EARLY_SEGMENTS; seg++) {
    const base = segmentBase;
    const segmentLength = EARLY_SEGMENT_LENGTHS[seg];
    const pathCount = earlyPathCount(seg);
    for (let step = 0; step < segmentLength - 1; step++) {
      const cur = layers[base + step];
      const nxt = layers[base + step + 1];
      for (let pi = 0; pi < pathCount; pi++) {
        cur[pi].conns = [nxt[pi].id];
      }
    }
    const lastIslands = layers[base + segmentLength - 1];
    const battle = layers[base + segmentLength];
    for (const node of lastIslands) {
      node.conns = [battle[0].id];
    }
    const nextBase = base + segmentLength + 1;
    if (nextBase < layers.length) {
      battle[0].conns = layers[nextBase].map(n => n.id);
    }
    segmentBase = nextBase;
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

  markScoutedCounterCaches(layers);

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
