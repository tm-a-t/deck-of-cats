/* ============================================================
   PIRATES — Cat Costume Generator & Costumes Scene
   ============================================================ */

const CATS_COLS    = 7;
const CATS_PX      = 10;
const NOTCATS_COLS = 2;

const FUR_ORIG_P = [0xf7, 0xb2, 0x6b];
const FUR_ORIG_S = [0xc0, 0x88, 0x4e];

const FUR_PALETTE = [
  { name: 'Orange', p: null,               s: null },
  { name: 'Brown',  p: [0x7b,0x41,0x29],   s: [0x5b,0x2b,0x17] },
  { name: 'Gray',   p: [0x6a,0x7b,0x7f],   s: [0x55,0x60,0x68] },
  { name: 'Black',  p: [0x00,0x00,0x00],   s: [0x00,0x00,0x00], dark: true },
  { name: 'Pink',   p: [0xe0,0x82,0xdb],   s: [0xbe,0x63,0xba], w: 0.25 },
  { name: 'Ginger', p: [0xe6,0x6e,0x3e],   s: [0xc2,0x56,0x2b] },
  { name: 'Steel',  p: [0x4c,0x8b,0xa4],   s: [0x3a,0x73,0x8a] },
  { name: 'Cyan',   p: [0x40,0xc9,0xda],   s: [0x2b,0xab,0xbb], w: 0.25 },
  { name: 'Gold',   p: [0xeb,0xbe,0x23],   s: [0xdc,0xaf,0x17] },
  { name: 'Peach',  p: [0xfe,0xda,0xc0],   s: [0xf5,0xc9,0xa9] },
];

function pickWeighted(arr) {
  const total = arr.reduce((s, e) => s + (e.w || 1), 0);
  let r = Math.random() * total;
  for (const e of arr) {
    r -= (e.w || 1);
    if (r <= 0) return e;
  }
  return arr[arr.length - 1];
}

// ── Cat combination: encode as [body, clothes, weapon, eyes, accessory, furIdx]
//    tail is always frame 1; accessory 0 = none

function randCat() {
  const body    = 2 + Math.floor(Math.random() * 14);   // 2-15
  const clothes = 23 + Math.floor(Math.random() * 15);  // 23-37
  const weapon  = 38 + Math.floor(Math.random() * 9);   // 38-46
  const fur     = pickWeighted(FUR_PALETTE);
  const furIdx  = FUR_PALETTE.indexOf(fur);

  let eyes;
  if (fur.dark) {
    eyes = 19;
  } else {
    const r = Math.random();
    eyes = r < 0.95 ? 16 : (r < 0.975 ? 17 : 18);
  }

  let accessory = 0;
  const a = Math.random();
  if      (a < 0.0167) accessory = 20;
  else if (a < 0.0333) accessory = 21;
  else if (a < 0.05)   accessory = 22;

  return [body, clothes, weapon, eyes, accessory, furIdx];
}

function decodeCat(arr) {
  return {
    tail: 1,
    body: arr[0],
    clothes: arr[1],
    weapon: arr[2],
    eyes: arr[3],
    accessory: arr[4] || null,
    fur: FUR_PALETTE[arr[5]],
  };
}

function composeCatTexture(scene, cat, key) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CATS_PX;
  const ctx = canvas.getContext('2d');

  const src = scene.textures.get('catsImg').getSourceImage();
  const layers = [cat.tail, cat.body, cat.weapon, cat.clothes, cat.eyes];
  if (cat.accessory !== null) layers.push(cat.accessory);

  for (const fi of layers) {
    const idx = fi - 1;
    const sx = (idx % CATS_COLS) * CATS_PX;
    const sy = Math.floor(idx / CATS_COLS) * CATS_PX;

    if (cat.fur.p) {
      const tmp = document.createElement('canvas');
      tmp.width = tmp.height = CATS_PX;
      const tc = tmp.getContext('2d');
      tc.drawImage(src, sx, sy, CATS_PX, CATS_PX, 0, 0, CATS_PX, CATS_PX);

      const id = tc.getImageData(0, 0, CATS_PX, CATS_PX);
      const d  = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === FUR_ORIG_P[0] && d[i+1] === FUR_ORIG_P[1] && d[i+2] === FUR_ORIG_P[2]) {
          d[i] = cat.fur.p[0]; d[i+1] = cat.fur.p[1]; d[i+2] = cat.fur.p[2];
        } else if (d[i] === FUR_ORIG_S[0] && d[i+1] === FUR_ORIG_S[1] && d[i+2] === FUR_ORIG_S[2]) {
          d[i] = cat.fur.s[0]; d[i+1] = cat.fur.s[1]; d[i+2] = cat.fur.s[2];
        }
      }
      tc.putImageData(id, 0, 0);
      ctx.drawImage(tmp, 0, 0);
    } else {
      ctx.drawImage(src, sx, sy, CATS_PX, CATS_PX, 0, 0, CATS_PX, CATS_PX);
    }
  }

  scene.textures.addCanvas(key, canvas);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function catTexKey(typeKey) { return 'cat_' + typeKey; }

