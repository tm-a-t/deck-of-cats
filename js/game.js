// ============================================================
//  PIRATE DECK-BUILDER — Phaser 3 Game
// ============================================================

const W = 800, H = 600;
const SPRITE_W = 8, SPRITE_H = 8;
const SPRITE_COLS = 6;
const SCALE = 7;
const DISP = SPRITE_W * SCALE; // 56px display size

// -------------------- Pirate Definitions --------------------
const PIRATE_DEFS = {
    woodcutter: {
        name: 'Дровосек',
        frame: 0,
        canGoToIsland: true,
        island: { resource: 'wood', amount: 1, chance: 0.8 },
        ship: { consume: 'wood', consumeAmt: 1, produce: 'cunning', produceAmt: 2 },
        shopCost: 2,
        descIsland: '1 дерево (80%)',
        descShip: 'дерево → 2 ков.',
    },
    miner: {
        name: 'Шахтёр',
        frame: 1,
        canGoToIsland: true,
        island: { resource: 'stone', amount: 1, chance: 0.8 },
        ship: { consume: 'stone', consumeAmt: 1, produce: 'cunning', produceAmt: 2 },
        shopCost: 2,
        descIsland: '1 камень (80%)',
        descShip: 'камень → 2 ков.',
    },
    adventurer: {
        name: 'Искатель',
        frame: 2,
        canGoToIsland: true,
        island: { resource: 'gold', amount: 3, chance: 0.5 },
        ship: { consume: 'gold', consumeAmt: 1, produce: 'cunning', produceAmt: 2 },
        shopCost: 3,
        descIsland: '3 золота (50%)',
        descShip: 'золото → 2 ков.',
    },
    slacker: {
        name: 'Лентяй',
        frame: 3,
        canGoToIsland: false,
        island: null,
        ship: { consume: null, consumeAmt: 0, produce: 'cunning', produceAmt: 1 },
        shopCost: 0,
        descIsland: '—',
        descShip: '+1 ков.',
    },
    masterWoodcutter: {
        name: 'Мастер-дровосек',
        frame: 6,
        canGoToIsland: true,
        island: { resource: 'wood', amount: 2, chance: 0.8 },
        ship: { consume: 'wood', consumeAmt: 2, produce: 'cunning', produceAmt: 4 },
        shopCost: 5,
        descIsland: '2 дерева (80%)',
        descShip: '2 дер. → 4 ков.',
    },
    masterMiner: {
        name: 'Мастер-шахтёр',
        frame: 7,
        canGoToIsland: true,
        island: { resource: 'stone', amount: 2, chance: 0.8 },
        ship: { consume: 'stone', consumeAmt: 2, produce: 'cunning', produceAmt: 4 },
        shopCost: 5,
        descIsland: '2 камня (80%)',
        descShip: '2 кам. → 4 ков.',
    },
    masterAdventurer: {
        name: 'Мастер-искатель',
        frame: 8,
        canGoToIsland: true,
        island: { resource: 'gold', amount: 5, chance: 0.5 },
        ship: { consume: 'gold', consumeAmt: 2, produce: 'cunning', produceAmt: 4 },
        shopCost: 7,
        descIsland: '5 золота (50%)',
        descShip: '2 зол. → 4 ков.',
    },
    guard: {
        name: 'Стражник',
        frame: 9,
        canGoToIsland: false,
        island: null,
        ship: { consume: null, consumeAmt: 0, produce: 'cunning', produceAmt: 3 },
        shopCost: 4,
        descIsland: '—',
        descShip: '+3 ков.',
    },
    carpenter: {
        name: 'Плотник',
        frame: 12,
        canGoToIsland: true,
        island: { resource: 'wood', amount: 1, chance: 0.9 },
        ship: { consume: 'wood', consumeAmt: 2, produce: 'gold', produceAmt: 1 },
        shopCost: 3,
        descIsland: '1 дерево (90%)',
        descShip: '2 дер. → 1 зол.',
    },
    blacksmith: {
        name: 'Кузнец',
        frame: 13,
        canGoToIsland: true,
        island: { resource: 'stone', amount: 1, chance: 0.9 },
        ship: { consume: 'stone', consumeAmt: 2, produce: 'gold', produceAmt: 1 },
        shopCost: 3,
        descIsland: '1 камень (90%)',
        descShip: '2 кам. → 1 зол.',
    },
};

