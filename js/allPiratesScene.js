/* ============================================================
   PIRATES — All Pirates Gallery Scene
   ============================================================ */

class AllPiratesScene extends Phaser.Scene {
  constructor() { super('allPirates'); }

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
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.L = computeLayout(this.scale.width, this.scale.height);

    this.root = this.add.container(0, 0);
    this._scrollY = 0;
    this._contentH = 0;

    this._buildList();
    this._setupScroll();

    this._onResize = () => {
      this.L = computeLayout(this.scale.width, this.scale.height);
      this.scene.restart();
    };
    this.scale.on('resize', this._onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize);
    });
  }

  _buildList() {
    const L = this.L;
    const fs = L.fsPx(22);

    const title = this.add.text(L.cx, 36 * L.k, 'All Pirates', {
      fontFamily: 'monospace', fontSize: fs,
      color: '#d7c08f',
    }).setOrigin(0.5);
    this.root.add(title);

    this._mkBtn(L.cx, 76 * L.k, '← Menu', () => this.scene.start('menu'));

    const allKeys = Object.keys(TYPES).filter(k =>
      !k.startsWith('tutorial')
    );

    const cardW = Math.min(L.W - 40 * L.k, 700 * L.k);
    const cardLeft = (L.W - cardW) / 2;
    const sprSc = Math.max(3, Math.round(8 * L.k));
    const sprSize = CATS_PX * sprSc;
    const cardPadX = 16 * L.k;
    const cardPadY = 14 * L.k;
    const cardGap = 10 * L.k;

    let y = 116 * L.k;

    for (const key of allKeys) {
      const def = TYPES[key];
      if (!def) continue;

      const textX = cardLeft + cardPadX + sprSize + 16 * L.k;
      const textW = cardW - cardPadX * 2 - sprSize - 16 * L.k;

      const lines = this._pirateLines(def);
      const tmpTxt = this.add.text(0, -9999, def.name + '\n' + lines.join('\n'), {
        fontFamily: 'monospace', fontSize: fs,
        lineSpacing: 4, wordWrap: { width: textW },
      });
      const textH = tmpTxt.height;
      tmpTxt.destroy();

      const cardH = Math.max(sprSize + cardPadY * 2, textH + cardPadY * 2);


      const sprX = cardLeft + cardPadX + sprSize / 2;
      const sprY = y + cardPadY + sprSize / 2;
      const spr = addCatSprite(this, sprX, sprY, key).setScale(sprSc);
      this.root.add(spr);

      const nameTxt = this.add.text(textX, y + cardPadY, def.name, {
        fontFamily: 'monospace', fontSize: fs, color: '#d7c08f',
      }).setOrigin(0, 0);
      this.root.add(nameTxt);

      const infoTxt = this.add.text(textX, y + cardPadY + nameTxt.height + 4 * L.k, lines.join('\n'), {
        fontFamily: 'monospace', fontSize: fs, color: '#b0b8c8',
        lineSpacing: 4, wordWrap: { width: textW },
      }).setOrigin(0, 0);
      this.root.add(infoTxt);

      y += cardH + cardGap;
    }

    this._contentH = y + 40 * L.k;
  }

  _pirateLines(def) {
    const lines = [];
    if (def.canIsland) {
      lines.push('🏝️ ' + def.dI);
    } else {
      lines.push('🏝️ Can\'t land');
    }
    lines.push('⛵ ' + def.dS);
    lines.push('⚔️ ' + (def.str || 0));
    if (def.cost !== null) lines.push('☠️ ' + def.cost);
    return lines;
  }

  _setupScroll() {
    const L = this.L;
    const maxScroll = Math.max(0, this._contentH - L.H);

    this.input.on('wheel', (_ptr, _go, _dx, dy) => {
      this._scrollY = Phaser.Math.Clamp(this._scrollY + dy, 0, maxScroll);
      this.root.y = -this._scrollY;
    });

    let dragStartY = 0;
    let dragScrollStart = 0;
    this.input.on('pointerdown', (ptr) => {
      dragStartY = ptr.y;
      dragScrollStart = this._scrollY;
    });
    this.input.on('pointermove', (ptr) => {
      if (!ptr.isDown) return;
      const dy = dragStartY - ptr.y;
      this._scrollY = Phaser.Math.Clamp(dragScrollStart + dy, 0, maxScroll);
      this.root.y = -this._scrollY;
    });
  }

  _mkBtn(x, y, label, cb, opts = {}) {
    const L = this.L;
    const bg = opts.bg || '#2b3f52';
    const hoverBg = opts.hoverBg || '#35536f';
    const btn = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: L.fsPx(22),
      color: opts.color || '#d1e4f8',
      backgroundColor: bg, padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: hoverBg }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: bg }));
    btn.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); cb(); });
    this.root.add(btn);
    return btn;
  }
}
