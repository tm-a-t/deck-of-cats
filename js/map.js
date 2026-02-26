/* ============================================================
   PIRATES — Map Generation
   ============================================================ */

const MAP_LAYERS = 50;

function generateMap() {
  const layers = [];
  let nextId = 0;

  for (let li = 0; li < MAP_LAYERS; li++) {
    const isShip = (li + 1) % 5 === 0;

    if (isShip) {
      const shipNumber = (li + 1) / 5;
      layers.push([{ id: nextId++, type: 'ship', strength: Math.trunc(Math.pow(shipNumber, 1.39) * 4 + 2), conns: [] }]);
    } else {
      const count = (li < 9) ? 1 : 2 + Math.floor(Math.random() * 2);
      const available = (li < 9)
        ? ISLANDS.map((isl, i) => i).filter(i => i !== 2 && i !== 4)
        : ISLANDS.map((_, i) => i);
      const layer = [];
      for (let ni = 0; ni < count; ni++) {
        const islandIdx = available[Math.floor(Math.random() * available.length)];
        layer.push({ id: nextId++, type: 'island', islandIdx, conns: [] });
      }
      layers.push(layer);
    }
  }

  for (let li = 0; li < MAP_LAYERS - 1; li++) {
    const cur = layers[li];
    const nxt = layers[li + 1];
    const nextIsShip = nxt.length === 1 && nxt[0].type === 'ship';
    const prevIsShip = cur.length === 1 && cur[0].type === 'ship';

    if (nextIsShip) {
      // All nodes converge to the single ship
      for (const node of cur) {
        node.conns = [nxt[0].id];
      }
    } else if (prevIsShip) {
      // Ship fans out to all next-layer nodes
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