const ISLAND_TYPES = [
    { name: 'Лесной остров',    color: 0x4a7c3f, bonus: 'wood',  label: 'x2 дерево' },
    { name: 'Скалистый остров',  color: 0x8c8c8c, bonus: 'stone', label: 'x2 камень' },
    { name: 'Остров сокровищ',   color: 0xd4a437, bonus: 'gold',  label: 'x2 золото' },
];

const RESOURCE_COLORS = {
    wood:    '#8B5E3C',
    stone:   '#AAAAAA',
    gold:    '#FFD700',
    cunning: '#CC44CC',
    map:     '#DEC78B',
};

const RESOURCE_NAMES = {
    wood: 'дерево',
    stone: 'камень',
    gold: 'золото',
    cunning: 'коварство',
    map: 'карта',
};

const SHOP_POOL = [
    'woodcutter', 'miner', 'adventurer',
    'masterWoodcutter', 'masterMiner', 'masterAdventurer',
    'guard', 'carpenter', 'blacksmith',
];

// -------------------- Global Game State --------------------
const GS = {
    deck: [],
    discard: [],
    hand: [],
    resources: { wood: 0, stone: 0, gold: 0 },
    treasureMaps: 0,
    cunning: 0,
    round: 0,
};

// -------------------- Utilities --------------------
let _uid = 0;
function uid() { return ++_uid; }

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function makeCard(type) {
    return { type, id: uid() };
}

function createStartingDeck() {
    const cards = [];
    for (let i = 0; i < 2; i++) cards.push(makeCard('woodcutter'));
    for (let i = 0; i < 2; i++) cards.push(makeCard('miner'));
    for (let i = 0; i < 3; i++) cards.push(makeCard('adventurer'));
    for (let i = 0; i < 3; i++) cards.push(makeCard('slacker'));
    return shuffle(cards);
}

function drawHand() {
    GS.hand = [];
    for (let i = 0; i < 5; i++) {
        if (GS.deck.length === 0) {
            GS.deck = shuffle(GS.discard.splice(0));
        }
        if (GS.deck.length > 0) {
            GS.hand.push(GS.deck.pop());
        }
    }
}

function defOf(card) {
    return PIRATE_DEFS[card.type];
}

const FONT = '"Press Start 2P", Courier, monospace';
function fontStyle(size, color) {
    return { fontFamily: FONT, fontSize: size + 'px', color: color || '#ffffff', align: 'center' };
}

// ============================================================
//  BOOT SCENE
// ============================================================
class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    preload() {
        this.load.spritesheet('pirates', 'assets/pirates.png', {
            frameWidth: SPRITE_W,
            frameHeight: SPRITE_H,
        });
    }

    create() {
        this.scene.start('Title');
    }
}

// ============================================================
//  TITLE SCENE
// ============================================================
class TitleScene extends Phaser.Scene {
    constructor() { super('Title'); }

    create() {
        this.cameras.main.setBackgroundColor('#0a1628');

        this.add.text(W / 2, 140, 'ПИРАТСКИЙ\nДЕКБИЛДЕР', fontStyle(20, '#FFD700'))
            .setOrigin(0.5).setLineSpacing(12);

        this.add.text(W / 2, 260, 'Собирай команду.\nГрабь острова.\nНаращивай коварство.', fontStyle(8, '#88AACC'))
            .setOrigin(0.5).setLineSpacing(8);

        // show some pirate sprites as decoration
        for (let i = 0; i < 6; i++) {
            this.add.sprite(200 + i * 80, 350, 'pirates', i)
                .setScale(SCALE).setOrigin(0.5);
        }

        const btn = this.add.text(W / 2, 470, '[ НАЧАТЬ ИГРУ ]', fontStyle(12, '#FFFFFF'))
            .setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => btn.setColor('#FFD700'));
        btn.on('pointerout', () => btn.setColor('#FFFFFF'));
        btn.on('pointerdown', () => {
            GS.deck = createStartingDeck();
            GS.discard = [];
            GS.resources = { wood: 0, stone: 0, gold: 0 };
            GS.treasureMaps = 0;
            GS.cunning = 0;
            GS.round = 0;
            this.scene.start('Game');
        });
    }
}

