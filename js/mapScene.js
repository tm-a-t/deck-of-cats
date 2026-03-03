/* ============================================================
   PIRATES — Map Scene
   ============================================================ */

class MapScene extends Phaser.Scene {
  constructor() { super('map'); }

  preload() {
    if (!this.textures.exists('catsImg')) {
      this.load.image('catsImg', 'assets/cats.png');
    }
    if (!this.textures.exists('notcatsImg')) {
      this.load.image('notcatsImg', 'assets/notcats.png');
    }
  }

  create() {
    ensureCatTextures(this);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.L = computeLayout(this.scale.width, this.scale.height);
    this._closing = false;

    this.modal = this.computeModal();
    this.modalLayer = this.add.container(0, 0).setDepth(20);
    this.mapGfx = this.add.container(0, 0).setDepth(21);
    this.uiLayer = this.add.container(0, 0).setDepth(22);

    this.renderModalFrame();
    this.renderMapGraph();
    this.renderHeader();
    this.setupScroll();
    this.scrollToCurrentLayer(false);
    this.animateOpen();

    this._onResize = () => {
      this.L = computeLayout(this.scale.width, this.scale.height);
      this.scene.restart();
    };
    this.scale.on('resize', this._onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize);
    });
  }

  animateOpen() {
    const offset = 30 * this.L.k;
    [this.modalLayer, this.mapGfx, this.uiLayer].forEach(c => {
      const origY = c.y;
      c.setAlpha(0).setY(origY + offset);
      this.tweens.add({
        targets: c,
        alpha: 1, y: origY,
        duration: 140,
        ease: 'Cubic.easeOut',
      });
    });
  }

  closeModal() {
    if (this._closing) return;
    this._closing = true;
    this.input.enabled = false;
    const offset = 30 * this.L.k;
    [this.modalLayer, this.mapGfx, this.uiLayer].forEach((c, i) => {
      this.tweens.add({
        targets: c,
        alpha: 0, y: c.y + offset,
        duration: 100,
        ease: 'Cubic.easeIn',
        onComplete: i === 0 ? () => this.scene.stop() : undefined,
      });
    });
  }

  computeModal() {
    const L = this.L;
    const w = L.MAP_MODAL_W;
    const h = L.MAP_MODAL_H;
    const x = (L.W - w) / 2;
    const y = (L.H - h) / 2;
    const pad = L.MAP_MODAL_PAD;
    const headH = L.MAP_HEAD_H;
    const footH = L.MAP_FOOT_H;
    return {
      x, y, w, h, pad, headH, footH,
      innerX: x + pad,
      innerY: y + headH,
      innerW: w - pad * 2,
      innerH: h - headH - footH,
    };
  }

  // ──────────── MODAL ────────────

  renderModalFrame() {
    const L = this.L;
    const m = this.modal;

    const blocker = this.add.rectangle(0, 0, L.W, L.H, 0x000000, 0.25).setOrigin(0, 0);
    blocker.setInteractive();
    blocker.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      if (ptr.x >= m.x && ptr.x <= m.x + m.w && ptr.y >= m.y && ptr.y <= m.y + m.h) return;
      this.closeModal();
    });
    this.modalLayer.add(blocker);

    const paper = this.add.graphics();
    paper.fillStyle(0xd9c9a2, 1);
    paper.fillRoundedRect(m.x, m.y, m.w, m.h, 18 * L.k);
    paper.lineStyle(3, 0x6a5838, 1);
    paper.strokeRoundedRect(m.x, m.y, m.w, m.h, 18 * L.k);
    this.modalLayer.add(paper);

    const sep = this.add.graphics();
    sep.lineStyle(2, 0x8c7850, 1);
    sep.lineBetween(m.x + 16 * L.k, m.y + m.headH, m.x + m.w - 16 * L.k, m.y + m.headH);
    this.modalLayer.add(sep);
  }

  // ──────────── MAP GRAPH ────────────

  nodeScreenX(nodeIdx, layerLen) {
    const L = this.L, m = this.modal;
    const maxW = Math.min(m.innerW - 80 * L.k, 420 * L.k);
    if (layerLen === 1) return m.innerX + m.innerW / 2;
    const sp = maxW / (layerLen - 1);
    return m.innerX + m.innerW / 2 - maxW / 2 + nodeIdx * sp;
  }

  layerScreenY(layerIdx) {
    const L = this.L, m = this.modal;
    const totalLayers = G.map.layers.length;
    return (totalLayers - 1 - layerIdx) * L.MAP_LAYER_SP + m.innerY + L.MAP_LAYER_SP;
  }

  get mapTotalH() {
    return (G.map.layers.length + 2) * this.L.MAP_LAYER_SP;
  }

  renderMapGraph() {
    this.mapGfx.removeAll(true);
    const L = this.L;
    const map = G.map;
    const available = new Set(getAvailableNodes(map));
    const visited = new Set(map.visited);
    const selecting = G.phase === 'map';

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

    // Start node (below layer 0)
    const startX = this.nodeScreenX(0, 1);
    const startY = this.layerScreenY(-1);
    const startIsCurrent = map.currentLayer === -1;

    // Draw paths from start node to layer 0
    const layer0 = map.layers[0];
    for (const node of layer0) {
      const to = pos[node.id];
      const isActive = startIsCurrent
        ? available.has(node.id)
        : (visited.has(node.id) || node.id === map.currentNodeId);
      pathGfx.lineStyle(
        isActive ? 3 : 2,
        isActive ? 0x5588aa : 0x1e3040,
        1
      );
      pathGfx.beginPath();
      pathGfx.moveTo(startX, startY);
      pathGfx.lineTo(to.x, to.y);
      pathGfx.strokePath();
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
            1
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
          g.fillStyle(0x44aadd, 1);
          g.fillCircle(nx, ny, r + 8);
        }

        if (isAvail) {
          g.fillStyle(0x33aaff, 1);
          g.fillCircle(nx, ny, r + 6);
        }

        if (isShip) {
          g.fillStyle(isFinal ? 0x8a2020 : 0x3a1010, 1);
          g.fillCircle(nx, ny, r);
          if (isFinal) {
            g.lineStyle(3, 0xff4444, 1);
            g.strokeCircle(nx, ny, r + 4);
          }
        } else {
          const island = ISLANDS[node.islandIdx];
          g.fillStyle(island.accent, 1);
          g.fillCircle(nx, ny, r);
        }

        if (isAvail) {
          g.lineStyle(3, 0x44ddff, 1);
          g.strokeCircle(nx, ny, r);
        } else if (isCurrent) {
          g.lineStyle(3, 0x44aadd, 1);
          g.strokeCircle(nx, ny, r);
        } else if (isVisited) {
          g.lineStyle(2, 0x334455, 1);
          g.strokeCircle(nx, ny, r);
        } else {
          g.lineStyle(2, 0x1e3040, 1);
          g.strokeCircle(nx, ny, r);
        }

        this.mapGfx.add(g);

        // Emoji label
        const emoji = isShip ? '🏴‍☠️' : ISLANDS[node.islandIdx].emoji;
        const label = this.add.text(nx, ny, emoji, {
          fontFamily: 'monospace',
          fontSize: L.UI_FS,
          color: '#ffffff',
        }).setOrigin(0.5);
        this.mapGfx.add(label);

        // Ship strength label
        if (isShip) {
          const strTxt = this.add.text(nx, ny + r + 8, node.strength + '⚔️', {
            fontFamily: 'monospace',
            fontSize: L.UI_FS,
            color: '#ff8a80',
          }).setOrigin(0.5, 0);
          this.mapGfx.add(strTxt);
        }

        // Layer number (small, to the side)
        if (ni === 0) {
          const layerNum = this.add.text(this.modal.innerX + 8, ny, '' + (li + 1), {
            fontFamily: 'monospace',
            fontSize: L.UI_FS,
            color: '#69532f',
          }).setOrigin(0, 0.5);
          this.mapGfx.add(layerNum);
        }

        // Interactive hit area for available nodes
        if (isAvail && selecting) {
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

    // Draw start node
    {
      const r = L.MAP_NODE_R;
      const g = this.add.graphics();

      if (startIsCurrent) {
        g.fillStyle(0x44aadd, 1);
        g.fillCircle(startX, startY, r + 8);
      }

      g.fillStyle(0x3070a0, 1);
      g.fillCircle(startX, startY, r);

      if (startIsCurrent) {
        g.lineStyle(3, 0x44aadd, 1);
      } else {
        g.lineStyle(2, 0x334455, 1);
      }
      g.strokeCircle(startX, startY, r);

      this.mapGfx.add(g);

      const label = this.add.text(startX, startY, '🚢', {
        fontFamily: 'monospace',
        fontSize: L.UI_FS,
        color: '#ffffff',
      }).setOrigin(0.5);
      this.mapGfx.add(label);
    }
  }

  renderHeader() {
    const L = this.L;
    const m = this.modal;
    const selecting = G.phase === 'map';
    this.uiTxt(m.x + m.w / 2, m.y + 14 * L.k,
      selecting ? 'Map — choose destination' : 'Map — route preview',
      { fontSize: L.fs(24), color: '#2b2b2b' });

    const close = this.add.text(m.x + m.w - 18 * L.k, m.y + 12 * L.k, '✕', {
      fontFamily: 'monospace',
      fontSize: L.fs(24),
      color: '#483818',
      backgroundColor: '#d9c9a2',
      padding: { x: 8 * L.k, y: 4 * L.k },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on('pointerover', () => close.setStyle({ color: '#7a3118' }));
    close.on('pointerout', () => close.setStyle({ color: '#483818' }));
    close.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      this.closeModal();
    });
    this.uiLayer.add(close);
  }

  // ──────────── SCROLLING ────────────

  setupScroll() {
    const L = this.L;
    const m = this.modal;
    const mapZoneTop = m.innerY;
    const mapZoneBot = m.innerY + m.innerH;
    const viewH = mapZoneBot - mapZoneTop;

    // Mask the map container to the map zone
    const shape = this.make.graphics({ add: false });
    shape.fillStyle(0xffffff);
    shape.fillRect(0, mapZoneTop, L.W, viewH);
    const mask = shape.createGeometryMask();
    this.mapGfx.setMask(mask);

    const topLayerY = this.layerScreenY(G.map.layers.length - 1);
    const bottomLayerY = this.layerScreenY(-1);
    const pad = 54 * L.k;
    const contentTop = topLayerY - pad;
    const contentBottom = bottomLayerY + pad;
    this._scrollMinY = mapZoneBot - contentBottom;
    this._scrollMaxY = mapZoneTop - contentTop;
    if (this._scrollMinY > this._scrollMaxY) {
      const mid = (this._scrollMinY + this._scrollMaxY) / 2;
      this._scrollMinY = mid;
      this._scrollMaxY = mid;
    }
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
    const targetLayer = G.map.currentLayer < 0 ? -1 : G.map.currentLayer + 1;
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
    if (G.phase !== 'map') return;
    const game = this.scene.get('game');
    if (game && game.scene && game.scene.isActive()) {
      game.applyMapNodeSelection(nodeId);
    }
    this.closeModal();
  }

  // ──────────── HELPERS ────────────

  uiTxt(x, y, str, style) {
    const L = this.L;
    const base = { fontFamily: 'monospace', fontSize: L.fs(24), color: '#2b2b2b' };
    const t = this.add.text(x, y, str, Object.assign(base, style)).setOrigin(0.5, 0);
    this.uiLayer.add(t);
    return t;
  }
}