function composeCustomSkinTexture(scene, frame, key) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CATS_PX;
  const ctx = canvas.getContext('2d');
  const src = scene.textures.get('notcatsImg').getSourceImage();
  const sx = (frame % NOTCATS_COLS) * CATS_PX;
  const sy = Math.floor(frame / NOTCATS_COLS) * CATS_PX;
  ctx.drawImage(src, sx, sy, CATS_PX, CATS_PX, 0, 0, CATS_PX, CATS_PX);
  scene.textures.addCanvas(key, canvas);
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function ensureCatTextures(scene) {
  for (const k in TYPES) {
    const key = catTexKey(k);
    if (!scene.textures.exists(key)) {
      if (TYPES[k].customSkin != null) {
        composeCustomSkinTexture(scene, TYPES[k].customSkin, key);
      } else {
        composeCatTexture(scene, decodeCat(TYPES[k].cat), key);
      }
    }
  }
}

function addCatSprite(scene, x, y, typeKey) {
  return scene.add.image(x, y, catTexKey(typeKey));
}

// ============================================================
//   Costumes Gallery Scene
// ============================================================

class CostumesScene extends Phaser.Scene {
  constructor() { super('costumes'); this._texKeys = []; }

  preload() {
    if (typeof preloadSfx === 'function') preloadSfx(this);
    if (!this.textures.exists('catsImg')) {
      this.load.image('catsImg', 'assets/cats.png');
    }
    if (!this.textures.exists('notcatsImg')) {
      this.load.image('notcatsImg', 'assets/notcats.png');
    }
  }

  create() {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.L = computeLayout(this.scale.width, this.scale.height);
    this.root = this.add.container(0, 0);
    this._texKeys = [];

    this.renderAll();

    this._onResize = () => {
      this.L = computeLayout(this.scale.width, this.scale.height);
      this._cleanup();
      this.scene.restart();
    };
    this.scale.on('resize', this._onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize);
      this._cleanup();
    });
  }

  _cleanup() {
    for (const k of this._texKeys) {
      if (this.textures.exists(k)) this.textures.remove(k);
    }
    this._texKeys = [];
  }

  _composeTemp(cat, key) {
    composeCatTexture(this, cat, key);
    this._texKeys.push(key);
  }

  renderAll() {
    const L = this.L;
    this.root.removeAll(true);
    this._cleanup();

    const title = this.add.text(L.cx, 40 * L.k, 'Pirate Cat Costumes', {
      fontFamily: 'monospace', fontSize: L.fsPx(48),
      color: '#d7c08f', stroke: '#31220f', strokeThickness: 6 * L.k,
    }).setOrigin(0.5);
    this.root.add(title);

    const btnY = 100 * L.k;
    this._mkBtn(L.cx - 130 * L.k, btnY, '← Menu', () => this.scene.start('menu'), {
      bg: '#2b3f52', hoverBg: '#35536f', color: '#d1e4f8',
    });
    this._mkBtn(L.cx + 130 * L.k, btnY, '🎲 Reroll', () => this.renderAll(), {
      bg: '#52392b', hoverBg: '#6f4d35', color: '#f8e2d1',
    });

    const catSc  = Math.max(3, Math.round(8 * L.k));
    const catPx  = CATS_PX * catSc;
    const padX   = 20 * L.k;
    const padY   = 68 * L.k;
    const cellW  = catPx + padX;
    const cellH  = catPx + padY;
    const gridTop = 150 * L.k;
    const cols   = Math.max(2, Math.floor((L.W - 30 * L.k) / cellW));
    const rows   = Math.max(1, Math.floor((L.H - gridTop - 10 * L.k) / cellH));
    const n      = cols * rows;

    const gridW  = cols * cellW;
    const x0     = (L.W - gridW) / 2 + cellW / 2;

    for (let i = 0; i < n; i++) {
      const c  = i % cols;
      const r  = Math.floor(i / cols);
      const cx = x0 + c * cellW;
      const cy = gridTop + r * cellH + catPx / 2;

      const catArr = randCat();
      const cat = decodeCat(catArr);
      const key = `_cat${i}`;
      this._composeTemp(cat, key);

      const sp = this.add.image(cx, cy, key);
      sp.setScale(catSc).setOrigin(0.5);
      this.root.add(sp);

      const frames = [1, cat.body, cat.weapon, cat.clothes, cat.eyes];
      if (cat.accessory !== null) frames.push(cat.accessory);

      const half = Math.ceil(frames.length / 2);
      const lblText = frames.slice(0, half).join(', ') + '\n' + frames.slice(half).join(', ');
      const lbl = this.add.text(cx, cy + catPx / 2 + 6 * L.k, lblText, {
        fontFamily: 'monospace', fontSize: L.fsPx(12),
        color: '#8da0b3', align: 'center',
      }).setOrigin(0.5, 0);
      this.root.add(lbl);

      const furLbl = this.add.text(cx, cy + catPx / 2 + 32 * L.k, cat.fur.name, {
        fontFamily: 'monospace', fontSize: L.fsPx(10),
        color: '#6a7a8a', align: 'center',
      }).setOrigin(0.5, 0);
      this.root.add(furLbl);
    }
  }

  _mkBtn(x, y, label, cb, opts = {}) {
    const L  = this.L;
    const bg = opts.bg || '#1e4535';
    const hoverBg = opts.hoverBg || '#2a6545';
    const btn = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: L.fsPx(24),
      color: opts.color || '#d7f0d7',
      backgroundColor: bg, padding: { x: 24 * L.k, y: 12 * L.k },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: hoverBg }));
    btn.on('pointerout',  () => btn.setStyle({ backgroundColor: bg }));
    btn.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      playSfx(this, 'button');
      cb();
    });
    this.root.add(btn);
    return btn;
  }
}