// ============================================================
//  GAME SCENE — main round of play
// ============================================================
class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
        this.cameras.main.setBackgroundColor('#0f2744');
        this.phase = 'SELECT';
        this.selectedForIsland = new Set();
        this.pirateSlots = [];
        this.resultTexts = [];

        GS.round++;
        GS.cunning = 0;
        drawHand();

        this.island = Phaser.Utils.Array.GetRandom(ISLAND_TYPES);

        this.drawBackground();
        this.drawIsland();
        this.drawShip();
        this.createResourceBar();
        this.createPirateSlots();
        this.createUI();
    }

    // ---------- Drawing ----------

    drawBackground() {
        const g = this.add.graphics();
        // water gradient
        for (let y = 0; y < H; y++) {
            const t = y / H;
            const r = Math.floor(15 + t * 10);
            const gr = Math.floor(39 + t * 20);
            const b = Math.floor(68 + t * 40);
            g.fillStyle(Phaser.Display.Color.GetColor(r, gr, b));
            g.fillRect(0, y, W, 1);
        }
        // gentle wave lines
        g.lineStyle(1, 0x1a5080, 0.3);
        for (let wy = 100; wy < H; wy += 40) {
            g.beginPath();
            for (let x = 0; x <= W; x += 4) {
                const yy = wy + Math.sin(x * 0.02 + wy) * 4;
                if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
            }
            g.strokePath();
        }
    }

    drawIsland() {
        const g = this.add.graphics();
        const cx = W / 2, cy = 240, rx = 220, ry = 140;
        // island body
        g.fillStyle(this.island.color, 1);
        g.beginPath();
        g.moveTo(cx - rx, cy);
        for (let a = Math.PI; a >= 0; a -= 0.05) {
            g.lineTo(cx + Math.cos(a) * rx, cy - Math.sin(a) * ry);
        }
        g.lineTo(cx + rx, cy);
        g.closePath();
        g.fillPath();

        // beach edge
        g.fillStyle(0xf0d080, 0.4);
        g.beginPath();
        g.moveTo(cx - rx, cy);
        for (let a = Math.PI; a >= 0; a -= 0.05) {
            g.lineTo(cx + Math.cos(a) * rx, cy - Math.sin(a) * (ry * 0.15));
        }
        g.lineTo(cx + rx, cy);
        g.closePath();
        g.fillPath();

        // island label
        this.add.text(W / 2, 18, `Раунд ${GS.round}  —  ${this.island.name}`, fontStyle(9, '#FFFFFF'))
            .setOrigin(0.5);
        this.add.text(W / 2, 38, this.island.label, fontStyle(8, '#FFD700'))
            .setOrigin(0.5);
    }

    drawShip() {
        const g = this.add.graphics();
        const sy = 410;
        // hull
        g.fillStyle(0x5c3a1e, 1);
        g.beginPath();
        g.moveTo(60, sy);
        g.lineTo(740, sy);
        g.lineTo(700, H);
        g.lineTo(100, H);
        g.closePath();
        g.fillPath();
        // deck
        g.fillStyle(0x8b5e3c, 1);
        g.fillRect(80, sy, 640, 12);
        // railing
        g.lineStyle(2, 0x6b4226);
        g.strokeRect(80, sy, 640, 12);
        // planks
        g.lineStyle(1, 0x4a2a10, 0.3);
        for (let py = sy + 30; py < H; py += 20) {
            g.lineTo(80, py);
            g.moveTo(80, py);
            g.lineTo(720, py);
        }
    }

    createResourceBar() {
        const y = 270;
        const items = [
            { key: 'wood',  label: 'Дерево', color: RESOURCE_COLORS.wood },
            { key: 'stone', label: 'Камень', color: RESOURCE_COLORS.stone },
            { key: 'gold',  label: 'Золото', color: RESOURCE_COLORS.gold },
            { key: 'map',   label: 'Карты',  color: RESOURCE_COLORS.map },
            { key: 'cunning', label: 'Ков.',  color: RESOURCE_COLORS.cunning },
        ];

        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.5);
        bg.fillRoundedRect(40, y - 4, W - 80, 22, 4);

        this.resTexts = {};
        const startX = 70;
        const spacing = 145;
        items.forEach((item, i) => {
            const x = startX + i * spacing;
            this.add.text(x, y, item.label + ':', fontStyle(7, item.color)).setOrigin(0, 0);
            const val = item.key === 'map' ? GS.treasureMaps
                      : item.key === 'cunning' ? GS.cunning
                      : GS.resources[item.key];
            this.resTexts[item.key] = this.add.text(x + 65, y, '' + val, fontStyle(7, '#FFFFFF')).setOrigin(0, 0);
        });
    }

    updateResources() {
        this.resTexts.wood.setText('' + GS.resources.wood);
        this.resTexts.stone.setText('' + GS.resources.stone);
        this.resTexts.gold.setText('' + GS.resources.gold);
        this.resTexts.map.setText('' + GS.treasureMaps);
        this.resTexts.cunning.setText('' + GS.cunning);
    }

    // ---------- Pirate Display ----------

    createPirateSlots() {
        this.pirateSlots = [];
        const positions = [160, 280, 400, 520, 640];
        const baseY = 480;

        GS.hand.forEach((card, i) => {
            const def = defOf(card);
            const x = positions[i];

            const sprite = this.add.sprite(0, 0, 'pirates', def.frame)
                .setScale(SCALE).setOrigin(0.5);

            const nameTxt = this.add.text(0, DISP / 2 + 6, def.name, fontStyle(6, '#FFFFFF'))
                .setOrigin(0.5, 0);

            const islandDesc = this.add.text(0, DISP / 2 + 20, '🏝 ' + def.descIsland, fontStyle(5, '#88CC88'))
                .setOrigin(0.5, 0);

            const shipDesc = this.add.text(0, DISP / 2 + 32, '⚓ ' + def.descShip, fontStyle(5, '#88AACC'))
                .setOrigin(0.5, 0);

            const highlight = this.add.graphics();

            const container = this.add.container(x, baseY, [highlight, sprite, nameTxt, islandDesc, shipDesc]);

            const slot = {
                card, def, sprite, nameTxt, container, highlight,
                islandDesc, shipDesc,
                baseX: x, baseY, onIsland: false, index: i,
            };

            this.drawSlotHighlight(slot, false);

            // interaction
            sprite.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-4, -4, SPRITE_W + 8, SPRITE_H + 8), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
            sprite.on('pointerdown', () => this.onPirateClick(slot));
            sprite.on('pointerover', () => {
                if (this.phase === 'SELECT' && def.canGoToIsland && !slot.onIsland && this.selectedForIsland.size < 3) {
                    sprite.setTint(0xccffcc);
                } else if (this.phase === 'SELECT' && slot.onIsland) {
                    sprite.setTint(0xffcccc);
                }
            });
            sprite.on('pointerout', () => {
                sprite.clearTint();
                if (!def.canGoToIsland) sprite.setTint(0x888888);
            });

            if (!def.canGoToIsland) {
                sprite.setTint(0x888888);
            }

            this.pirateSlots.push(slot);
        });
    }

    drawSlotHighlight(slot, selected) {
        const hl = slot.highlight;
        hl.clear();
        if (selected) {
            hl.lineStyle(2, 0x44ff44);
            hl.strokeRoundedRect(-DISP / 2 - 4, -DISP / 2 - 4, DISP + 8, DISP + 8, 4);
        }
    }

    onPirateClick(slot) {
        if (this.phase !== 'SELECT') return;
        const def = slot.def;

        if (slot.onIsland) {
            // deselect
            slot.onIsland = false;
            this.selectedForIsland.delete(slot.index);
            this.drawSlotHighlight(slot, false);
            this.tweens.add({
                targets: slot.container,
                y: slot.baseY,
                duration: 300,
                ease: 'Back.easeOut',
            });
            this.updateSendCount();
            return;
        }

        if (!def.canGoToIsland) {
            this.showFloating(slot.container.x, slot.container.y - 50, 'Не может на остров!', '#ff6666');
            return;
        }

        if (this.selectedForIsland.size >= 3) {
            this.showFloating(W / 2, 300, 'Максимум 3 на острове!', '#ff6666');
            return;
        }

        slot.onIsland = true;
        this.selectedForIsland.add(slot.index);
        this.drawSlotHighlight(slot, true);
        this.tweens.add({
            targets: slot.container,
            y: slot.baseY - 50,
            duration: 300,
            ease: 'Back.easeOut',
        });
        this.updateSendCount();
    }

    updateSendCount() {
        if (this.sendCountText) {
            this.sendCountText.setText(`На остров: ${this.selectedForIsland.size}/3`);
        }
    }

    showFloating(x, y, text, color) {
        const t = this.add.text(x, y, text, fontStyle(7, color)).setOrigin(0.5).setDepth(100);
        this.tweens.add({
            targets: t, y: y - 30, alpha: 0, duration: 1200, ease: 'Cubic.easeOut',
            onComplete: () => t.destroy(),
        });
        this.resultTexts.push(t);
    }

    // ---------- UI ----------

    createUI() {
        this.sendCountText = this.add.text(W / 2, 300, 'На остров: 0/3', fontStyle(8, '#CCDDEE'))
            .setOrigin(0.5);

        this.add.text(W / 2, 320, 'Нажимай на пиратов, чтобы отправить на остров', fontStyle(6, '#667788'))
            .setOrigin(0.5);

        this.goBtn = this.add.text(W / 2, 565, '[ В ПУТЬ! ]', fontStyle(12, '#FFFFFF'))
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(50);

        this.goBtn.on('pointerover', () => this.goBtn.setColor('#44FF44'));
        this.goBtn.on('pointerout', () => this.goBtn.setColor('#FFFFFF'));
        this.goBtn.on('pointerdown', () => this.onExecute());
    }

    // ---------- Execution ----------

    onExecute() {
        if (this.phase !== 'SELECT') return;
        this.phase = 'RESOLVE';
        this.goBtn.setVisible(false);
        if (this.sendCountText) this.sendCountText.setVisible(false);

        // animate selected pirates to island
        const islandSlots = this.pirateSlots.filter(s => s.onIsland);
        const shipSlots = this.pirateSlots.filter(s => !s.onIsland);
        const islandXs = [300, 400, 500];

        const promises = [];

        islandSlots.forEach((slot, i) => {
            const targetX = islandXs[i] || (300 + i * 100);
            const targetY = 170;
            promises.push(new Promise(resolve => {
                this.tweens.add({
                    targets: slot.container,
                    x: targetX, y: targetY,
                    duration: 600,
                    ease: 'Cubic.easeInOut',
                    onComplete: resolve,
                });
            }));
        });

        Promise.all(promises).then(() => {
            this.time.delayedCall(300, () => this.resolveIslandActions(islandSlots, shipSlots));
        });
    }

    resolveIslandActions(islandSlots, shipSlots) {
        let delay = 0;
        const results = [];

        islandSlots.forEach((slot) => {
            delay += 600;
            this.time.delayedCall(delay, () => {
                const result = this.rollIslandAction(slot);
                results.push(result);
                this.showActionResult(slot.container.x, slot.container.y - 40, result);
                this.updateResources();
            });
        });

        delay += 800;
        this.time.delayedCall(delay, () => this.resolveShipActions(shipSlots));
    }

    rollIslandAction(slot) {
        const def = slot.def;
        const action = def.island;
        if (!action) return { text: '—', color: '#888888' };

        // treasure map bonus for adventurers
        let chance = action.chance;
        if (action.resource === 'gold' && GS.treasureMaps > 0) {
            const bonus = Math.min(GS.treasureMaps, 3) * 0.15;
            chance = Math.min(chance + bonus, 0.95);
            GS.treasureMaps = Math.max(0, GS.treasureMaps - 1);
        }

        // island multiplier
        let multiplier = 1;
        if (this.island.bonus === action.resource) multiplier = 2;

        const roll = Math.random();
        if (roll < chance) {
            // success
            const gained = action.amount * multiplier;
            GS.resources[action.resource] += gained;
            const rname = RESOURCE_NAMES[action.resource];
            return { text: `+${gained} ${rname}`, color: RESOURCE_COLORS[action.resource] };
        } else {
            // failure — consolation
            if (Math.random() < 0.01) {
                GS.treasureMaps++;
                return { text: '+1 карта сокровищ!', color: RESOURCE_COLORS.map };
            }
            // random other resource
            const others = ['wood', 'stone', 'gold'].filter(r => r !== action.resource);
            const pick = others[Math.floor(Math.random() * others.length)];
            GS.resources[pick] += 1;
            return { text: `Неудача! +1 ${RESOURCE_NAMES[pick]}`, color: '#CC8844' };
        }
    }

    resolveShipActions(shipSlots) {
        let delay = 0;

        shipSlots.forEach((slot) => {
            delay += 600;
            this.time.delayedCall(delay, () => {
                const result = this.doShipAction(slot);
                this.showActionResult(slot.container.x, slot.container.y - 50, result);
                this.updateResources();
            });
        });

        delay += 1000;
        this.time.delayedCall(delay, () => this.showRoundEnd());
    }

    doShipAction(slot) {
        const def = slot.def;
        const action = def.ship;
        if (!action) return { text: '—', color: '#888888' };

        if (action.consume) {
            if (GS.resources[action.consume] >= action.consumeAmt) {
                GS.resources[action.consume] -= action.consumeAmt;
                if (action.produce === 'cunning') {
                    GS.cunning += action.produceAmt;
                } else {
                    GS.resources[action.produce] += action.produceAmt;
                }
                const cname = RESOURCE_NAMES[action.consume];
                const pname = RESOURCE_NAMES[action.produce];
                return { text: `-${action.consumeAmt} ${cname} → +${action.produceAmt} ${pname}`, color: RESOURCE_COLORS[action.produce] };
            } else {
                return { text: `Нет ${RESOURCE_NAMES[action.consume]}!`, color: '#666666' };
            }
        } else {
            // no consume — just produce
            if (action.produce === 'cunning') {
                GS.cunning += action.produceAmt;
            } else {
                GS.resources[action.produce] += action.produceAmt;
            }
            const pname = RESOURCE_NAMES[action.produce];
            return { text: `+${action.produceAmt} ${pname}`, color: RESOURCE_COLORS[action.produce] };
        }
    }

    showActionResult(x, y, result) {
        this.showFloating(x, y, result.text, result.color);
    }

    showRoundEnd() {
        // darken overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(0, 0, W, H);
        overlay.setDepth(80);

        this.add.text(W / 2, 180, 'Итоги раунда', fontStyle(14, '#FFD700'))
            .setOrigin(0.5).setDepth(90);

        const summary = [
            `Дерево: ${GS.resources.wood}`,
            `Камень: ${GS.resources.stone}`,
            `Золото: ${GS.resources.gold}`,
            `Карты: ${GS.treasureMaps}`,
            `Коварство: ${GS.cunning}`,
        ].join('   ');

        this.add.text(W / 2, 240, summary, fontStyle(7, '#CCDDEE'))
            .setOrigin(0.5).setDepth(90);

        this.add.text(W / 2, 290, `Колода: ${GS.deck.length + GS.discard.length + GS.hand.length} пиратов`, fontStyle(7, '#88AACC'))
            .setOrigin(0.5).setDepth(90);

        const shopBtn = this.add.text(W / 2, 380, '[ МАГАЗИН ]', fontStyle(14, '#FFFFFF'))
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(90);
        shopBtn.on('pointerover', () => shopBtn.setColor('#FFD700'));
        shopBtn.on('pointerout', () => shopBtn.setColor('#FFFFFF'));
        shopBtn.on('pointerdown', () => {
            // move hand to discard
            GS.discard.push(...GS.hand);
            GS.hand = [];
            this.scene.start('Shop');
        });

        const skipBtn = this.add.text(W / 2, 440, '[ ПРОПУСТИТЬ → ]', fontStyle(10, '#888888'))
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(90);
        skipBtn.on('pointerover', () => skipBtn.setColor('#CCCCCC'));
        skipBtn.on('pointerout', () => skipBtn.setColor('#888888'));
        skipBtn.on('pointerdown', () => {
            GS.discard.push(...GS.hand);
            GS.hand = [];
            GS.cunning = 0;
            this.scene.start('Game');
        });
    }
}

