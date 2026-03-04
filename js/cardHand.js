/* ============================================================
   PIRATES — Card Hand Visual System
   Renders the 5 active pirates as a fan-shaped hand of cards.
   Keeps gameplay logic untouched — only drives visuals.
   ============================================================ */

const CARD = {
  W: 190,
  H: 300,
  RADIUS: 14,
  BORDER: 3,
  BG: 0x111e2e,
  BG_ALPHA: 0.95,
  BORDER_COLOR: 0x3a5a7a,
  BORDER_HOVER: 0x6ac0ff,
  BORDER_ACTIVE: 0xffe082,
  SHADOW_COLOR: 0x000000,
  SHADOW_ALPHA: 0.35,
  SHADOW_OFF: 6,

  FAN_CURVE: 0.04,
  FAN_ROTATION: 0.035,
  HOVER_LIFT: 50,
  HOVER_SCALE: 1.10,
  DRAG_SCALE: 1.06,
  IDLE_AMP: 2.5,
  IDLE_ROT_AMP: 0.008,

  SHIP_GLOW: 0x80cbc4,
  SHIP_GLOW_ALPHA: 0.45,

  NEIGHBOR_SPREAD: 36,
};

function measureWrappedHeight(ctx, text, maxW, lineH) {
  if (ctx.measureText(text).width <= maxW) return lineH;
  const words = text.split(' ');
  let line = '';
  let h = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      h += lineH;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) h += lineH;
  return h;
}

function buildCardTexture(scene, typeKey, L) {
  const k = L.k;
  const cw = Math.round(CARD.W * k);
  const ch = Math.round(CARD.H * k);
  const r = Math.round(CARD.RADIUS * k);
  const bw = Math.max(1, Math.round(CARD.BORDER * k));
  const texKey = '_card_' + typeKey + '_' + cw + 'x' + ch;

  if (scene.textures.exists(texKey)) return { texKey, cw, ch };

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, cw, ch);
  roundRect(ctx, 0, 0, cw, ch, r);
  ctx.fillStyle = hexToCSS(CARD.BG, CARD.BG_ALPHA);
  ctx.fill();
  ctx.strokeStyle = hexToCSS(CARD.BORDER_COLOR, 0.8);
  ctx.lineWidth = bw;
  ctx.stroke();

  const def = TYPES[typeKey];
  const nameFs = Math.max(13, Math.round(17 * k));
  const statFs = Math.max(11, Math.round(14 * k));
  const bodyFs = Math.max(10, Math.round(12 * k));
  const pad = Math.round(cw * 0.08);
  const maxTxtW = cw - pad * 2;
  const margin = Math.round(ch * 0.045);
  const sepGap = Math.round(bodyFs * 0.55);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const islText = def.dI || '—';
  const shipText = def.dS || '—';

  ctx.font = `${bodyFs}px monospace`;
  const islH = measureWrappedHeight(ctx, islText, maxTxtW, bodyFs * 1.3);
  const shipH = measureWrappedHeight(ctx, shipText, maxTxtW, bodyFs * 1.3);

  const topSepY = margin + islH + sepGap;
  const botSepY = ch - margin - shipH - sepGap;

  // ── TOP: Island effect + separator ──
  ctx.font = `${bodyFs}px monospace`;
  ctx.fillStyle = '#c8e0c0';
  drawWrappedReturn(ctx, islText, cw / 2, margin, maxTxtW, bodyFs * 1.3);

  ctx.strokeStyle = 'rgba(58,90,122,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, topSepY);
  ctx.lineTo(cw - pad, topSepY);
  ctx.stroke();

  // ── BOTTOM: separator + Ship effect ──
  ctx.strokeStyle = 'rgba(58,90,122,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, botSepY);
  ctx.lineTo(cw - pad, botSepY);
  ctx.stroke();

  ctx.font = `${bodyFs}px monospace`;
  ctx.fillStyle = '#b0d0e0';
  drawWrappedReturn(ctx, shipText, cw / 2, botSepY + sepGap, maxTxtW, bodyFs * 1.3);

  // ── CENTER: Sprite + Name + Strength (vertically centered) ──
  const sprSize = Math.round(Math.min(cw * 0.58, ch * 0.28));
  const gapSprName = Math.round(nameFs * 0.7);
  const gapNameStr = Math.round(nameFs * 1.3);
  const blockH = sprSize + gapSprName + nameFs + gapNameStr + statFs;

  const zoneTop = topSepY + sepGap;
  const zoneBot = botSepY - sepGap;
  const blockY = zoneTop + (zoneBot - zoneTop - blockH) / 2;

  const sprKey = catTexKey(typeKey);
  if (scene.textures.exists(sprKey)) {
    const img = scene.textures.get(sprKey).getSourceImage();
    const sx = Math.round((cw - sprSize) / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, Math.round(blockY), sprSize, sprSize);
  }

  const nameY = Math.round(blockY + sprSize + gapSprName);
  ctx.font = `bold ${nameFs}px monospace`;
  ctx.fillStyle = '#ffd78a';
  ctx.fillText(def.name, cw / 2, nameY);

  const strY = Math.round(nameY + gapNameStr);
  ctx.font = `${statFs}px monospace`;
  ctx.fillStyle = '#a0b8c8';
  const strText = (def.str || 0) + ' ⚔️';
  const costText = def.cost != null ? '  ☠️' + def.cost : '';
  ctx.fillText(strText + costText, cw / 2, strY);

  scene.textures.addCanvas(texKey, canvas);
  scene.textures.get(texKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return { texKey, cw, ch };
}

