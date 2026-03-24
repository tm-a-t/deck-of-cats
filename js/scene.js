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
    const needsFreshState = !G.map && !(G.tutorial && G.tutorial.active);
    if (needsFreshState) initState();

    this.ct = {};
    ['top', 'island', 'phase', 'hand', 'btn', 'nav', 'fx', 'tutorialHint', 'tutorial', 'gameover'].forEach(k => {
      this.ct[k] = this.add.container(0, 0);
    });
    this.ct.fx.setDepth(50);
    this.ct.tutorialHint.setDepth(170).setVisible(false);
    this.ct.tutorial.setDepth(180).setVisible(false);
    this.ct.gameover.setDepth(200);
    this._sendingToIsland = new Set();
    this._pendingEndSending = false;
    this._sacrificedIds = new Set();
    this.input.setDraggable([]);
    this._cardHand = new CardHand(this);
    this._pendingHandAppearById = null;
    this._animateInitialMapHand = needsFreshState && !this.isTutorial();

    this._tutorialPopupOpen = false;
    this._tutorialHintTimer = null;
    this._mapPanelOpen = false;
    this._shopPanelOpen = false;
    this._drawPilePanelOpen = false;
    this._discardPilePanelOpen = false;

    this._onResize = () => {
      this.L = computeLayout(this.scale.width, this.scale.height);
      if (!G.shopAnimating) this.renderAll();
    };
    this.scale.on('resize', this._onResize);

    this._panelShutdownHandlers = {
      map: () => {
        this._mapPanelOpen = false;
        this.refreshPanelUi();
      },
      shopModal: () => {
        this._shopPanelOpen = false;
        this.refreshPanelUi();
      },
      drawPileModal: () => {
        this._drawPilePanelOpen = false;
        this.refreshPanelUi();
      },
      discardPileModal: () => {
        this._discardPilePanelOpen = false;
        this.refreshPanelUi();
      },
    };
    Object.entries(this._panelShutdownHandlers).forEach(([key, handler]) => {
      this.scene.get(key).events.on(Phaser.Scenes.Events.SHUTDOWN, handler);
    });

    if (window.PokiBridge) {
      window.PokiBridge.markGameReady();
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this._onResize);
      Object.entries(this._panelShutdownHandlers || {}).forEach(([key, handler]) => {
        this.scene.get(key).events.off(Phaser.Scenes.Events.SHUTDOWN, handler);
      });
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

  buildIslandState(island, opts = {}) {
    const src = island || {};
    return {
      name: src.name || opts.name || 'Training Cove',
      emoji: src.emoji || opts.emoji || '🏝️',
      accent: src.accent != null ? src.accent : (opts.accent != null ? opts.accent : 0x4b7d42),
      bonus: src.bonus || null,
      extraSend: src.extraSend || 0,
      maxSend: src.maxSend != null ? src.maxSend : (opts.maxSend != null ? opts.maxSend : null),
      bonusEnthusiasm: src.bonusEnthusiasm || 0,
      sacrifice: !!src.sacrifice,
      tutorialDesc: src.tutorialDesc || opts.tutorialDesc || null,
    };
  }

  islandYieldAmount(res, amount, island = G.island) {
    const base = Number(amount) || 0;
    if (!res || !island || island.bonus !== res) return base;
    return base * 2;
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
    bg.fillStyle(uiColorInt(UI_THEME.colors.sand), 0.98);
    bg.fillRoundedRect(x, y, w, h, 16 * L.k);
    bg.lineStyle(3 * L.k, uiColorInt(UI_THEME.colors.cocoa), 1);
    bg.strokeRoundedRect(x, y, w, h, 16 * L.k);
    this.addTo('tutorialHint', bg);

    const title = this.add.text(x + 22 * L.k, y + 16 * L.k, copy.title, uiHeadingStyle(L, 24, UI_THEME.colors.ink))
      .setOrigin(0, 0);
    this.addTo('tutorialHint', title);

    const body = this.add.text(x + 22 * L.k, y + 56 * L.k, copy.body.join('\n'), uiBodyStyle(L, UI_THEME.colors.ink, {
      lineSpacing: uiLineSpacingPx(L, UI_THEME.fonts.bodyPx, 18),
      wordWrap: { width: w - 84 * L.k },
    })).setOrigin(0, 0);
    this.addTo('tutorialHint', body);

    const close = this.add.text(x + w - 14 * L.k, y + 12 * L.k, '✕', uiHeadingStyle(L, 22, UI_THEME.colors.ink))
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    close.on('pointerover', () => close.setColor(UI_THEME.colors.cocoa));
    close.on('pointerout', () => close.setColor(UI_THEME.colors.ink));
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
    paper.fillStyle(uiColorInt(UI_THEME.colors.sand), 1);
    paper.fillRoundedRect(x, y, w, h, 22 * L.k);
    paper.lineStyle(4, uiColorInt(UI_THEME.colors.cocoa), 1);
    paper.strokeRoundedRect(x, y, w, h, 22 * L.k);
    this.addTo('tutorial', paper);

    const title = this.add.text(L.cx, y + 24 * L.k, copy.title, uiHeadingStyle(L, 32, UI_THEME.colors.ink))
      .setOrigin(0.5, 0);
    this.addTo('tutorial', title);

    const body = this.add.text(x + 34 * L.k, y + 94 * L.k, copy.body.join('\n'), uiBodyStyle(L, UI_THEME.colors.ink, {
      lineSpacing: uiLineSpacingPx(L, UI_THEME.fonts.bodyPx, 20),
      wordWrap: { width: w - 68 * L.k },
    })).setOrigin(0, 0);
    this.addTo('tutorial', body);

    const btn = makeUiPill(this, {
      x: L.cx,
      y: y + h - 72 * L.k,
      label: 'Got it',
      L,
      minW: 140 * L.k,
      fill: UI_THEME.colors.cocoa,
      textColor: UI_THEME.colors.paper,
      textPx: 18,
    }).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setPillStyle({
      fill: UI_THEME.colors.cocoaDark,
      textColor: UI_THEME.colors.paper,
    }));
    btn.on('pointerout', () => btn.setPillStyle({
      fill: UI_THEME.colors.cocoa,
      textColor: UI_THEME.colors.paper,
    }));
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
          shopping: 'Continue to shop',
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
          shopping: 'Continue to shop',
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
          shopping: 'Continue to shop',
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
    this._pendingEndSending = false;
    this._sacrificedIds.clear();
    this.closeTutorialHint();

    if (Array.isArray(turn.shop)) {
      G.shop = turn.shop.map(type => this.tutorialResolveType(type, tut.featured.type));
    } else if (!Array.isArray(G.shop)) {
      G.shop = [];
    }

    G.hand = hand.slice(0, 5);
    this.queueHandAppear(G.hand, {
      delay: opts.handEntranceDelay != null ? opts.handEntranceDelay : CARD_MOTION.handAppearDelay,
    });

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
      G.island = this.buildIslandState(island, {
        maxSend: requiredSent,
        tutorialDesc: `send ${requiredSent} pirates here`,
      });
      G.enemyShip = null;
      if (G.island.bonusEnthusiasm) G.enthusiasm += G.island.bonusEnthusiasm;
    }

    this.closePanels(G.phase === 'shopping' ? 'shopModal' : null);

    if (!opts.deferRender) {
      this.renderAll();
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
    if (!(this._animateInitialMapHand && !this.isTutorial() && G.phase === 'map')) {
      this.renderAll();
    }
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
    this._pendingEndSending = false;
    this._sacrificedIds.clear();
    if (node.type === 'ship') {
      G.boardingCount++;
      G.phase = 'boarding';
      G.island = null;
      G.enemyShip = { strength: node.strength };
    } else {
      G.phase = 'sending';
      G.island = this.buildIslandState(ISLANDS[node.islandIdx]);
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
    if (this._animateInitialMapHand) {
      this.queueHandAppear(G.hand, { delay: CARD_MOTION.handAppearDelay });
      this._animateInitialMapHand = false;
    }
    this.renderAll();

    const available = getAvailableNodes(G.map);
    if (available.length === 1) {
      this.applyMapNodeSelection(available[0]);
      return;
    }
    this.openMapPanel();
  }

  panelSceneKeys() {
    return ['map', 'shopModal', 'drawPileModal', 'discardPileModal'];
  }

  closePanels(exceptKey = null) {
    this.panelSceneKeys().forEach((key) => {
      if (exceptKey && key === exceptKey) return;
      if (!this.scene.isActive(key)) return;
      if (key === 'map') this._mapPanelOpen = false;
      if (key === 'shopModal') this._shopPanelOpen = false;
      if (key === 'drawPileModal') this._drawPilePanelOpen = false;
      if (key === 'discardPileModal') this._discardPilePanelOpen = false;
      this.scene.stop(key);
    });
  }

  openPauseMenu() {
    if (this.isTutorialPopupOpen() || this.scene.isActive('pauseModal')) return;
    this.closePanels();
    if (window.PokiBridge) {
      window.PokiBridge.gameplayStop();
    }
    this.scene.launch('pauseModal', { version: GAME_VERSION });
    this.scene.bringToTop('pauseModal');
    this.scene.pause();
  }

  panelFlagKey(sceneKey) {
    const map = {
      map: '_mapPanelOpen',
      shopModal: '_shopPanelOpen',
      drawPileModal: '_drawPilePanelOpen',
      discardPileModal: '_discardPilePanelOpen',
    };
    return map[sceneKey] || null;
  }

  setPanelOpen(sceneKey, isOpen) {
    const flagKey = this.panelFlagKey(sceneKey);
    if (flagKey) this[flagKey] = !!isOpen;
    this.refreshPanelUi();
  }

  refreshPanelUi() {
    if (!this.sys || !this.sys.isActive()) return;
    this.renderPhase();
    this.renderBtn();
    this.renderNav();
  }

  openPanel(sceneKey) {
    if (this.isTutorialPopupOpen()) return;
    this.closePanels(sceneKey);
    if (this.scene.isActive(sceneKey)) return;
    this.scene.launch(sceneKey);
    this.scene.bringToTop(sceneKey);
    this.setPanelOpen(sceneKey, true);
  }

  openMapPanel() {
    if (this.isTutorial()) return;
    this.openPanel('map');
  }

  openShopPanel() {
    this.openPanel('shopModal');
  }

  openDrawPilePanel() {
    this.openPanel('drawPileModal');
  }

  openDiscardPilePanel() {
    this.openPanel('discardPileModal');
  }

  toggleMapPanel() {
    if (this.isTutorial()) return;
    this.togglePanel('map');
  }

  toggleShopPanel() {
    this.togglePanel('shopModal');
  }

  toggleDrawPilePanel() {
    this.togglePanel('drawPileModal');
  }

  toggleDiscardPilePanel() {
    this.togglePanel('discardPileModal');
  }

  togglePanel(sceneKey) {
    if (this.scene.isActive(sceneKey)) {
      this.setPanelOpen(sceneKey, false);
      this.scene.stop(sceneKey);
      return;
    }
    this.openPanel(sceneKey);
  }

  maxSend() {
    if (!G.island) return 0;
    if (G.island.maxSend != null) return G.island.maxSend;
    return 2 + (G.island.extraSend || 0);
  }

  sentOffsetX(si) {
    const m = this.maxSend();
    if (!this.L || m <= 1) return 0;
    const L = this.L;
    const cardW = CARD.W * this.sentCardScale() * L.k;
    const outlineW = Math.min(L.W - 40 * L.k, 360 * L.k);
    const maxStep = (outlineW - cardW) / Math.max(m - 1, 1);
    const desiredStep = cardW + 8 * L.k;
    const step = Math.max(0, Math.min(desiredStep, maxStep));
    return (si - (m - 1) / 2) * step;
  }

  islandCenterY() {
    const L = this.L;
    return Math.min(L.Y_ISL_CY, L.H * (L.IS_MOBILE ? 0.34 : 0.37));
  }

  sentCardScale() {
    return 1;
  }

  sentCardRotation(si) {
    return 0;
  }

  sentCardPlacement(si) {
    const L = this.L;
    return {
      x: L.cx + this.sentOffsetX(si),
      y: this.islandCenterY() - 22 * L.k,
      rotation: this.sentCardRotation(si),
      scale: this.sentCardScale(),
    };
  }

  sentCardIslandEffectPosition(si) {
    const L = this.L;
    const placement = this.sentCardPlacement(si);
    const cardH = Math.round(CARD.H * L.k) * placement.scale;
    const islandBand = cardIslandBandMetrics(Math.round(CARD.H * L.k), L.k);
    return {
      x: placement.x,
      y: placement.y - cardH / 2 + (islandBand.height * placement.scale) / 2,
      scale: placement.scale,
    };
  }

  sendToIsland(idx, fromPos) {
    if (this.isTutorialPopupOpen()) return;
    if (G.phase !== 'sending') return;
    if (G.sent.includes(idx) || G.sent.length >= this.maxSend()) return;

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
    const placement = this.sentCardPlacement(G.sent.length - 1);
    const toX = placement.x;
    const toY = placement.y;

    const { texKey: sendTex } = buildCardTexture(this, p.type, L);
    const ghost = this.add.image(fromX, fromY, sendTex);
    ghost.setOrigin(0.5, 0.5).setDepth(60);
    const cardStartW = Math.round(CARD.W * L.k);
    const cardStartH = Math.round(CARD.H * L.k);
    ghost.setDisplaySize(cardStartW, cardStartH);

    this.tweens.add({
      targets: ghost, x: toX, y: toY,
      displayWidth: cardStartW * placement.scale, displayHeight: cardStartH * placement.scale,
      rotation: placement.rotation,
      duration: CARD_MOTION.sendToIslandDuration, ease: 'Power2',
      onComplete: () => {
        ghost.destroy();
        this._sendingToIsland.delete(idx);
        const result = this.resolveIsland(p);
        const sentSlot = Math.max(0, G.sent.indexOf(idx));
        const effectPos = this.sentCardIslandEffectPosition(sentSlot);

        const isSacrifice = G.island && G.island.sacrifice;
        if (isSacrifice) {
          this.sacrificePirate(p, effectPos.x, effectPos.y);
        }

        this.renderAll();
        const spendDuration = this.showIslandResult(p, sentSlot, result, effectPos.x, effectPos.y);

        const baseWait = isSacrifice ? 1400 : (spendDuration !== false ? 1000 : 800);
        const waitMs = baseWait + (spendDuration || 0);
        this.time.delayedCall(waitMs, () => {
          if (G.phase !== 'sending') return;
          const sendingDone = this._sendingToIsland.size === 0;
          if (sendingDone && this._pendingEndSending) {
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
      const amt = this.islandYieldAmount(c.pRes, c.pN, isl);
      G.res[c.pRes] += amt;
      return { ok: true, convert: true, cRes: c.cRes, cN: c.cN, res: c.pRes, n: amt };
    }

    if (def.island.multi) {
      const items = [];
      for (const m of def.island.multi) {
        const amt = this.islandYieldAmount(m.res, m.amt, isl);
        G.res[m.res] += amt;
        items.push({ res: m.res, n: amt });
      }
      return { ok: true, items };
    }

    if (this.isTutorial() && this.getTutorialCurrentTurn() <= 4 && def.island.chance != null) {
      const tgt = def.island.res;
      const amt = this.islandYieldAmount(tgt, def.island.amt, isl);
      const islBonusE = def.island.bonusEnthusiasm || 0;
      if (islBonusE) G.enthusiasm += islBonusE;
      G.res[tgt] += amt;
      return { ok: true, res: tgt, n: amt, bonusEnthusiasm: islBonusE };
    }

    let chance = def.island.chance;
    const tgt = def.island.res;
    const amt = this.islandYieldAmount(tgt, def.island.amt, isl);

    if (tgt === 'gold' && G.res.map > 0) {
      chance = Math.min(chance + 0.30, 0.95);
      G.res.map--;
    }

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
    const altAmt = this.islandYieldAmount(alt, 1, isl);
    G.res[alt] += altAmt;
    return { ok: false, res: alt, n: altAmt, bonusEnthusiasm: islBonusE };
  }

  sacrificePirate(pirate, x, y) {
    G.allCrew = G.allCrew.filter(p => p.id !== pirate.id);
    G.deck = G.deck.filter(p => p.id !== pirate.id);
    G.discard = G.discard.filter(p => p.id !== pirate.id);
    this._sacrificedIds.add(pirate.id);
    this.time.delayedCall(400, () => {
      this.float(x, y, '💀 Lost!', '#c060ff');
    });
  }

  showIslandEffectOverlay(type, sentSlot, color) {
    if (sentSlot < 0) return;
    const L = this.L;
    const effectPos = this.sentCardIslandEffectPosition(sentSlot);
    const overlay = createCardBandOverlay(this, {
      type,
      band: 'island',
      x: effectPos.x,
      y: effectPos.y,
      scale: effectPos.scale,
      color,
      parentContainer: this.ct.fx,
      depth: 66,
      L,
    });
    showCardBandOverlay(this, overlay);
    this.time.delayedCall(420, () => {
      if (!this.sys || !this.sys.isActive()) return;
      hideCardBandOverlay(this, overlay);
    });
  }

  showIslandResult(pirate, sentSlot, r, x, y) {
    const L = this.L;
    const sentPlacement = this.sentCardPlacement(sentSlot);
    const bandH = cardIslandBandMetrics(Math.round(CARD.H * L.k), L.k).height * sentPlacement.scale;
    const fy = y - bandH / 2 - 18 * L.k;

    if (r.recall !== undefined) {
      if (r.ok) {
        this.showIslandEffectOverlay(pirate.type, sentSlot, '#80cbc4');
        this.effectText(x, fy, '↩ Recalled!', '#80cbc4');
      } else {
        this.showIslandEffectOverlay(pirate.type, sentSlot, '#ffa726');
        this.effectText(x, fy, 'No one to recall', '#ffa726', 400);
      }
      return false;
    }
    if (r.exileSent) {
      if (r.ok) {
        this.showIslandEffectOverlay(pirate.type, sentSlot, '#ff8a80');
        this.effectText(x, fy, '💀 Exiled ' + r.name + '!', '#ff8a80');
      } else {
        this.showIslandEffectOverlay(pirate.type, sentSlot, '#ffa726');
        this.effectText(x, fy, 'No one to exile', '#ffa726', 400);
      }
      return false;
    }

    let gainItems = [];
    let spendDuration = 0;
    if (r.convert) {
      this.showIslandEffectOverlay(pirate.type, sentSlot, '#66bb6a');
      this.effectText(x, fy,
        r.cN + RES_EMOJI[r.cRes] + ' → ' + r.n + RES_EMOJI[r.res], '#66bb6a');
      spendDuration = this.animateResourceSpend(x, y, [{ emoji: RES_EMOJI[r.cRes], count: r.cN }]);
      gainItems = [{ emoji: RES_EMOJI[r.res], count: r.n }];
    } else if (r.weapons) {
      this.showIslandEffectOverlay(pirate.type, sentSlot, '#66bb6a');
      this.effectText(x, fy, '+' + r.weapons + '🗡️', '#66bb6a');
      gainItems = [{ emoji: '🗡️', count: r.weapons }];
    } else if (r.items) {
      this.showIslandEffectOverlay(pirate.type, sentSlot, '#66bb6a');
      const msg = r.items.map(i => '+' + i.n + RES_EMOJI[i.res]).join(' ');
      this.effectText(x, fy, msg, '#66bb6a');
      gainItems = r.items.map(i => ({ emoji: RES_EMOJI[i.res], count: i.n }));
    } else {
      const em = RES_EMOJI[r.res] || '🗺️';
      const eBonus = r.bonusEnthusiasm ? ' +' + r.bonusEnthusiasm + '☠️' : '';
      gainItems = [{ emoji: em, count: r.n }];
      if (r.bonusEnthusiasm) gainItems.push({ emoji: '☠️', count: r.bonusEnthusiasm });
      if (r.ok) {
        this.showIslandEffectOverlay(pirate.type, sentSlot, '#66bb6a');
        this.effectText(x, fy, '+' + r.n + em + eBonus, '#66bb6a');
      } else if (r.res === 'map') {
        this.showIslandEffectOverlay(pirate.type, sentSlot, '#ffd54f');
        this.effectText(x, fy, '+🗺️!' + eBonus, '#ffd54f', 400);
      } else {
        this.showIslandEffectOverlay(pirate.type, sentSlot, '#ffa726');
        this.effectText(x, fy, 'Miss +' + r.n + em + eBonus, '#ffa726', 400);
      }
    }

    if (gainItems.length) {
      if (spendDuration > 0) {
        this.time.delayedCall(spendDuration, () => {
          this.animateResourceGain(x, y, gainItems);
        });
      } else {
        this.animateResourceGain(x, y, gainItems);
      }
    }
    return spendDuration;
  }

  endSending() {
    if (this.isTutorialPopupOpen()) return;
    if (G.phase !== 'sending') return;
    if (this._sendingToIsland.size > 0) {
      this._pendingEndSending = true;
      return;
    }
    this._pendingEndSending = false;
    this.closePanels();
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

    this._shipQueue = [];
    for (let i = 0; i < G.hand.length; i++) {
      if (!G.sent.includes(i)) this._shipQueue.push(i);
    }
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
        this.closePanels();
        G.phase = 'shopping';
        G.busy = false;
        this.renderAll();
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
    const shipEffectSuccessColor = '#177C05';
    const shipEffectFailColor = '#CE2E25';

    this._cardHand.prepareForShipEffect();
    this._cardHand.highlightShipCard(hi, true);

    const pos = this._cardHand.getCardPosition(hi);
    const x = pos ? pos.x : L.cx;
    const y = pos ? pos.y : L.Y_HAND;

    const resolveAndContinue = (effectDuration) => {
      this.time.delayedCall(effectDuration, () => {
        const nextHi = this._shipQueuePos < this._shipQueue.length
          ? this._shipQueue[this._shipQueuePos]
          : -1;
        this._cardHand.hideShipEffectOverlay(hi);
        this._cardHand.highlightShipCard(hi, false);
        this._cardHand.clearShipSpread();
        if (nextHi >= 0) {
          this._cardHand.highlightShipCard(nextHi, true, { spread: false });
        }
        this.time.delayedCall(250, () => {
          this.renderTop();
          this.renderBtn();
          this.renderNav();
          this.time.delayedCall(150, () => this.processNextShip());
        });
      });
    };

    if (def.ship && def.ship.removeSelf) {
      G.allCrew = G.allCrew.filter(p => p.id !== pirate.id);
      G.deck = G.deck.filter(p => p.id !== pirate.id);
      G.discard = G.discard.filter(p => p.id !== pirate.id);
      this._cardHand.showShipEffectOverlay(hi, shipEffectSuccessColor);
      resolveAndContinue(600);
      return;
    }

    if (def.ship && def.ship.removeFromDeck) {
      if (def.ship.cRes && (G.res[def.ship.cRes] || 0) < def.ship.cN) {
        this._cardHand.showShipEffectOverlay(hi, shipEffectFailColor);
        resolveAndContinue(500);
        return;
      }
      const handIds = new Set(G.hand.map(p => p.id));
      const targets = G.allCrew.filter(p => !handIds.has(p.id));
      if (targets.length === 0) {
        this._cardHand.showShipEffectOverlay(hi, shipEffectFailColor);
        resolveAndContinue(500);
        return;
      }
      if (def.ship.cRes) {
        G.res[def.ship.cRes] -= def.ship.cN;
        this.animateResourceSpend(x, y, [{ emoji: RES_EMOJI[def.ship.cRes], count: def.ship.cN }]);
      }
      this._cardHand.showShipEffectOverlay(hi, shipEffectSuccessColor);
      this.time.delayedCall(500, () => {
        this._cardHand.highlightShipCard(hi, false);
        G.phase = 'removing';
        G.busy = false;
        this.renderAll();
      });
      return;
    }

    if (!def.ship) {
      this._cardHand.showShipEffectOverlay(hi, shipEffectFailColor);
      resolveAndContinue(500);
      return;
    }

    const r = this.resolveShip(pirate);
    const s = def.ship;
    this._cardHand.showShipEffectOverlay(hi, r.ok ? shipEffectSuccessColor : shipEffectFailColor);
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
    const shipWait = 1000 + spendDuration;
    resolveAndContinue(shipWait);
  }

  completeRemoval(pirateId) {
    G.allCrew = G.allCrew.filter(p => p.id !== pirateId);
    G.deck = G.deck.filter(p => p.id !== pirateId);
    G.discard = G.discard.filter(p => p.id !== pirateId);

    const L = this.L;
    this.float(L.cx, this.inventoryLayout().rowY - 10 * L.k, '💀 Exiled!', '#ff8a80');

    G.phase = 'ship';
    G.busy = true;
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
    G.discard.push(p);

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
    G.shopAnimating = false;
    if (opts.deferRender) return p;
    this.renderAll();
    if (!opts.skipPanelRefresh && this.scene.isActive('shopModal')) {
      this.scene.get('shopModal').renderPanel();
    }
    return p;
  }

  handleShoppingContinue() {
    if (this.isTutorial()) {
      this.ensureTutorialFlow();
      const turn = this.getTutorialTurn();
      const needFeatured = !!(turn && turn.requireFeaturedPurchase);
      if (needFeatured && !(G.tutorial.featured && G.tutorial.featured.bought)) {
        this.float(this.L.cx, this.L.Y_ISL_CY - 40 * this.L.k, `Buy ${this.tutorialFeaturedName()} to continue`, '#ffa726');
        return;
      }
    }
    this.advanceFromShopping();
  }

  advanceFromShopping() {
    if (!this.isTutorial() && G.shop.length) {
      G.shop.shift();
      G.shop.push(randomShopType(G.round + 1));
    }
    this.prepareNextRound();
  }

  prepareNextRound() {
    if (this.isTutorialPopupOpen()) return;
    if (G.phase !== 'shopping') return;
    G.busy = true;
    const discardAnimEnd = this.animateCurrentHandToDiscard();
    const nextTurnDelay = discardAnimEnd + CARD_MOTION.betweenTurnsDelay;
    if (this.isTutorial()) {
      this.ensureTutorialFlow();
      const tut = this.tutorialState();
      const totalTurns = this.getTutorialTurnCount();
      if (tut.currentTurn >= totalTurns) {
        G.busy = false;
        return;
      }
      this.closePanels();
      G.hand = [];
      G.sent = [];
      this._sendingToIsland.clear();
      this._pendingEndSending = false;
      this.renderAll();
      this.time.delayedCall(nextTurnDelay, () => {
        if (!this.sys || !this.sys.isActive()) return;
        tut.currentTurn += 1;
        this.applyTutorialTurn(tut.currentTurn, {
          handEntranceDelay: CARD_MOTION.handAppearDelay,
        });
      });
      return;
    }
    const allCrewIds = new Set(G.allCrew.map(p => p.id));
    G.discard.push(...G.hand.filter(p => allCrewIds.has(p.id)));
    G.hand = [];
    G.sent = [];
    G.enthusiasm = 0;
    this._sendingToIsland.clear();
    this._pendingEndSending = false;
    this.renderAll();
    this.time.delayedCall(nextTurnDelay, () => {
      if (!this.sys || !this.sys.isActive()) return;
      G.busy = false;
      this.drawCardsIntoHand(5);
      this.enterMapPhase();
    });
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
    const crewStr = G.hand.reduce((s, p) => s + (TYPES[p.type].str || 0), 0);
    const totalStr = crewStr + this.shipBonusStr();
    const shipStr = G.enemyShip.strength;
    const L = this.L;

    if (totalStr >= shipStr) {
      this.float(L.cx, L.Y_ISL_CY - 80 * L.k, '⚔️ Victory!', '#66bb6a');
      this.time.delayedCall(1000, () => {
        const discardAnimEnd = this.animateCurrentHandToDiscard();
        const nextTurnDelay = discardAnimEnd + CARD_MOTION.betweenTurnsDelay;
        G.weapons = 0;
        G.discard.push(...G.hand);
        G.hand = [];
        G.sent = [];
        this._sendingToIsland.clear();
        this._pendingEndSending = false;
        this.renderAll();
        if (G.map.currentLayer >= MAP_LAYERS - 1) {
          G.busy = false;
          this.showVictory();
          return;
        }

        this.time.delayedCall(nextTurnDelay, () => {
          if (!this.sys || !this.sys.isActive()) return;
          G.busy = false;
          this.drawCardsIntoHand(5);
          this.enterMapPhase();
        });
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
    const L = this.L;
    const crewStr = G.hand.reduce((s, p) => s + (TYPES[p.type].str || 0), 0);
    const totalStr = crewStr + this.shipBonusStr();
    const shipStr = G.enemyShip ? G.enemyShip.strength : 0;

    if (totalStr >= shipStr) {
      this.float(L.cx, L.Y_ISL_CY - 80 * L.k, '⚔️ Victory!', '#66bb6a');
      this.time.delayedCall(1000, () => {
        this.animateCurrentHandToDiscard();
        G.weapons = 0;
        G.discard.push(...G.hand);
        G.hand = [];
        G.sent = [];
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

    this.addTo('gameover', this.add.text(L.cx, L.H * 0.28, 'Tutorial Complete',
      uiHeadingStyle(L, 40, UI_THEME.colors.paper)).setOrigin(0.5, 0));
    this.txt('gameover', L.cx, L.H * 0.38,
      'You won the scripted boarding fight on turn 5.',
      { color: UI_THEME.colors.mutedPaper });
    this.txt('gameover', L.cx, L.H * 0.44,
      'Start a real run and build your own deck.',
      { color: UI_THEME.colors.mutedPaper });

    const btn = makeUiPill(this, {
      x: L.cx,
      y: L.H * 0.56,
      label: 'Start Real Game',
      L,
      minW: 220 * L.k,
      minH: 56 * L.k,
      fill: UI_THEME.colors.cocoa,
      textColor: UI_THEME.colors.paper,
      textPx: 18,
    }).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setPillStyle({ fill: UI_THEME.colors.cocoaDark, textColor: UI_THEME.colors.paper }));
    btn.on('pointerout', () => btn.setPillStyle({ fill: UI_THEME.colors.cocoa, textColor: UI_THEME.colors.paper }));
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

    this.addTo('gameover', this.add.text(L.cx, L.H * 0.32, 'Defeated',
      uiHeadingStyle(L, 44, '#ff8a80')).setOrigin(0.5, 0));
    this.txt('gameover', L.cx, L.H * 0.40,
      `Survived ${G.round} rounds  ·  ${G.boardingCount} boarding${G.boardingCount !== 1 ? 's' : ''}`,
      { color: UI_THEME.colors.mutedPaper });

    const crewStr = G.hand.reduce((s, p) => s + (TYPES[p.type].str || 0), 0);
    const totalStr = crewStr + this.shipBonusStr();
    this.txt('gameover', L.cx, L.H * 0.46,
      `Your crew ${totalStr}⚔️  vs  Enemy ${G.enemyShip.strength}⚔️`,
      { color: '#ff8a80' });

    const btn = makeUiPill(this, {
      x: L.cx,
      y: L.H * 0.56,
      label: 'Try Again',
      L,
      minW: 180 * L.k,
      minH: 56 * L.k,
      fill: UI_THEME.colors.cocoa,
      textColor: UI_THEME.colors.paper,
      textPx: 18,
    }).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setPillStyle({ fill: UI_THEME.colors.cocoaDark, textColor: UI_THEME.colors.paper }));
    btn.on('pointerout', () => btn.setPillStyle({ fill: UI_THEME.colors.cocoa, textColor: UI_THEME.colors.paper }));
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

    this.addTo('gameover', this.add.text(L.cx, L.H * 0.28, 'Victory!',
      uiHeadingStyle(L, 44, UI_THEME.colors.paper)).setOrigin(0.5, 0));
    this.txt('gameover', L.cx, L.H * 0.36,
      'You conquered all 10 enemy ships!',
      { color: UI_THEME.colors.mutedPaper });
    this.txt('gameover', L.cx, L.H * 0.42,
      `${G.round} rounds  ·  Crew of ${G.allCrew.length}`,
      { color: UI_THEME.colors.mutedPaper });

    let inv = '';
    ['wood', 'stone', 'gold'].forEach(r => {
      if (G.res[r] > 0) inv += ` ${G.res[r]}${RES_EMOJI[r]}`;
    });
    if (G.cannons > 0) inv += ` ${G.cannons}💣`;
    if (inv) {
      this.txt('gameover', L.cx, L.H * 0.48, 'Final stash:' + inv,
        { color: UI_THEME.colors.mutedPaper });
    }

    const btn = makeUiPill(this, {
      x: L.cx,
      y: L.H * 0.58,
      label: 'Play Again',
      L,
      minW: 180 * L.k,
      minH: 56 * L.k,
      fill: UI_THEME.colors.cocoa,
      textColor: UI_THEME.colors.paper,
      textPx: 18,
    }).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setPillStyle({ fill: UI_THEME.colors.cocoaDark, textColor: UI_THEME.colors.paper }));
    btn.on('pointerout', () => btn.setPillStyle({ fill: UI_THEME.colors.cocoa, textColor: UI_THEME.colors.paper }));
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
    const base = uiBodyStyle(L, UI_THEME.colors.paper);
    const t = this.add.text(x, y, str, Object.assign(base, style)).setOrigin(0.5, 0);
    return this.addTo(k, t);
  }

  currentStrengthState() {
    const crew = G.hand.reduce((sum, pirate) => sum + (TYPES[pirate.type].str || 0), 0);
    return {
      crew,
      bonus: this.shipBonusStr(),
      total: crew + this.shipBonusStr(),
    };
  }

  currentGoalState() {
    if (G.enemyShip) {
      return {
        icon: '😈',
        line1: 'Enemy now.',
        line2: `Reach ⚔️ ${G.enemyShip.strength}`,
      };
    }

    if (this.isTutorial()) {
      const currentTurn = this.getTutorialCurrentTurn();
      for (let i = currentTurn; i < this.getTutorialTurnCount(); i++) {
        const turn = this.getTutorialTurn(i + 1);
        if (!turn || !(turn.phase === 'boarding' || turn.enemyShip)) continue;
        const strength = (turn.enemyShip && turn.enemyShip.strength != null)
          ? turn.enemyShip.strength
          : (turn.enemyStrength != null ? turn.enemyStrength : 0);
        const turnsAway = i + 1 - currentTurn;
        return {
          icon: '😈',
          line1: `Enemy in ${turnsAway} turn${turnsAway === 1 ? '' : 's'}.`,
          line2: `Reach ⚔️ ${strength}`,
        };
      }
      return { icon: '⭐', line1: 'Final stretch.', line2: 'Keep building strength' };
    }

    if (!G.map || !Array.isArray(G.map.layers)) {
      return { icon: '🗺️', line1: 'Choose a route.', line2: 'Open the map' };
    }

    const currentLayer = G.map.currentLayer;
    for (let li = Math.max(0, currentLayer + 1); li < G.map.layers.length; li++) {
      const layer = G.map.layers[li];
      if (!layer || layer.length !== 1 || layer[0].type !== 'ship') continue;
      const turnsAway = li - currentLayer;
      return {
        icon: '😈',
        line1: `Enemy in ${turnsAway} turn${turnsAway === 1 ? '' : 's'}.`,
        line2: `Reach ⚔️ ${layer[0].strength}`,
      };
    }

    return { icon: '⭐', line1: 'No more battles.', line2: 'Sail to the end' };
  }

  islandDescription() {
    if (!G.island) return 'Choose a route on the map';
    if (G.island.bonus === 'wood') return 'Pirates gain twice more wood';
    if (G.island.bonus === 'stone') return 'Pirates gain twice more stone';
    if (G.island.bonus === 'gold') return 'Pirates gain twice more gold';
    if (G.island.extraSend) return 'You can send one extra pirate';
    if (G.island.maxSend != null) return `Send up to ${G.island.maxSend} pirates`;
    if (G.island.bonusEnthusiasm) return `Gain ${G.island.bonusEnthusiasm}☠️ on landing`;
    if (G.island.sacrifice) return 'Pirates sent here are lost forever';
    if (G.island.tutorialDesc) return G.island.tutorialDesc;
    return 'Set sail and gather what you can';
  }

  inventoryDisplayItems(extraKeys = []) {
    const keep = new Set(extraKeys);
    return [
      { key: 'wood', emoji: RES_EMOJI.wood, count: G.res.wood || 0 },
      { key: 'stone', emoji: RES_EMOJI.stone, count: G.res.stone || 0 },
      { key: 'gold', emoji: RES_EMOJI.gold, count: G.res.gold || 0 },
      { key: 'map', emoji: RES_EMOJI.map, count: G.res.map || 0 },
      { key: 'enthusiasm', emoji: '☠️', count: G.enthusiasm || 0 },
      { key: 'weapons', emoji: '🗡️', count: G.weapons || 0 },
      { key: 'cannons', emoji: '💣', count: G.cannons || 0 },
    ].filter((item) => item.count > 0 || keep.has(item.key));
  }

  currentIslandAction() {
    if (G.busy || this.isTutorialPopupOpen()) return null;
    if (G.phase === 'boarding') {
      return { label: 'Board!', onClick: () => this.resolveBoarding(), variant: 'continue' };
    }
    if (G.phase === 'sending') {
      if (G.sent.length >= this.maxSend()) {
        if (this._sendingToIsland.size > 0) return null;
        return { label: 'Work on Ship', onClick: () => this.endSending(), variant: 'continue' };
      }
      return { label: 'End', onClick: () => this.endSending(), variant: 'end' };
    }
    if (G.phase === 'shopping' && !this._shopPanelOpen) {
      return { label: 'Continue', onClick: () => this.openShopPanel(), variant: 'continue' };
    }
    return null;
  }

  islandActionY() {
    return this.L.Y_ISL_LBL + 78 * this.L.k;
  }

  islandContinueY() {
    const handTopY = handCardsTopY(this.L);
    return handTopY - 48 * this.L.k;
  }

  endActionY() {
    return this.L.Y_HAND_CENTER - CARD.H * this.L.k * 0.56;
  }

  actionPanelRightX() {
    const L = this.L;
    const screenRight = L.W - 24 * L.k;
    if (L.IS_MOBILE) return screenRight;

    const islandRight = L.cx + Math.min(L.W - 40 * L.k, 360 * L.k) / 2;
    const visibleCount = G.hand.reduce((count, _pirate, handIdx) => {
      if (G.sent.includes(handIdx) || this._sendingToIsland.has(handIdx)) return count;
      return count + 1;
    }, 0);
    const handSlots = visibleCount > 0 ? cardHandLayout(visibleCount, L) : [];
    const handRight = handSlots.length > 0
      ? Math.max(...handSlots.map(slot => slot.x)) + CARD.W * L.k * 0.5
      : 0;
    const playAreaRight = Math.max(islandRight, handRight);
    return Math.min(screenRight, playAreaRight + 28 * L.k);
  }

  measurePillWidth(label, opts = {}) {
    if (!label) return 0;
    const L = this.L;
    const probe = this.add.text(0, -9999, label, uiHeadingStyle(L, opts.textPx || 16, opts.textColor || UI_THEME.colors.paper));
    const padX = opts.padX != null ? opts.padX : 20 * L.k;
    const width = Math.max(opts.minW || 0, probe.width + padX * 2);
    probe.destroy();
    return width;
  }

  footerPileBtnOpts() {
    const L = this.L;
    return {
      textPx: 16,
      padX: 12 * L.k,
      padY: 8 * L.k,
      minH: 0,
    };
  }

  inventoryLayout(extraKeys = []) {
    const L = this.L;
    const pileBtnOpts = this.footerPileBtnOpts();
    const items = this.inventoryDisplayItems(extraKeys);
    const slotW = 30 * L.k;
    const slotH = 32 * L.k;
    const gap = 4 * L.k;
    const emojiOffsetX = -4 * L.k;
    const countOffsetX = 7 * L.k;
    const totalWidth = items.length > 0 ? items.length * slotW + (items.length - 1) * gap : 0;

    const left = 22 * L.k;
    const footerGap = 14 * L.k;
    const drawWidth = this.measurePillWidth('Draw Pile', pileBtnOpts);
    const discardWidth = this.measurePillWidth('Discard', pileBtnOpts);
    const leftEdge = left + drawWidth + footerGap;
    const rightEdge = L.W - 22 * L.k - discardWidth - footerGap;
    const centeredLeft = L.cx - totalWidth / 2;
    const centeredRight = L.cx + totalWidth / 2;
    const inline = totalWidth > 0 && centeredLeft >= leftEdge && centeredRight <= rightEdge;
    const rowY = inline ? (L.Y_NAV + slotH * 0.5) : (L.Y_NAV - 20 * L.k);
    const centerX = L.cx;
    const startX = centerX - totalWidth / 2 + slotW / 2;
    return { items, slotW, slotH, gap, rowY, totalWidth, startX, emojiOffsetX, countOffsetX };
  }

  inventoryTargetForItem(itemOrEmoji) {
    const emoji = typeof itemOrEmoji === 'string' ? itemOrEmoji : itemOrEmoji.emoji;
    const key = (typeof itemOrEmoji === 'object' && itemOrEmoji.key) || ({
      [RES_EMOJI.wood]: 'wood',
      [RES_EMOJI.stone]: 'stone',
      [RES_EMOJI.gold]: 'gold',
      [RES_EMOJI.map]: 'map',
      '☠️': 'enthusiasm',
      '🗡️': 'weapons',
      '💣': 'cannons',
    })[emoji];
    const layout = this.inventoryLayout(key ? [key] : []);
    const idx = layout.items.findIndex((item) => item.key === key);
    const safeIdx = idx >= 0 ? idx : 0;
    return {
      x: layout.startX + safeIdx * (layout.slotW + layout.gap) + layout.emojiOffsetX,
      y: layout.rowY - layout.slotH * 0.45,
    };
  }

  pileButtonCenter(kind) {
    const L = this.L;
    const pileBtnOpts = this.footerPileBtnOpts();
    if (kind === 'draw') {
      const width = this.measurePillWidth('Draw Pile', pileBtnOpts);
      return { x: 22 * L.k + width / 2, y: L.Y_NAV };
    }
    const width = this.measurePillWidth('Discard', pileBtnOpts);
    return { x: L.W - 22 * L.k - width / 2, y: L.Y_NAV };
  }

  queueHandAppear(cards, opts = {}) {
    if (!Array.isArray(cards) || cards.length === 0) return opts.delay || 0;
    const from = opts.from || this.pileButtonCenter('draw');
    const delay = opts.delay || 0;
    const stagger = opts.stagger != null ? opts.stagger : CARD_MOTION.handAppearStagger;
    const startScale = opts.startScale != null ? opts.startScale : 0.38;
    const duration = opts.duration != null ? opts.duration : CARD_MOTION.handAppearDuration;
    let endAt = delay;
    if (!this._pendingHandAppearById || typeof this._pendingHandAppearById !== 'object') {
      this._pendingHandAppearById = {};
    }
    cards.forEach((pirate, idx) => {
      if (!pirate) return;
      const entryDelay = delay + idx * stagger;
      this._pendingHandAppearById[pirate.id] = {
        x: from.x,
        y: from.y,
        delay: entryDelay,
        duration,
        startScale,
        rotation: -0.18 + idx * 0.05,
      };
      endAt = Math.max(endAt, entryDelay + duration);
    });
    return endAt;
  }

  consumeHandAppear() {
    if (!this._pendingHandAppearById) return null;
    const byId = this._pendingHandAppearById;
    const byIdx = {};
    let found = false;
    G.hand.forEach((pirate, handIdx) => {
      if (!pirate || !byId[pirate.id]) return;
      byIdx[handIdx] = byId[pirate.id];
      found = true;
    });
    this._pendingHandAppearById = null;
    return found ? byIdx : null;
  }

  snapshotHandCardsForDiscard() {
    const visibleByIdx = {};
    (this._cardHand.cards || []).forEach((card) => {
      visibleByIdx[card.handIdx] = card;
    });
    const sentSlotByIdx = new Map();
    G.sent.forEach((handIdx, sentIdx) => {
      sentSlotByIdx.set(handIdx, sentIdx);
    });

    const cards = [];
    G.hand.forEach((pirate, handIdx) => {
      if (!pirate) return;
      const visible = visibleByIdx[handIdx];
      if (visible) {
        cards.push({
          type: pirate.type,
          x: visible.container.x,
          y: visible.container.y,
          rotation: visible.container.rotation,
          scale: visible.container.scaleX || 1,
        });
        return;
      }
      if (!sentSlotByIdx.has(handIdx)) return;
      const placement = this.sentCardPlacement(sentSlotByIdx.get(handIdx));
      cards.push({
        type: pirate.type,
        x: placement.x,
        y: placement.y,
        rotation: placement.rotation || 0,
        scale: placement.scale != null ? placement.scale : 1,
      });
    });
    return cards;
  }

  animateCardGhost(card, target, opts = {}) {
    const L = this.L;
    const delay = opts.delay || 0;
    const duration = opts.duration != null ? opts.duration : CARD_MOTION.ghostDuration;
    const startScale = card.scale != null ? card.scale : 1;
    const endScale = opts.endScale != null ? opts.endScale : 0.34;
    const startRotation = card.rotation || 0;
    const endRotation = opts.endRotation != null ? opts.endRotation : Phaser.Math.FloatBetween(-0.14, 0.14);
    const endAlpha = opts.endAlpha != null ? opts.endAlpha : 0.16;
    const scatterX = opts.scatterX != null ? opts.scatterX : 16 * L.k;
    const scatterY = opts.scatterY != null ? opts.scatterY : 10 * L.k;
    const targetX = target.x + (Math.random() - 0.5) * scatterX;
    const targetY = target.y - (Math.random() * scatterY);
    const cpX = (card.x + targetX) / 2 + (Math.random() - 0.5) * (opts.arcSpreadX != null ? opts.arcSpreadX : 80 * L.k);
    const cpY = Math.min(card.y, targetY) - (opts.arcHeight != null ? opts.arcHeight : 80 * L.k);

    this.time.delayedCall(delay, () => {
      if (!this.sys || !this.sys.isActive()) return;
      const built = buildCardTexture(this, card.type, L);
      const baseScale = built.textureResolution > 1 ? (1 / built.textureResolution) : 1;
      const ghost = this.add.image(card.x, card.y, built.texKey)
        .setOrigin(0.5, 0.5)
        .setDepth(65)
        .setRotation(startRotation)
        .setScale(startScale * baseScale);
      this.ct.fx.add(ghost);

      let destroyed = false;
      const destroyGhost = () => {
        if (destroyed) return;
        destroyed = true;
        if (ghost && ghost.scene && ghost.scene.sys) {
          ghost.destroy();
        }
      };

      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        ease: opts.ease || 'Cubic.easeInOut',
        onUpdate: (tw) => {
          if (!ghost || !ghost.scene || !ghost.scene.sys) return;
          const p = tw.getValue();
          const q = 1 - p;
          const x = q * q * card.x + 2 * q * p * cpX + p * p * targetX;
          const y = q * q * card.y + 2 * q * p * cpY + p * p * targetY;
          ghost.setPosition(x, y);
          ghost.setRotation(Phaser.Math.Linear(startRotation, endRotation, p));
          const scale = Phaser.Math.Linear(startScale, endScale, p);
          ghost.setScale(scale * baseScale);
          ghost.setAlpha(Phaser.Math.Linear(1, endAlpha, p));
        },
        onStop: destroyGhost,
        onComplete: destroyGhost,
      });
    });

    return delay + duration;
  }

  animateCardsToDiscard(cards, opts = {}) {
    if (!Array.isArray(cards) || cards.length === 0) return opts.delay || 0;
    const target = this.pileButtonCenter('discard');
    const baseDelay = opts.delay || 0;
    const stagger = opts.stagger != null ? opts.stagger : CARD_MOTION.discardStagger;
    let endAt = baseDelay;
    cards.forEach((card, idx) => {
      endAt = Math.max(endAt, this.animateCardGhost(card, target, {
        delay: baseDelay + idx * stagger,
        duration: CARD_MOTION.discardDuration,
        arcHeight: 120 * this.L.k,
        arcSpreadX: 70 * this.L.k,
        endScale: 0.34,
        endAlpha: 0.18,
      }));
    });
    return endAt;
  }

  animateCurrentHandToDiscard(opts = {}) {
    return this.animateCardsToDiscard(this.snapshotHandCardsForDiscard(), opts);
  }

  animateReshuffleToDraw(reshuffles, opts = {}) {
    if (!Array.isArray(reshuffles) || reshuffles.length === 0) return opts.delay || 0;
    const from = this.pileButtonCenter('discard');
    const to = this.pileButtonCenter('draw');
    let cursor = opts.delay || 0;

    reshuffles.forEach((entry) => {
      const sourceCards = (entry.previewCards && entry.previewCards.length)
        ? entry.previewCards
        : (entry.cards || []);
      const cards = sourceCards.slice();
      let batchEnd = cursor;
      cards.forEach((pirate, idx) => {
        batchEnd = Math.max(batchEnd, this.animateCardGhost({
          type: pirate.type,
          x: from.x + (idx - (cards.length - 1) / 2) * 10 * this.L.k,
          y: from.y - idx * 4 * this.L.k,
          rotation: -0.12 + idx * 0.06,
          scale: 0.34,
        }, to, {
          delay: cursor + idx * CARD_MOTION.reshuffleStagger,
          duration: CARD_MOTION.reshuffleDuration,
          arcHeight: 34 * this.L.k,
          arcSpreadX: 24 * this.L.k,
          endScale: 0.34,
          endAlpha: 0.22,
          scatterX: 10 * this.L.k,
          scatterY: 6 * this.L.k,
          ease: 'Sine.easeInOut',
        }));
      });
      cursor = batchEnd + CARD_MOTION.reshuffleSettleDelay;
    });

    return cursor;
  }

  drawCardsIntoHand(n, opts = {}) {
    const meta = drawCardsWithMeta(n);
    if (opts.append) G.hand.push(...meta.cards);
    else G.hand = meta.cards;
    const steps = Array.isArray(meta.steps) ? meta.steps : [];
    let cursor = opts.delay || 0;
    const stepGap = opts.stepGap != null ? opts.stepGap : CARD_MOTION.sequenceGap;

    steps.forEach((step, idx) => {
      if (!step) return;
      if (step.type === 'draw') {
        cursor = this.queueHandAppear(step.cards, { delay: cursor });
      } else if (step.type === 'reshuffle') {
        const nextStep = steps[idx + 1];
        const previewCards = nextStep && nextStep.type === 'draw' ? nextStep.cards : null;
        cursor = this.animateReshuffleToDraw([{ ...step, previewCards }], { delay: cursor });
      }
      if (idx < steps.length - 1) cursor += stepGap;
    });

    return meta;
  }

  renderInventory() {
    const L = this.L;
    const layout = this.inventoryLayout();
    if (layout.items.length === 0) return;
    const counterStyle = uiBodyStyle(L, UI_THEME.colors.paper, {
      fontSize: L.fs(14),
      stroke: UI_THEME.colors.shadow,
      strokeThickness: Math.max(2, Math.round(2 * L.k)),
    });

    layout.items.forEach((item, idx) => {
      const x = layout.startX + idx * (layout.slotW + layout.gap);
      const y = layout.rowY;

      const emoji = this.add.text(
        x + layout.emojiOffsetX,
        y,
        item.emoji,
        uiHeadingStyle(L, 32, UI_THEME.colors.paper)
      ).setOrigin(0.5, 1);
      this.addTo('nav', emoji);

      const counter = this.add.text(
        x + layout.countOffsetX,
        y - 1 * L.k,
        String(item.count),
        counterStyle
      ).setOrigin(0, 1);
      this.addTo('nav', counter);
    });
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
    const pad = 18 * L.k;
    const labelY = 18 * L.k;
    const valueY = 40 * L.k;
    const sectionGap = 16 * L.k;
    const iconTextGap = 8 * L.k;
    const rightReserve = 188 * L.k;
    const goal = this.currentGoalState();
    const strength = this.currentStrengthState();

    const strengthLabel = this.add.text(pad, labelY, 'Strength', uiHeadingStyle(L, 16, UI_THEME.colors.paper))
      .setOrigin(0, 0);
    const strengthValue = this.add.text(pad, valueY, `⚔️${strength.total}`, uiHeadingStyle(L, 32, UI_THEME.colors.paper))
      .setOrigin(0, 0);
    const strengthBlockWidth = Math.max(strengthLabel.width, strengthValue.width);
    const goalX = pad + strengthBlockWidth + sectionGap;
    const goalLabel = this.add.text(goalX, labelY, 'Current goal', uiHeadingStyle(L, 16, UI_THEME.colors.paper))
      .setOrigin(0, 0);
    const goalIcon = this.add.text(goalX, valueY - 2 * L.k, goal.icon, uiHeadingStyle(L, 26, UI_THEME.colors.paper))
      .setOrigin(0, 0);
    const goalTextX = goalX + goalIcon.width + iconTextGap;
    const goalWidth = Math.max(96 * L.k, L.W - rightReserve - goalTextX);
    const goalText = this.add.text(goalTextX, valueY + 1 * L.k, `${goal.line1}\n${goal.line2}`, uiBodyStyle(L, UI_THEME.colors.paper, {
      lineSpacing: uiLineSpacingPx(L, UI_THEME.fonts.bodyPx, 15),
      wordWrap: { width: goalWidth },
    })).setOrigin(0, 0);

    [strengthLabel, strengthValue, goalLabel, goalIcon, goalText].forEach((node) => {
      this.addTo('top', node);
    });
  }

  renderIsland() {
    this.clearCt('island');
    const L = this.L;
    const cx = L.cx;
    const cy = this.islandCenterY();
    const titleY = cy + 96 * L.k;
    const titleDescMargin = 8 * L.k;
    const titleLineSpacing = Math.round(-18 * L.k);
    const outlineW = Math.min(L.W - 40 * L.k, 360 * L.k);
    const outlineH = 144 * L.k;

    if (G.enemyShip) {
      const title = this.add.text(cx, cy, 'Enemy Ship', uiHeadingStyle(L, 64, UI_THEME.colors.paper, {
        align: 'center',
        lineSpacing: titleLineSpacing,
        wordWrap: { width: L.W - 72 * L.k },
      })).setOrigin(0.5);
      this.addTo('island', title);

      if (G.enemyShip.strength != null) {
        this.addTo('island', this.add.text(
          cx,
          cy + title.height * 0.5 + 10 * L.k,
          `You need ${G.enemyShip.strength}⚔️ to win`,
          uiBodyStyle(L, UI_THEME.colors.paper, {
            align: 'center',
            wordWrap: { width: L.W - 120 * L.k },
          })
        ).setOrigin(0.5, 0));
      }
      return;
    }

    if (!G.island) {
      const title = this.add.text(cx, titleY, 'Open Sea', uiHeadingStyle(L, 64, UI_THEME.colors.paper, {
        align: 'center',
        lineSpacing: titleLineSpacing,
      })).setOrigin(0.5, 0);
      this.addTo('island', title);
      this.addTo('island', this.add.text(cx, titleY + title.height + titleDescMargin, 'Choose the next place to sail', uiBodyStyle(L, UI_THEME.colors.paper))
        .setOrigin(0.5, 0));
      return;
    }

    const outline = this.add.graphics();
    outline.lineStyle(Math.max(2, 6 * L.k), uiColorInt(UI_THEME.colors.outline), 1);
    outline.strokeEllipse(cx, cy, outlineW, outlineH);
    this.addTo('island', outline);

    const title = this.add.text(cx, titleY, G.island.name, uiHeadingStyle(L, 64, UI_THEME.colors.paper, {
      align: 'center',
      lineSpacing: titleLineSpacing,
      wordWrap: { width: L.W - 72 * L.k },
    })).setOrigin(0.5, 0);
    this.addTo('island', title);
    this.addTo('island', this.add.text(cx, titleY + title.height + titleDescMargin, this.islandDescription(), uiBodyStyle(L, UI_THEME.colors.paper, {
      align: 'center',
      wordWrap: { width: L.W - 120 * L.k },
    })).setOrigin(0.5, 0));

    G.sent.forEach((hi, si) => {
      if (this._sendingToIsland.has(hi)) return;
      const p = G.hand[hi];
      const placement = this.sentCardPlacement(si);
      const cardView = createPirateCard(this, {
        type: p.type,
        x: placement.x,
        y: placement.y,
        rotation: placement.rotation,
        scale: placement.scale,
        depth: 12 + si,
        L,
        container: this.ct.island,
      });
      if (this._sacrificedIds.has(p.id)) {
        cardView.container.setAlpha(0.35);
      }
    });
  }

  renderPhase() {
    this.clearCt('phase');
    if (G.phase !== 'removing') return;
    const L = this.L;
    const crew = [...G.allCrew].sort((a, b) => {
      const ca = TYPES[a.type].cost ?? -1;
      const cb = TYPES[b.type].cost ?? -1;
      if (ca !== cb) return ca - cb;
      return a.type < b.type ? -1 : a.type > b.type ? 1 : 0;
    });
    const handIds = new Set(G.hand.map(p => p.id));
    const selectable = crew.filter(p => !handIds.has(p.id));
    const rowY = L.Y_ISL_LBL + 172 * L.k;
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

  renderHand() {
    const prevPositions = this._cardHand.getCardPositions();
    const appearFrom = this.consumeHandAppear();
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
    const allowInteraction = isSending;

    this._cardHand.render({
      hand: G.hand,
      sent: G.sent,
      sendingSet: this._sendingToIsland,
      isSending,
      allowInteraction,
      prevPositions,
      appearFrom,
      tutorialBlocked: (p) => this.isTutorial() && G.phase === 'sending' &&
        this.isTutorialIslandBlockedPirate(p, tutorialTurn),
      tutorialTargetIdx,
      onSendToIsland: (idx, fromPos) => this.sendToIsland(idx, fromPos),
      container: this.ct.hand,
    });
  }

  renderBtn() {
    this.clearCt('btn');
    const action = this.currentIslandAction();
    if (!action) return;
    const L = this.L;
    if (action.variant === 'end') {
      const color = '#DEBEA2';
      const end = this.add.text(this.actionPanelRightX(), this.endActionY(), action.label, uiHeadingStyle(L, 16, color))
        .setOrigin(1, 0.5)
        .setInteractive({ useHandCursor: true });
      end.on('pointerover', () => end.setColor(UI_THEME.colors.paper));
      end.on('pointerout', () => end.setColor(color));
      end.on('pointerdown', (ptr) => {
        ptr.event.stopPropagation();
        action.onClick();
      });
      this.addTo('btn', end);
      return;
    }
    if (action.variant === 'continue') {
      const actionY = this.endActionY();
      const actionX = this.actionPanelRightX();
      this.mkBtn('btn', actionX, actionY, action.label, action.onClick, {
        originX: 1,
        minH: 48 * L.k,
        minW: 122 * L.k,
        textPx: 16,
      });
      return;
    }
    const actionY = this.islandActionY();
    const actionX = L.cx;
    this.mkBtn('btn', actionX, actionY, action.label, action.onClick, {
      originX: 0.5,
      minH: 48 * L.k,
      minW: 122 * L.k,
      textPx: 16,
    });
  }

  renderNav() {
    this.clearCt('nav');
    const L = this.L;
    this.renderInventory();

    const panelEnabled = !this.isTutorialPopupOpen();
    const mapEnabled = panelEnabled && !this.isTutorial();
    const shopEnabled = panelEnabled && !G.busy && (!this.isTutorial() || G.phase === 'shopping');
    const pileEnabled = panelEnabled && !G.busy;
    const pauseEnabled = panelEnabled;
    const topGap = 10 * L.k;
    const topY = 60 * L.k;
    const iconOpts = {
      originX: 1,
      textPx: 20,
      minW: 50 * L.k,
      minH: 50 * L.k,
      padX: 12 * L.k,
      padY: 10 * L.k,
    };
    const footerY = L.Y_NAV;
    const pileBtnOpts = this.footerPileBtnOpts();

    const mapOpen = this._mapPanelOpen;
    const shopOpen = this._shopPanelOpen;
    const shopBtn = this.mkBtn('nav', L.W - 22 * L.k, topY, '🛒', () => {
      this.toggleShopPanel();
    }, {
      ...iconOpts,
      enabled: shopEnabled,
      bg: shopOpen ? UI_THEME.colors.cocoaDark : UI_THEME.colors.cocoa,
      hoverBg: UI_THEME.colors.cocoaDark,
      disabledBg: UI_THEME.colors.disabled,
      color: UI_THEME.colors.paper,
      disabledColor: UI_THEME.colors.ink,
    });

    const mapBtn = this.mkBtn('nav', shopBtn.x - shopBtn.width / 2 - topGap, topY, '🗺️', () => {
      this.toggleMapPanel();
    }, {
      ...iconOpts,
      enabled: mapEnabled,
      bg: mapOpen ? UI_THEME.colors.cocoaDark : UI_THEME.colors.cocoa,
      hoverBg: UI_THEME.colors.cocoaDark,
      disabledBg: UI_THEME.colors.disabled,
      color: UI_THEME.colors.paper,
      disabledColor: UI_THEME.colors.ink,
    });

    this.mkBtn('nav', mapBtn.x - mapBtn.width / 2 - topGap, topY, '⏸', () => {
      this.openPauseMenu();
    }, {
      ...iconOpts,
      enabled: pauseEnabled,
      bg: UI_THEME.colors.cocoa,
      hoverBg: UI_THEME.colors.cocoaDark,
      disabledBg: UI_THEME.colors.disabled,
      color: UI_THEME.colors.paper,
      disabledColor: UI_THEME.colors.ink,
    });

    const drawPileOpen = this._drawPilePanelOpen;
    this.mkBtn('nav', 22 * L.k, footerY, 'Draw Pile', () => {
      this.toggleDrawPilePanel();
    }, {
      ...pileBtnOpts,
      originX: 0,
      enabled: pileEnabled,
      bg: drawPileOpen ? UI_THEME.colors.cocoaDark : UI_THEME.colors.cocoa,
      hoverBg: UI_THEME.colors.cocoaDark,
      disabledBg: UI_THEME.colors.disabled,
      color: UI_THEME.colors.paper,
      disabledColor: UI_THEME.colors.ink,
    });

    const discardOpen = this._discardPilePanelOpen;
    this.mkBtn('nav', L.W - 22 * L.k, footerY, 'Discard', () => {
      this.toggleDiscardPilePanel();
    }, {
      ...pileBtnOpts,
      originX: 1,
      enabled: pileEnabled,
      bg: discardOpen ? UI_THEME.colors.cocoaDark : UI_THEME.colors.cocoa,
      hoverBg: UI_THEME.colors.cocoaDark,
      disabledBg: UI_THEME.colors.disabled,
      color: UI_THEME.colors.paper,
      disabledColor: UI_THEME.colors.ink,
    });
  }

  mkBtn(k, x, y, label, cb, opts = {}) {
    const enabled = opts.enabled !== false;
    const fill = enabled ? (opts.bg || UI_THEME.colors.cocoa) : (opts.disabledBg || UI_THEME.colors.disabled);
    const textColor = enabled ? (opts.color || UI_THEME.colors.paper) : (opts.disabledColor || UI_THEME.colors.ink);
    const btn = makeUiPill(this, {
      x,
      y,
      label,
      L: this.L,
      fill,
      textColor,
      textPx: opts.textPx != null ? opts.textPx : 16,
      minH: opts.minH != null ? opts.minH : 48 * this.L.k,
      minW: opts.minW,
      padX: opts.padX,
      padY: opts.padY,
      radius: opts.radius,
    });
    btn.setPosition(
      x + (0.5 - (opts.originX != null ? opts.originX : 0.5)) * btn.width,
      y
    );
    if (enabled) {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setPillStyle({
        fill: opts.hoverBg || UI_THEME.colors.cocoaDark,
        textColor,
      }));
      btn.on('pointerout', () => btn.setPillStyle({ fill, textColor }));
      btn.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); cb(); });
    }
    this.addTo(k, btn);
    return btn;
  }

  // ──────────── RESOURCE ANIMATIONS ────────────

  animateResourceGain(fromX, fromY, items) {
    const L = this.L;
    let delay = 0;
    for (const item of items) {
      const target = this.inventoryTargetForItem(item);
      const targetX = target.x;
      const targetY = target.y;
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
    let delay = 0;
    let totalEmojis = 0;
    for (const item of items) totalEmojis += Math.min(item.count || 1, 8);
    for (const item of items) {
      const start = this.inventoryTargetForItem(item);
      const startX = start.x;
      const startY = start.y;
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
      fontFamily: UI_THEME.fonts.heading, fontSize: L.fs(24), color: col || UI_THEME.colors.paper,
      stroke: UI_THEME.colors.shadow, strokeThickness: 3 * L.k,
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
      fontFamily: UI_THEME.fonts.heading, fontSize: L.fs(24), color: col || UI_THEME.colors.paper,
      stroke: UI_THEME.colors.shadow, strokeThickness: 3 * L.k,
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({
      targets: t, y: y - 70 * L.k, alpha: 0,
      duration: 1400, ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }
}
