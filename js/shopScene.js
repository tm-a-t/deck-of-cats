/* ============================================================
   PIRATES — Shop Modal Scene
   ============================================================ */

class ShopScene extends Phaser.Scene {
  constructor() { super('shopModal'); }

  create() {
    this.L = computeLayout(this.scale.width, this.scale.height);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.modalLayer = this.add.container(0, 0).setDepth(40);
    this.renderModal();

    this.scale.on('resize', (gameSize) => {
      this.L = computeLayout(gameSize.width, gameSize.height);
      this.scene.restart();
    });
  }

  computeModal() {
    const L = this.L;
    const w = Math.min(L.W - 80 * L.k, 820 * L.k);
    const h = Math.min(L.H - 400 * L.k, 1040 * L.k);
    const x = (L.W - w) / 2;
    const y = (L.H - h) / 2;
    return { x, y, w, h };
  }

  shopPos(idx, n, modal) {
    const L = this.L;
    const cols = Math.min(n, 2);
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const rowStart = row * cols;
    const rowN = Math.min(cols, n - rowStart);
    const sp = Math.min(220 * L.k, (modal.w - 80 * L.k) / Math.max(cols - 1, 1));
    const x = modal.x + modal.w / 2 - ((rowN - 1) * sp) / 2 + col * sp;
    const rowGap = 350 * L.k;
    const topY = modal.y + 220 * L.k;
    const y = topY + row * rowGap;
    return { x, y };
  }

