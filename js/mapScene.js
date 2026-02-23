/* ============================================================
   PIRATES — Map Scene
   ============================================================ */

class MapScene extends Phaser.Scene {
  constructor() { super('map'); }

  preload() {
    this.load.spritesheet('pirates', 'assets/pirates.png', {
      frameWidth: 8, frameHeight: 8, spacing: 2, margin: 0,
    });
  }

  create() {
    this.textures.get('pirates').setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.L = computeLayout(this.scale.width, this.scale.height);

    if (!G.map) initState();

    this.mapGfx = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0).setDepth(10);

    this.renderMapGraph();
    this.renderTopBar();
    this.renderHandPreview();
    this.setupScroll();
    this.scrollToCurrentLayer(false);

    this.scale.on('resize', (gameSize) => {
      this.L = computeLayout(gameSize.width, gameSize.height);
      this.scene.restart();
    });
  }

  // ──────────── MAP GRAPH ────────────

  nodeScreenX(nodeIdx, layerLen) {
    const L = this.L;
    const maxW = Math.min(L.W * 0.45, 280 * L.k);
    if (layerLen === 1) return L.cx;
    const sp = maxW / (layerLen - 1);
    return L.cx - maxW / 2 + nodeIdx * sp;
  }

  layerScreenY(layerIdx) {
    const L = this.L;
    const totalLayers = G.map.layers.length;
    return (totalLayers - 1 - layerIdx) * L.MAP_LAYER_SP + L.MAP_LAYER_SP;
  }

  get mapTotalH() {
    return (G.map.layers.length + 1) * this.L.MAP_LAYER_SP;
  }

  renderMapGraph() {
    this.mapGfx.removeAll(true);
    const L = this.L;
    const map = G.map;
    const available = new Set(getAvailableNodes(map));
    const visited = new Set(map.visited);

    const pathGfx = this.add.graphics();
    this.mapGfx.add(pathGfx);

    // Build id->position lookup
    const pos = {};
    for (let li = 0; li < map.layers.length; li++) {
      const layer = map.layers[li];
      for (let ni = 0; ni < layer.length; ni++) {
        const node = layer[ni];
        pos[node.id] = {
          x: this.nodeScreenX(ni, layer.length),
          y: this.layerScreenY(li),
        };
      }
    }

    // Draw paths
    for (const layer of map.layers) {
      for (const node of layer) {
        const from = pos[node.id];
        for (const connId of node.conns) {
          const to = pos[connId];
          if (!to) continue;
          const isActive = (node.id === map.currentNodeId && available.has(connId))
            || (visited.has(node.id) && visited.has(connId));
          pathGfx.lineStyle(
            isActive ? 3 : 2,
            isActive ? 0x5588aa : 0x1e3040,
            isActive ? 0.9 : 0.4
          );
          pathGfx.beginPath();
          pathGfx.moveTo(from.x, from.y);
          pathGfx.lineTo(to.x, to.y);
          pathGfx.strokePath();
        }
      }
    }

    // Draw nodes
    for (let li = 0; li < map.layers.length; li++) {
      const layer = map.layers[li];
      for (let ni = 0; ni < layer.length; ni++) {
        const node = layer[ni];
        const nx = pos[node.id].x;
        const ny = pos[node.id].y;
        const isAvail = available.has(node.id);
        const isVisited = visited.has(node.id);
        const isCurrent = node.id === map.currentNodeId;
        const isShip = node.type === 'ship';
        const isFinal = li === map.layers.length - 1;
        const r = isShip ? L.MAP_SHIP_R : L.MAP_NODE_R;

        const g = this.add.graphics();

        if (isCurrent) {
          g.fillStyle(0x44aadd, 0.3);
          g.fillCircle(nx, ny, r + 8);
        }

        if (isAvail) {
          g.fillStyle(0x33aaff, 0.25);
          g.fillCircle(nx, ny, r + 6);
        }

        if (isShip) {
          g.fillStyle(isFinal ? 0x8a2020 : 0x3a1010, isVisited ? 0.4 : 0.9);
          g.fillCircle(nx, ny, r);
          if (isFinal) {
            g.lineStyle(3, 0xff4444, 0.7);
            g.strokeCircle(nx, ny, r + 4);
          }
        } else {
          const island = ISLANDS[node.islandIdx];
          g.fillStyle(island.accent, isVisited ? 0.3 : 0.8);
          g.fillCircle(nx, ny, r);
        }

        if (isAvail) {
          g.lineStyle(3, 0x44ddff, 0.9);
          g.strokeCircle(nx, ny, r);
        } else if (isCurrent) {
          g.lineStyle(3, 0x44aadd, 1);
          g.strokeCircle(nx, ny, r);
        } else if (isVisited) {
          g.lineStyle(2, 0x334455, 0.5);
          g.strokeCircle(nx, ny, r);
        } else {
          g.lineStyle(2, 0x1e3040, 0.6);
          g.strokeCircle(nx, ny, r);
        }

        this.mapGfx.add(g);

        // Emoji label
        const emoji = isShip ? '🏴‍☠️' : ISLANDS[node.islandIdx].emoji;
        const label = this.add.text(nx, ny, emoji, {
          fontFamily: 'monospace',
          fontSize: Math.max(10, Math.round(L.MAP_NODE_FS * (isShip ? 0.9 : 0.75))) + 'px',
          color: '#ffffff',
        }).setOrigin(0.5);
        if (isVisited && !isCurrent) label.setAlpha(0.4);
        this.mapGfx.add(label);

        // Ship strength label
        if (isShip) {
          const strTxt = this.add.text(nx, ny + r + 8, node.strength + '⚔️', {
            fontFamily: 'monospace',
            fontSize: L.fs(16),
            color: '#ff8a80',
          }).setOrigin(0.5, 0);
          if (isVisited) strTxt.setAlpha(0.4);
          this.mapGfx.add(strTxt);
        }

        // Layer number (small, to the side)
        if (ni === 0) {
          const layerNum = this.add.text(14, ny, '' + (li + 1), {
            fontFamily: 'monospace',
            fontSize: L.fs(14),
            color: '#334455',
          }).setOrigin(0, 0.5);
          this.mapGfx.add(layerNum);
        }

        // Interactive hit area for available nodes
        if (isAvail) {
          const hitZone = this.add.zone(nx, ny, r * 3, r * 3)
            .setInteractive({ useHandCursor: true });
          hitZone.on('pointerdown', (ptr) => {
            ptr.event.stopPropagation();
            this.selectMapNode(node.id);
          });
          this.mapGfx.add(hitZone);
        }
      }
    }
  }

  // ──────────── TOP BAR ────────────

  renderTopBar() {
    const L = this.L;

    const bg = this.add.graphics();
    bg.fillStyle(0x0d1b2a, 1);
    bg.fillRect(0, 0, L.W, L.MAP_TOP);
    this.uiLayer.add(bg);

    const roundNum = G.map.currentLayer + 2;
    this.uiTxt(L.cx, 24 * L.k,
      `Choose your destination (Round ${roundNum} of ${MAP_LAYERS})`,
      { fontSize: L.fs(22), color: '#8090a0' });

    let inv = '';
    ['wood', 'stone', 'gold', 'map'].forEach(r => {
      for (let i = 0; i < Math.min(G.res[r], 30); i++) inv += RES_EMOJI[r];
    });
    if (G.weapons > 0) inv += `  🗡️${G.weapons}`;
    if (G.cannons > 0) inv += `  💣${G.cannons}`;
    if (!inv) inv = '—';
    this.uiTxt(L.cx, 60 * L.k, inv,
      { fontSize: L.fs(20), color: '#d0d0d0', wordWrap: { width: L.W - 40 } });

    const crew = [...G.allCrew].sort((a, b) => a.type < b.type ? -1 : a.type > b.type ? 1 : 0);
    const maxSp = 36 * L.k;
    const sp = Math.min(maxSp, (L.W - 80) / Math.max(crew.length, 1));
    const sx = L.cx - ((crew.length - 1) * sp) / 2;
    crew.forEach((p, i) => {
      const spr = this.add.sprite(sx + i * sp, 110 * L.k, 'pirates', TYPES[p.type].frame)
        .setScale(L.SC_SM);
      this.uiLayer.add(spr);
    });

    const dv = this.add.graphics();
    dv.lineStyle(2, 0x1e3040);
    dv.lineBetween(40, L.MAP_TOP - 4, L.W - 40, L.MAP_TOP - 4);
    this.uiLayer.add(dv);
  }

  // ──────────── HAND PREVIEW ────────────

  renderHandPreview() {
    const L = this.L;
    const handY = L.MAP_HAND_Y;
    const lblY = L.MAP_HAND_LBL;

    const bg = this.add.graphics();
    bg.fillStyle(0x0d1b2a, 1);
    bg.fillRect(0, handY - 60 * L.k, L.W, L.H - handY + 60 * L.k);
    bg.lineStyle(2, 0x1e3040);
    bg.lineBetween(40, handY - 60 * L.k, L.W - 40, handY - 60 * L.k);
    this.uiLayer.add(bg);

    this.uiTxt(L.cx, handY - 50 * L.k, 'Your hand this round',
      { fontSize: L.fs(20), color: '#607080' });

    const n = G.hand.length;
    const sp = Math.min(180 * L.k, (L.W - 80) / Math.max(n - 1, 1));

    G.hand.forEach((p, i) => {
      const def = TYPES[p.type];
      const x = L.cx - ((n - 1) * sp) / 2 + i * sp;

      const spr = this.add.sprite(x, handY, 'pirates', def.frame).setScale(L.SC);
      this.uiLayer.add(spr);

      this.uiTxt(x, lblY, def.name, { fontSize: L.fs(18), color: '#a0b0c0' });
      this.uiTxt(x, lblY + 24 * L.k, def.dI, { fontSize: L.fs(16), color: '#7a9a6a' });
      this.uiTxt(x, lblY + 46 * L.k, def.dS, { fontSize: L.fs(16), color: '#6a8a9a' });
      this.uiTxt(x, lblY + 68 * L.k, (def.str || 0) + '⚔️',
        { fontSize: L.fs(16), color: '#e57373' });
    });
  }

  // ──────────── SCROLLING ────────────

  setupScroll() {
    const L = this.L;
    const mapZoneTop = L.MAP_TOP;
    const mapZoneBot = L.MAP_HAND_Y - 60 * L.k;
    const viewH = mapZoneBot - mapZoneTop;

    // Mask the map container to the map zone
    const shape = this.make.graphics({ add: false });
    shape.fillStyle(0xffffff);
    shape.fillRect(0, mapZoneTop, L.W, viewH);
    const mask = shape.createGeometryMask();
    this.mapGfx.setMask(mask);

    this._scrollMinY = -(this.mapTotalH - viewH) + mapZoneTop;
    this._scrollMaxY = mapZoneTop;
    this._mapZoneTop = mapZoneTop;
    this._mapZoneBot = mapZoneBot;
    this._viewH = viewH;

    // Pointer drag
    let dragging = false;
    let dragStartY = 0;
    let containerStartY = 0;

    this.input.on('pointerdown', (ptr) => {
      if (ptr.y >= mapZoneTop && ptr.y <= mapZoneBot) {
        dragging = true;
        dragStartY = ptr.y;
        containerStartY = this.mapGfx.y;
      }
    });

    this.input.on('pointermove', (ptr) => {
      if (!dragging) return;
      const dy = ptr.y - dragStartY;
      this.mapGfx.y = Phaser.Math.Clamp(
        containerStartY + dy,
        this._scrollMinY,
        this._scrollMaxY
      );
    });

    this.input.on('pointerup', () => { dragging = false; });

    // Mouse wheel
    this.input.on('wheel', (ptr, gos, dx, dy) => {
      this.mapGfx.y = Phaser.Math.Clamp(
        this.mapGfx.y - dy * 0.5,
        this._scrollMinY,
        this._scrollMaxY
      );
    });
  }

  scrollToCurrentLayer(animate) {
    const targetLayer = Math.max(0, G.map.currentLayer + 1);
    const targetY = this.layerScreenY(targetLayer);
    const centerOffset = this._mapZoneTop + this._viewH / 2;
    const scrollY = Phaser.Math.Clamp(
      -targetY + centerOffset,
      this._scrollMinY,
      this._scrollMaxY
    );

    if (animate) {
      this.tweens.add({
        targets: this.mapGfx,
        y: scrollY,
        duration: 400,
        ease: 'Power2',
      });
    } else {
      this.mapGfx.y = scrollY;
    }
  }

  // ──────────── NODE SELECTION ────────────

  selectMapNode(nodeId) {
    const map = G.map;
    const node = mapNodeById(map, nodeId);
    if (!node) return;

    // Find layer index
    let layerIdx = -1;
    for (let li = 0; li < map.layers.length; li++) {
      if (map.layers[li].some(n => n.id === nodeId)) {
        layerIdx = li;
        break;
      }
    }

    map.currentNodeId = nodeId;
    map.currentLayer = layerIdx;
    map.visited.push(nodeId);

    G.round++;
    G.sent = [];
    G.enthusiasm = 0;
    G.busy = false;

    if (node.type === 'ship') {
      G.boardingCount++;
      G.phase = 'boarding';
      G.island = null;
      G.enemyShip = { strength: node.strength };
    } else {
      G.phase = 'sending';
      G.island = ISLANDS[node.islandIdx];
      G.enemyShip = null;
      if (G.island.bonusEnthusiasm) G.enthusiasm += G.island.bonusEnthusiasm;
    }

    if (G.round > 1) {
      G.shop.shift();
      G.shop.push(randomShopType(G.round));
    }

    this.scene.start('game');
  }

  // ──────────── HELPERS ────────────

  uiTxt(x, y, str, style) {
    const L = this.L;
    const base = { fontFamily: 'monospace', fontSize: L.fs(24), color: '#b0b8c8' };
    const t = this.add.text(x, y, str, Object.assign(base, style)).setOrigin(0.5, 0);
    this.uiLayer.add(t);
    return t;
  }
}
