/* ============================================================
   PIRATES — GameScene
   ============================================================ */

class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

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
    if (!G.map && !(G.tutorial && G.tutorial.active)) initState();

    this.ct = {};
    ['top', 'island', 'phase', 'hand', 'btn', 'nav', 'tip', 'fx', 'tutorialHint', 'tutorial', 'gameover'].forEach(k => {
      this.ct[k] = this.add.container(0, 0);
    });
    this.ct.tip.setDepth(100).setVisible(false);
    this.ct.fx.setDepth(50);
    this.ct.tutorialHint.setDepth(170).setVisible(false);
    this.ct.tutorial.setDepth(180).setVisible(false);
    this.ct.gameover.setDepth(200);
    this._sendingToIsland = new Set();
    this._sacrificedIds = new Set();
    this._shipResolvedSet = new Set();
    this._shipQueueTotal = 0;
    this.input.setDraggable([]);
    this._cardHand = new CardHand(this);

    this._tipRect = null;
    this._tipJustOpened = false;
    this._tutorialPopupOpen = false;
    this._tutorialHintTimer = null;
    this._mapPanelOpen = false;
    this._shopPanelOpen = false;
    this.input.on('pointerdown', (ptr) => {
      if (this._tipJustOpened) {
        this._tipJustOpened = false;
        return;
      }
      if (this.ct.tip.visible) {
        if (!this._tipRect || !this._tipRect.contains(ptr.x, ptr.y)) {
          this.ct.tip.setVisible(false);
        }
      }
    });

    this._onResize = () => {
      this.L = computeLayout(this.scale.width, this.scale.height);
      if (!G.shopAnimating) this.renderAll();
    };
    this.scale.on('resize', this._onResize);

    this._onMapModalShutdown = () => {
      this._mapPanelOpen = false;
      this.renderNav();
    };
    this._onShopModalShutdown = () => {
      this._shopPanelOpen = false;
      this.renderNav();
    };
    this.scene.get('map').events.on(Phaser.Scenes.Events.SHUTDOWN, this._onMapModalShutdown);
    this.scene.get('shopModal').events.on(Phaser.Scenes.Events.SHUTDOWN, this._onShopModalShutdown);

    if (window.PokiBridge) {
      window.PokiBridge.markGameReady();
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize);
      this.scene.get('map').events.off(Phaser.Scenes.Events.SHUTDOWN, this._onMapModalShutdown);
      this.scene.get('shopModal').events.off(Phaser.Scenes.Events.SHUTDOWN, this._onShopModalShutdown);
      if (this._cardHand) this._cardHand.destroy();
      if (window.PokiBridge) window.PokiBridge.gameplayStop();
    });

    this.startRound();
    if (!this.isTutorial() && G.phase === 'map') this.enterMapPhase();
  }

  // ──────────── GAME FLOW ────────────

  isTutorial() {
    return !!(G.tutorial && G.tutorial.active);
  }

  tutorialState() {
    if (!this.isTutorial()) return null;
    if (!G.tutorial) G.tutorial = { active: true };
    return G.tutorial;
  }

  tutorialResolveType(type, fallback = 'carpenter') {
    if (type && TYPES[type]) return type;
    if (fallback && TYPES[fallback]) return fallback;
    const keys = Object.keys(TYPES);
    return keys.length ? keys[0] : null;
  }

  tutorialFeaturedRef() {
    const tut = this.tutorialState();
    if (!tut) return 'FEATURED';
    return (tut.featured && tut.featured.cardRef) || 'FEATURED';
  }

  tutorialFeaturedName() {
    const tut = this.tutorialState();
    if (!tut) return 'Featured pirate';
    if (tut.featured && tut.featured.label) return tut.featured.label;
    const type = tut.featured && tut.featured.type;
    if (type && TYPES[type]) return TYPES[type].name;
    return 'Featured pirate';
  }

  isTutorialPopupOpen() {
    return !!this._tutorialPopupOpen;
  }

  tutorialPopupCopy(id) {
    const map = {
      turn1_start: {
        title: 'How to Win',
        body: [
          'Goal: build a stronger deck and win boarding on turn 5.',
          'Right now focus on resources: 🪵 wood and 🪨 stone.',
          'Sent pirates use top effect; ship pirates use bottom effect.',
          'Buying pirates in shop makes future turns stronger.',
          'Send 2 pirates.',
        ],
      },
      turn2_start: {
        title: 'Resource Run',
        body: [
          'Keep collecting resources for the shop.',
          'This turn is great for stone: x2 🪨.',
          'Send 2 pirates.',
        ],
      },
      turn3_shop: {
        title: 'Deck Upgrade',
        body: [
          'Shop is how you get stronger.',
          'Each bought pirate improves your future turns.',
          'Buy the pirate in shop to continue.',
        ],
      },
      turn4_start: {
        title: 'Ship Setup',
        body: [
          'Keep your new pirate on ship this turn.',
          'Send 2 other pirates to island.',
        ],
      },
      turn4_mismatch: {
        title: 'Mismatch Happened',
        body: [
          'Expected 🪵, got 🪙.',
          'No bug: this can happen on any island.',
          'Now use that 🪙 on ship.',
        ],
      },
      turn5_start: {
        title: 'Final Boarding',
        body: [
          'Boarding power = crew ⚔️ + cannons 💣.',
          'If your power is at least enemy power, you win.',
          'Tap Board.',
        ],
      },
    };
    return map[id] || null;
  }

  tutorialPopupSeen(id) {
    const tut = this.tutorialState();
    if (!tut) return false;
    if (!tut.runtime || typeof tut.runtime !== 'object') tut.runtime = {};
    if (!tut.runtime.popupSeen || typeof tut.runtime.popupSeen !== 'object') {
      tut.runtime.popupSeen = {};
    }
    return !!tut.runtime.popupSeen[id];
  }

  markTutorialPopupSeen(id) {
    const tut = this.tutorialState();
    if (!tut) return;
    if (!tut.runtime || typeof tut.runtime !== 'object') tut.runtime = {};
    if (!tut.runtime.popupSeen || typeof tut.runtime.popupSeen !== 'object') {
      tut.runtime.popupSeen = {};
    }
    tut.runtime.popupSeen[id] = true;
  }

  closeTutorialPopup() {
    this._tutorialPopupOpen = false;
    this.ct.tutorial.setVisible(false);
    this.clearCt('tutorial');
  }

  tutorialHintCopy(id) {
    const map = {
      turn3_shop_hint: {
        title: 'Shop = Stronger Deck',
        body: [
          'Buying pirates is your long-term power.',
          'Stronger deck means easier resource turns and fights.',
          'Buy the pirate in shop.',
        ],
        autoHideMs: 8000,
      },
      turn4_mismatch_hint: {
        title: 'Mismatch Happened',
        body: [
          'Expected 🪵, got 🪙.',
          'This is normal on any island.',
          'Now use that 🪙 on ship.',
        ],
        autoHideMs: 8000,
      },
      turn5_boarding_hint: {
        title: 'Final Boarding',
        body: [
          'Power = crew ⚔️ + cannons 💣.',
          'If your power is at least enemy power, you win.',
          'Tap Board.',
        ],
        autoHideMs: 8000,
      },
    };
    return map[id] || null;
  }

  tutorialHintSeen(id) {
    const tut = this.tutorialState();
    if (!tut) return false;
    if (!tut.runtime || typeof tut.runtime !== 'object') tut.runtime = {};
    if (!tut.runtime.hintSeen || typeof tut.runtime.hintSeen !== 'object') {
      tut.runtime.hintSeen = {};
    }
    return !!tut.runtime.hintSeen[id];
  }

  markTutorialHintSeen(id) {
    const tut = this.tutorialState();
    if (!tut) return;
    if (!tut.runtime || typeof tut.runtime !== 'object') tut.runtime = {};
    if (!tut.runtime.hintSeen || typeof tut.runtime.hintSeen !== 'object') {
      tut.runtime.hintSeen = {};
    }
    tut.runtime.hintSeen[id] = true;
  }

  closeTutorialHint() {
    if (this._tutorialHintTimer) {
      this._tutorialHintTimer.remove(false);
      this._tutorialHintTimer = null;
    }
    this.ct.tutorialHint.setVisible(false);
    this.clearCt('tutorialHint');
  }

  showTutorialHint(id) {
    if (!this.isTutorial() || this.tutorialHintSeen(id) || this.isTutorialPopupOpen()) return;
    const copy = this.tutorialHintCopy(id);
    if (!copy) return;

    this.markTutorialHintSeen(id);
    this.closeTutorialHint();
    this.ct.tutorialHint.setVisible(true);

    const L = this.L;
    const w = Math.min(820 * L.k, L.W - 44 * L.k);
    const h = Math.min(230 * L.k, L.H * 0.3);
    const x = L.cx - w / 2;
    const y = 28 * L.k;

    const bg = this.add.graphics();
    bg.fillStyle(0x112336, 0.96);
    bg.fillRoundedRect(x, y, w, h, 16 * L.k);
    bg.lineStyle(3 * L.k, 0x5f91b6, 1);
    bg.strokeRoundedRect(x, y, w, h, 16 * L.k);
    this.addTo('tutorialHint', bg);

    const title = this.add.text(x + 22 * L.k, y + 16 * L.k, copy.title, {
      fontFamily: 'monospace',
      fontSize: L.fs(24),
      color: '#ffe082',
    }).setOrigin(0, 0);
    this.addTo('tutorialHint', title);

    const body = this.add.text(x + 22 * L.k, y + 56 * L.k, copy.body.join('\n'), {
      fontFamily: 'monospace',
      fontSize: L.fs(20),
      color: '#d6e5f3',
      lineSpacing: 10 * L.k,
      wordWrap: { width: w - 84 * L.k },
    }).setOrigin(0, 0);
    this.addTo('tutorialHint', body);

    const close = this.add.text(x + w - 14 * L.k, y + 12 * L.k, '✕', {
      fontFamily: 'monospace',
      fontSize: L.fs(22),
      color: '#8eb3cf',
      backgroundColor: '#112336',
      padding: { x: 6 * L.k, y: 3 * L.k },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on('pointerover', () => close.setStyle({ color: '#c1d8ea' }));
    close.on('pointerout', () => close.setStyle({ color: '#8eb3cf' }));
    close.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      this.closeTutorialHint();
    });
    this.addTo('tutorialHint', close);

    this.ct.tutorialHint.setAlpha(0);
    this.tweens.add({
      targets: this.ct.tutorialHint,
      alpha: 1,
      duration: 140,
      ease: 'Cubic.easeOut',
    });

    const autoHideMs = Math.max(2500, copy.autoHideMs || 7000);
    this._tutorialHintTimer = this.time.delayedCall(autoHideMs, () => {
      this.closeTutorialHint();
    });
  }

  showTutorialPopup(id) {
    if (!this.isTutorial() || this.isTutorialPopupOpen() || this.tutorialPopupSeen(id)) return;
    const copy = this.tutorialPopupCopy(id);
    if (!copy) return;

    this.closeTutorialHint();
    this.markTutorialPopupSeen(id);
    this._tutorialPopupOpen = true;
    this.clearCt('tutorial');
    this.ct.tutorial.setVisible(true);

    const L = this.L;
    const blocker = this.add.rectangle(0, 0, L.W, L.H, 0x000000, 0.48)
      .setOrigin(0, 0)
      .setInteractive();
    blocker.on('pointerdown', (ptr) => ptr.event.stopPropagation());
    this.addTo('tutorial', blocker);

    const w = Math.min(760 * L.k, L.W - 60 * L.k);
    const h = Math.min(520 * L.k, L.H - 120 * L.k);
    const x = L.cx - w / 2;
    const y = L.H * 0.22;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.38);
    shadow.fillRoundedRect(x + 8 * L.k, y + 10 * L.k, w, h, 22 * L.k);
    this.addTo('tutorial', shadow);

    const paper = this.add.graphics();
    paper.fillStyle(0x1a2534, 1);
    paper.fillRoundedRect(x, y, w, h, 22 * L.k);
    paper.lineStyle(4, 0xd6b36d, 1);
    paper.strokeRoundedRect(x, y, w, h, 22 * L.k);
    this.addTo('tutorial', paper);

    const title = this.add.text(L.cx, y + 24 * L.k, copy.title, {
      fontFamily: 'monospace',
      fontSize: L.fs(32),
      color: '#ffd78a',
    }).setOrigin(0.5, 0);
    this.addTo('tutorial', title);

    const body = this.add.text(x + 34 * L.k, y + 94 * L.k, copy.body.join('\n'), {
      fontFamily: 'monospace',
      fontSize: L.fs(22),
      color: '#d8e2ef',
      lineSpacing: 14 * L.k,
      wordWrap: { width: w - 68 * L.k },
    }).setOrigin(0, 0);
    this.addTo('tutorial', body);

    const btn = this.add.text(L.cx, y + h - 72 * L.k, '[ Got it ]', {
      fontFamily: 'monospace',
      fontSize: L.fs(24),
      color: '#d9f1db',
      backgroundColor: '#264f38',
      padding: { x: 24 * L.k, y: 12 * L.k },
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#35714e' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#264f38' }));
    btn.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
      this.closeTutorialPopup();
      this.renderAll();
    });
    this.addTo('tutorial', btn);
  }

  maybeShowTurnStartTutorialPopup(turnNo = this.getTutorialCurrentTurn()) {
    if (!this.isTutorial()) return;
    if (turnNo === 1 && G.phase === 'sending') this.showTutorialPopup('turn1_start');
    if (turnNo === 5 && G.phase === 'boarding') this.showTutorialHint('turn5_boarding_hint');
  }

  getTutorialTurnCount() {
    const tut = this.tutorialState();
    if (!tut || !Array.isArray(tut.turns) || tut.turns.length === 0) return 0;
    return tut.turns.length;
  }

  getTutorialCurrentTurn() {
    const tut = this.tutorialState();
    if (!tut) return 0;
    const total = this.getTutorialTurnCount() || 5;
    const cur = Phaser.Math.Clamp(tut.currentTurn || 1, 1, total);
    tut.currentTurn = cur;
    return cur;
  }

  getTutorialTurn(turnNo = this.getTutorialCurrentTurn()) {
    const tut = this.tutorialState();
    if (!tut || !Array.isArray(tut.turns) || tut.turns.length === 0) return null;
    return tut.turns[turnNo - 1] || null;
  }

  getTutorialHandRefs(turn = this.getTutorialTurn()) {
    if (!turn) return [];
    if (Array.isArray(turn.handRefs)) {
      return turn.handRefs.filter(Boolean);
    }
    if (Array.isArray(turn.hand)) {
      return turn.hand
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          if (entry && typeof entry === 'object' && entry.ref) return entry.ref;
          return null;
        })
        .filter(Boolean);
    }
    return [];
  }

  tutorialRequiredSent(turn = this.getTutorialTurn()) {
    if (!turn) return 2;
    return turn.requiredSent != null ? turn.requiredSent : 2;
  }

  makeTutorialIsland(desc = 'send 2 pirates here') {
    return {
      name: 'Training Cove',
      emoji: '🏝️',
      accent: 0x4b7d42,
      maxSend: 2,
      tutorialDesc: desc,
    };
  }

  buildDefaultTutorialCards(featuredType, featuredRef) {
    const gathererType = this.tutorialResolveType('tutorialForager', 'lumberjack');
    const swabbieType = this.tutorialResolveType('tutorialSwabbie', 'bosun');
    return {
      L1: { type: gathererType },
      L2: { type: gathererType },
      L3: { type: gathererType },
      S1: { type: swabbieType },
      S2: { type: swabbieType },
      S3: { type: swabbieType },
      [featuredRef]: { type: featuredType },
    };
  }

  buildDefaultTutorialTurns(featuredType, featuredRef) {
    const featuredName = (TYPES[featuredType] && TYPES[featuredType].name) || 'Admiral';
    return [
      {
        round: 1,
        phase: 'sending',
        island: this.makeTutorialIsland('send exactly 2 pirates here'),
        handRefs: ['L1', 'L2', 'S1', 'S2', 'S3'],
        shop: [],
        requiredSent: 2,
        hints: {
          sending: 'Send 2 pirates',
          shopping: 'Tap Next turn',
        },
      },
      {
        round: 2,
        phase: 'sending',
        island: this.makeTutorialIsland('send exactly 2 pirates here'),
        handRefs: ['L1', 'L3', 'S1', 'S2', 'S3'],
        shop: [],
        requiredSent: 2,
        hints: {
          sending: 'Send 2 pirates',
          shopping: 'Tap Next turn',
        },
      },
      {
        round: 3,
        phase: 'sending',
        island: this.makeTutorialIsland('send exactly 2 pirates here'),
        handRefs: ['L2', 'L3', 'S1', 'S2', 'S3'],
        shop: [featuredType],
        requiredSent: 2,
        requireFeaturedPurchase: true,
        hints: {
          sending: 'Send 2 pirates',
          shopping: `Buy ${featuredName}`,
        },
      },
      {
        round: 4,
        phase: 'sending',
        island: this.makeTutorialIsland('send exactly 2 pirates here'),
        handRefs: ['L1', 'L3', featuredRef, 'S1', 'S2'],
        shop: [],
        requiredSent: 2,
        blockedIslandRefs: [featuredRef],
        forcedMismatch: { cardRef: 'L3', res: 'gold', n: 1, targetRes: 'wood' },
        hints: {
          sending: `Send 2 pirates; keep ${featuredName} on ship`,
          shopping: 'Tap Next turn',
        },
      },
      {
        round: 5,
        phase: 'boarding',
        handRefs: [featuredRef, 'L1', 'L2', 'L3', 'S1'],
        shop: [],
        enemyShip: { strength: 4 },
        hints: {
          boarding: 'Tap Board',
        },
      },
    ];
  }

  tutorialTypeForRef(ref, turn = null) {
    const tut = this.tutorialState();
    if (!tut) return null;

    if (turn && Array.isArray(turn.hand)) {
      for (const entry of turn.hand) {
        if (entry && typeof entry === 'object' && entry.ref === ref && entry.type) {
          return this.tutorialResolveType(entry.type, 'lumberjack');
        }
      }
    }

    if (turn && turn.cardTypes && turn.cardTypes[ref]) {
      return this.tutorialResolveType(turn.cardTypes[ref], 'lumberjack');
    }

    if (tut.cards && tut.cards[ref] && tut.cards[ref].type) {
      return this.tutorialResolveType(tut.cards[ref].type, 'lumberjack');
    }

    if (ref === this.tutorialFeaturedRef()) {
      const featuredType = tut.featured && tut.featured.type;
      return this.tutorialResolveType(featuredType, 'carpenter');
    }

    return null;
  }

  ensureTutorialPirateByRef(ref, turn = null) {
    const tut = this.tutorialState();
    if (!tut || !ref) return null;
    if (!tut.cardRefs || typeof tut.cardRefs !== 'object') tut.cardRefs = {};

    const featuredRef = this.tutorialFeaturedRef();
    const allowCreateFeatured = !!(turn && turn.allowCreateFeatured);
    if (ref === featuredRef && !allowCreateFeatured && !(tut.featured && tut.featured.bought)) {
      return null;
    }

    const existingId = tut.cardRefs[ref];
    if (existingId != null) {
      const existing = G.allCrew.find(p => p.id === existingId);
      if (existing) return existing;
    }

    const type = this.tutorialTypeForRef(ref, turn);
    if (!type) return null;

    const pirate = mkP(type);
    G.allCrew.push(pirate);
    G.deck.push(pirate);
    tut.cardRefs[ref] = pirate.id;
    return pirate;
  }

  tutorialCardRefByPirateId(pirateId) {
    const tut = this.tutorialState();
    if (!tut || !tut.cardRefs) return null;
    const refs = Object.keys(tut.cardRefs);
    for (const ref of refs) {
      if (tut.cardRefs[ref] === pirateId) return ref;
    }
    return null;
  }

  tutorialBlockedIslandRefs(turn = this.getTutorialTurn(), turnNo = this.getTutorialCurrentTurn()) {
    const out = new Set();
    if (turn && Array.isArray(turn.blockedIslandRefs)) {
      turn.blockedIslandRefs.forEach((ref) => out.add(ref));
    }
    if (turnNo === 4) out.add(this.tutorialFeaturedRef());
    return out;
  }

  isTutorialIslandBlockedPirate(pirate, turn = this.getTutorialTurn(), turnNo = this.getTutorialCurrentTurn()) {
    if (!this.isTutorial() || !pirate) return false;
    const ref = this.tutorialCardRefByPirateId(pirate.id);
    if (!ref) return false;
    return this.tutorialBlockedIslandRefs(turn, turnNo).has(ref);
  }

  tutorialForcedMismatchForPirate(pirate, def, turn = this.getTutorialTurn()) {
    if (!this.isTutorial() || !turn || !turn.forcedMismatch) return null;
    const mismatch = turn.forcedMismatch;
    const ref = this.tutorialCardRefByPirateId(pirate.id);
    if (!ref || ref !== mismatch.cardRef) return null;
    return {
      res: mismatch.res || 'gold',
      n: mismatch.n != null ? mismatch.n : 1,
      targetRes: mismatch.targetRes || (def.island && def.island.res) || null,
    };
  }

  ensureTutorialFlow() {
    const tut = this.tutorialState();
    if (!tut) return;

    if (!tut.featured || typeof tut.featured !== 'object') tut.featured = {};
    tut.featured.type = this.tutorialResolveType(
      tut.featured.type || tut.recommendedType || 'carpenter',
      'carpenter'
    );
    if (!tut.featured.label) {
      tut.featured.label = (TYPES[tut.featured.type] && TYPES[tut.featured.type].name) || 'Admiral';
    }
    if (!tut.featured.cardRef) tut.featured.cardRef = 'FEATURED';
    if (tut.featured.bought == null) tut.featured.bought = !!tut.recommendedBought;

    const featuredRef = this.tutorialFeaturedRef();
    if (!tut.cards || typeof tut.cards !== 'object') {
      tut.cards = this.buildDefaultTutorialCards(tut.featured.type, featuredRef);
    }
    if (!tut.cards[featuredRef]) {
      tut.cards[featuredRef] = { type: tut.featured.type };
    } else {
      tut.cards[featuredRef].type = this.tutorialResolveType(
        tut.cards[featuredRef].type,
        tut.featured.type
      );
    }

    if (!Array.isArray(tut.turns) || tut.turns.length === 0) {
      tut.turns = this.buildDefaultTutorialTurns(tut.featured.type, featuredRef);
    }

    if (!Number.isInteger(tut.currentTurn) || tut.currentTurn < 1) tut.currentTurn = 1;
    tut.currentTurn = Phaser.Math.Clamp(tut.currentTurn, 1, tut.turns.length);

    if (!tut.cardRefs || typeof tut.cardRefs !== 'object') tut.cardRefs = {};
    if (!tut.flowInitialized) {
      G.allCrew = [];
      G.deck = [];
      G.discard = [];
      G.hand = [];
      G.sent = [];
      const refs = new Set();
      Object.keys(tut.cards).forEach((ref) => {
        if (ref !== featuredRef) refs.add(ref);
      });
      tut.turns.forEach((turn) => {
        this.getTutorialHandRefs(turn).forEach((ref) => {
          if (ref && ref !== featuredRef) refs.add(ref);
        });
      });
      refs.forEach((ref) => {
        this.ensureTutorialPirateByRef(ref, { allowCreateFeatured: true });
      });
      tut.flowInitialized = true;
    }

    if (tut.boughtPirateId && !tut.cardRefs[featuredRef]) {
      tut.cardRefs[featuredRef] = tut.boughtPirateId;
    }
    if (tut.cardRefs[featuredRef]) {
      tut.boughtPirateId = tut.cardRefs[featuredRef];
      tut.featured.bought = true;
      tut.featured.boughtPirateId = tut.cardRefs[featuredRef];
    }

    // Legacy sync fields for compatibility with old saves.
    tut.recommendedType = tut.featured.type;
    tut.recommendedBought = !!tut.featured.bought;
  }

  applyTutorialTurn(turnNo, opts = {}) {
    const tut = this.tutorialState();
    if (!tut) return;
    this.ensureTutorialFlow();

    const total = this.getTutorialTurnCount();
    const cur = Phaser.Math.Clamp(turnNo, 1, total);
    tut.currentTurn = cur;
    const turn = this.getTutorialTurn(cur) || {};
    const requiredSent = this.tutorialRequiredSent(turn);

    const refs = this.getTutorialHandRefs(turn);
    const hand = [];
    refs.forEach((ref) => {
      const pirate = this.ensureTutorialPirateByRef(ref, turn);
      if (pirate) hand.push(pirate);
    });
    if (hand.length < 5) {
      const handIds = new Set(hand.map(p => p.id));
      const fallback = G.allCrew.filter(p => !handIds.has(p.id)).slice(0, 5 - hand.length);
      hand.push(...fallback);
    }

    G.round = turn.round || cur;
    G.sent = [];
    G.busy = false;
    G.enthusiasm = turn.startEnthusiasm || 0;
    if (turn.startRes && typeof turn.startRes === 'object') {
      ['wood', 'stone', 'gold', 'map'].forEach((resKey) => {
        if (turn.startRes[resKey] != null) {
          G.res[resKey] = turn.startRes[resKey];
        }
      });
    }
    G.shopAnimating = false;
    this._sendingToIsland.clear();
    this._sacrificedIds.clear();
    this._shipResolvedSet = new Set();
    this._shipQueueTotal = 0;
    this.ct.tip.setVisible(false);
    this.closeTutorialHint();

    if (Array.isArray(turn.shop)) {
      G.shop = turn.shop.map(type => this.tutorialResolveType(type, tut.featured.type));
    } else if (!Array.isArray(G.shop)) {
      G.shop = [];
    }

    G.hand = hand.slice(0, 5);

    const phase = turn.phase || (turn.enemyShip ? 'boarding' : 'sending');
    G.phase = phase;
    if (phase === 'boarding') {
      const strength =
        (turn.enemyShip && turn.enemyShip.strength != null) ? turn.enemyShip.strength :
          (turn.enemyStrength != null ? turn.enemyStrength : Math.max(1, G.hand.reduce((s, p) => s + (TYPES[p.type].str || 0), 0) - 1));
      G.enemyShip = { strength };
      G.island = null;
      G.boardingCount = Math.max(G.boardingCount || 0, 1);
    } else {
      const island = turn.island || this.makeTutorialIsland(`send ${requiredSent} pirates here`);
      G.island = {
        name: island.name || 'Training Cove',
        emoji: island.emoji || '🏝️',
        accent: island.accent != null ? island.accent : 0x4b7d42,
        bonus: island.bonus || null,
        extraSend: island.extraSend || 0,
        maxSend: island.maxSend != null ? island.maxSend : requiredSent,
        bonusEnthusiasm: island.bonusEnthusiasm || 0,
        sacrifice: !!island.sacrifice,
        tutorialDesc: island.tutorialDesc || `send ${requiredSent} pirates here`,
      };
      G.enemyShip = null;
      if (G.island.bonusEnthusiasm) G.enthusiasm += G.island.bonusEnthusiasm;
    }

    this.closePanels(G.phase === 'shopping' ? 'shopModal' : null);

    if (!opts.deferRender) {
      this.renderAll();
      if (G.phase === 'shopping') this.openShopModal();
      this.maybeShowTurnStartTutorialPopup(cur);
    }
  }

  startRound() {
    // G.round, G.phase, G.island, G.enemyShip, G.hand, G.sent, G.enthusiasm
    // are all set by MapScene.selectMapNode() before transitioning here.
    if (window.PokiBridge) {
      window.PokiBridge.gameplayStart();
    }
    if (this.isTutorial()) {
      this.ensureTutorialFlow();
      this.applyTutorialTurn(this.getTutorialCurrentTurn(), { deferRender: true });
    }
    this.renderAll();
    if (this.isTutorial()) this.maybeShowTurnStartTutorialPopup();
  }

  applyMapNodeSelection(nodeId) {
    const map = G.map;
    const node = mapNodeById(map, nodeId);
    if (!node) return false;

    let layerIdx = -1;
    for (let li = 0; li < map.layers.length; li++) {
      if (map.layers[li].some(n => n.id === nodeId)) {
        layerIdx = li;
        break;
      }
    }
    if (layerIdx < 0) return false;

    map.currentNodeId = nodeId;
    map.currentLayer = layerIdx;
    map.visited.push(nodeId);

    G.round++;
    G.sent = [];
    G.enthusiasm = 0;
    G.busy = false;
    this._sendingToIsland.clear();
    this._sacrificedIds.clear();
    this._shipResolvedSet = new Set();
    this._shipQueueTotal = 0;
    this.ct.tip.setVisible(false);

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

    this.closePanels();
    this.renderAll();
    return true;
  }

  enterMapPhase() {
    if (this.isTutorial()) return;
    this.closePanels('map');
    G.phase = 'map';
    G.island = null;
    G.enemyShip = null;
    this.renderAll();

    const available = getAvailableNodes(G.map);
    if (available.length === 1) {
      this.applyMapNodeSelection(available[0]);
      return;
    }
    this.openMapModal();
  }

  panelSceneKeys() {
    return ['map', 'shopModal'];
  }

  closePanels(exceptKey = null) {
    this.panelSceneKeys().forEach((key) => {
      if (exceptKey && key === exceptKey) return;
      if (!this.scene.isActive(key)) return;
      if (key === 'map') this._mapPanelOpen = false;
      if (key === 'shopModal') this._shopPanelOpen = false;
      this.scene.stop(key);
    });
  }

  openMapModal() {
    if (this.isTutorial()) return;
    this.closePanels('map');
    if (this.scene.isActive('map')) return;
    this.scene.launch('map');
    this.scene.bringToTop('map');
    this._mapPanelOpen = true;
    this.renderNav();
  }

  openShopModal() {
    if (this.isTutorialPopupOpen()) return;
    this.closePanels('shopModal');
    if (this.scene.isActive('shopModal')) return;
    this.scene.launch('shopModal');
    this.scene.bringToTop('shopModal');
    this._shopPanelOpen = true;
    this.renderNav();
  }

  toggleMapModal() {
    if (this._mapPanelOpen) {
      this._mapPanelOpen = false;
      this.scene.stop('map');
      this.renderNav();
      return;
    }
    this.openMapModal();
  }

  toggleShopModal() {
    if (this._shopPanelOpen) {
      this._shopPanelOpen = false;
      this.scene.stop('shopModal');
      this.renderNav();
      return;
    }
    this.openShopModal();
  }

  maxSend() {
    if (!G.island) return 0;
    if (G.island.maxSend != null) return G.island.maxSend;
    return 2 + (G.island.extraSend || 0);
  }

  sentOffsetX(si) {
    const m = this.maxSend();
    const sp = this.L && this.L.IS_MOBILE ? 130 : 110;
    return (si - (m - 1) / 2) * sp;
  }

  sendToIsland(idx, fromPos) {
    if (this.isTutorialPopupOpen()) return;
    if (G.phase !== 'sending') return;
    if (G.sent.includes(idx) || G.sent.length >= this.maxSend()) return;

    this.ct.tip.setVisible(false);
    const p = G.hand[idx];
    const def = TYPES[p.type];
    const L = this.L;

    const handPos = this.handPos(idx);
    const msgPos = fromPos || handPos;
    if (this.isTutorial() && this.isTutorialIslandBlockedPirate(p)) {
      this.float(msgPos.x, msgPos.y - 70 * L.k, 'Keep this pirate on ship', '#ffca28');
      return;
    }
    if (!def.canIsland) {
      this.float(msgPos.x, msgPos.y - 70 * L.k, "Can't go!", '#ff8a80');
      return;
    }

    if (def.island.convert) {
      const c = def.island.convert;
      if ((G.res[c.cRes] || 0) < c.cN) {
        this.float(msgPos.x, msgPos.y - 70 * L.k, "Can't go!", '#ff8a80');
        return;
      }
    }

    G.sent.push(idx);
    this._sendingToIsland.add(idx);
    this.renderAll();

    const fromX = fromPos ? fromPos.x : handPos.x;
    const fromY = fromPos ? fromPos.y : handPos.y;
    const toX = L.cx + this.sentOffsetX(G.sent.length - 1) * L.k;
    const toY = L.Y_ISL_CY;

    const { texKey: sendTex } = buildCardTexture(this, p.type, L);
    const ghost = this.add.image(fromX, fromY, sendTex);
    ghost.setOrigin(0.5, 0.5).setDepth(60);
    const cardStartW = Math.round(CARD.W * L.k);
    const cardStartH = Math.round(CARD.H * L.k);
    ghost.setDisplaySize(cardStartW, cardStartH);

    this.tweens.add({
      targets: ghost, x: toX, y: toY,
      displayWidth: cardStartW * 0.5, displayHeight: cardStartH * 0.5,
      rotation: -0.1 + Math.random() * 0.2,
      duration: 350, ease: 'Power2',
      onComplete: () => {
        ghost.destroy();
        this._sendingToIsland.delete(idx);
        const result = this.resolveIsland(p);
        const spendDuration = this.showIslandResult(result, toX);

        const isSacrifice = G.island && G.island.sacrifice;
        if (isSacrifice) {
          this.sacrificePirate(p, toX);
        }

        this.renderAll();

        const baseWait = isSacrifice ? 1400 : (spendDuration !== false ? 1000 : 800);
        const waitMs = baseWait + (spendDuration || 0);
        this.time.delayedCall(waitMs, () => {
          if (G.phase !== 'sending') return;
          if (G.sent.length >= this.maxSend() && this._sendingToIsland.size === 0) {
            this.endSending();
          } else {
            this.renderAll();
          }
        });
      },
    });
  }

  resolveIsland(pirate) {
    const def = TYPES[pirate.type];
    const isl = G.island;
    const tutorialTurn = this.isTutorial() ? this.getTutorialTurn() : null;
    const forcedMismatch = this.tutorialForcedMismatchForPirate(pirate, def, tutorialTurn);
    if (forcedMismatch) {
      G.res[forcedMismatch.res] = (G.res[forcedMismatch.res] || 0) + forcedMismatch.n;
      this.showTutorialHint('turn4_mismatch_hint');
      return { ok: false, res: forcedMismatch.res, n: forcedMismatch.n };
    }

    if (def.island.recall) {
      const currentIdx = G.sent[G.sent.length - 1];
      const candidates = G.sent.filter(idx => idx !== currentIdx);
      const n = Math.min(def.island.recall, candidates.length);
      for (let i = 0; i < n; i++) {
        const recIdx = candidates[candidates.length - 1 - i];
        G.sent = G.sent.filter(idx => idx !== recIdx);
      }
      return { ok: n > 0, recall: n };
    }

    if (def.island.exileSent) {
      const currentIdx = G.sent[G.sent.length - 1];
      const candidates = G.sent.filter(idx => idx !== currentIdx);
      if (candidates.length > 0) {
        const targetIdx = candidates[candidates.length - 1];
        const target = G.hand[targetIdx];
        G.allCrew = G.allCrew.filter(p => p.id !== target.id);
        G.deck = G.deck.filter(p => p.id !== target.id);
        G.discard = G.discard.filter(p => p.id !== target.id);
        this._sacrificedIds.add(target.id);
        return { ok: true, exileSent: true, name: TYPES[target.type].name };
      }
      return { ok: false, exileSent: true };
    }

    if (def.island.draw) {
      const drawn = drawCards(def.island.draw);
      G.hand.push(...drawn);
      return { ok: drawn.length > 0, drawn: drawn.length };
    }

    if (def.island.guaranteed) {
      const g = def.island.guaranteed;
      if (g.weapons) {
        G.weapons += g.weapons;
        return { ok: true, weapons: g.weapons };
      }
      if (g.res === 'enthusiasm') G.enthusiasm += g.amt;
      else G.res[g.res] = (G.res[g.res] || 0) + g.amt;
      return { ok: true, res: g.res, n: g.amt };
    }

    if (def.island.convert) {
      const c = def.island.convert;
      G.res[c.cRes] -= c.cN;
      let amt = c.pN;
      if (isl.bonus === c.pRes) amt *= 2;
      G.res[c.pRes] += amt;
      return { ok: true, convert: true, cRes: c.cRes, cN: c.cN, res: c.pRes, n: amt };
    }

    if (def.island.multi) {
      const items = [];
      for (const m of def.island.multi) {
        let amt = m.amt;
        if (isl.bonus === m.res) amt *= 2;
        G.res[m.res] += amt;
        items.push({ res: m.res, n: amt });
      }
      return { ok: true, items };
    }

    if (this.isTutorial() && this.getTutorialCurrentTurn() <= 4 && def.island.chance != null) {
      let amt = def.island.amt;
      const tgt = def.island.res;
      if (isl.bonus === tgt) amt *= 2;
      const islBonusE = def.island.bonusEnthusiasm || 0;
      if (islBonusE) G.enthusiasm += islBonusE;
      G.res[tgt] += amt;
      return { ok: true, res: tgt, n: amt, bonusEnthusiasm: islBonusE };
    }

    let chance = def.island.chance;
    let amt = def.island.amt;
    const tgt = def.island.res;

    if (tgt === 'gold' && G.res.map > 0) {
      chance = Math.min(chance + 0.30, 0.95);
      G.res.map--;
    }
    if (isl.bonus === tgt) amt *= 2;

    const islBonusE = def.island.bonusEnthusiasm || 0;
    if (islBonusE) G.enthusiasm += islBonusE;

    if (Math.random() < chance) {
      G.res[tgt] += amt;
      return { ok: true, res: tgt, n: amt, bonusEnthusiasm: islBonusE };
    }

    if (Math.random() < 0.01) {
      G.res.map++;
      return { ok: false, res: 'map', n: 1, bonusEnthusiasm: islBonusE };
    }
    const others = ['wood', 'stone', 'gold'].filter(r => r !== tgt);
    const alt = Phaser.Utils.Array.GetRandom(others);
    let altAmt = 1;
    if (isl.bonus === alt) altAmt *= 2;
    G.res[alt] += altAmt;
    return { ok: false, res: alt, n: altAmt, bonusEnthusiasm: islBonusE };
  }

  sacrificePirate(pirate, x) {
    G.allCrew = G.allCrew.filter(p => p.id !== pirate.id);
    G.deck = G.deck.filter(p => p.id !== pirate.id);
    G.discard = G.discard.filter(p => p.id !== pirate.id);
    this._sacrificedIds.add(pirate.id);
    const L = this.L;
    this.time.delayedCall(400, () => {
      this.float(x, L.Y_ISL_CY - 50 * L.k, '💀 Lost!', '#c060ff');
    });
  }

  showIslandResult(r, x) {
    const L = this.L;
    const fy = L.Y_ISL_CY - 80 * L.k;

    if (r.recall !== undefined) {
      if (r.ok) this.effectText(x, fy, '↩ Recalled!', '#80cbc4');
      else this.effectText(x, fy, 'No one to recall', '#ffa726', 400);
      return false;
    }
    if (r.exileSent) {
      if (r.ok) this.effectText(x, fy, '💀 Exiled ' + r.name + '!', '#ff8a80');
      else this.effectText(x, fy, 'No one to exile', '#ffa726', 400);
      return false;
    }
    if (r.drawn !== undefined) {
      if (r.ok) this.effectText(x, fy, '+1 pirate to hand!', '#80cbc4');
      else this.effectText(x, fy, 'Deck empty', '#ffa726', 400);
      return false;
    }

    let gainItems = [];
    let spendDuration = 0;
    if (r.convert) {
      this.effectText(x, fy,
        r.cN + RES_EMOJI[r.cRes] + ' → ' + r.n + RES_EMOJI[r.res], '#66bb6a');
      spendDuration = this.animateResourceSpend(x, L.Y_ISL_CY, [{ emoji: RES_EMOJI[r.cRes], count: r.cN }]);
      gainItems = [{ emoji: RES_EMOJI[r.res], count: r.n }];
    } else if (r.weapons) {
      this.effectText(x, fy, '+' + r.weapons + '🗡️', '#66bb6a');
      gainItems = [{ emoji: '🗡️', count: r.weapons }];
    } else if (r.items) {
      const msg = r.items.map(i => '+' + i.n + RES_EMOJI[i.res]).join(' ');
      this.effectText(x, fy, msg, '#66bb6a');
      gainItems = r.items.map(i => ({ emoji: RES_EMOJI[i.res], count: i.n }));
    } else {
      const em = RES_EMOJI[r.res] || '🗺️';
      const eBonus = r.bonusEnthusiasm ? ' +' + r.bonusEnthusiasm + '☠️' : '';
      gainItems = [{ emoji: em, count: r.n }];
      if (r.bonusEnthusiasm) gainItems.push({ emoji: '☠️', count: r.bonusEnthusiasm });
      if (r.ok) this.effectText(x, fy, '+' + r.n + em + eBonus, '#66bb6a');
      else if (r.res === 'map') this.effectText(x, fy, '+🗺️!' + eBonus, '#ffd54f', 400);
      else this.effectText(x, fy, 'Miss +' + r.n + em + eBonus, '#ffa726', 400);
    }

    if (gainItems.length) {
      if (spendDuration > 0) {
        this.time.delayedCall(spendDuration, () => {
          this.animateResourceGain(x, L.Y_ISL_CY, gainItems);
        });
      } else {
        this.animateResourceGain(x, L.Y_ISL_CY, gainItems);
      }
    }
    return spendDuration;
  }

  endSending() {
    if (this.isTutorialPopupOpen()) return;
    if (G.phase !== 'sending') return;
    if (this._sendingToIsland.size > 0) return;
    if (this.isTutorial()) {
      const requiredSent = this.tutorialRequiredSent(this.getTutorialTurn());
      if (G.sent.length < requiredSent) {
        const L = this.L;
        this.float(L.cx, L.Y_ISL_CY - 40 * L.k, `Send ${requiredSent} pirates to continue`, '#ffa726');
        return;
      }
    }
    G.phase = 'ship';
    G.busy = true;
    this.ct.tip.setVisible(false);
    this._shipResolvedSet = new Set();

    this._shipQueue = [];
    for (let i = 0; i < G.hand.length; i++) {
      if (!G.sent.includes(i)) this._shipQueue.push(i);
    }
    this._shipQueueTotal = this._shipQueue.length;
    this._shipQueuePos = 0;
    this.renderAll();
    this.processNextShip();
  }

  processNextShip() {
    if (this._shipQueuePos >= this._shipQueue.length) {
      this.time.delayedCall(400, () => {
        if (this.isTutorial()) {
          const turn = this.getTutorialTurn();
          if (turn && turn.requireFeaturedPurchase) {
            const featuredType = this.tutorialResolveType(G.tutorial && G.tutorial.featured && G.tutorial.featured.type, 'carpenter');
            const featuredDef = TYPES[featuredType];
            const needed = featuredDef && featuredDef.cost != null ? featuredDef.cost : 0;
            if (G.enthusiasm < needed) G.enthusiasm = needed;
          }
        }
        G.phase = 'shopping';
        G.busy = false;
        this.renderAll();
        this.openShopModal();
        if (this.isTutorial() && this.getTutorialCurrentTurn() === 3) {
          this.showTutorialHint('turn3_shop_hint');
        }
      });
      return;
    }
    const hi = this._shipQueue[this._shipQueuePos];
    this._shipQueuePos++;

    const pirate = G.hand[hi];
    const def = TYPES[pirate.type];
    const L = this.L;

    this._cardHand.highlightShipCard(hi, true);

    const pos = this._cardHand.getCardPosition(hi);
    const x = pos ? pos.x : L.cx;
    const y = pos ? pos.y : L.Y_HAND;

    const resolveAndContinue = (effectDuration) => {
      this.time.delayedCall(effectDuration, () => {
        this._cardHand.hideShipEffectOverlay(hi);
        this._cardHand.highlightShipCard(hi, false);
        this.time.delayedCall(250, () => {
          this._shipResolvedSet.add(hi);
          this.renderAll();
          this.time.delayedCall(150, () => this.processNextShip());
        });
      });
    };

    if (def.ship && def.ship.removeSelf) {
      G.allCrew = G.allCrew.filter(p => p.id !== pirate.id);
      G.deck = G.deck.filter(p => p.id !== pirate.id);
      G.discard = G.discard.filter(p => p.id !== pirate.id);
      this._cardHand.showShipEffectOverlay(hi, '💀 Lost!', '#c060ff');
      resolveAndContinue(600);
      return;
    }

    if (def.ship && def.ship.removeFromDeck) {
      if (def.ship.cRes && (G.res[def.ship.cRes] || 0) < def.ship.cN) {
        this._cardHand.showShipEffectOverlay(hi, '—', '#546e7a');
        resolveAndContinue(500);
        return;
      }
      const handIds = new Set(G.hand.map(p => p.id));
      const targets = G.allCrew.filter(p => !handIds.has(p.id));
      if (targets.length === 0) {
        this._cardHand.showShipEffectOverlay(hi, 'No one to exile', '#ffa726');
        resolveAndContinue(500);
        return;
      }
      if (def.ship.cRes) {
        G.res[def.ship.cRes] -= def.ship.cN;
        this.animateResourceSpend(x, y, [{ emoji: RES_EMOJI[def.ship.cRes], count: def.ship.cN }]);
      }
      this._cardHand.showShipEffectOverlay(hi, 'Exile a pirate!', '#ff8a80');
      this.time.delayedCall(500, () => {
        this._cardHand.highlightShipCard(hi, false);
        this._shipResolvedSet.add(hi);
        G.phase = 'removing';
        G.busy = false;
        this.renderAll();
      });
      return;
    }

    if (!def.ship) {
      this._cardHand.showShipEffectOverlay(hi, '—', '#546e7a');
      resolveAndContinue(500);
      return;
    }

    const r = this.resolveShip(pirate);
    const s = TYPES[pirate.type].ship;
    let costPart = '';
    if (s.costs) {
      costPart = s.costs.map(c => c.n + (c.res === 'enthusiasm' ? '☠️' : RES_EMOJI[c.res])).join(' ');
    } else if (s.costWeapons) {
      costPart = (s.costWeapons > 1 ? s.costWeapons : '') + '🗡️';
    } else if (s.costCannons) {
      costPart = (s.costCannons > 1 ? s.costCannons : '') + '💣';
    } else if (s.cRes && s.cN > 0) {
      costPart = s.cN + RES_EMOJI[s.cRes];
    }
    const gainParts = [];
    if (s.prodWeapons) gainParts.push(s.prodWeapons + '🗡️');
    if (s.prodCannons) gainParts.push(s.prodCannons + '💣');
    if (s.pN > 0) {
      const em = s.pRes === 'enthusiasm' ? '☠️' : RES_EMOJI[s.pRes];
      gainParts.push(s.pN + em);
    }
    if (s.extraEnthusiasm) gainParts.push(s.extraEnthusiasm + '☠️');
    let msg;
    if (gainParts.length === 0 && !costPart) {
      msg = '—';
    } else if (costPart && gainParts.length) {
      msg = costPart + ' → ' + gainParts.join(' ');
    } else if (gainParts.length) {
      msg = gainParts.map(g => '+' + g).join(' ');
    } else {
      msg = '—';
    }
    this._cardHand.showShipEffectOverlay(hi, msg, r.ok ? '#80cbc4' : '#546e7a');
    let spendDuration = 0;
    if (r.ok) {
      const spendItems = [];
      if (s.costs) {
        for (const c of s.costs) spendItems.push({ emoji: c.res === 'enthusiasm' ? '☠️' : RES_EMOJI[c.res], count: c.n });
      } else if (s.costWeapons) {
        spendItems.push({ emoji: '🗡️', count: s.costWeapons });
      } else if (s.costCannons) {
        spendItems.push({ emoji: '💣', count: s.costCannons });
      } else if (s.cRes && s.cN > 0) {
        spendItems.push({ emoji: RES_EMOJI[s.cRes], count: s.cN });
      }
      if (spendItems.length) spendDuration = this.animateResourceSpend(x, y, spendItems);

      const gainItems = [];
      if (r.pN > 0) {
        gainItems.push({ emoji: r.pRes === 'enthusiasm' ? '☠️' : RES_EMOJI[r.pRes], count: r.pN });
      }
      if (r.extraEnthusiasm) gainItems.push({ emoji: '☠️', count: r.extraEnthusiasm });
      if (r.weaponN) gainItems.push({ emoji: '🗡️', count: r.weaponN });
      if (r.cannonN) gainItems.push({ emoji: '💣', count: r.cannonN });
      if (gainItems.length) {
        if (spendDuration > 0) {
          this.time.delayedCall(spendDuration, () => {
            this.animateResourceGain(x, y, gainItems);
          });
        } else {
          this.animateResourceGain(x, y, gainItems);
        }
      }
    }
    const baseShipWait = (r.ok && (r.pN > 0 || r.weaponN || r.cannonN || r.extraEnthusiasm)) ? 1000 : 1000;
    const shipWait = baseShipWait + spendDuration;
    resolveAndContinue(shipWait);
  }

  completeRemoval(pirateId) {
    G.allCrew = G.allCrew.filter(p => p.id !== pirateId);
    G.deck = G.deck.filter(p => p.id !== pirateId);
    G.discard = G.discard.filter(p => p.id !== pirateId);

    const L = this.L;
    this.float(L.cx, L.Y_INV + 20 * L.k, '💀 Exiled!', '#ff8a80');

    G.phase = 'ship';
    G.busy = true;
    this.ct.tip.setVisible(false);
    this.renderAll();
    this.processNextShip();
  }

  resolveShip(pirate) {
    const s = TYPES[pirate.type].ship;
    if (s.costs) {
      for (const c of s.costs) {
        if ((G.res[c.res] || 0) < c.n) return { ok: false };
      }
      for (const c of s.costs) G.res[c.res] -= c.n;
      const weaponN = s.prodWeapons || 0;
      const cannonN = s.prodCannons || 0;
      G.weapons += weaponN;
      G.cannons += cannonN;
      if (s.pRes === 'enthusiasm') G.enthusiasm += (s.pN || 0);
      else if (s.pRes) G.res[s.pRes] += (s.pN || 0);
      return { ok: true, pRes: s.pRes || null, pN: s.pN || 0, weaponN, cannonN };
    }
    if (s.costWeapons) {
      if (G.weapons < s.costWeapons) return { ok: false };
      G.weapons -= s.costWeapons;
      const cannonN = s.prodCannons || 0;
      G.cannons += cannonN;
      if (s.pRes === 'enthusiasm') G.enthusiasm += (s.pN || 0);
      else if (s.pRes) G.res[s.pRes] += (s.pN || 0);
      if (s.extraEnthusiasm) G.enthusiasm += s.extraEnthusiasm;
      return { ok: true, pRes: s.pRes || null, pN: s.pN || 0, extraEnthusiasm: s.extraEnthusiasm || 0, weaponN: 0, cannonN };
    }
    if (s.costCannons) {
      if (G.cannons < s.costCannons) return { ok: false };
      G.cannons -= s.costCannons;
      if (s.pRes === 'enthusiasm') G.enthusiasm += (s.pN || 0);
      else if (s.pRes) G.res[s.pRes] += (s.pN || 0);
      if (s.extraEnthusiasm) G.enthusiasm += s.extraEnthusiasm;
      return { ok: true, pRes: s.pRes || null, pN: s.pN || 0, extraEnthusiasm: s.extraEnthusiasm || 0, weaponN: 0, cannonN: 0 };
    }
    if (!s.cRes) {
      if (s.pRes === 'enthusiasm') G.enthusiasm += s.pN;
      else if (s.pRes) G.res[s.pRes] += s.pN;
      const weaponN = s.prodWeapons || 0;
      const cannonN = s.prodCannons || 0;
      G.weapons += weaponN;
      G.cannons += cannonN;
      return { ok: true, pRes: s.pRes, pN: s.pN, weaponN, cannonN };
    }
    if ((G.res[s.cRes] || 0) >= s.cN) {
      G.res[s.cRes] -= s.cN;
      if (s.pRes === 'enthusiasm') G.enthusiasm += s.pN;
      else G.res[s.pRes] += s.pN;
      const weaponN = s.prodWeapons || 0;
      const cannonN = s.prodCannons || 0;
      G.weapons += weaponN;
      G.cannons += cannonN;
      return { ok: true, pRes: s.pRes, pN: s.pN, weaponN, cannonN };
    }
    return { ok: false };
  }

  buyPirate(si, opts = {}) {
    if (this.isTutorialPopupOpen()) return;
    if (G.phase !== 'shopping' || G.busy || (!opts.ignoreAnimating && G.shopAnimating)) return;
    if (si >= G.shop.length) return;
    const L = this.L;
    const type = G.shop[si];
    const def = TYPES[type];
    if (G.enthusiasm < def.cost) {
      this.float(L.cx, L.Y_ISL_CY - 40 * L.k, 'Not enough ☠️', '#ef5350');
      return;
    }
    G.enthusiasm -= def.cost;
    const p = mkP(type);
    G.allCrew.push(p);
    G.deck.push(p);

    if (this.isTutorial()) {
      this.ensureTutorialFlow();
      const tut = this.tutorialState();
      const featuredRef = this.tutorialFeaturedRef();
      const featuredType = this.tutorialResolveType(tut.featured && tut.featured.type, type);
      if (type === featuredType) {
        tut.featured.bought = true;
        tut.featured.boughtPirateId = p.id;
        tut.boughtPirateId = p.id;
        tut.boughtPirateRef = featuredRef;
        if (!tut.cardRefs || typeof tut.cardRefs !== 'object') tut.cardRefs = {};
        tut.cardRefs[featuredRef] = p.id;
        if (!tut.cards || typeof tut.cards !== 'object') tut.cards = {};
        tut.cards[featuredRef] = { type };
      }
      tut.recommendedBought = !!(tut.featured && tut.featured.bought);
    }

    G.shop.splice(si, 1);
    if (!this.isTutorial()) {
      G.shop.push(randomShopType(G.round));
    }
    if (!opts.silent) this.float(L.cx, L.Y_ISL_CY - 40 * L.k, '+ ' + def.name + '!', '#66bb6a');
    this.ct.tip.setVisible(false);
    G.shopAnimating = false;
    if (opts.deferRender) return;
    this.renderAll();
    if (!opts.skipModalRefresh && this.scene.isActive('shopModal')) {
      this.scene.get('shopModal').renderModal();
    }
  }

  prepareNextRound() {
    if (this.isTutorialPopupOpen()) return;
    if (G.phase !== 'shopping') return;
    if (this.isTutorial()) {
      this.ensureTutorialFlow();
      const tut = this.tutorialState();
      const totalTurns = this.getTutorialTurnCount();
      if (tut.currentTurn >= totalTurns) return;
      this.closePanels();
      tut.currentTurn += 1;
      this.applyTutorialTurn(tut.currentTurn);
      return;
    }
    const allCrewIds = new Set(G.allCrew.map(p => p.id));
    G.discard.push(...G.hand.filter(p => allCrewIds.has(p.id)));
    G.hand = [];
    G.sent = [];
    G.enthusiasm = 0;
    this._sendingToIsland.clear();
    this._shipResolvedSet = new Set();
    this._shipQueueTotal = 0;
    this.ct.tip.setVisible(false);
    G.hand = drawCards(5);
    this.enterMapPhase();
  }

  shipBonusStr() {
    return G.weapons + G.cannons;
  }

  resolveBoarding() {
    if (this.isTutorialPopupOpen()) return;
    if (this.isTutorial()) {
      this.resolveTutorialBoarding();
      return;
    }
    if (G.phase !== 'boarding' || G.busy) return;
    G.busy = true;
    this.ct.tip.setVisible(false);

    const crewStr = G.hand.reduce((s, p) => s + (TYPES[p.type].str || 0), 0);
    const totalStr = crewStr + this.shipBonusStr();
    const shipStr = G.enemyShip.strength;
    const L = this.L;

    if (totalStr >= shipStr) {
      this.float(L.cx, L.Y_ISL_CY - 80 * L.k, '⚔️ Victory!', '#66bb6a');
      this.time.delayedCall(1000, () => {
        G.weapons = 0;
        G.busy = false;
        G.discard.push(...G.hand);
        G.hand = [];
        this.ct.tip.setVisible(false);

        if (G.map.currentLayer >= MAP_LAYERS - 1) {
          this.showVictory();
          return;
        }

        G.hand = drawCards(5);
        this.enterMapPhase();
      });
    } else {
      this.float(L.cx, L.Y_ISL_CY - 80 * L.k, '💀 Defeated…', '#ff5252');
      this.time.delayedCall(1200, () => {
        G.weapons = 0;
        G.busy = false;
        this.renderAll();
        this.showGameOver();
      });
    }
  }

  resolveTutorialBoarding() {
    if (G.phase !== 'boarding' || G.busy) return;
    G.busy = true;
    this.ct.tip.setVisible(false);
    const L = this.L;
    const crewStr = G.hand.reduce((s, p) => s + (TYPES[p.type].str || 0), 0);
    const totalStr = crewStr + this.shipBonusStr();
    const shipStr = G.enemyShip ? G.enemyShip.strength : 0;

    if (totalStr >= shipStr) {
      this.float(L.cx, L.Y_ISL_CY - 80 * L.k, '⚔️ Victory!', '#66bb6a');
      this.time.delayedCall(1000, () => {
        G.weapons = 0;
        G.phase = 'tutorialOutro';
        G.busy = true;
        this.renderAll();
        this.showTutorialOutro();
      });
      return;
    }

    this.float(L.cx, L.Y_ISL_CY - 80 * L.k, '💀 Defeated…', '#ff5252');
    this.time.delayedCall(1200, () => {
      G.weapons = 0;
      G.busy = false;
      this.renderAll();
      this.showGameOver();
    });
  }

  showTutorialOutro() {
    if (window.PokiBridge) {
      window.PokiBridge.gameplayStop();
    }
    this.clearCt('gameover');
    const L = this.L;

    const overlay = this.add.rectangle(0, 0, L.W, L.H, 0x000000, 1)
      .setOrigin(0, 0)
      .setInteractive();
    overlay.on('pointerdown', (ptr) => {
      ptr.event.stopPropagation();
    });
    this.addTo('gameover', overlay);

    this.txt('gameover', L.cx, L.H * 0.28, 'Tutorial Complete',
      { fontSize: L.fs(44), color: '#ffd740' });
    this.txt('gameover', L.cx, L.H * 0.38,
      'You won the scripted boarding fight on turn 5.',
      { fontSize: L.fs(24), color: '#b0b8c8' });
    this.txt('gameover', L.cx, L.H * 0.44,
      'Start a real run and build your own deck.',
      { fontSize: L.fs(24), color: '#a0d0a0' });

    const btn = this.add.text(L.cx, L.H * 0.56, '[ Start Real Game ]', {
      fontFamily: 'monospace', fontSize: L.fs(32), color: '#a0d0a0',
      backgroundColor: '#1e4535', padding: { x: 40 * L.k, y: 20 * L.k },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#2a6545' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#1e4535' }));
    btn.on('pointerdown', () => {
      this.clearCt('gameover');
      this.closePanels();
      initState();
      this.scene.restart();
    });
    this.addTo('gameover', btn);
  }

  showGameOver() {
    if (window.PokiBridge) {
      window.PokiBridge.gameplayStop();
    }
    this.clearCt('gameover');
    const L = this.L;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 1);
    overlay.fillRect(0, 0, L.W, L.H);
    this.addTo('gameover', overlay);

    this.txt('gameover', L.cx, L.H * 0.32, '☠️ DEFEATED ☠️',
      { fontSize: L.fs(48), color: '#ff5252' });
    this.txt('gameover', L.cx, L.H * 0.40,
      `Survived ${G.round} rounds  ·  ${G.boardingCount} boarding${G.boardingCount !== 1 ? 's' : ''}`,
      { fontSize: L.fs(26), color: '#b0b8c8' });

    const crewStr = G.hand.reduce((s, p) => s + (TYPES[p.type].str || 0), 0);
    const totalStr = crewStr + this.shipBonusStr();
    this.txt('gameover', L.cx, L.H * 0.46,
      `Your crew ${totalStr}⚔️  vs  Enemy ${G.enemyShip.strength}⚔️`,
      { fontSize: L.fs(24), color: '#ff8a80' });

    const btn = this.add.text(L.cx, L.H * 0.56, '[ Try Again ]', {
      fontFamily: 'monospace', fontSize: L.fs(32), color: '#a0d0a0',
      backgroundColor: '#1e4535', padding: { x: 40 * L.k, y: 20 * L.k },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#2a6545' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#1e4535' }));
    btn.on('pointerdown', () => {
      this.clearCt('gameover');
      this.closePanels();
      initState();
      this.scene.restart();
    });
    this.addTo('gameover', btn);
  }

  showVictory() {
    if (window.PokiBridge) {
      window.PokiBridge.gameplayStop();
    }
    this.clearCt('gameover');
    const L = this.L;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 1);
    overlay.fillRect(0, 0, L.W, L.H);
    this.addTo('gameover', overlay);

    this.txt('gameover', L.cx, L.H * 0.28, '🏆 VICTORY! 🏆',
      { fontSize: L.fs(48), color: '#ffd740' });
    this.txt('gameover', L.cx, L.H * 0.36,
      'You conquered all 10 enemy ships!',
      { fontSize: L.fs(26), color: '#b0b8c8' });
    this.txt('gameover', L.cx, L.H * 0.42,
      `${G.round} rounds  ·  Crew of ${G.allCrew.length}`,
      { fontSize: L.fs(24), color: '#a0d0a0' });

    let inv = '';
    ['wood', 'stone', 'gold'].forEach(r => {
      if (G.res[r] > 0) inv += ` ${G.res[r]}${RES_EMOJI[r]}`;
    });
    if (G.cannons > 0) inv += ` ${G.cannons}💣`;
    if (inv) {
      this.txt('gameover', L.cx, L.H * 0.48, 'Final stash:' + inv,
        { fontSize: L.fs(22), color: '#80cbc4' });
    }

    const btn = this.add.text(L.cx, L.H * 0.58, '[ Play Again ]', {
      fontFamily: 'monospace', fontSize: L.fs(32), color: '#a0d0a0',
      backgroundColor: '#1e4535', padding: { x: 40 * L.k, y: 20 * L.k },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#2a6545' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#1e4535' }));
    btn.on('pointerdown', () => {
      this.clearCt('gameover');
      this.closePanels();
      initState();
      this.scene.restart();
    });
    this.addTo('gameover', btn);
  }

  // ──────────── HELPERS ────────────

  handPos(idx) {
    const L = this.L;
    const n = G.hand.length;
    const EDGE_PAD = 8 * L.k;
    const MAX_STEP = 180 * L.k;
    const spriteHalfW = 5 * L.SC;
    const minX = spriteHalfW + EDGE_PAD;
    const maxX = L.W - minX;
    const usableW = Math.max(0, maxX - minX);

    let x;
    if (n <= 1) {
      x = Phaser.Math.Clamp(L.cx, minX, maxX);
    } else {
      const stepFit = usableW / Math.max(n - 1, 1);
      const step = Math.min(MAX_STEP, stepFit);
      const rowW = step * (n - 1);
      const startX = Phaser.Math.Clamp(L.cx - rowW / 2, minX, maxX - rowW);
      x = startX + idx * step;
    }
    return { x, y: L.Y_HAND_CENTER };
  }

  shipRowPos(slotIdx, total) {
    const L = this.L;
    const EDGE_PAD = 8 * L.k;
    const MAX_STEP = 160 * L.k;
    const spriteHalfW = 5 * L.SC;
    const minX = spriteHalfW + EDGE_PAD;
    const maxX = L.W - minX;
    const usableW = Math.max(0, maxX - minX);
    const n = total || 1;
    let x;
    if (n <= 1) {
      x = Phaser.Math.Clamp(L.cx, minX, maxX);
    } else {
      const stepFit = usableW / Math.max(n - 1, 1);
      const step = Math.min(MAX_STEP, stepFit);
      const rowW = step * (n - 1);
      const startX = Phaser.Math.Clamp(L.cx - rowW / 2, minX, maxX - rowW);
      x = startX + slotIdx * step;
    }
    return { x, y: L.Y_SHIP_ROW };
  }

  handX(idx) {
    return this.handPos(idx).x;
  }

  clearCt(k) { this.ct[k].removeAll(true); }

  addTo(k, obj) { this.ct[k].add(obj); return obj; }

  txt(k, x, y, str, style) {
    const L = this.L;
    const base = { fontFamily: 'monospace', fontSize: L.fs(24), color: '#b0b8c8' };
    const t = this.add.text(x, y, str, Object.assign(base, style)).setOrigin(0.5, 0);
    return this.addTo(k, t);
  }

  // ──────────── RENDERING ────────────

  renderAll() {
    this.renderTop();
    this.renderIsland();
    this.renderPhase();
    this.renderHand();
    this.renderBtn();
    this.renderNav();
  }

  renderTop() {
    this.clearCt('top');
    const L = this.L;

    this.txt('top', L.cx, L.Y_ROUND,
      `Round ${G.round}`,
      { fontSize: L.fs(26) });

    let resIcons = '';
    ['wood', 'stone', 'gold', 'map'].forEach(r => {
      for (let i = 0; i < Math.min(G.res[r], 30); i++) resIcons += RES_EMOJI[r];
    });
    const invParts = [];
    if (resIcons) invParts.push(resIcons);
    if (G.enthusiasm > 0) invParts.push(`☠️${G.enthusiasm}`);
    if (G.weapons > 0) invParts.push(`🗡️${G.weapons}`);
    if (G.cannons > 0) invParts.push(`💣${G.cannons}`);
    const inv = invParts.join('  ') || '—';
    this.txt('top', L.cx, L.Y_INV, inv,
      { fontSize: L.fs(24), color: '#d0d0d0', wordWrap: { width: L.W - 40 } });

    const dv = this.add.graphics();
    dv.lineStyle(2, 0x1e3040);
    dv.lineBetween(40, L.Y_INV + 44 * L.k, L.W - 40, L.Y_INV + 44 * L.k);
    this.addTo('top', dv);
  }

  renderIsland() {
    this.clearCt('island');
    const L = this.L;
    const cx = L.cx, cy = L.Y_ISL_CY;

    if (G.enemyShip) {
      const g = this.add.graphics();
      g.fillStyle(0x1a0808, 1);
      g.fillEllipse(cx, cy, 600 * L.k, 340 * L.k);
      g.fillStyle(0x3a1010, 1);
      g.fillEllipse(cx, cy, 440 * L.k, 220 * L.k);
      g.fillStyle(0x8a2020, 1);
      g.fillEllipse(cx - 50 * L.k, cy - 16 * L.k, 140 * L.k, 80 * L.k);
      this.addTo('island', g);

      this.txt('island', cx, cy - 120 * L.k, '🏴‍☠️', { fontSize: L.fsPx(56) });
      this.txt('island', cx, cy - 30 * L.k, `${G.enemyShip.strength}⚔️`,
        { fontSize: L.fs(40), color: '#ff6b6b' });

      const crewStr = G.hand.reduce((s, p) => s + (TYPES[p.type].str || 0), 0);
      const bonusStr = this.shipBonusStr();
      const totalStr = crewStr + bonusStr;
      const winning = totalStr >= G.enemyShip.strength;
      let strLabel = `Crew ${crewStr}⚔️`;
      if (G.weapons > 0) strLabel += ` +🗡️${G.weapons}`;
      if (G.cannons > 0) strLabel += ` +💣${G.cannons}`;
      strLabel += ` = ${totalStr}⚔️ vs ${G.enemyShip.strength}⚔️`;
      this.txt('island', cx, L.Y_ISL_LBL, strLabel,
        { fontSize: L.fs(22), color: winning ? '#66bb6a' : '#ff8a80' });
      return;
    }

    if (!G.island) {
      const g = this.add.graphics();
      g.fillStyle(0x0b1f33, 1);
      g.fillEllipse(cx, cy, 640 * L.k, 360 * L.k);
      g.fillStyle(0x113252, 1);
      g.fillEllipse(cx, cy + 10 * L.k, 540 * L.k, 250 * L.k);
      this.addTo('island', g);
      this.txt('island', cx, cy - 120 * L.k, '🌊', { fontSize: L.fsPx(56) });
      this.txt('island', cx, L.Y_ISL_LBL, 'Open sea',
        { fontSize: L.fs(22), color: '#9fc3e0' });
      return;
    }

    const g = this.add.graphics();
    g.fillStyle(0x0f2a40, 1);
    g.fillEllipse(cx, cy, 600 * L.k, 340 * L.k);
    g.fillStyle(G.island.accent, 1);
    g.fillEllipse(cx, cy, 440 * L.k, 220 * L.k);
    this.addTo('island', g);

    this.txt('island', cx, cy - 120 * L.k, G.island.emoji, { fontSize: L.fsPx(56) });

    let islDesc;
    if (G.island.bonus) {
      const bm = { wood: '2x 🪵', stone: '2x 🪨', gold: '2x 🪙' };
      islDesc = bm[G.island.bonus];
    } else if (G.island.extraSend) {
      islDesc = '+1 pirate ashore';
    } else if (G.island.maxSend != null) {
      islDesc = `max ${G.island.maxSend} ashore`;
    } else if (G.island.bonusEnthusiasm) {
      islDesc = '+' + G.island.bonusEnthusiasm + '☠️';
    } else if (G.island.sacrifice) {
      islDesc = 'pirates lost forever';
    } else if (G.island.tutorialDesc) {
      islDesc = G.island.tutorialDesc;
    }
    const islandLine = islDesc ? `${G.island.name}: ${islDesc}` : G.island.name;
    this.txt('island', cx, L.Y_ISL_LBL, islandLine,
      { fontSize: L.fs(22), color: '#ffe082' });

    G.sent.forEach((hi, si) => {
      if (this._sendingToIsland.has(hi)) return;
      const p = G.hand[hi];
      const px = cx + this.sentOffsetX(si) * L.k;
      const spr = addCatSprite(this, px, cy, p.type);
      spr.setScale(L.SC);
      if (this._sacrificedIds.has(p.id)) spr.setAlpha(0.35);
      spr.setInteractive({ useHandCursor: true });
      spr.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        this.showTip(p.type, px, cy - 100 * L.k, { fromClick: true });
      });
      spr.on('pointerover', () => {
        if (this.ct.tip.visible) this.showTip(p.type, px, cy - 100 * L.k);
      });
      this.addTo('island', spr);
    });
  }

  renderPhase() {
    this.clearCt('phase');
    const L = this.L;
    const statusY = L.Y_ISL_LBL + 30 * L.k;
    let str;
    let col = '#8090a0';

    if (G.phase === 'boarding') {
      str = 'Boarding! Prepare for battle!';
      col = '#ff8a80';
    } else if (G.phase === 'map') {
      str = 'Choose the destination on the map';
      col = '#9fc3e0';
    } else if (G.phase === 'sending') {
      const r = this.maxSend() - G.sent.length;
      str = `Drag a card to island (${r} left)`;
    } else if (G.phase === 'ship') {
      str = 'Ship at work…';
      col = '#80cbc4';
    } else if (G.phase === 'removing') {
      str = 'Choose a pirate to exile';
      col = '#ff8a80';
    } else {
      const canHire = G.shop.some(t => G.enthusiasm >= TYPES[t].cost);
      str = canHire ? 'You can hire new crew' : 'Not enough ☠️ to hire';
      col = canHire ? '#ce93d8' : '#8090a0';
    }
    this.txt('phase', L.cx, statusY, str, { fontSize: L.fs(22), color: col });

    if (G.phase === 'removing') {
      const crew = [...G.allCrew].sort((a, b) => {
        const ca = TYPES[a.type].cost ?? -1;
        const cb = TYPES[b.type].cost ?? -1;
        if (ca !== cb) return ca - cb;
        return a.type < b.type ? -1 : a.type > b.type ? 1 : 0;
      });
      const handIds = new Set(G.hand.map(p => p.id));
      const selectable = crew.filter(p => !handIds.has(p.id));
      const rowY = statusY + 56 * L.k;
      const scale = L.SC_SM * 0.86;
      const maxSp = 52 * L.k;
      const sp = Math.min(maxSp, (L.W - 80) / Math.max(selectable.length, 1));
      const sx = L.cx - ((selectable.length - 1) * sp) / 2;

      selectable.forEach((p, i) => {
        const cx = sx + i * sp;
        const spr = addCatSprite(this, cx, rowY, p.type);
        spr.setScale(scale);
        spr.setTint(0xff6666);
        spr.setInteractive({ useHandCursor: true });
        spr.on('pointerover', () => spr.setScale(scale + 1));
        spr.on('pointerout', () => spr.setScale(scale));
        spr.on('pointerdown', (ptr) => {
          ptr.event.stopPropagation();
          this.completeRemoval(p.id);
        });
        this.addTo('phase', spr);
      });
    }
  }

  renderHand() {
    const prevPositions = this._cardHand.getCardPositions();
    this.clearCt('hand');
    this._cardHand.destroy();
    this._handSprites = {};
    const L = this.L;

    const tutorialTurn = this.isTutorial() ? this.getTutorialTurn() : null;
    const tutorialRequiredSent = this.isTutorial() ? this.tutorialRequiredSent(tutorialTurn) : 0;
    const tutorialTargetIdx = (this.isTutorial() && G.phase === 'sending' && G.sent.length < tutorialRequiredSent)
      ? G.hand.findIndex((hp, hi) => {
        if (G.sent.includes(hi) || this._sendingToIsland.has(hi)) return false;
        const hd = TYPES[hp.type];
        if (this.isTutorialIslandBlockedPirate(hp, tutorialTurn)) return false;
        if (!hd.canIsland) return false;
        if (hd.island && hd.island.convert) {
          return (G.res[hd.island.convert.cRes] || 0) >= hd.island.convert.cN;
        }
        return true;
      })
      : -1;

    const isSending = G.phase === 'sending';

    this._cardHand.render({
      hand: G.hand,
      sent: G.sent,
      sendingSet: this._sendingToIsland,
      shipResolvedSet: this._shipResolvedSet,
      isSending,
      prevPositions,
      tutorialBlocked: (p) => this.isTutorial() && G.phase === 'sending' &&
        this.isTutorialIslandBlockedPirate(p, tutorialTurn),
      tutorialTargetIdx,
      onSendToIsland: (idx, fromPos) => this.sendToIsland(idx, fromPos),
      container: this.ct.hand,
    });
  }

  renderBtn() {
    this.clearCt('btn');
    const L = this.L;
    if (G.busy) return;
    const x = L.W - 20 * L.k;
    const y = L.Y_NAV;
    const right = { originX: 1 };

    if (G.phase === 'boarding') {
      this.mkBtn('btn', x, y, 'Board!', () => this.resolveBoarding(), right);
    } else if (G.phase === 'sending') {
      this.mkBtn('btn', x, y, 'End landing', () => this.endSending(), right);
    } else if (G.phase === 'shopping') {
      const nextLabel = this.isTutorial() ? 'Next turn' : 'Next round';
      this.mkBtn('btn', x, y, nextLabel, () => {
        if (this.isTutorial()) {
          this.ensureTutorialFlow();
          const turn = this.getTutorialTurn();
          const needFeatured = !!(turn && turn.requireFeaturedPurchase);
          if (needFeatured && !(G.tutorial.featured && G.tutorial.featured.bought)) {
            this.float(L.cx, L.Y_ISL_CY - 40 * L.k, `Buy ${this.tutorialFeaturedName()} to continue`, '#ffa726');
            return;
          }
          this.prepareNextRound();
          return;
        }
        if (G.shop.length) {
          G.shop.shift();
          G.shop.push(randomShopType(G.round + 1));
        }
        this.prepareNextRound();
      }, right);
    }
  }

  renderNav() {
    this.clearCt('nav');
    const L = this.L;

    const mapEnabled = !this.isTutorial();
    const shopEnabled = !G.busy && (!this.isTutorial() || G.phase === 'shopping');
    const left = 20 * L.k;
    const gap = 12 * L.k;
    const leftOpts = { originX: 0 };

    const mapOpen = this._mapPanelOpen;
    const mapLabel = mapOpen ? '[Map]' : 'Map';
    const mapBtn = this.mkBtn('nav', left, L.Y_NAV, mapLabel, () => {
      if (!mapEnabled) {
        this.float(L.cx, L.Y_NAV - 40 * L.k, 'Map is available between rounds', '#8090a0');
        return;
      }
      this.toggleMapModal();
    }, {
      ...leftOpts,
      enabled: mapEnabled,
      bg: '#2b3f52',
      hoverBg: '#35536f',
      disabledBg: '#1a2630',
      color: '#c0d8f0',
      disabledColor: '#5a6570',
    });

    const shopOpen = this._shopPanelOpen;
    const shopLabel = shopOpen ? '[Shop]' : 'Shop';
    this.mkBtn('nav', left + mapBtn.width + gap, L.Y_NAV, shopLabel, () => {
      this.toggleShopModal();
    }, {
      ...leftOpts,
      enabled: shopEnabled,
      bg: '#3a2a48',
      hoverBg: '#55406b',
      disabledBg: '#261d30',
      color: '#e0c8f0',
      disabledColor: '#6c6074',
    });
  }

  mkBtn(k, x, y, label, cb, opts = {}) {
    const L = this.L;
    const enabled = opts.enabled !== false;
    const bg = opts.bg || '#1e4535';
    const hoverBg = opts.hoverBg || '#2a6545';
    const disabledBg = opts.disabledBg || '#1a2630';
    const color = opts.color || '#c0d8c0';
    const disabledColor = opts.disabledColor || '#607080';
    const t = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: L.fs(24), color: enabled ? color : disabledColor,
      backgroundColor: enabled ? bg : disabledBg, padding: { x: 32 * L.k, y: 16 * L.k },
    }).setOrigin(opts.originX != null ? opts.originX : 0.5, 0.5);
    if (enabled) {
      t.setInteractive({ useHandCursor: true });
    } else {
      t.setAlpha(1);
    }
    t.on('pointerover', () => {
      if (enabled) t.setStyle({ backgroundColor: hoverBg });
    });
    t.on('pointerout', () => {
      if (enabled) t.setStyle({ backgroundColor: bg });
    });
    t.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); cb(); });
    this.addTo(k, t);
    return t;
  }

  // ──────────── TOOLTIP (CARD) ────────────

  showTip(type, tx, ty, opts = {}) {
    const L = this.L;
    if (opts.fromClick) this._tipJustOpened = true;
    if (!this._tipDragAnchor) this.ct.tip.setPosition(0, 0);
    this.clearCt('tip');
    const def = TYPES[type];
    const tipFs = L.fs(20);
    const headFs = L.fs(24);
    const sectionFs = L.fs(18);
    const pad = 18 * L.k;
    const innerPad = 12 * L.k;
    const sectionGap = 8 * L.k;

    const nameText = def.name + '  ' + (def.str || 0) + '⚔️';
    const islandText = def.dI || '—';
    const shipText = def.dS || '—';
    const costText = def.cost !== null ? '☠️' + def.cost : '';
    let extraText = '';
    if (type === 'smuggler' && G.res.map > 0) {
      extraText = '🗺️ +30% gold chance';
    }

    const cardW = Math.min(320 * L.k, L.W - 40 * L.k);

    const measure = (str, fs) => {
      const t = this.add.text(0, -9999, str, {
        fontFamily: 'monospace', fontSize: fs, wordWrap: { width: cardW - pad * 2 },
      });
      const h = t.height;
      t.destroy();
      return h;
    };

    const nameH = measure(nameText, headFs);
    const divH = 2 * L.k;
    const islLabelH = measure('🏝️ Island', sectionFs);
    const islH = measure(islandText, tipFs);
    const shipLabelH = measure('⛵ Ship', sectionFs);
    const shipH = measure(shipText, tipFs);
    const costH = costText ? measure(costText, sectionFs) + sectionGap : 0;
    const extraH = extraText ? measure(extraText, sectionFs) + sectionGap : 0;

    const cardH = pad + nameH + sectionGap + divH + sectionGap
      + islLabelH + innerPad + islH + sectionGap
      + divH + sectionGap
      + shipLabelH + innerPad + shipH + sectionGap
      + costH + extraH + pad;

    let bx = tx - cardW / 2;
    let by = ty - cardH - 12 * L.k;
    if (bx < 6 * L.k) bx = 6 * L.k;
    if (bx + cardW > L.W - 6 * L.k) bx = L.W - cardW - 6 * L.k;
    if (by < 6 * L.k) by = ty + 50 * L.k;

    const bg = this.add.graphics();
    bg.fillStyle(0x0e1a28, 0.97);
    bg.fillRoundedRect(bx, by, cardW, cardH, 12 * L.k);
    bg.lineStyle(2 * L.k, 0x3a5a7a);
    bg.strokeRoundedRect(bx, by, cardW, cardH, 12 * L.k);
    this.addTo('tip', bg);

    let cy = by + pad;

    const nameObj = this.add.text(bx + pad, cy, nameText, {
      fontFamily: 'monospace', fontSize: headFs, color: '#ffd78a',
      wordWrap: { width: cardW - pad * 2 },
    }).setOrigin(0, 0);
    this.addTo('tip', nameObj);
    cy += nameH + sectionGap;

    bg.lineStyle(1, 0x3a5a7a, 0.6);
    bg.lineBetween(bx + pad, cy, bx + cardW - pad, cy);
    cy += divH + sectionGap;

    const islLabel = this.add.text(bx + pad, cy, 'On island:', {
      fontFamily: 'monospace', fontSize: sectionFs, color: '#7a9a6a',
    }).setOrigin(0, 0);
    this.addTo('tip', islLabel);
    cy += islLabelH + innerPad;

    const islObj = this.add.text(bx + pad + 10 * L.k, cy, islandText, {
      fontFamily: 'monospace', fontSize: tipFs, color: '#c8e0c0',
      wordWrap: { width: cardW - pad * 2 - 10 * L.k },
    }).setOrigin(0, 0);
    this.addTo('tip', islObj);
    cy += islH + sectionGap;

    bg.lineBetween(bx + pad, cy, bx + cardW - pad, cy);
    cy += divH + sectionGap;

    const shipLabel = this.add.text(bx + pad, cy, 'On ship:', {
      fontFamily: 'monospace', fontSize: sectionFs, color: '#6a8a9a',
    }).setOrigin(0, 0);
    this.addTo('tip', shipLabel);
    cy += shipLabelH + innerPad;

    const shipObj = this.add.text(bx + pad + 10 * L.k, cy, shipText, {
      fontFamily: 'monospace', fontSize: tipFs, color: '#b0d0e0',
      wordWrap: { width: cardW - pad * 2 - 10 * L.k },
    }).setOrigin(0, 0);
    this.addTo('tip', shipObj);
    cy += shipH + sectionGap;

    if (costText) {
      const costObj = this.add.text(bx + pad, cy, 'Cost: ' + costText, {
        fontFamily: 'monospace', fontSize: sectionFs, color: '#ce93d8',
      }).setOrigin(0, 0);
      this.addTo('tip', costObj);
      cy += costH;
    }

    if (extraText) {
      const exObj = this.add.text(bx + pad, cy, extraText, {
        fontFamily: 'monospace', fontSize: sectionFs, color: '#ffd54f',
      }).setOrigin(0, 0);
      this.addTo('tip', exObj);
      cy += extraH;
    }

    let btnAreaH = 0;

    if (opts.canBuy && G.phase === 'shopping') {
      const btnY = by + cardH + 6 * L.k;
      const bb = this.add.text(bx + cardW / 2, btnY, 'Buy', {
        fontFamily: 'monospace', fontSize: L.fs(22), color: '#a0d8a0',
        backgroundColor: '#1a3a28', padding: { x: 20 * L.k, y: 10 * L.k },
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      bb.on('pointerover', () => bb.setStyle({ backgroundColor: '#2a5a38' }));
      bb.on('pointerout', () => bb.setStyle({ backgroundColor: '#1a3a28' }));
      bb.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        this.buyPirate(opts.shopIdx);
      });
      this.addTo('tip', bb);
      btnAreaH = 50 * L.k;
    }

    this._tipRect = new Phaser.Geom.Rectangle(bx, by, cardW, cardH + btnAreaH);
    this.ct.tip.setVisible(true);
  }

  // ──────────── RESOURCE ANIMATIONS ────────────

  animateResourceGain(fromX, fromY, items) {
    const L = this.L;
    const targetX = L.cx;
    const targetY = L.Y_INV;
    let delay = 0;
    for (const item of items) {
      const n = Math.min(item.count || 1, 8);
      for (let i = 0; i < n; i++) {
        this.time.delayedCall(delay, () => {
          const ox = (Math.random() - 0.5) * 30 * L.k;
          const sx = fromX + ox;
          const sy = fromY;
          const cpX = (sx + targetX) / 2 + (Math.random() - 0.5) * 80 * L.k;
          const cpY = Math.min(sy, targetY) - 60 * L.k;

          const t = this.add.text(sx, sy, item.emoji, {
            fontFamily: 'monospace',
            fontSize: L.fs(28),
            stroke: '#000',
            strokeThickness: 3 * L.k,
          }).setOrigin(0.5).setDepth(70);

          this.tweens.addCounter({
            from: 0, to: 1,
            duration: 650,
            ease: 'Sine.easeInOut',
            onUpdate: (tw) => {
              const p = tw.getValue();
              const bx = (1 - p) * (1 - p) * sx + 2 * (1 - p) * p * cpX + p * p * targetX;
              const by = (1 - p) * (1 - p) * sy + 2 * (1 - p) * p * cpY + p * p * targetY;
              t.setPosition(bx, by);
              t.setScale(1 + 0.2 * Math.sin(p * Math.PI) - p * 0.4);
              t.setAlpha(0.95 - p * 0.15);
            },
            onComplete: () => {
              t.setPosition(targetX, targetY).setAlpha(1).setScale(1.3);
              this.tweens.add({
                targets: t,
                scale: 1.8, alpha: 0,
                duration: 250,
                ease: 'Cubic.easeOut',
                onComplete: () => t.destroy(),
              });
            },
          });
        });
        delay += 110;
      }
    }
  }

  animateResourceSpend(toX, toY, items) {
    const L = this.L;
    const startX = L.cx;
    const startY = L.Y_INV;
    let delay = 0;
    let totalEmojis = 0;
    for (const item of items) totalEmojis += Math.min(item.count || 1, 8);
    for (const item of items) {
      const n = Math.min(item.count || 1, 8);
      for (let i = 0; i < n; i++) {
        this.time.delayedCall(delay, () => {
          const ox = (Math.random() - 0.5) * 20 * L.k;
          const sx = startX + ox;
          const sy = startY;
          const cpX = (sx + toX) / 2 + (Math.random() - 0.5) * 80 * L.k;
          const cpY = Math.min(sy, toY) - 50 * L.k;

          const t = this.add.text(sx, sy, item.emoji, {
            fontFamily: 'monospace',
            fontSize: L.fs(24),
            stroke: '#000',
            strokeThickness: 3 * L.k,
          }).setOrigin(0.5).setDepth(70).setAlpha(0.9);

          this.tweens.addCounter({
            from: 0, to: 1,
            duration: 550,
            ease: 'Sine.easeIn',
            onUpdate: (tw) => {
              const p = tw.getValue();
              const bx = (1 - p) * (1 - p) * sx + 2 * (1 - p) * p * cpX + p * p * toX;
              const by = (1 - p) * (1 - p) * sy + 2 * (1 - p) * p * cpY + p * p * toY;
              t.setPosition(bx, by);
              t.setScale(1 - p * 0.4);
              t.setAlpha(0.9 - p * 0.3);
            },
            onComplete: () => {
              this.tweens.add({
                targets: t,
                scale: 0, alpha: 0,
                duration: 150,
                ease: 'Cubic.easeIn',
                onComplete: () => t.destroy(),
              });
            },
          });
        });
        delay += 100;
      }
    }
    return (totalEmojis - 1) * 100 + 700;
  }

  effectText(x, y, str, col, hold = true) {
    const L = this.L;
    const t = this.add.text(x, y, str, {
      fontFamily: 'monospace', fontSize: L.fs(28), color: col || '#fff',
      stroke: '#000', strokeThickness: 4 * L.k,
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({
      targets: t,
      alpha: 0,
      y: y - (hold ? 30 : 70) * L.k,
      delay: hold === true ? 800 : (hold === false ? 0 : hold),
      duration: hold === true ? 500 : (hold === false ? 1200 : 600),
      ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  // ──────────── FLOATING TEXT ────────────

  float(x, y, str, col) {
    const L = this.L;
    const t = this.add.text(x, y, str, {
      fontFamily: 'monospace', fontSize: L.fs(28), color: col || '#fff',
      stroke: '#000', strokeThickness: 4 * L.k,
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({
      targets: t, y: y - 70 * L.k, alpha: 0,
      duration: 1400, ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }
}