// ============================================================
//  SHOP SCENE
// ============================================================
class ShopScene extends Phaser.Scene {
    constructor() { super('Shop'); }

    create() {
        this.cameras.main.setBackgroundColor('#0a1628');

        this.add.text(W / 2, 30, 'ТАВЕРНА', fontStyle(16, '#FFD700')).setOrigin(0.5);
        this.add.text(W / 2, 56, 'Нанимай пиратов в команду', fontStyle(7, '#88AACC')).setOrigin(0.5);

        // cunning display
        this.cunningText = this.add.text(W / 2, 82, `Коварство: ${GS.cunning}`, fontStyle(9, '#CC44CC')).setOrigin(0.5);

        // pick 4 random shop pirates
        const available = shuffle([...SHOP_POOL]).slice(0, 4);
        this.shopItems = [];

        available.forEach((type, i) => {
            this.createShopCard(type, i);
        });

        // next round button
        const nextBtn = this.add.text(W / 2, 540, '[ СЛЕДУЮЩИЙ РАУНД → ]', fontStyle(11, '#FFFFFF'))
            .setOrigin(0.5).setInteractive({ useHandCursor: true });
        nextBtn.on('pointerover', () => nextBtn.setColor('#44FF44'));
        nextBtn.on('pointerout', () => nextBtn.setColor('#FFFFFF'));
        nextBtn.on('pointerdown', () => {
            GS.cunning = 0;
            this.scene.start('Game');
        });
    }

