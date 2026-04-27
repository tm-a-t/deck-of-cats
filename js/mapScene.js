/* ============================================================
   PIRATES — Map Scene
   ============================================================ */

class MapScene extends Phaser.Scene {
  constructor() { super('map'); }

  init(data) {
    this._launchOriginRect = data && data.originRect ? { ...data.originRect } : null;
    this._skipOpenAnim = !!(data && data.skipOpenAnim);
  }

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
    this.panel = this.computePanel();
    this._panelTween = null;
    this._panelClosing = false;
    this._mapMaskSource = null;
    this.panelLayer = this.add.container(0, 0).setDepth(20);
    this.mapGfx = this.add.container(0, 0).setDepth(21);
    this.uiLayer = this.add.container(0, 0).setDepth(22);

    this.renderPanelFrame();
    this.renderMapGraph();
    this.renderHeader();
    this.setupScroll();
    this.scrollToCurrentLayer(false);
    if (!this._skipOpenAnim) this.animateOpen();

    this.input.on('pointerdown', (ptr) => {
      if (ptr.y > this.panel.h) {
        ptr.event.stopPropagation();
        this.requestClose();
      }
    });

    this._onResize = () => {
      this.L = computeLayout(this.scale.width, this.scale.height);
      this.scene.restart({ skipOpenAnim: true, originRect: this._launchOriginRect });
    };
    this.scale.on('resize', this._onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize);
      if (this._panelTween) this._panelTween.stop();
      this._panelTween = null;
      this._panelClosing = false;
      if (this._mapMaskSource) {
        this._mapMaskSource.destroy();
        this._mapMaskSource = null;
      }
    });
  }

  transitionTargets() {
    return [this.panelLayer, this.mapGfx, this.uiLayer, this._mapMaskSource];
  }

  currentOriginRect() {
    const game = this.scene.get('game');
    if (game && typeof game.panelButtonRect === 'function') {
      return game.panelButtonRect(this.scene.key) || this._launchOriginRect;
    }
    return this._launchOriginRect;
  }

  animateOpen() {
    const finalStates = snapshotPanelTargets(this.transitionTargets());
    const fromStates = finalStates.map((state) => (
      collapsedPanelState(state, this.panel, this._launchOriginRect, { L: this.L })
    ));
    this._panelTween = tweenPanelStates(this, fromStates, finalStates, {
      duration: PANEL_MOTION.openDuration,
      ease: PANEL_MOTION.openEase,
      onComplete: () => {
        this._panelTween = null;
      },
    });
  }

  requestClose() {
    if (this._panelClosing) return;
    this._panelClosing = true;
    const game = this.scene.get('game');
    if (game && typeof game.panelFlagKey === 'function') {
      const flagKey = game.panelFlagKey(this.scene.key);
      if (flagKey && game[flagKey]) game.setPanelOpen(this.scene.key, false);
    }
    this.input.enabled = false;
    if (this._panelTween) {
      this._panelTween.stop();
      this._panelTween = null;
    }
    const fromStates = snapshotPanelTargets(this.transitionTargets());
    const toStates = fromStates.map((state) => (
      collapsedPanelState(state, this.panel, this.currentOriginRect(), { L: this.L })
    ));
    this._panelTween = tweenPanelStates(this, fromStates, toStates, {
      duration: PANEL_MOTION.closeDuration,
      ease: PANEL_MOTION.closeEase,
      onComplete: () => {
        this._panelTween = null;
        this.scene.stop();
      },
    });
  }

  computePanel() {
    const L = this.L;
    const handTop = handCardsTopY(L);
    const maxH = Math.min(L.H * 0.64, handTop - 16 * L.k);
    const h = Math.max(320 * L.k, maxH);
    const x = 0;
    const y = 0;
    const w = L.W;
    const pad = L.MAP_PANEL_PAD;
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

  // ──────────── PAGE ────────────

  renderPanelFrame() {
    const L = this.L;
    const m = this.panel;

    const shadow = this.add.graphics();
    shadow.fillStyle(uiColorInt(UI_THEME.colors.shadow), 0.18);
    shadow.fillRect(m.x, m.h - 10 * L.k, m.w, 20 * L.k);
    this.panelLayer.add(shadow);

    const paper = this.add.graphics();
    paper.fillStyle(uiColorInt(UI_THEME.colors.sand), 1);
    paper.fillRect(m.x, m.y, m.w, m.h);
    paper.lineStyle(Math.max(1, 3 * L.k), uiColorInt(UI_THEME.colors.sandEdge), 1);
    paper.lineBetween(m.x, m.h, m.w, m.h);
    this.panelLayer.add(paper);
  }

  // ──────────── MAP GRAPH ────────────

  nodeScreenX(nodeIdx, layerLen) {
    const L = this.L, m = this.panel;
    const maxW = Math.min(m.innerW - 80 * L.k, 420 * L.k);
    if (layerLen === 1) return m.innerX + m.innerW / 2;
    const sp = maxW / (layerLen - 1);
    return m.innerX + m.innerW / 2 - maxW / 2 + nodeIdx * sp;
  }

  layerScreenY(layerIdx) {
    const L = this.L, m = this.panel;
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
    const nextShipIntel = this.nextShipIntel();
    const activePath = uiColorInt(UI_THEME.colors.cocoa);
    const dimPath = uiColorInt(UI_THEME.colors.outline);

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
        isActive ? activePath : dimPath,
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
            isActive ? activePath : dimPath,
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
          g.fillStyle(uiColorInt(UI_THEME.colors.sandEdge), 1);
          g.fillCircle(nx, ny, r + 8);
        }

        if (isAvail) {
          g.fillStyle(uiColorInt(UI_THEME.colors.cocoa), 1);
          g.fillCircle(nx, ny, r + 6);
        }

        if (isShip) {
          g.fillStyle(uiColorInt(isFinal ? UI_THEME.colors.cocoa : UI_THEME.colors.cocoaDark), 1);
          g.fillCircle(nx, ny, r);
          if (isFinal) {
            g.lineStyle(3, uiColorInt(UI_THEME.colors.ink), 1);
            g.strokeCircle(nx, ny, r + 4);
          }
        } else {
          g.fillStyle(uiColorInt(UI_THEME.colors.sand), 1);
          g.fillCircle(nx, ny, r);
        }

        if (isAvail) {
          g.lineStyle(3, uiColorInt(UI_THEME.colors.ink), 1);
          g.strokeCircle(nx, ny, r);
        } else if (isCurrent) {
          g.lineStyle(3, uiColorInt(UI_THEME.colors.ink), 1);
          g.strokeCircle(nx, ny, r);
        } else if (isVisited) {
          g.lineStyle(2, uiColorInt(UI_THEME.colors.cocoa), 1);
          g.strokeCircle(nx, ny, r);
        } else {
          g.lineStyle(2, uiColorInt(UI_THEME.colors.sandBorder), 1);
          g.strokeCircle(nx, ny, r);
        }

        this.mapGfx.add(g);

        // Emoji label
        const emoji = isShip ? '🏴‍☠️' : ISLANDS[node.islandIdx].emoji;
        const label = this.add.text(nx, ny, emoji, {
          fontFamily: UI_THEME.fonts.heading,
          fontSize: L.fs(24),
          color: isShip ? UI_THEME.colors.paper : UI_THEME.colors.ink,
        }).setOrigin(0.5);
        this.mapGfx.add(label);

        // Boarding label
        if (isShip) {
          const isNextShip = nextShipIntel && nextShipIntel.nodeId === node.id;
          const boardText = isNextShip && nextShipIntel.mainLabel
            ? `Board\n${nextShipIntel.mainLabel}`
            : 'Board';
          const strTxt = this.add.text(nx, ny + r + 8, boardText, {
            fontFamily: UI_THEME.fonts.body,
            fontSize: L.fs(isNextShip ? 12 : 14),
            color: UI_THEME.colors.ink,
            align: 'center',
            lineSpacing: uiLineSpacingPx(L, isNextShip ? 12 : 14, isNextShip ? 14 : 16),
            wordWrap: { width: 132 * L.k },
          }).setOrigin(0.5, 0);
          this.mapGfx.add(strTxt);
        }

        const cacheText = this.scoutedCacheBadgeText(node);
        if (cacheText) {
          makeUiPill(this, {
            container: this.mapGfx,
            L,
            x: nx,
            y: ny - r - 18 * L.k,
            label: cacheText,
            textPx: 12,
            padX: 7 * L.k,
            padY: 4 * L.k,
            minH: 20 * L.k,
            fill: UI_THEME.colors.cocoaDark,
            stroke: UI_THEME.colors.sand,
            textColor: UI_THEME.colors.paper,
          });
        }

        // Layer number (small, to the side)
        if (ni === 0) {
          const layerNum = this.add.text(this.panel.innerX + 8, ny, '' + (li + 1), {
            fontFamily: UI_THEME.fonts.body,
            fontSize: L.fs(14),
            color: UI_THEME.colors.ink,
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
        g.fillStyle(uiColorInt(UI_THEME.colors.sandEdge), 1);
        g.fillCircle(startX, startY, r + 8);
      }

      g.fillStyle(uiColorInt(UI_THEME.colors.cocoa), 1);
      g.fillCircle(startX, startY, r);

      if (startIsCurrent) {
        g.lineStyle(3, uiColorInt(UI_THEME.colors.ink), 1);
      } else {
        g.lineStyle(2, uiColorInt(UI_THEME.colors.sandBorder), 1);
      }
      g.strokeCircle(startX, startY, r);

      this.mapGfx.add(g);

      const label = this.add.text(startX, startY, '🚢', {
        fontFamily: UI_THEME.fonts.heading,
        fontSize: L.fs(24),
        color: UI_THEME.colors.paper,
      }).setOrigin(0.5);
      this.mapGfx.add(label);
    }
  }

  renderHeader() {
    const L = this.L;
    const m = this.panel;
    const title = this.add.text(28 * L.k, 32 * L.k, 'Map', uiHeadingStyle(L, 40, UI_THEME.colors.ink))
      .setOrigin(0, 0);
    const close = this.add.text(m.w - 28 * L.k, 32 * L.k, '×', uiHeadingStyle(L, 40, UI_THEME.colors.ink))
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      this.requestClose();
    });
    this.uiLayer.add([title, close]);
  }

  // ──────────── SCROLLING ────────────

  setupScroll() {
    const L = this.L;
    const m = this.panel;
    const mapZoneTop = m.innerY;
    const mapZoneBot = m.innerY + m.innerH;
    const viewH = mapZoneBot - mapZoneTop;

    // Mask the map container to the map zone
    const shape = this.add.graphics().setDepth(19).setAlpha(0.001);
    shape.fillStyle(0xffffff);
    shape.fillRect(0, mapZoneTop, L.W, viewH);
    this._mapMaskSource = shape;
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
    let handled = false;
    if (game && game.scene && game.scene.isActive()) {
      handled = game.applyMapNodeSelection(nodeId);
    }
    if (!handled) this.requestClose();
  }

  // ──────────── HELPERS ────────────

  nextShipIntel() {
    const game = this.scene.get('game');
    if (!game || typeof game.nextShipIntel !== 'function') return null;
    return game.nextShipIntel();
  }

  scoutedCacheBadgeText(node) {
    const cache = node && node.scoutedCache;
    if (!cache || cache.claimed) return '';
    const emoji = RES_EMOJI[cache.res];
    if (!emoji) return '';
    const enemy = COMBAT.enemyArchetypes.find(archetype => archetype && archetype.key === cache.mainKey);
    const amount = Math.max(0, Math.floor(Number(cache.amount) || 0));
    const enthusiasm = cache.enthusiasm == null
      ? 1
      : Math.max(0, Math.floor(Number(cache.enthusiasm) || 0));
    const alert = Math.max(0, Math.floor(Number(cache.alert) || 0));
    const parts = [];
    if (enemy && enemy.emoji) parts.push(enemy.emoji);
    parts.push('1st opens');
    if (amount > 0) parts.push(`+${amount > 1 ? amount : ''}${emoji}`);
    if (enthusiasm > 0) parts.push(`+${enthusiasm > 1 ? enthusiasm : ''}${RES_EMOJI.enthusiasm}`);
    if (alert > 0) parts.push(`+${alert > 1 ? alert + ' ' : ''}Alert`);
    if (alert > 0) {
      const refund = Math.min(alert, 1);
      const remaining = Math.max(0, alert - refund);
      parts.push(remaining > 0
        ? `counter cuts ${refund} Alert, +${remaining} left`
        : 'counter disarms');
    }
    const routeWatch = this.openingRouteWatchBadgeText(cache);
    if (routeWatch) parts.push(routeWatch);
    return parts.join(' ');
  }

  openingRouteWatchBadgeText(cache) {
    if (!cache
      || G.mode === 'battleTest'
      || Math.max(0, Math.floor(Number(G.boardingCount) || 0)) !== 0
      || typeof openingDeckhandCounterTypes !== 'function') {
      return '';
    }
    const starterType = openingDeckhandCounterTypes(cache.mainKey, 1, { mode: G.mode })[0];
    const def = starterType && TYPES[starterType];
    return def && def.name ? `${def.name} Watch` : '';
  }

  uiTxt(x, y, str, style) {
    const t = this.add.text(x, y, str, Object.assign(uiBodyStyle(this.L, UI_THEME.colors.ink), style)).setOrigin(0.5, 0);
    this.uiLayer.add(t);
    return t;
  }
}
