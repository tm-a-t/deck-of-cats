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
  HOVER_LIFT: 18,
  HOVER_SCALE: 1.04,
  DRAG_SCALE: 1.02,
  NEIGHBOR_SPREAD: 33,
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

function cardTextHash(text) {
  let hash = 2166136261;
  const src = String(text || '');
  for (let i = 0; i < src.length; i++) {
    hash ^= src.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cardShipBandMetrics(ch, k) {
  const top = ch - Math.round(31 * k);
  return {
    top,
    height: ch - top,
  };
}

function cardIslandBandMetrics(ch, k) {
  return {
    top: 0,
    height: Math.min(ch, Math.round(31 * k) + 1),
  };
}

function ensureCardBandTexture(scene, bandTexKey, sourceImage, cw, textureResolution, band) {
  if (scene.textures.exists(bandTexKey)) return;
  const bandCanvas = document.createElement('canvas');
  bandCanvas.width = cw * textureResolution;
  bandCanvas.height = band.height * textureResolution;
  const bandCtx = bandCanvas.getContext('2d');
  bandCtx.imageSmoothingEnabled = false;
  bandCtx.drawImage(
    sourceImage,
    0,
    band.top * textureResolution,
    cw * textureResolution,
    band.height * textureResolution,
    0,
    0,
    cw * textureResolution,
    band.height * textureResolution
  );
  scene.textures.addCanvas(bandTexKey, bandCanvas);
  scene.textures.get(bandTexKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
}

function buildCardTexture(scene, typeKey, L, opts = {}) {
  const k = L.k;
  const textureResolution = Math.max(1, Math.ceil(scene.game.config.resolution || 1));
  const cw = Math.round(CARD.W * k);
  const ch = Math.round(CARD.H * k);
  const r = Math.round(CARD.RADIUS * k);
  const bw = Math.max(1, Math.round(CARD.BORDER * k));
  const mode = opts.mode || 'default';
  const slotState = opts.slotState || 'none';
  const slotWeaponKey = opts.slotWeaponKey || null;

  const def = TYPES[typeKey];
  const islandDesc = pirateIslandDesc(def);
  const shipDesc = pirateShipDesc(def);
  const textHash = cardTextHash(`${mode}|${slotState}|${slotWeaponKey || ''}|${typeKey}|${def.name}|${islandDesc}|${shipDesc}|${def.str || 0}`);
  const texKey = '_card_' + typeKey + '_' + textHash + '_' + cw + 'x' + ch + '@' + textureResolution;
  const islandBand = cardIslandBandMetrics(ch, k);
  const islandBandTexKey = texKey + '_islandband';
  const shipBand = cardShipBandMetrics(ch, k);
  const shipBandTexKey = texKey + '_shipband';

  let sourceImage = null;

  if (!scene.textures.exists(texKey)) {
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

    const pad = Math.round(10 * k);
    const maxTxtW = cw - pad * 2;
    const lineY = Math.round(31 * k);
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
    const islandFs = fitCanvasFontSize(ctx, islandDesc, maxTxtW, Math.max(11, Math.round(14 * k)), UI_THEME.fonts.body);
    const shipFs = fitCanvasFontSize(ctx, shipDesc, maxTxtW, Math.max(11, Math.round(14 * k)), UI_THEME.fonts.body);
    const topTextY = Math.round(7 * k);
    const nameY = Math.round(123 * k);
    const statY = Math.round(143 * k);
    const bottomTextY = shipBand.top + Math.round(8 * k);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const sprKey = catTexKey(typeKey);
    if (scene.textures.exists(sprKey)) {
      const img = scene.textures.get(sprKey).getSourceImage();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, spriteX, spriteY, spriteSize, spriteSize);
    }

    if (mode === 'default') {
      ctx.strokeStyle = hexToCSS(CARD.BORDER_COLOR, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(8 * k), lineY);
      ctx.lineTo(cw - Math.round(8 * k), lineY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(Math.round(8 * k), shipBand.top);
      ctx.lineTo(cw - Math.round(8 * k), shipBand.top);
      ctx.stroke();
    }

    const showsWeaponSlot = mode === 'default'
      ? slotState === 'armed'
      : (slotState === 'armed' || slotState === 'empty');
    if (showsWeaponSlot) {
      const slotW = Math.round(32 * k);
      const slotH = Math.round(32 * k);
      const slotR = Math.round(4 * k);
      const slotX = 0;
      const slotY = mode === 'default' ? Math.round(36 * k) : 0;
      roundRect(ctx, slotX, slotY, slotW, slotH, slotR);
      ctx.fillStyle = UI_THEME.colors.sandEdge;
      ctx.fill();
      ctx.strokeStyle = hexToCSS(CARD.BORDER_COLOR, 1);
      ctx.lineWidth = 1;
      ctx.stroke();
      const slotEmoji = slotState === 'armed'
        ? ((slotWeaponKey && WEAPON_TYPES[slotWeaponKey] && WEAPON_TYPES[slotWeaponKey].emoji) || WEAPON_CATEGORY_EMOJI)
        : '+';
      ctx.fillStyle = UI_THEME.colors.ink;
      ctx.font = `${Math.max(UI_THEME.fonts.headingMinPx, Math.round((slotState === 'armed' ? 16 : 18) * k))}px ${UI_THEME.fonts.heading}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slotEmoji, slotX + slotW / 2, slotY + slotH / 2 + Math.round(1 * k));
      ctx.textBaseline = 'top';
    }

    ctx.fillStyle = UI_THEME.colors.ink;

    if (mode === 'default') {
      ctx.font = `${islandFs}px ${UI_THEME.fonts.body}`;
      ctx.fillText(islandDesc, cw / 2, topTextY);
    }

    ctx.font = `${nameFs}px ${UI_THEME.fonts.heading}`;
    ctx.fillText(def.name, cw / 2, nameY);

    ctx.font = `${statFs}px ${UI_THEME.fonts.heading}`;
    ctx.fillText(`⚔️${def.str || 0}`, cw / 2, statY);

    if (mode === 'default') {
      ctx.font = `${shipFs}px ${UI_THEME.fonts.body}`;
      ctx.fillText(shipDesc, cw / 2, bottomTextY);
    }

    scene.textures.addCanvas(texKey, canvas);
    scene.textures.get(texKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
    sourceImage = canvas;
  } else {
    sourceImage = scene.textures.get(texKey).getSourceImage();
  }

  if (mode === 'default') {
    ensureCardBandTexture(scene, islandBandTexKey, sourceImage, cw, textureResolution, islandBand);
    ensureCardBandTexture(scene, shipBandTexKey, sourceImage, cw, textureResolution, shipBand);
  }

  return {
    texKey,
    cw,
    ch,
    textureResolution,
    islandBandTexKey,
    islandBandH: islandBand.height,
    shipBandTexKey,
    shipBandH: shipBand.height,
  };
}

function createPirateCard(scene, opts) {
  const L = opts.L || scene.L;
  const x = opts.x || 0;
  const y = opts.y || 0;
  const rotation = opts.rotation || 0;
  const depth = opts.depth != null ? opts.depth : 10;
  const scale = opts.scale != null ? opts.scale : 1;

  const built = buildCardTexture(scene, opts.type, L, {
    mode: opts.cardMode || 'default',
    slotState: opts.slotState || 'none',
    slotWeaponKey: opts.slotWeaponKey || null,
  });
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

function createCardBandOverlay(scene, opts) {
  const L = opts.L || scene.L;
  const k = L.k;
  const built = buildCardTexture(scene, opts.type, L);
  const isIslandBand = opts.band === 'island';
  const bandH = isIslandBand ? built.islandBandH : built.shipBandH;
  const bandTexKey = isIslandBand ? built.islandBandTexKey : built.shipBandTexKey;
  const visualScale = opts.scale != null ? opts.scale : 1;
  const imageScale = (built.textureResolution > 1 ? 1 / built.textureResolution : 1) * visualScale;
  const accentColor = uiColorInt(opts.color || UI_THEME.colors.cocoa);
  const x = opts.x || 0;
  const y = opts.y || 0;
  const settleOffset = opts.settleOffset != null ? opts.settleOffset : Math.round(5 * k);
  const accentPad = Math.round(2 * k);

  const accent = scene.add.graphics();
  accent.setPosition(x, y);
  if (opts.depth != null) accent.setDepth(opts.depth + 1);
  accent.fillStyle(accentColor, 0.22);
  accent.fillRoundedRect(
    -built.cw / 2 - accentPad,
    -bandH / 2 - accentPad,
    built.cw + accentPad * 2,
    bandH + accentPad * 2,
    Math.round((CARD.RADIUS + 1) * k)
  );
  accent.setScale(visualScale * 0.985).setAlpha(0);
  accent.y += settleOffset;

  const bandImg = scene.add.image(x, y, bandTexKey).setOrigin(0.5);
  if (opts.depth != null) bandImg.setDepth(opts.depth);
  bandImg.setScale(imageScale * 0.985).setAlpha(0);
  bandImg.y += settleOffset;

  if (opts.parentContainer) {
    opts.parentContainer.add([bandImg, accent]);
  }

  return { accent, bandImg, visualScale, imageScale, x, y };
}

function showCardBandOverlay(scene, overlay, opts = {}) {
  if (!overlay) return;
  const showScale = opts.showScale != null ? opts.showScale : 1.045;
  const duration = opts.duration != null ? opts.duration : 240;
  const ease = opts.ease || 'Back.easeOut';
  scene.tweens.add({
    targets: overlay.accent,
    scaleX: overlay.visualScale * showScale,
    scaleY: overlay.visualScale * showScale,
    y: overlay.y,
    alpha: 1,
    duration,
    ease,
  });
  scene.tweens.add({
    targets: overlay.bandImg,
    scaleX: overlay.imageScale * showScale,
    scaleY: overlay.imageScale * showScale,
    y: overlay.y,
    alpha: 1,
    duration,
    ease,
  });
}

function destroyCardBandOverlay(scene, overlay) {
  if (!overlay) return;
  if (scene && scene.tweens) {
    scene.tweens.killTweensOf(overlay.accent);
    scene.tweens.killTweensOf(overlay.bandImg);
  }
  if (overlay.accent && overlay.accent.scene && overlay.accent.scene.sys) overlay.accent.destroy();
  if (overlay.bandImg && overlay.bandImg.scene && overlay.bandImg.scene.sys) overlay.bandImg.destroy();
}

function hideCardBandOverlay(scene, overlay, opts = {}) {
  if (!overlay) return;
  const hideScale = opts.hideScale != null ? opts.hideScale : 1;
  const exitOffset = opts.exitOffset != null ? opts.exitOffset : Math.round(4 * scene.L.k);
  const duration = opts.duration != null ? opts.duration : 180;
  const ease = opts.ease || 'Sine.easeIn';
  if (scene && scene.tweens) {
    scene.tweens.killTweensOf(overlay.accent);
    scene.tweens.killTweensOf(overlay.bandImg);
  }
  scene.tweens.add({
    targets: overlay.accent,
    scaleX: overlay.visualScale * hideScale,
    scaleY: overlay.visualScale * hideScale,
    y: overlay.y - exitOffset,
    alpha: 0,
    duration,
    ease,
    onComplete: () => destroyCardBandOverlay(scene, overlay),
  });
  scene.tweens.add({
    targets: overlay.bandImg,
    scaleX: overlay.imageScale * hideScale,
    scaleY: overlay.imageScale * hideScale,
    y: overlay.y - exitOffset,
    alpha: 0,
    duration,
    ease,
  });
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

function cardRowLayout(n, L, opts = {}) {
  const k = L.k;
  const scale = opts.scale != null ? opts.scale : 1;
  const cardW = CARD.W * k * scale;
  const y = opts.y != null ? opts.y : L.Y_HAND_CENTER;
  const maxStep = opts.maxStep != null ? opts.maxStep : 170 * k;
  const edgePad = opts.edgePad != null ? opts.edgePad : 22 * k;
  const minX = edgePad + cardW / 2;
  const maxX = L.W - minX;
  const usableW = Math.max(0, maxX - minX);
  const step = n <= 1 ? 0 : Math.min(maxStep, usableW / Math.max(n - 1, 1));
  const rowW = step * Math.max(0, n - 1);
  const startX = Phaser.Math.Clamp(L.cx - rowW / 2, minX, maxX - rowW);
  const slots = [];
  for (let i = 0; i < n; i++) {
    slots.push({ x: startX + i * step, y, rotation: 0, index: i });
  }
  return slots;
}

function isTouchLikePointer(pointer) {
  return !!pointer && (pointer.pointerType === 'touch' || pointer.wasTouch === true);
}

const CARD_TIP = {
  maxW: 212,
  padX: 12,
  padY: 10,
  titleGap: 5,
  stackGap: 8,
  anchorGap: 12,
  edgePad: 12,
  radius: 10,
};

class CardTooltipController {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.boundsRect = opts.boundsRect || null;
    this.layer = scene.add.container(0, 0).setDepth(opts.depth != null ? opts.depth : 160);
    this.layer.setVisible(false);
    this._activeKey = null;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  destroy() {
    this.hide();
    if (this.layer) this.layer.destroy(true);
    this.layer = null;
    this.scene = null;
    this.boundsRect = null;
  }

  setBoundsRect(rect) {
    this.boundsRect = rect || null;
  }

  isActiveFor(key) {
    return !!key && this._activeKey === key;
  }

  hideForKey(key) {
    if (!this.isActiveFor(key)) return false;
    this.hide();
    return true;
  }

  hide() {
    if (!this.layer) return;
    this.layer.removeAll(true);
    this.layer.setVisible(false);
    this._activeKey = null;
  }

  showForCard(target, entries, opts = {}) {
    const tips = Array.isArray(entries) ? entries.filter((entry) => entry && entry.title && entry.body) : [];
    if (!tips.length) {
      this.hide();
      return false;
    }
    const bounds = this.resolveCardBounds(target);
    if (!bounds) {
      this.hide();
      return false;
    }

    const scene = this.scene;
    const L = scene.L;
    const area = this.resolveArea();
    const areaW = Math.max(1, area.right - area.left);
    const minBoxW = Math.min(Math.round(120 * L.k), areaW);
    const boxW = Phaser.Math.Clamp(Math.round(CARD_TIP.maxW * L.k), minBoxW, areaW);
    const stackGap = Math.round(CARD_TIP.stackGap * L.k);
    const boxes = tips.map((entry) => this.buildTipBox(entry, boxW));
    const totalH = boxes.reduce((sum, box, idx) => sum + box.height + (idx > 0 ? stackGap : 0), 0);
    const anchorGap = Math.round(CARD_TIP.anchorGap * L.k);
    const maxTop = Math.max(area.top, area.bottom - totalH);
    const placement = opts.placement || 'side';
    let left = area.left;
    let top = area.top;

    if (placement === 'above' || placement === 'below') {
      left = Phaser.Math.Clamp(bounds.centerX - boxW / 2, area.left, Math.max(area.left, area.right - boxW));
      const preferredTop = placement === 'above'
        ? bounds.top - anchorGap - totalH
        : bounds.bottom + anchorGap;
      const fallbackTop = placement === 'above'
        ? bounds.bottom + anchorGap
        : bounds.top - anchorGap - totalH;
      top = preferredTop;
      if (top < area.top || top > maxTop) top = fallbackTop;
    } else {
      const centerX = (area.left + area.right) / 2;
      const preferRight = bounds.centerX <= centerX;
      left = preferRight
        ? bounds.right + anchorGap
        : bounds.left - anchorGap - boxW;
      if (preferRight && left + boxW > area.right) {
        left = bounds.left - anchorGap - boxW;
      } else if (!preferRight && left < area.left) {
        left = bounds.right + anchorGap;
      }
      left = Phaser.Math.Clamp(left, area.left, Math.max(area.left, area.right - boxW));
      top = bounds.centerY - totalH / 2;
    }
    top = Phaser.Math.Clamp(top, area.top, maxTop);

    this.hide();
    this._activeKey = opts.key || null;

    let cursorY = top;
    boxes.forEach((box, idx) => {
      box.container.setPosition(left, cursorY);
      this.layer.add(box.container);
      cursorY += box.height + (idx < boxes.length - 1 ? stackGap : 0);
    });

    this.layer.setVisible(true);
    return true;
  }

  resolveArea() {
    const scene = this.scene;
    const L = scene.L;
    const pad = Math.round(CARD_TIP.edgePad * L.k);
    const rect = this.boundsRect;
    if (rect) {
      return {
        left: rect.left != null ? rect.left : pad,
        top: rect.top != null ? rect.top : pad,
        right: rect.right != null ? rect.right : scene.scale.width - pad,
        bottom: rect.bottom != null ? rect.bottom : scene.scale.height - pad,
      };
    }
    return {
      left: pad,
      top: pad,
      right: scene.scale.width - pad,
      bottom: scene.scale.height - pad,
    };
  }

  resolveCardBounds(target) {
    const node = target && (target.container || target);
    if (!node || typeof node.getBounds !== 'function') return null;
    const raw = node.getBounds();
    if (!raw) return null;
    const left = raw.x;
    const top = raw.y;
    const width = raw.width || 0;
    const height = raw.height || 0;
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      centerX: left + width / 2,
      centerY: top + height / 2,
    };
  }

  buildTipBox(entry, width) {
    const scene = this.scene;
    const L = scene.L;
    const padX = Math.round(CARD_TIP.padX * L.k);
    const padY = Math.round(CARD_TIP.padY * L.k);
    const titleGap = Math.round(CARD_TIP.titleGap * L.k);
    const innerW = Math.max(1, width - padX * 2);

    const title = scene.add.text(padX, padY, entry.title, uiHeadingStyle(L, 15, UI_THEME.colors.ink, {
      wordWrap: { width: innerW },
    })).setOrigin(0, 0);
    const body = scene.add.text(padX, padY + title.height + titleGap, entry.body, uiBodyStyle(L, UI_THEME.colors.ink, {
      wordWrap: { width: innerW },
      lineSpacing: uiLineSpacingPx(L, UI_THEME.fonts.bodyPx, 15),
    })).setOrigin(0, 0);
    const height = Math.round(padY + title.height + titleGap + body.height + padY);
    const radius = Math.round(CARD_TIP.radius * L.k);

    const shadow = scene.add.graphics();
    shadow.fillStyle(uiColorInt(UI_THEME.colors.shadow), 0.2);
    shadow.fillRoundedRect(3 * L.k, 4 * L.k, width, height, radius);

    const bg = scene.add.graphics();
    bg.fillStyle(uiColorInt(UI_THEME.colors.paper), 0.98);
    bg.lineStyle(Math.max(1, Math.round(2 * L.k)), uiColorInt(UI_THEME.colors.sandEdge), 1);
    bg.fillRoundedRect(0, 0, width, height, radius);
    bg.strokeRoundedRect(0, 0, width, height, radius);

    const accent = scene.add.graphics();
    accent.fillStyle(uiColorInt(UI_THEME.colors.outline), 0.18);
    accent.fillRoundedRect(padX, padY + title.height + Math.max(1, Math.round(2 * L.k)), Math.max(12 * L.k, innerW * 0.48), Math.max(2, Math.round(2 * L.k)), Math.max(1, Math.round(1 * L.k)));

    const container = scene.add.container(0, 0, [shadow, bg, accent, title, body]);
    return { container, height };
  }
}


// ─────────── CardHand class ───────────

class CardHand {
  constructor(scene) {
    this.scene = scene;
    this.cards = [];
    this._hoverIdx = -1;
    this._dragIdx = -1;
    this._dragGhost = null;
    this._spreadTweens = null;
    this._onCardHoverChange = null;
  }

  destroy() {
    const tweens = this.scene && this.scene.tweens;
    if (this._onCardHoverChange) {
      this.cards.forEach((card) => {
        if (card.hovered) this._onCardHoverChange(card, false);
      });
    }
    this.cards.forEach(c => {
      if (tweens) {
        tweens.killTweensOf(c.container);
        tweens.killTweensOf(c.cardImg);
      }
      this._clearShipEffectOverlay(c);
      if (c.container) c.container.destroy(true);
    });
    this._killSpreadTweens();
    this.cards = [];
    if (this._dragGhost) { this._dragGhost.destroy(); this._dragGhost = null; }
    this._hoverIdx = -1;
    this._dragIdx = -1;
    this._onCardHoverChange = null;
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
    const isSending = opts.isSending;
    const allowInteraction = opts.allowInteraction !== false;
    const blockedCard = opts.blockedCard || (() => false);
    const highlightTargetIdx = opts.highlightTargetIdx;
    const onSendToIsland = opts.onSendToIsland;
    const onCardPointerDown = opts.onCardPointerDown;
    const cardModeForCard = opts.cardModeForCard || (() => 'default');
    const cardSlotStateForCard = opts.cardSlotStateForCard || (() => 'none');
    const cardSlotWeaponKeyForCard = opts.cardSlotWeaponKeyForCard || (() => null);
    const touchTapPreviewsAction = opts.touchTapPreviewsAction !== false;
    const container = opts.container;
    this._onCardHoverChange = opts.onCardHoverChange || null;

    const visible = [];
    hand.forEach((p, i) => {
      if (sent.includes(i) || sendingSet.has(i)) return;
      visible.push({ pirate: p, handIdx: i });
    });

    const slots = Array.isArray(opts.slots)
      ? opts.slots
      : (opts.layout === 'row'
        ? cardRowLayout(visible.length, L, opts.rowLayout || {})
        : cardHandLayout(visible.length, L));

    visible.forEach((entry, slotI) => {
      const { pirate, handIdx } = entry;
      const slot = slots[slotI];
      const isBlocked = blockedCard(pirate, handIdx);
      const isTarget = handIdx === highlightTargetIdx;

      const cardView = createPirateCard(scene, {
        type: pirate.type,
        x: slot.x,
        y: slot.y,
        rotation: slot.rotation,
        depth: 10 + slotI,
        cardMode: cardModeForCard(pirate, handIdx),
        slotState: cardSlotStateForCard(pirate, handIdx),
        slotWeaponKey: cardSlotWeaponKeyForCard(pirate, handIdx),
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
        cardMode: cardModeForCard(pirate, handIdx),
        slotWeaponKey: cardSlotWeaponKeyForCard(pirate, handIdx),
        slotIndex: slotI,
        isBlocked,
        hovered: false,
        dragging: false,
      };

      if (allowInteraction) {
        cardImg.setInteractive({ useHandCursor: true });
        if (isSending) {
          scene.input.setDraggable(cardImg, true);
          this._setupDrag(cardData, onSendToIsland, L);
        } else if (onCardPointerDown) {
          cardImg.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
            if (touchTapPreviewsAction && isTouchLikePointer(pointer)) {
              const alreadyHovered = this._hoverIdx === slotI;
              this._setHoveredCard(alreadyHovered ? -1 : slotI, L);
              if (!alreadyHovered) return;
            }
            onCardPointerDown(handIdx, pirate, cardData, pointer);
          });
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
      }

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
          duration: CARD_MOTION.handReflowDuration, ease: 'Cubic.easeOut',
        });
      } else if (appearFrom) {
        const startScale = appearFrom.startScale != null ? appearFrom.startScale : 0.38;
        const startRotation = appearFrom.rotation != null ? appearFrom.rotation : slot.rotation - 0.16;
        const appearDuration = appearFrom.duration != null ? appearFrom.duration : CARD_MOTION.handAppearDuration;
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
          duration: appearDuration,
          ease: 'Cubic.easeOut',
        });
      }

      this.cards.push(cardData);
    });
  }

  _setHoveredCard(slotIndex, L) {
    if (this._hoverIdx === slotIndex) return;

    const prevHoverIdx = this._hoverIdx;
    this.cards.forEach((c) => {
      if (c.dragging) return;
      const shouldHover = c.slotIndex === slotIndex;
      if (c.hovered === shouldHover) return;
      c.hovered = shouldHover;
      this._animateHover(c, shouldHover, L);
      if (this._onCardHoverChange) this._onCardHoverChange(c, shouldHover);
    });
    this._hoverIdx = slotIndex;
    const easing = slotIndex >= 0 && prevHoverIdx < 0 ? 'Back.easeOut' : 'Sine.easeOut';
    const duration = slotIndex >= 0 ? CARD_MOTION.hoverInDuration : CARD_MOTION.hoverOutDuration;
    this._tweenNeighborSpread(slotIndex, L, duration, easing);
  }

  getCardPosition(handIdx) {
    const card = this.cards.find(c => c.handIdx === handIdx);
    if (!card) return null;
    return {
      x: card.container.x,
      y: card.container.y,
      rotation: card.container.rotation,
    };
  }

  highlightShipCard(handIdx, active, opts = {}) {
    const card = this.cards.find(c => c.handIdx === handIdx);
    if (!card) return;
    const L = this.scene.L;

    if (active) {
      card.container.setDepth(50);
      if (opts.spread !== false) {
        this._tweenNeighborSpread(card.slotIndex, L, 180, 'Cubic.easeOut');
      }
    } else {
      card.container.setDepth(10 + card.slotIndex);
    }
  }

  clearShipSpread(duration = 180, ease = 'Sine.easeOut') {
    this._tweenNeighborSpread(-1, this.scene.L, duration, ease);
  }

  prepareForShipEffect() {
    const tweens = this.scene && this.scene.tweens;
    this._killSpreadTweens();
    for (const card of this.cards) {
      if (tweens) tweens.killTweensOf(card.container);
      card.hovered = false;
      card.dragging = false;
      card.container.setPosition(card.slot.x, card.slot.y);
      card.container.setRotation(card.slot.rotation);
      card.container.setScale(1);
      card.container.setAlpha(card.isBlocked ? 0.7 : 1);
      card.container.setDepth(10 + card.slotIndex);
    }
  }

  showShipEffectOverlay(handIdx, color) {
    const card = this.cards.find(c => c.handIdx === handIdx);
    if (!card) return;
    const scene = this.scene;
    const L = scene.L;
    const ch = Math.round(CARD.H * L.k);
    const effectY = ch / 2 - cardShipBandMetrics(ch, L.k).height / 2;

    this._clearShipEffectOverlay(card);
    card._shipEffectOverlay = createCardBandOverlay(scene, {
      type: card.pirate.type,
      band: 'ship',
      x: 0,
      y: effectY,
      scale: 1,
      color,
      parentContainer: card.container,
      L,
    });
    showCardBandOverlay(scene, card._shipEffectOverlay);
  }

  hideShipEffectOverlay(handIdx) {
    const card = this.cards.find(c => c.handIdx === handIdx);
    if (!card || !card._shipEffectOverlay) return;
    const overlay = card._shipEffectOverlay;
    card._shipEffectOverlay = null;
    hideCardBandOverlay(this.scene, overlay);
  }

  _clearShipEffectOverlay(card) {
    if (!card || !card._shipEffectOverlay) return;
    const overlay = card._shipEffectOverlay;
    card._shipEffectOverlay = null;
    destroyCardBandOverlay(this.scene, overlay);
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

    const isMobileViewport = () =>
      !!(scene.L && scene.L.IS_MOBILE);

    const beginDragVisual = (pointer) => {
      if (dragActivated) return;
      dragActivated = true;
      this._setHoveredCard(-1, L);
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
      if (isTouchLikePointer(pointer) && !cardData.dragging) {
        this._setHoveredCard(this._hoverIdx === cardData.slotIndex ? -1 : cardData.slotIndex, L);
      }
    });

    cardImg.on('dragstart', (pointer) => {
      dragMoved = false;
      dragActivated = false;
      dragCard = cardData;
      touchDrag = isMobileViewport() && isTouchLikePointer(pointer);

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
        if (!dragCard.hovered) this._animateHover(dragCard, false, L);
      }
    });
  }

  _animateHover(cardData, hovering, L) {
    const scene = this.scene;
    const k = L.k;

    if (hovering) {
      cardData.container.setDepth(40);

      scene.tweens.add({
        targets: cardData.container,
        y: cardData.slot.y - CARD.HOVER_LIFT * k,
        scaleX: CARD.HOVER_SCALE,
        scaleY: CARD.HOVER_SCALE,
        rotation: 0,
        duration: CARD_MOTION.hoverInDuration,
        ease: 'Back.easeOut',
      });
    } else {
      cardData.container.setDepth(10 + cardData.slotIndex);

      scene.tweens.add({
        targets: cardData.container,
        y: cardData.slot.y,
        scaleX: 1,
        scaleY: 1,
        rotation: cardData.slot.rotation,
        duration: CARD_MOTION.hoverOutDuration,
        ease: 'Sine.easeOut',
      });
    }
  }

  _killSpreadTweens() {
    if (!this._spreadTweens) return;
    for (const tw of this._spreadTweens) tw.stop();
    this._spreadTweens = null;
  }

  _tweenNeighborSpread(activeSlotIndex, L, duration, ease) {
    const scene = this.scene;
    const spread = CARD.NEIGHBOR_SPREAD * L.k;
    this._killSpreadTweens();
    this._spreadTweens = [];

    for (const c of this.cards) {
      let targetX = c.slot.x;
      if (activeSlotIndex >= 0 && c.slotIndex !== activeSlotIndex) {
        const diff = c.slotIndex - activeSlotIndex;
        const dir = Math.sign(diff);
        const dist = Math.abs(diff);
        targetX = c.slot.x + dir * spread / dist;
      }
      this._spreadTweens.push(scene.tweens.add({
        targets: c.container,
        x: targetX,
        duration,
        ease,
      }));
    }
  }
}