  renderModal() {
    this.modalLayer.removeAll(true);
    const L = this.L;
    const m = this.computeModal();

    const blocker = this.add.rectangle(0, 0, L.W, L.H, 0x000000, 0.25).setOrigin(0, 0);
    blocker.setInteractive();
    blocker.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      if (ptr.x >= m.x && ptr.x <= m.x + m.w && ptr.y >= m.y && ptr.y <= m.y + m.h) return;
      this.scene.stop();
    });
    this.modalLayer.add(blocker);

    const paper = this.add.graphics();
    paper.fillStyle(0xe0d4b1, 1);
    paper.fillRoundedRect(m.x, m.y, m.w, m.h, 18 * L.k);
    paper.lineStyle(3, 0x6a5838, 1);
    paper.strokeRoundedRect(m.x, m.y, m.w, m.h, 18 * L.k);
    this.modalLayer.add(paper);

    const title = this.add.text(m.x + m.w / 2, m.y + 14 * L.k, 'Pirate Shop', {
      fontFamily: 'monospace', fontSize: L.fs(30), color: '#2b2b2b',
    }).setOrigin(0.5, 0);
    this.modalLayer.add(title);

    const close = this.add.text(m.x + m.w - 18 * L.k, m.y + 12 * L.k, '✕', {
      fontFamily: 'monospace', fontSize: L.fs(24), color: '#483818',
      backgroundColor: '#e0d4b1', padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on('pointerover', () => close.setStyle({ color: '#7a3118' }));
    close.on('pointerout', () => close.setStyle({ color: '#483818' }));
    close.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      this.scene.stop();
    });
    this.modalLayer.add(close);

    const canBuyNow = G.phase === 'shopping' && !G.busy;
    const infoText = canBuyNow ? `You have ☠️ ${G.enthusiasm}` : 'Hire in the end of the round';
    const info = this.add.text(m.x + m.w / 2, m.y + 46 * L.k, infoText, {
      fontFamily: 'monospace', fontSize: L.fs(18), color: canBuyNow ? '#6f2a82' : '#7a6a4a',
    }).setOrigin(0.5, 0);
    this.modalLayer.add(info);

    if (G.shop.length === 0) {
      const empty = this.add.text(m.x + m.w / 2, m.y + m.h * 0.48, '(empty)', {
        fontFamily: 'monospace', fontSize: L.fs(22), color: '#7a6a4a',
      }).setOrigin(0.5);
      this.modalLayer.add(empty);
      return;
    }

    G.shop.forEach((type, i) => {
      const def = TYPES[type];
      const pos = this.shopPos(i, G.shop.length, m);
      const canBuy = canBuyNow && G.enthusiasm >= def.cost;

      const spr = this.add.sprite(pos.x, pos.y, 'pirates', def.frame).setScale(L.SC);
      this.modalLayer.add(spr);

      this.modalLayer.add(this.add.text(pos.x, pos.y - 92 * L.k, `☠️${def.cost}`, {
        fontFamily: 'monospace', fontSize: L.fs(20), color: canBuy ? '#6f2a82' : '#8a7a8a',
      }).setOrigin(0.5, 0));
      this.modalLayer.add(this.add.text(pos.x, pos.y + 56 * L.k, def.name, {
        fontFamily: 'monospace', fontSize: L.fs(18), color: '#3f4f60',
      }).setOrigin(0.5, 0));
      this.modalLayer.add(this.add.text(pos.x, pos.y + 86 * L.k, def.dI, {
        fontFamily: 'monospace', fontSize: L.fs(16), color: '#5a7a4a',
      }).setOrigin(0.5, 0));
      this.modalLayer.add(this.add.text(pos.x, pos.y + 116 * L.k, def.dS, {
        fontFamily: 'monospace', fontSize: L.fs(16), color: '#4a6f7a',
      }).setOrigin(0.5, 0));
      this.modalLayer.add(this.add.text(pos.x, pos.y + 146 * L.k, (def.str || 0) + '⚔️', {
        fontFamily: 'monospace', fontSize: L.fs(16), color: '#a05a5a',
      }).setOrigin(0.5, 0));

      if (canBuy) {
        const buy = this.add.text(pos.x, pos.y + 186 * L.k, '[ buy ]', {
          fontFamily: 'monospace',
          fontSize: L.fs(20),
          color: '#d7f0d7',
          backgroundColor: '#275a32',
          padding: { x: 12, y: 6 },
        }).setOrigin(0.5, 0);
        buy.setInteractive({ useHandCursor: true });
        buy.on('pointerover', () => buy.setStyle({ backgroundColor: '#357542' }));
        buy.on('pointerout', () => buy.setStyle({ backgroundColor: '#275a32' }));
        buy.on('pointerdown', (ptr) => {
          ptr.event.stopPropagation();
          this.animateBuyTransition(i, m);
        });
        this.modalLayer.add(buy);
      }
    });

    if (canBuyNow) {
      const nextBtn = this.add.text(L.W - 20 * L.k, L.Y_NAV, 'Next round →', {
        fontFamily: 'monospace',
        fontSize: L.fs(24),
        color: '#f0e8d0',
        backgroundColor: '#4a3a24',
        padding: { x: 32, y: 16 },
      }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setDepth(50);
      nextBtn.on('pointerover', () => nextBtn.setStyle({ backgroundColor: '#5f4a2c' }));
      nextBtn.on('pointerout', () => nextBtn.setStyle({ backgroundColor: '#4a3a24' }));
      nextBtn.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        this.animateNextRoundTransition(m);
      });
      this.modalLayer.add(nextBtn);
    }
  }

  animateNextRoundTransition(modal) {
    if (G.shopAnimating || G.phase !== 'shopping' || G.busy) return;
    const L = this.L;
    const oldShop = [...G.shop];
    if (oldShop.length === 0) {
      const game = this.scene.get('game');
      game.prepareNextRound();
      this.scene.stop();
      return;
    }

    G.shop.shift();
    G.shop.push(randomShopType(G.round + 1));

    const game = this.scene.get('game');
    game.prepareNextRound();
    this.scene.stop();
  }

  animateBuyTransition(shopIdx, modal) {
    if (G.shopAnimating || G.phase !== 'shopping' || G.busy) return;
    const L = this.L;
    const game = this.scene.get('game');
    const oldShop = [...G.shop];
    const oldN = oldShop.length;
    if (shopIdx < 0 || shopIdx >= oldN) return;

    const type = oldShop[shopIdx];
    const cost = TYPES[type].cost;
    if (G.enthusiasm < cost) return;

    G.shopAnimating = true;

    const firstPos = this.shopPos(0, oldN, modal);
    const lastPos = this.shopPos(oldN - 1, oldN, modal);
    const rowMask = this.add.graphics().setDepth(70);
    rowMask.fillStyle(0xe0d4b1, 1);
    const maskTop = firstPos.y - 120 * L.k;
    const maskBot = lastPos.y + 240 * L.k;
    rowMask.fillRect(modal.x + 16 * L.k, maskTop, modal.w - 32 * L.k, maskBot - maskTop);
    this.modalLayer.add(rowMask);

    const dur = 340;
    const newN = oldN;
    const ghosts = [];
    oldShop.forEach((t, i) => {
      const p = this.shopPos(i, oldN, modal);
      const spr = this.add.sprite(p.x, p.y, 'pirates', TYPES[t].frame)
        .setScale(L.SC).setDepth(80);
      this.modalLayer.add(spr);
      ghosts.push(spr);
    });

    game.buyPirate(shopIdx, { deferRender: true, silent: true, ignoreAnimating: true });

    const removed = ghosts[shopIdx];
    this.tweens.add({
      targets: removed,
      y: removed.y - 100 * L.k,
      alpha: 0,
      duration: dur,
      ease: 'Power2',
    });

    let ni = 0;
    for (let i = 0; i < oldN; i++) {
      if (i === shopIdx) continue;
      const tp = this.shopPos(ni, newN, modal);
      this.tweens.add({
        targets: ghosts[i],
        x: tp.x,
        y: tp.y,
        duration: dur,
        ease: 'Power2',
      });
      ni++;
    }

    const newType = G.shop[newN - 1];
    const lastNewPos = this.shopPos(newN - 1, newN, modal);
    const newGhost = this.add.sprite(modal.x + modal.w + 90 * L.k, lastNewPos.y, 'pirates', TYPES[newType].frame)
      .setScale(L.SC).setDepth(80);
    this.modalLayer.add(newGhost);
    this.tweens.add({
      targets: newGhost,
      x: lastNewPos.x,
      duration: dur,
      ease: 'Power2',
      delay: 30,
    });

    this.time.delayedCall(dur + 100, () => {
      ghosts.forEach(g => g.destroy());
      newGhost.destroy();
      rowMask.destroy();
      G.shopAnimating = false;
      game.float(game.L.cx, game.L.Y_ISL_CY - 40 * game.L.k, '+ ' + TYPES[type].name + '!', '#66bb6a');
      game.renderAll();
      this.renderModal();
    });
  }
}