function drawWrappedReturn(ctx, text, x, y, maxW, lineH) {
  const measured = ctx.measureText(text).width;
  if (measured <= maxW) {
    ctx.fillText(text, x, y);
    return y + lineH;
  }
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      cy += lineH;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, cy); cy += lineH; }
  return cy;
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
  const handY = L.Y_HAND_CENTER + ch * 0.1;
  const cx = L.cx;

  const maxSpread = Math.min(cw * 0.75 * (n - 1), L.W - cw - 40 * k);
  const slots = [];

  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const x = cx + t * (maxSpread / 2);
    const yOff = t * t * CARD.FAN_CURVE * ch * n;
    const rot = t * CARD.FAN_ROTATION * n;
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
    this.cards.forEach(c => {
      if (c.container) c.container.destroy(true);
      if (c.shadow) c.shadow.destroy();
    });
    this.cards = [];
    if (this._dragGhost) { this._dragGhost.destroy(); this._dragGhost = null; }
    if (this._updateEvent) { this._updateEvent.remove(); this._updateEvent = null; }
    this._hoverIdx = -1;
    this._dragIdx = -1;
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
    const cw = Math.round(CARD.W * k);
    const ch = Math.round(CARD.H * k);

    visible.forEach((entry, slotI) => {
      const { pirate, handIdx } = entry;
      const slot = slots[slotI];
      const isBlocked = tutorialBlocked(pirate);
      const isTarget = handIdx === tutorialTargetIdx;

      const { texKey } = buildCardTexture(scene, pirate.type, L);
      const cardImg = scene.add.image(0, 0, texKey).setOrigin(0.5, 0.5);

      const ct = scene.add.container(slot.x, slot.y, [cardImg]);
      ct.setRotation(slot.rotation);
      ct.setDepth(10 + slotI);

      if (isBlocked) {
        cardImg.setTint(0x8a8a8a);
        cardImg.setAlpha(0.7);
      }

      const shadow = scene.add.graphics();
      shadow.fillStyle(CARD.SHADOW_COLOR, CARD.SHADOW_ALPHA);
      shadow.fillEllipse(0, 0, cw * 0.8, ch * 0.12);
      shadow.setPosition(slot.x + CARD.SHADOW_OFF * k, slot.y + ch * 0.52);
      shadow.setDepth(9);
      shadow.setRotation(slot.rotation);
      container.add(shadow);

      const cardData = {
        container: ct,
        shadow,
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
        this._hoverIdx = slotI;
        cardData.hovered = true;
        this._animateHover(cardData, true, L);
      });

      cardImg.on('pointerout', () => {
        if (cardData.dragging) return;
        this._hoverIdx = -1;
        cardData.hovered = false;
        this._animateHover(cardData, false, L);
      });

      if (isTarget) {
        scene.tweens.add({
          targets: ct, y: slot.y - 14 * k,
          duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      }

      container.add(ct);
      this.cards.push(cardData);
    });

    this._time = 0;
    this._updateEvent = scene.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => this._updateIdle(L),
    });
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

    const fontSize = Math.max(14, Math.round(17 * k));
    const txt = scene.add.text(0, top + areaH / 2, msg, {
      fontFamily: 'monospace',
      fontSize: fontSize + 'px',
      color: color || '#80cbc4',
      stroke: '#000',
      strokeThickness: Math.max(1, Math.round(2.5 * k)),
    }).setOrigin(0.5);

    const pad = Math.round(16 * k);
    const bgW = txt.width + pad * 2;
    const bgH = txt.height + Math.round(8 * k);
    const bgY = top + areaH / 2 - bgH / 2;
    const bg = scene.add.graphics();
    bg.fillStyle(0x0e2028, 0.95);
    bg.fillRoundedRect(-bgW / 2, bgY, bgW, bgH, Math.round(4 * k));

    const overlay = scene.add.container(0, 0, [bg, txt]);
    card.container.add(overlay);
    card._shipEffectOverlay = overlay;

    txt.setScale(0.75);
    txt.setAlpha(0);
    bg.setScale(0.75);
    bg.setAlpha(0);
    scene.tweens.add({
      targets: [txt, bg],
      scaleX: 1, scaleY: 1,
      alpha: 1,
      duration: 280,
      ease: 'Back.easeOut',
    });
  }

  hideShipEffectOverlay(handIdx) {
    const card = this.cards.find(c => c.handIdx === handIdx);
    if (!card || !card._shipEffectOverlay) return;
    const overlay = card._shipEffectOverlay;
    card._shipEffectOverlay = null;
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      scaleX: 0.85, scaleY: 0.85,
      duration: 180,
    });
  }

  _setupDrag(cardData, onSendToIsland, L) {
    const scene = this.scene;
    const ct = cardData.container;
    const cardImg = cardData.cardImg;
    const k = L.k;
    const ch = Math.round(CARD.H * k);

    let dragMoved = false;

    cardImg.on('dragstart', (pointer) => {
      dragMoved = false;
      cardData.dragging = true;
      this._dragIdx = cardData.slotIndex;
      ct.setAlpha(0.3);
      ct.setDepth(5);

      const ghost = scene.add.image(pointer.x, pointer.y, cardImg.texture.key);
      ghost.setOrigin(0.5, 0.5);
      ghost.setDepth(80);
      ghost.setScale(CARD.DRAG_SCALE);
      ghost.setRotation(0);
      this._dragGhost = ghost;
    });

    cardImg.on('drag', (pointer) => {
      if (this._dragGhost) {
        this._dragGhost.setPosition(pointer.x, pointer.y);
        const dx = pointer.x - (pointer.prevPosition ? pointer.prevPosition.x : pointer.x);
        this._dragGhost.setRotation(Phaser.Math.Clamp(dx * 0.01, -0.15, 0.15));
      }
      const dist = Phaser.Math.Distance.Between(
        cardData.slot.x, cardData.slot.y, pointer.x, pointer.y
      );
      if (dist > 10) dragMoved = true;
    });

    cardImg.on('dragend', (pointer) => {
      cardData.dragging = false;
      this._dragIdx = -1;

      if (this._dragGhost) {
        this._dragGhost.destroy();
        this._dragGhost = null;
      }

      ct.setAlpha(cardData.isBlocked ? 0.7 : 1);
      ct.setDepth(10 + cardData.slotIndex);

      if (dragMoved && pointer.y < L.Y_HAND_CENTER) {
        if (onSendToIsland) onSendToIsland(cardData.handIdx, { x: pointer.x, y: pointer.y });
      } else {
        this._animateHover(cardData, false, L);
      }
    });
  }

  _animateHover(cardData, hovering, L) {
    const scene = this.scene;
    const k = L.k;
    const ch = Math.round(CARD.H * k);

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
      scene.tweens.add({
        targets: cardData.shadow,
        alpha: 0.15,
        y: cardData.slot.y + ch * 0.52 + 10 * k,
        duration: 200,
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
      scene.tweens.add({
        targets: cardData.shadow,
        alpha: CARD.SHADOW_ALPHA,
        y: cardData.slot.y + ch * 0.52,
        duration: 250,
      });
    }
  }

  _updateIdle(L) {
    this._time += 0.03;
    const k = L.k;
    const spread = CARD.NEIGHBOR_SPREAD * k;
    const lerpSpeed = 0.18;

    let elevIdx = -1;
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      if (c.hovered || c.handIdx === this._shipHighlightedIdx) {
        elevIdx = i;
        break;
      }
    }

    this.cards.forEach((c, i) => {
      // Spread neighbors toward/away from elevated card
      let targetX = c.slot.x;
      if (elevIdx >= 0 && i !== elevIdx && !c.dragging) {
        const diff = i - elevIdx;
        const dir = Math.sign(diff);
        const dist = Math.abs(diff);
        targetX = c.slot.x + dir * spread / dist;
      }
      c.container.x += (targetX - c.container.x) * lerpSpeed;
      c.shadow.x += ((targetX + CARD.SHADOW_OFF * k) - c.shadow.x) * lerpSpeed;

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
