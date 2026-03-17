/* ============================================================
   PIRATES — Card Hand Visual System
   Renders the 5 active pirates as a fan-shaped hand of cards.
   Keeps gameplay logic untouched — only drives visuals.
   ============================================================ */

const CARD = {
  W: 120,
  H: 198,
  RADIUS: 8,
  BORDER: 1,
  BG: uiColorInt(UI_THEME.colors.sand),
  BG_ALPHA: 1,
  BORDER_COLOR: uiColorInt(UI_THEME.colors.sandBorder),

  FAN_CURVE: 0.022,
  FAN_ROTATION: 0.02,
  HOVER_LIFT: 28,
  HOVER_SCALE: 1.04,
  DRAG_SCALE: 1.02,
  IDLE_AMP: 0,
  IDLE_ROT_AMP: 0,

  SHIP_GLOW: uiColorInt(UI_THEME.colors.cocoa),
  SHIP_GLOW_ALPHA: 0.45,

  NEIGHBOR_SPREAD: 22,
  MOBILE_DRAG_PULL: 48,
};

function fitCanvasFontSize(ctx, text, maxW, startPx, fontFamily, fontStyle = '', minPx = 10) {
  let size = startPx;
  const floorPx = Math.max(1, minPx);
  while (size > floorPx) {
    ctx.font = `${fontStyle}${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxW) return size;
    size -= 1;
  }
  return floorPx;
}

function buildCardTexture(scene, typeKey, L) {
  const k = L.k;
  const textureResolution = Math.max(1, Math.ceil(scene.game.config.resolution || 1));
  const cw = Math.round(CARD.W * k);
  const ch = Math.round(CARD.H * k);
  const r = Math.round(CARD.RADIUS * k);
  const bw = Math.max(1, Math.round(CARD.BORDER * k));
  const texKey = '_card_' + typeKey + '_' + cw + 'x' + ch + '@' + textureResolution;

  if (scene.textures.exists(texKey)) return { texKey, cw, ch, textureResolution };

  const canvas = document.createElement('canvas');
  canvas.width = cw * textureResolution;
  canvas.height = ch * textureResolution;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(textureResolution, 0, 0, textureResolution, 0, 0);
  ctx.imageSmoothingEnabled = false;

  ctx.clearRect(0, 0, cw, ch);
  roundRect(ctx, 0, 0, cw, ch, r);
  ctx.fillStyle = hexToCSS(CARD.BG, CARD.BG_ALPHA);
  ctx.fill();
  ctx.strokeStyle = hexToCSS(CARD.BORDER_COLOR, 1);
  ctx.lineWidth = bw;
  ctx.stroke();

  const def = TYPES[typeKey];
  const pad = Math.round(10 * k);
  const maxTxtW = cw - pad * 2;
  const lineY = Math.round(31 * k);
  const shipBandY = ch - Math.round(31 * k);
  const spriteSize = Math.round(80 * k);
  const spriteY = Math.round(37 * k);
  const spriteX = Math.round((cw - spriteSize) / 2);
  const nameFs = fitCanvasFontSize(
    ctx,
    def.name,
    maxTxtW,
    Math.max(UI_THEME.fonts.headingMinPx, Math.round(16 * k)),
    UI_THEME.fonts.heading,
    '',
    UI_THEME.fonts.headingMinPx
  );
  const statFs = fitCanvasFontSize(
    ctx,
    `⚔️${def.str || 0}`,
    maxTxtW,
    Math.max(UI_THEME.fonts.headingMinPx, Math.round(16 * k)),
    UI_THEME.fonts.heading,
    '',
    UI_THEME.fonts.headingMinPx
  );
  const islandFs = fitCanvasFontSize(ctx, def.dI || '—', maxTxtW, Math.max(11, Math.round(14 * k)), UI_THEME.fonts.body);
  const shipFs = fitCanvasFontSize(ctx, def.dS || '—', maxTxtW, Math.max(11, Math.round(14 * k)), UI_THEME.fonts.body);
  const topTextY = Math.round(7 * k);
  const nameY = Math.round(123 * k);
  const statY = Math.round(143 * k);
  const bottomTextY = shipBandY + Math.round(8 * k);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const sprKey = catTexKey(typeKey);
  if (scene.textures.exists(sprKey)) {
    const img = scene.textures.get(sprKey).getSourceImage();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, spriteX, spriteY, spriteSize, spriteSize);
  }

  ctx.strokeStyle = hexToCSS(CARD.BORDER_COLOR, 0.9);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(8 * k), lineY);
  ctx.lineTo(cw - Math.round(8 * k), lineY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(Math.round(8 * k), shipBandY);
  ctx.lineTo(cw - Math.round(8 * k), shipBandY);
  ctx.stroke();

  ctx.fillStyle = UI_THEME.colors.ink;

  ctx.font = `${islandFs}px ${UI_THEME.fonts.body}`;
  ctx.fillText(def.dI || '—', cw / 2, topTextY);

  ctx.font = `${nameFs}px ${UI_THEME.fonts.heading}`;
  ctx.fillText(def.name, cw / 2, nameY);

  ctx.font = `${statFs}px ${UI_THEME.fonts.heading}`;
  ctx.fillText(`⚔️${def.str || 0}`, cw / 2, statY);

  ctx.font = `${shipFs}px ${UI_THEME.fonts.body}`;
  ctx.fillText(def.dS || '—', cw / 2, bottomTextY);

  scene.textures.addCanvas(texKey, canvas);
  scene.textures.get(texKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return { texKey, cw, ch, textureResolution };
}

function createPirateCard(scene, opts) {
  const L = opts.L || scene.L;
  const k = L.k;
  const x = opts.x || 0;
  const y = opts.y || 0;
  const rotation = opts.rotation || 0;
  const depth = opts.depth != null ? opts.depth : 10;
  const scale = opts.scale != null ? opts.scale : 1;

  const built = buildCardTexture(scene, opts.type, L);
  const cardImg = scene.add.image(0, 0, built.texKey).setOrigin(0.5, 0.5);
  if (built.textureResolution > 1) {
    cardImg.setScale(1 / built.textureResolution);
  }
  const ct = scene.add.container(x, y, [cardImg]);
  ct.setRotation(rotation);
  ct.setDepth(depth);
  ct.setScale(scale);

  if (opts.alpha != null) cardImg.setAlpha(opts.alpha);
  if (opts.tint != null) cardImg.setTint(opts.tint);

  if (opts.interactive) {
    cardImg.setInteractive({ useHandCursor: opts.useHandCursor !== false });
  }

  if (opts.container) {
    opts.container.add(ct);
  }

  return {
    container: ct,
    cardImg,
    cw: built.cw,
    ch: built.ch,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function hexToCSS(hex, alpha) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return alpha != null ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

// ─────────── Hand layout: arc positions ───────────

function cardHandLayout(n, L) {
  const k = L.k;
  const cw = Math.round(CARD.W * k);
  const ch = Math.round(CARD.H * k);
  const handY = L.Y_HAND_CENTER + ch * 0.05;
  const cx = L.cx;
  const maxSpread = Math.min(cw * 0.74 * (n - 1), L.W - cw - 48 * k);
  const slots = [];

  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const x = cx + t * (maxSpread / 2);
    const yOff = t * t * CARD.FAN_CURVE * ch * Math.max(1, n - 1);
    const rot = t * CARD.FAN_ROTATION * Math.max(1, n - 1);
    slots.push({ x, y: handY + yOff, rotation: rot, index: i });
  }
  return slots;
}


// ─────────── CardHand class ───────────

class CardHand {
  constructor(scene) {
    this.scene = scene;
    this.cards = [];
    this._hoverIdx = -1;
    this._dragIdx = -1;
    this._dragGhost = null;
    this._time = 0;
    this._shipHighlightedIdx = -1;
    this._shipHighlightTween = null;
  }

  destroy() {
    const tweens = this.scene && this.scene.tweens;
    this.cards.forEach(c => {
      if (tweens) {
        tweens.killTweensOf(c.container);
        tweens.killTweensOf(c.cardImg);
        if (c._shipGlow) tweens.killTweensOf(c._shipGlow);
        if (c._shipEffectOverlay) tweens.killTweensOf(c._shipEffectOverlay);
        if (c._shipEffectParts) {
          c._shipEffectParts.forEach(part => tweens.killTweensOf(part));
        }
      }
      if (c.container) c.container.destroy(true);
    });
    this.cards = [];
    if (this._dragGhost) { this._dragGhost.destroy(); this._dragGhost = null; }
    if (this._updateEvent) { this._updateEvent.remove(); this._updateEvent = null; }
    this._hoverIdx = -1;
    this._dragIdx = -1;
  }

  getCardPositions() {
    const positions = {};
    for (const c of this.cards) {
      positions[c.handIdx] = {
        x: c.container.x,
        y: c.container.y,
        rotation: c.container.rotation,
      };
    }
    return positions;
  }

  render(opts) {
    this.destroy();
    const scene = this.scene;
    const L = scene.L;
    const k = L.k;
    const hand = opts.hand;
    const sent = opts.sent;
    const sendingSet = opts.sendingSet;
    const shipResolvedSet = opts.shipResolvedSet;
    const isSending = opts.isSending;
    const tutorialBlocked = opts.tutorialBlocked || (() => false);
    const tutorialTargetIdx = opts.tutorialTargetIdx;
    const onSendToIsland = opts.onSendToIsland;
    const container = opts.container;

    const visible = [];
    hand.forEach((p, i) => {
      if (sent.includes(i) || sendingSet.has(i)) return;
      visible.push({ pirate: p, handIdx: i });
    });

    const slots = cardHandLayout(visible.length, L);

    visible.forEach((entry, slotI) => {
      const { pirate, handIdx } = entry;
      const slot = slots[slotI];
      const isBlocked = tutorialBlocked(pirate);
      const isTarget = handIdx === tutorialTargetIdx;

      const cardView = createPirateCard(scene, {
        type: pirate.type,
        x: slot.x,
        y: slot.y,
        rotation: slot.rotation,
        depth: 10 + slotI,
        L,
        container,
      });
      const ct = cardView.container;
      const cardImg = cardView.cardImg;

      if (isBlocked) {
        cardImg.setTint(0x8a8a8a);
        cardImg.setAlpha(0.7);
      }

      const cardData = {
        container: ct,
        cardImg,
        slot,
        handIdx,
        pirate,
        slotIndex: slotI,
        isBlocked,
        hovered: false,
        dragging: false,
        targetY: slot.y,
        targetScale: 1,
        targetRot: slot.rotation,
        currentScale: 1,
      };

      cardImg.setInteractive({ useHandCursor: true });
      if (isSending) {
        scene.input.setDraggable(cardImg, true);
        this._setupDrag(cardData, onSendToIsland, L);
      }

      cardImg.on('pointerover', () => {
        if (cardData.dragging) return;
        this._setHoveredCard(slotI, L);
      });

      cardImg.on('pointerout', () => {
        if (cardData.dragging) return;
        if (this._hoverIdx !== slotI) return;
        this._setHoveredCard(-1, L);
      });

      if (isTarget) {
        scene.tweens.add({
          targets: ct, y: slot.y - 14 * k,
          duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      }

      const prevPos = opts.prevPositions && opts.prevPositions[handIdx];
      const appearFrom = opts.appearFrom && opts.appearFrom[handIdx];
      if (prevPos) {
        ct.setPosition(prevPos.x, prevPos.y);
        ct.setRotation(prevPos.rotation);
        scene.tweens.add({
          targets: ct,
          x: slot.x, y: slot.y, rotation: slot.rotation,
          duration: 300, ease: 'Cubic.easeOut',
        });
      } else if (appearFrom) {
        const startScale = appearFrom.startScale != null ? appearFrom.startScale : 0.38;
        const startRotation = appearFrom.rotation != null ? appearFrom.rotation : slot.rotation - 0.16;
        ct.setPosition(appearFrom.x, appearFrom.y);
        ct.setRotation(startRotation);
        ct.setScale(startScale);
        ct.setAlpha(0);
        scene.tweens.add({
          targets: ct,
          x: slot.x,
          y: slot.y,
          rotation: slot.rotation,
          scaleX: 1,
          scaleY: 1,
          alpha: 1,
          delay: appearFrom.delay || 0,
          duration: 420,
          ease: 'Cubic.easeOut',
        });
      }

      this.cards.push(cardData);
    });

    this._time = 0;
    this._updateEvent = scene.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => this._updateIdle(L),
    });
  }

  _setHoveredCard(slotIndex, L) {
    if (this._hoverIdx === slotIndex) return;

    this.cards.forEach((c) => {
      if (c.dragging) return;
      const shouldHover = c.slotIndex === slotIndex;
      if (c.hovered === shouldHover) return;
      c.hovered = shouldHover;
      this._animateHover(c, shouldHover, L);
    });
    this._hoverIdx = slotIndex;
  }

  getCardPosition(handIdx) {
    const card = this.cards.find(c => c.handIdx === handIdx);
    if (!card) return null;
    return { x: card.slot.x, y: card.slot.y };
  }

  highlightShipCard(handIdx, active) {
    const card = this.cards.find(c => c.handIdx === handIdx);
    if (!card) return;
    const scene = this.scene;
    const L = scene.L;
    const k = L.k;

    if (this._shipHighlightTween) {
      this._shipHighlightTween.stop();
      this._shipHighlightTween = null;
    }

    this._killSpreadTweens();

    if (active) {
      this._shipHighlightedIdx = handIdx;
      const glow = scene.add.graphics();
      const cw = Math.round(CARD.W * k);
      const ch = Math.round(CARD.H * k);
      glow.lineStyle(4 * k, CARD.SHIP_GLOW, CARD.SHIP_GLOW_ALPHA);
      roundRectGraphics(glow, -cw / 2 - 3 * k, -ch / 2 - 3 * k, cw + 6 * k, ch + 6 * k, CARD.RADIUS * k + 2);
      card.container.add(glow);
      card._shipGlow = glow;

      card.container.setDepth(50);
      this._shipHighlightTween = scene.tweens.add({
        targets: card.container,
        scaleX: 1.08, scaleY: 1.08,
        y: card.slot.y - 20 * k,
        duration: 300, ease: 'Back.easeOut',
      });

      this._tweenNeighborSpread(card, k, 300, 'Back.easeOut');
    } else {
      this._shipHighlightedIdx = -1;
      if (card._shipGlow) {
        card._shipGlow.destroy();
        card._shipGlow = null;
      }
      card.container.setDepth(10 + card.slotIndex);
      card.targetY = card.slot.y;
      scene.tweens.add({
        targets: card.container,
        scaleX: 1, scaleY: 1,
        y: card.slot.y,
        duration: 200, ease: 'Sine.easeOut',
      });

      this._tweenNeighborSpread(null, k, 200, 'Sine.easeOut');
    }
  }

  showShipEffectOverlay(handIdx, msg, color) {
    const card = this.cards.find(c => c.handIdx === handIdx);
    if (!card) return;
    const scene = this.scene;
    const L = scene.L;
    const k = L.k;
    const cw = Math.round(CARD.W * k);
    const ch = Math.round(CARD.H * k);
    const r = Math.round(CARD.RADIUS * k);

    if (card._shipEffectOverlay) {
      card._shipEffectOverlay.destroy(true);
      card._shipEffectOverlay = null;
    }

    const areaH = Math.round(ch * 0.24);
    const top = ch / 2 - areaH;
    const textY = top + areaH / 2;
    const accentColor = uiColorInt(color || UI_THEME.colors.cocoa);

    const fontSize = Math.max(14, Math.round(17 * k));
    const txt = scene.make.text({
      x: 0, y: textY,
      text: msg,
      style: {
        fontFamily: UI_THEME.fonts.body,
        fontSize: fontSize + 'px',
        color: color || UI_THEME.colors.ink,
      },
      add: false,
    }).setOrigin(0.5);

    const panel = scene.make.graphics({ add: false });
    panel.fillStyle(CARD.BG, 1);
    panel.fillRoundedRect(
      -cw / 2 + 1, top,
      cw - 2, areaH - 1,
      { tl: 0, tr: 0, bl: r, br: r }
    );

    const accent = scene.add.rectangle(
      0,
      top + Math.round(7 * k),
      Math.max(12 * k, cw - Math.round(30 * k)),
      Math.max(2, Math.round(2 * k)),
      accentColor,
      1
    ).setOrigin(0.5, 0);

    const overlay = scene.make.container({ add: false });
    overlay.add([panel, accent, txt]);
    card.container.add(overlay);
    card._shipEffectOverlay = overlay;
    card._shipEffectParts = [panel, accent, txt];

    overlay.setAlpha(0);
    overlay.y = Math.round(10 * k);
    accent.setScale(0.2, 1);
    accent.setAlpha(0);
    txt.y += Math.round(8 * k);
    txt.setAlpha(0);
    scene.tweens.add({
      targets: overlay,
      y: 0,
      alpha: 1,
      duration: 180,
      ease: 'Cubic.easeOut',
    });
    scene.tweens.add({
      targets: accent,
      scaleX: 1,
      alpha: 1,
      duration: 220,
      ease: 'Cubic.easeOut',
    });
    scene.tweens.add({
      targets: txt,
      y: textY,
      alpha: 1,
      duration: 220,
      delay: 35,
      ease: 'Quad.easeOut',
    });
  }

  hideShipEffectOverlay(handIdx) {
    const card = this.cards.find(c => c.handIdx === handIdx);
    if (!card || !card._shipEffectOverlay) return;
    const overlay = card._shipEffectOverlay;
    const parts = card._shipEffectParts || [];
    card._shipEffectOverlay = null;
    card._shipEffectParts = null;
    this.scene.tweens.killTweensOf(overlay);
    parts.forEach(part => this.scene.tweens.killTweensOf(part));
    this.scene.tweens.add({
      targets: overlay,
      y: overlay.y + Math.round(8 * this.scene.L.k),
      alpha: 0,
      duration: 160,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (overlay && overlay.scene) {
          overlay.setVisible(false);
          overlay.setActive(false);
        }
      },
    });
  }

  _setupDrag(cardData, onSendToIsland, L) {
    const scene = this.scene;
    const cardImg = cardData.cardImg;
    const k = L.k;

    let dragMoved = false;
    let dragActivated = false;
    let touchDrag = false;
    let dragCard = cardData;
    let dragStartY = cardData.slot.y;
    const mobilePullThreshold = CARD.MOBILE_DRAG_PULL * k;

    const isTouchPointer = (pointer) =>
      !!pointer && (pointer.pointerType === 'touch' || pointer.wasTouch === true);
    const isMobileViewport = () =>
      !!(scene.L && scene.L.IS_MOBILE);

    const beginDragVisual = (pointer) => {
      if (dragActivated) return;
      dragActivated = true;
      dragCard.dragging = true;
      this._dragIdx = dragCard.slotIndex;
      dragCard.container.setAlpha(0.3);
      dragCard.container.setDepth(5);

      const ghost = scene.add.image(pointer.x, pointer.y, dragCard.cardImg.texture.key);
      ghost.setOrigin(0.5, 0.5);
      ghost.setDepth(80);
      ghost.setScale(CARD.DRAG_SCALE);
      ghost.setRotation(0);
      this._dragGhost = ghost;
    };

    const resetDragVisual = () => {
      dragActivated = false;
      dragMoved = false;
      dragCard.dragging = false;
      this._dragIdx = -1;
      if (this._dragGhost) {
        this._dragGhost.destroy();
        this._dragGhost = null;
      }
      dragCard.container.setAlpha(dragCard.isBlocked ? 0.7 : 1);
      dragCard.container.setDepth(10 + dragCard.slotIndex);
    };

    cardImg.on('pointerdown', (pointer) => {
      dragStartY = pointer.y;
    });

    cardImg.on('dragstart', (pointer) => {
      dragMoved = false;
      dragActivated = false;
      dragCard = cardData;
      touchDrag = isMobileViewport() && isTouchPointer(pointer);

      if (!touchDrag) {
        beginDragVisual(pointer);
      }
    });

    cardImg.on('drag', (pointer) => {
      if (touchDrag) {
        if (!dragActivated) {
          const hoveredCard = this.cards.find(c => c.slotIndex === this._hoverIdx);
          if (hoveredCard && !hoveredCard.isBlocked) {
            dragCard = hoveredCard;
          }
        }
        const upwardPull = dragStartY - pointer.y;
        if (upwardPull >= mobilePullThreshold) {
          if (!dragActivated) beginDragVisual(pointer);
        } else {
          if (dragActivated) {
            resetDragVisual();
            this._setHoveredCard(-1, L);
          }
          return;
        }
      }
      if (!dragActivated) return;

      if (this._dragGhost) {
        this._dragGhost.setPosition(pointer.x, pointer.y);
        const dx = pointer.x - (pointer.prevPosition ? pointer.prevPosition.x : pointer.x);
        this._dragGhost.setRotation(Phaser.Math.Clamp(dx * 0.01, -0.15, 0.15));
      }
      const dist = Phaser.Math.Distance.Between(
        dragCard.slot.x, dragCard.slot.y, pointer.x, pointer.y
      );
      if (dist > 10) dragMoved = true;
    });

    cardImg.on('dragend', (pointer) => {
      const wasActivated = dragActivated;
      const wasMoved = dragMoved;
      resetDragVisual();

      if (wasActivated && wasMoved && pointer.y < L.Y_HAND_CENTER) {
        if (onSendToIsland) onSendToIsland(dragCard.handIdx, { x: pointer.x, y: pointer.y });
      } else {
        this._animateHover(dragCard, false, L);
      }
    });
  }

  _animateHover(cardData, hovering, L) {
    const scene = this.scene;
    const k = L.k;

    if (hovering) {
      cardData.targetY = cardData.slot.y - CARD.HOVER_LIFT * k;
      cardData.targetScale = CARD.HOVER_SCALE;
      cardData.targetRot = 0;
      cardData.container.setDepth(40);

      scene.tweens.add({
        targets: cardData.container,
        y: cardData.targetY,
        scaleX: CARD.HOVER_SCALE,
        scaleY: CARD.HOVER_SCALE,
        rotation: 0,
        duration: 200,
        ease: 'Back.easeOut',
      });
    } else {
      cardData.targetY = cardData.slot.y;
      cardData.targetScale = 1;
      cardData.targetRot = cardData.slot.rotation;
      cardData.container.setDepth(10 + cardData.slotIndex);

      scene.tweens.add({
        targets: cardData.container,
        y: cardData.slot.y,
        scaleX: 1,
        scaleY: 1,
        rotation: cardData.slot.rotation,
        duration: 250,
        ease: 'Sine.easeOut',
      });
    }
  }

  _killSpreadTweens() {
    if (this._spreadTweens) {
      for (const tw of this._spreadTweens) tw.stop();
      this._spreadTweens = null;
    }
  }

  _tweenNeighborSpread(elevCard, k, duration, ease) {
    const scene = this.scene;
    const spread = CARD.NEIGHBOR_SPREAD * k;
    this._spreadTweens = [];
    let pending = 0;

    const elevIdx = elevCard
      ? this.cards.indexOf(elevCard)
      : -1;

    const onDone = () => {
      if (--pending <= 0) this._spreadTweens = null;
    };

    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      if (i === elevIdx || c.dragging) continue;
      let targetX = c.slot.x;
      if (elevIdx >= 0) {
        const diff = i - elevIdx;
        const dir = Math.sign(diff);
        const dist = Math.abs(diff);
        targetX = c.slot.x + dir * spread / dist;
      }
      pending++;
      this._spreadTweens.push(scene.tweens.add({
        targets: c.container,
        x: targetX,
        duration, ease,
        onComplete: onDone,
      }));
    }

    if (pending === 0) this._spreadTweens = null;
  }

  _updateIdle(L) {
    this._time += 0.03;
    const k = L.k;
    const spread = CARD.NEIGHBOR_SPREAD * k;
    const lerpSpeed = 0.18;

    let elevIdx = -1;
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      if (c.hovered || c.dragging || c.handIdx === this._shipHighlightedIdx) {
        elevIdx = i;
        break;
      }
    }

    const spreadTweening = this._spreadTweens != null;

    this.cards.forEach((c, i) => {
      if (!spreadTweening) {
        let targetX = c.slot.x;
        if (elevIdx >= 0 && i !== elevIdx && !c.dragging) {
          const diff = i - elevIdx;
          const dir = Math.sign(diff);
        const dist = Math.abs(diff);
        targetX = c.slot.x + dir * spread / dist;
      }
      c.container.x += (targetX - c.container.x) * lerpSpeed;
    }

      if (c.hovered || c.dragging) return;
      if (c.handIdx === this._shipHighlightedIdx) return;
      const phase = i * 1.3;
      const yOff = Math.sin(this._time + phase) * CARD.IDLE_AMP * k;
      const rOff = Math.cos(this._time * 0.7 + phase) * CARD.IDLE_ROT_AMP;
      c.container.y = c.targetY + yOff;
      c.container.rotation = c.targetRot + rOff;
    });
  }
}

function roundRectGraphics(g, x, y, w, h, r) {
  g.beginPath();
  g.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  g.lineTo(x + w - r, y);
  g.arc(x + w - r, y + r, r, -Math.PI * 0.5, 0);
  g.lineTo(x + w, y + h - r);
  g.arc(x + w - r, y + h - r, r, 0, Math.PI * 0.5);
  g.lineTo(x + r, y + h);
  g.arc(x + r, y + h - r, r, Math.PI * 0.5, Math.PI);
  g.closePath();
  g.strokePath();
}