    createShopCard(type, index) {
        const def = PIRATE_DEFS[type];
        const x = 120 + index * 170;
        const y = 260;

        // card bg
        const bg = this.add.graphics();
        bg.fillStyle(0x1a2a4a, 1);
        bg.fillRoundedRect(x - 70, y - 130, 140, 280, 8);
        bg.lineStyle(2, 0x334466);
        bg.strokeRoundedRect(x - 70, y - 130, 140, 280, 8);

        // sprite
        this.add.sprite(x, y - 70, 'pirates', def.frame)
            .setScale(SCALE).setOrigin(0.5);

        // name
        this.add.text(x, y - 20, def.name, fontStyle(6, '#FFFFFF')).setOrigin(0.5);

        // description
        this.add.text(x, y + 10, '🏝 ' + def.descIsland, fontStyle(5, '#88CC88')).setOrigin(0.5);
        this.add.text(x, y + 28, '⚓ ' + def.descShip, fontStyle(5, '#88AACC')).setOrigin(0.5);

        // cost
        const costColor = GS.cunning >= def.shopCost ? '#FFD700' : '#666666';
        this.add.text(x, y + 60, `Цена: ${def.shopCost} ков.`, fontStyle(6, costColor)).setOrigin(0.5);

        // buy button
        const canBuy = GS.cunning >= def.shopCost;
        const buyBtn = this.add.text(x, y + 90, canBuy ? '[ НАНЯТЬ ]' : '—', fontStyle(7, canBuy ? '#44FF44' : '#444444'))
            .setOrigin(0.5);

        if (canBuy) {
            buyBtn.setInteractive({ useHandCursor: true });
            buyBtn.on('pointerover', () => buyBtn.setColor('#88FF88'));
            buyBtn.on('pointerout', () => buyBtn.setColor('#44FF44'));
            buyBtn.on('pointerdown', () => {
                if (GS.cunning >= def.shopCost) {
                    GS.cunning -= def.shopCost;
                    GS.discard.push(makeCard(type));
                    this.cunningText.setText(`Коварство: ${GS.cunning}`);

                    // flash feedback
                    buyBtn.setText('Нанят!');
                    buyBtn.setColor('#FFD700');
                    buyBtn.removeInteractive();

                    // show total deck size
                    this.showFloating(x, y + 120, `В команде: ${GS.deck.length + GS.discard.length} пиратов`, '#88AACC');

                    // refresh all buy buttons
                    this.time.delayedCall(100, () => this.refreshBuyButtons());
                }
            });
        }

        this.shopItems.push({ type, def, buyBtn, x, y });
    }

    refreshBuyButtons() {
        this.shopItems.forEach(item => {
            if (item.buyBtn.text === 'Нанят!') return;
            const canBuy = GS.cunning >= item.def.shopCost;
            if (!canBuy) {
                item.buyBtn.setText('—');
                item.buyBtn.setColor('#444444');
                item.buyBtn.removeInteractive();
            }
        });
    }

    showFloating(x, y, text, color) {
        const t = this.add.text(x, y, text, fontStyle(5, color)).setOrigin(0.5);
        this.tweens.add({
            targets: t, y: y - 20, alpha: 0, duration: 2000, ease: 'Cubic.easeOut',
            onComplete: () => t.destroy(),
        });
    }
}

// ============================================================
//  PHASER CONFIG
// ============================================================
const config = {
    type: Phaser.AUTO,
    width: W,
    height: H,
    parent: 'game',
    pixelArt: true,
    roundPixels: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, TitleScene, GameScene, ShopScene],
};

const game = new Phaser.Game(config);
