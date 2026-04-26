/* ============================================================
   PIRATES — GameScene
   ============================================================ */

class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  init(data) {
    this._sceneRestartData = data || {};
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
    const restartData = this._sceneRestartData || {};
    this._sceneRestartData = null;
    if (restartData.resetMode === 'battleTest') {
      initBattleTestState(restartData.battleTestRepeat || null);
    } else if (restartData.resetMode === 'run') {
      initState();
    }
    ensureCatTextures(this);
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.L = computeLayout(this.scale.width, this.scale.height);
    const hasBattleTestState = G && G.mode === 'battleTest';
    const needsFreshState = !hasBattleTestState && !G.map;
    if (needsFreshState) initState();

    this.ct = {};
    ['top', 'island', 'phase', 'hand', 'btn', 'nav', 'fx', 'overlay', 'gameover'].forEach(k => {
      this.ct[k] = this.add.container(0, 0);
    });
    this.ct.fx.setDepth(50);
    this.ct.overlay.setDepth(60);
    this.ct.gameover.setDepth(200);
    this._sendingToIsland = new Set();
    this._pendingEndSending = false;
    this._sacrificedIds = new Set();
    this._combatTickTimer = null;
    this._combatEffectTimers = [];
    this._combatEnemyViews = {};
    this._combatPlayerViews = {};
    this._combatNodes = {};
    this._activeHeldCombatTooltipKey = null;
    this._combatTipState = null;
    this._renderAllQueued = false;
    this._combatSetupPopupPinned = false;
    this._combatSetupDragState = null;
    this._combatSetupPopupDismissTimer = null;
    this._weaponAssignFlow = null;
    this._pendingWeaponQueue = [];
    this._boardingIntroTimer = null;
    this.input.setDraggable([]);
    this._cardHand = new CardHand(this);
    this._cardTips = new CardTooltipController(this, { depth: 165 });
    this._pendingHandAppearById = null;
    this._pendingHandAppearUntil = 0;
    this._animateInitialMapHand = needsFreshState;
    this.normalizeCrewWeapons();

    this._mapPanelOpen = false;
    this._shopPanelOpen = false;
    this._drawPilePanelOpen = false;
    this._discardPilePanelOpen = false;
    this._panelButtons = {};

    this._onResize = () => {
      this.L = computeLayout(this.scale.width, this.scale.height);
      if (!G.shopAnimating) this.renderAll();
    };
    this.scale.on('resize', this._onResize);
    this._onCombatHoldPointerUp = () => {
      if (!this._activeHeldCombatTooltipKey) return;
      this.hideCombatTooltipForKey(this._activeHeldCombatTooltipKey, { force: true });
      this._activeHeldCombatTooltipKey = null;
    };
    this.input.on('pointerup', this._onCombatHoldPointerUp);

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
      if (this._onCombatHoldPointerUp) {
        this.input.off('pointerup', this._onCombatHoldPointerUp);
      }
      Object.entries(this._panelShutdownHandlers || {}).forEach(([key, handler]) => {
        this.scene.get(key).events.off(Phaser.Scenes.Events.SHUTDOWN, handler);
      });
      this.clearCombatState();
      if (this._cardHand) this._cardHand.destroy();
      if (this._cardTips) this._cardTips.destroy();
      if (window.PokiBridge) window.PokiBridge.gameplayStop();
    });

    this.startRound();
    if (G.phase === 'map') this.enterMapPhase();
  }

  // ──────────── GAME FLOW ────────────

  isBattleTest() {
    return !!(G && G.mode === 'battleTest');
  }

  normalizeCrewWeapons() {
    [G.allCrew, G.deck, G.discard, G.hand].forEach((cards) => {
      if (!Array.isArray(cards)) return;
      cards.forEach((pirate) => {
        if (!pirate) return;
        pirate.weaponKey = WEAPON_TYPES[pirate.weaponKey] ? pirate.weaponKey : null;
        pirate.might = Math.max(0, Math.floor(Number(pirate.might) || 0));
        pirate.tempo = Math.max(0, Math.floor(Number(pirate.tempo) || 0));
        pirate.wounded = !!pirate.wounded;
      });
    });
  }

  pirateWeaponKey(pirate) {
    if (!pirate) return null;
    return WEAPON_TYPES[pirate.weaponKey] ? pirate.weaponKey : null;
  }

  pirateHasWeapon(pirate) {
    return !!this.pirateWeaponKey(pirate);
  }

  pirateMight(pirate) {
    return Math.max(0, Math.floor(Number(pirate && pirate.might) || 0));
  }

  pirateTempo(pirate) {
    return Math.max(0, Math.floor(Number(pirate && pirate.tempo) || 0));
  }

  pirateBuffCount(pirate) {
    return this.pirateMight(pirate) + this.pirateTempo(pirate);
  }

  pirateBuffSummary(pirate) {
    const parts = [];
    const might = this.pirateMight(pirate);
    const tempo = this.pirateTempo(pirate);
    if (might > 0) parts.push(`${BUFF_EMOJI.might}${might}`);
    if (tempo > 0) parts.push(`${BUFF_EMOJI.tempo}${tempo}`);
    return parts.join(' ');
  }

  pirateWounded(pirate) {
    return !!(pirate && pirate.wounded);
  }

  woundedCrew() {
    return (G.allCrew || []).filter((pirate) => pirate && this.pirateWounded(pirate));
  }

  readyCrew() {
    return (G.allCrew || []).filter((pirate) => pirate && !this.pirateWounded(pirate));
  }

  activeCombatHandPirates() {
    return (G.hand || []).filter((pirate) => pirate && !this.pirateWounded(pirate));
  }

  markPirateWounded(pirateId) {
    const pirate = (G.allCrew || []).find((candidate) => candidate && candidate.id === pirateId);
    if (!pirate || pirate.wounded) return false;
    pirate.wounded = true;
    return true;
  }

  healingLimit() {
    const fromState = G.healing && G.healing.max;
    const fromIsland = G.island && G.island.healWounded;
    return Math.max(0, Math.floor(Number(fromState != null ? fromState : fromIsland) || 0));
  }

  healingUsed() {
    return Array.isArray(G.healing && G.healing.healedIds) ? G.healing.healedIds.length : 0;
  }

  ensureHealingState() {
    if (!G.healing) {
      G.healing = {
        max: this.healingLimit(),
        healedIds: [],
      };
    }
    if (!Array.isArray(G.healing.healedIds)) G.healing.healedIds = [];
    G.healing.max = this.healingLimit();
    return G.healing;
  }

  healPirate(pirateId) {
    if (G.phase !== 'healing') return false;
    const state = this.ensureHealingState();
    if (this.healingUsed() >= this.healingLimit()) return false;
    const pirate = (G.allCrew || []).find((candidate) => candidate && candidate.id === pirateId);
    if (!pirate || !pirate.wounded || state.healedIds.includes(pirate.id)) return false;

    pirate.wounded = false;
    state.healedIds.push(pirate.id);
    const label = (TYPES[pirate.type] && TYPES[pirate.type].name) || 'Pirate';
    this.float(this.L.cx, this.endActionY() - 54 * this.L.k, `${label} healed`, '#66bb6a');
    this.renderAll();
    return true;
  }

  continueFromHealing() {
    if (G.phase !== 'healing') return;
    G.healing = null;
    G.phase = 'map';
    G.island = null;
    this.closePanels();
    this.renderAll();
    this.enterMapPhase();
  }

  setPirateWeapon(pirate, weaponKey) {
    if (!pirate) return null;
    pirate.weaponKey = WEAPON_TYPES[weaponKey] ? weaponKey : null;
    return pirate.weaponKey;
  }

  addPirateBuff(pirate, buffKey, count = 1) {
    if (!pirate || !BUFF_EMOJI[buffKey]) return 0;
    const amount = Math.max(0, Math.floor(Number(count) || 0));
    if (amount <= 0) return 0;
    pirate[buffKey] = Math.max(0, Math.floor(Number(pirate[buffKey]) || 0)) + amount;
    return amount;
  }

  leftmostIslandPirateEntry() {
    const sent = Array.isArray(G.sent) ? G.sent : [];
    for (let sentSlot = 0; sentSlot < sent.length; sentSlot++) {
      const handIdx = sent[sentSlot];
      const pirate = G.hand && G.hand[handIdx];
      if (!pirate) continue;
      if (this._sacrificedIds.has(pirate.id)) continue;
      return { pirate, handIdx, sentSlot };
    }
    return null;
  }

  leftmostIslandPirate() {
    const entry = this.leftmostIslandPirateEntry();
    return entry ? entry.pirate : null;
  }

  islandPirateEffectPoint(sentSlot) {
    if (sentSlot == null || sentSlot < 0) return null;
    return this.sentCardIslandEffectPosition(sentSlot);
  }

  applyPersonalGainsToPirate(pirate, gains) {
    const personalGains = normalizePersonalGains(gains);
    if (!pirate || !personalGains.length) return { applied: false, gains: [] };

    const applied = [];
    personalGains.forEach((gain) => {
      if (gain.weapon) {
        const weaponKey = this.setPirateWeapon(pirate, gain.weapon);
        if (weaponKey) applied.push({ weapon: weaponKey, count: gain.count });
      } else if (gain.buff) {
        const added = this.addPirateBuff(pirate, gain.buff, gain.count);
        if (added > 0) applied.push({ buff: gain.buff, count: added });
      }
    });

    return {
      applied: applied.length > 0,
      gains: applied,
      text: personalGainText(applied),
      pirate,
    };
  }

  splitPersonalGains(gains) {
    const personalGains = normalizePersonalGains(gains);
    const weaponGains = personalGains.filter((gain) => !!gain.weapon);
    const buffGains = personalGains.filter((gain) => !!gain.buff);
    return { personalGains, weaponGains, buffGains };
  }

  applyShipPersonalGains(gains) {
    const personalGains = normalizePersonalGains(gains);
    if (!personalGains.length) return { applied: false, gains: [] };
    const target = this.leftmostIslandPirateEntry();
    if (!target) {
      return {
        applied: false,
        gains: personalGains,
        lost: true,
        text: 'No island pirate',
        color: '#ffa726',
      };
    }
    const applied = this.applyPersonalGainsToPirate(target.pirate, personalGains);
    return {
      ...applied,
      applied: applied.applied,
      handIdx: target.handIdx,
      sentSlot: target.sentSlot,
      color: '#66bb6a',
    };
  }

  canAssignWeaponToHandIndex(handIdx) {
    const pirate = G.hand && G.hand[handIdx];
    if (!pirate) return false;
    if (this._sendingToIsland.has(handIdx)) return false;
    if (this._sacrificedIds.has(pirate.id)) return false;
    return true;
  }

  roundWeaponCandidateIndices() {
    return (G.hand || []).reduce((indices, pirate, handIdx) => {
      if (this.canAssignWeaponToHandIndex(handIdx)) indices.push(handIdx);
      return indices;
    }, []);
  }

  queueWeaponGrant(grant) {
    const queue = weaponGrantQueue(grant);
    if (!queue.length) return 0;
    this._pendingWeaponQueue.push(...queue);
    return queue.length;
  }

  weaponAssignmentActive() {
    return !!(this._weaponAssignFlow && WEAPON_TYPES[this._weaponAssignFlow.weaponKey]);
  }

  currentWeaponAssignment() {
    return this.weaponAssignmentActive() ? this._weaponAssignFlow : null;
  }

  finishWeaponAssignmentFlow() {
    const flow = this._weaponAssignFlow;
    if (!flow) return;
    const onComplete = flow.onComplete;
    this._weaponAssignFlow = null;
    this.renderAll();
    if (onComplete) onComplete();
  }

  advanceWeaponAssignmentFlow() {
    const flow = this._weaponAssignFlow;
    if (!flow) return;
    if (this.roundWeaponCandidateIndices().length === 0) {
      this.finishWeaponAssignmentFlow();
      return;
    }

    while (flow.queue.length > 0) {
      const nextWeaponKey = flow.queue.shift();
      if (!WEAPON_TYPES[nextWeaponKey]) continue;
      flow.weaponKey = nextWeaponKey;
      this.renderAll();
      return;
    }

    this.finishWeaponAssignmentFlow();
  }

  startWeaponAssignmentFlow(queue, opts = {}) {
    const nextQueue = Array.isArray(queue)
      ? queue.filter((weaponKey) => WEAPON_TYPES[weaponKey])
      : [];
    if (nextQueue.length === 0 || this.roundWeaponCandidateIndices().length === 0) {
      if (typeof opts.onComplete === 'function') opts.onComplete();
      return false;
    }

    this._weaponAssignFlow = {
      queue: nextQueue,
      weaponKey: null,
      onComplete: typeof opts.onComplete === 'function' ? opts.onComplete : null,
      reason: opts.reason || 'round',
    };
    this.advanceWeaponAssignmentFlow();
    return true;
  }

  maybeStartPendingWeaponAssignment(opts = {}) {
    if (this.weaponAssignmentActive()) return true;
    if (!Array.isArray(this._pendingWeaponQueue) || this._pendingWeaponQueue.length === 0) return false;
    const queue = [...this._pendingWeaponQueue];
    this._pendingWeaponQueue = [];
    return this.startWeaponAssignmentFlow(queue, opts);
  }

  assignWeaponToHandPirate(handIdx) {
    const flow = this.currentWeaponAssignment();
    if (!flow) return;
    const pirate = G.hand[handIdx];
    if (!pirate) return;
    if (!this.canAssignWeaponToHandIndex(handIdx)) {
      if (this._sacrificedIds.has(pirate.id)) {
        this.float(this.L.cx, this.endActionY() - 54 * this.L.k, 'That pirate is gone', '#ffa726');
        return;
      }
      if (this._sendingToIsland.has(handIdx)) return;
      return;
    }

    const weaponKey = flow.weaponKey;
    const oldWeaponKey = this.pirateWeaponKey(pirate);
    const oldWeapon = oldWeaponKey ? WEAPON_TYPES[oldWeaponKey] : null;
    pirate.weaponKey = weaponKey;
    const weapon = WEAPON_TYPES[weaponKey];
    const label = (TYPES[pirate.type] && TYPES[pirate.type].name) || 'Pirate';
    if (weapon) {
      const text = oldWeapon
        ? `${label} swapped ${oldWeapon.emoji} for ${weapon.emoji}`
        : `${label} took ${weapon.emoji}`;
      this.float(this.L.cx, this.endActionY() - 54 * this.L.k, text, '#66bb6a');
    }
    this.advanceWeaponAssignmentFlow();
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
      fullSendBuff: normalizePersonalGain(src.fullSendBuff || opts.fullSendBuff),
      sacrifice: !!src.sacrifice,
      healWounded: Math.max(0, Math.floor(Number(src.healWounded || opts.healWounded) || 0)),
      scoutedCacheDrill: (src.scoutedCacheDrill || opts.scoutedCacheDrill)
        ? {
          mainKey: (src.scoutedCacheDrill || opts.scoutedCacheDrill).mainKey || null,
          granted: !!(src.scoutedCacheDrill || opts.scoutedCacheDrill).granted,
        }
        : null,
    };
  }

  islandYieldAmount(res, amount, island = G.island) {
    const base = Number(amount) || 0;
    if (!res || !island || island.bonus !== res) return base;
    return base * 2;
  }

  applyScoutedCounterCache(node) {
    if (this.isBattleTest() || !node || node.type !== 'island') return null;
    const cache = node.scoutedCache;
    if (!cache || cache.claimed) return null;

    const island = ISLANDS[node.islandIdx];
    if (!island || island.healWounded) return null;

    const res = cache.res;
    const amount = Math.max(0, Math.floor(Number(cache.amount) || 0));
    const alert = Math.max(0, Math.floor(Number(cache.alert) || 0));
    if (!res || !RES_EMOJI[res] || (amount <= 0 && alert <= 0)) return null;

    if (!G.res) G.res = { wood: 0, stone: 0, gold: 0 };
    if (amount > 0) {
      G.res[res] = Math.max(0, Math.floor(Number(G.res[res]) || 0)) + amount;
    }
    if (alert > 0) {
      G.boardingAlert = this.pendingBoardingAlert() + alert;
    }
    cache.claimed = true;

    return { res, amount, alert, mainKey: cache.mainKey || null };
  }

  scoutedCacheDrillCounterTypes(mainKey) {
    if (!mainKey || typeof SCOUTED_SHIP_COUNTERS !== 'object') return [];
    const counters = SCOUTED_SHIP_COUNTERS[mainKey];
    return Array.isArray(counters) ? counters.filter(type => !!TYPES[type]) : [];
  }

  scoutedCacheDrillState() {
    if (this.isBattleTest() || G.phase !== 'sending' || !G.island || G.island.healWounded) return null;
    const drill = G.island.scoutedCacheDrill;
    if (!drill || !drill.mainKey) return null;
    if (!this.scoutedCacheDrillCounterTypes(drill.mainKey).length) return null;
    return drill;
  }

  scoutedCacheDrillDescription() {
    const drill = this.scoutedCacheDrillState();
    if (!drill) return '';
    if (drill.granted) return 'Cache Drill claimed';
    const names = this.scoutedCacheDrillCounterTypes(drill.mainKey)
      .map(type => TYPES[type] && TYPES[type].name)
      .filter(Boolean);
    const label = names.length > 2 ? `${names[0]}/${names[1]}...` : names.join('/');
    return `Cache Drill: first ${label || 'counter'} gains +💪`;
  }

  pirateStillInCrew(pirate) {
    if (!pirate) return false;
    return (G.allCrew || []).some(candidate => candidate && candidate.id === pirate.id);
  }

  applyScoutedCacheDrill(pirate, opts = {}) {
    const drill = this.scoutedCacheDrillState();
    if (!drill || drill.granted || !pirate || !pirate.type) return null;
    if (!this.scoutedCacheDrillCounterTypes(drill.mainKey).includes(pirate.type)) return null;
    if (!this.pirateStillInCrew(pirate)) return null;
    if (this._sacrificedIds && this._sacrificedIds.has(pirate.id)) return null;

    const applied = this.applyPersonalGainsToPirate(pirate, [{ buff: 'might', count: 1 }]);
    if (!applied.applied) return null;

    drill.granted = true;
    drill.pirateId = pirate.id;
    drill.type = pirate.type;

    const handIdx = (G.hand || []).findIndex(candidate => candidate && candidate.id === pirate.id);
    const sentSlot = handIdx >= 0 && Array.isArray(G.sent) ? G.sent.indexOf(handIdx) : -1;
    const reward = {
      ...applied,
      mainKey: drill.mainKey,
      handIdx,
      sentSlot,
      label: (TYPES[pirate.type] && TYPES[pirate.type].name) || 'Pirate',
    };
    if (!opts.silent) this.showScoutedCacheDrillResult(reward);
    return reward;
  }

  showScoutedCacheDrillResult(reward) {
    if (!reward || !this.L) return;
    const point = reward.sentSlot != null && reward.sentSlot >= 0
      ? this.islandPirateEffectPoint(reward.sentSlot)
      : null;
    const x = point ? point.x : this.L.cx;
    const y = point ? point.y + 28 * this.L.k : this.endActionY() - 54 * this.L.k;
    this.effectText(x, y, `Cache Drill +${reward.text || '💪'}`, '#ffca28', 760);
    this.renderIsland();
  }

  startRound() {
    // G.round, G.phase, G.island, G.enemyShip, G.hand, G.sent, G.enthusiasm
    // are all set by MapScene.selectMapNode() before transitioning here.
    if (window.PokiBridge) {
      window.PokiBridge.gameplayStart();
    }
    if (!(this._animateInitialMapHand && G.phase === 'map')) {
      this.renderAll();
    }
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
    this.clearCombatState();
    this._weaponAssignFlow = null;
    this._pendingWeaponQueue = [];
    this._sendingToIsland.clear();
    this._pendingEndSending = false;
    this._sacrificedIds.clear();
    G.fullCrewDiscount = 0;
    let cacheGrant = null;
    if (node.type === 'ship') {
      const alert = this.consumeBoardingAlertForBoarding();
      G.boardingCount++;
      G.phase = 'boarding';
      G.island = null;
      G.healing = null;
      G.enemyShip = {
        strength: node.strength,
        encounterNo: G.boardingCount,
        encounter: node.encounter || null,
        boardingAlert: alert.amount,
        boardingAlertGuards: alert.guardCount,
      };
    } else {
      cacheGrant = this.applyScoutedCounterCache(node);
      G.island = this.buildIslandState(ISLANDS[node.islandIdx]);
      if (cacheGrant && cacheGrant.mainKey && this.scoutedCacheDrillCounterTypes(cacheGrant.mainKey).length) {
        G.island.scoutedCacheDrill = {
          mainKey: cacheGrant.mainKey,
          granted: false,
        };
      }
      G.enemyShip = null;
      if (G.island.healWounded) {
        G.phase = 'healing';
        G.healing = { max: G.island.healWounded, healedIds: [] };
      } else {
        G.phase = 'sending';
        G.healing = null;
        if (G.island.bonusEnthusiasm) G.enthusiasm += G.island.bonusEnthusiasm;
      }
    }

    this.closePanels();
    this.renderAll();
    if (cacheGrant && this.L) {
      const resText = `${cacheGrant.amount > 1 ? cacheGrant.amount : ''}${RES_EMOJI[cacheGrant.res]}`;
      const alertText = cacheGrant.alert > 0
        ? ` +${cacheGrant.alert > 1 ? cacheGrant.alert : ''}Alert`
        : '';
      this.float(this.L.cx, this.L.Y_ISL_CY - 78 * this.L.k, `Scouted cache +${resText}${alertText}`, '#ffd166');
    }
    return true;
  }

  enterMapPhase() {
    this.closePanels('map');
    G.phase = 'map';
    G.island = null;
    G.enemyShip = null;
    G.healing = null;
    this.clearCombatState();
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
    if (this._cardTips) this._cardTips.hide();
    let changed = false;
    this.panelSceneKeys().forEach((key) => {
      if (exceptKey && key === exceptKey) return;
      if (!this.scene.isActive(key)) return;
      if (key === 'map') this._mapPanelOpen = false;
      if (key === 'shopModal') this._shopPanelOpen = false;
      if (key === 'drawPileModal') this._drawPilePanelOpen = false;
      if (key === 'discardPileModal') this._discardPilePanelOpen = false;
      const panelScene = this.scene.get(key);
      if (panelScene && typeof panelScene.requestClose === 'function') {
        panelScene.requestClose();
      } else {
        this.scene.stop(key);
      }
      changed = true;
    });
    if (changed) this.refreshPanelUi();
  }

  openPauseMenu() {
    if (this.scene.isActive('pauseModal')) return;
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
    if (this._cardTips) this._cardTips.hide();
    const originRect = this.panelButtonRect(sceneKey);
    this.closePanels(sceneKey);
    if (this.scene.isActive(sceneKey)) return;
    this.scene.launch(sceneKey, { originRect });
    this.scene.bringToTop(sceneKey);
    this.setPanelOpen(sceneKey, true);
  }

  openMapPanel() {
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
    if (this._cardTips) this._cardTips.hide();
    if (this.scene.isActive(sceneKey)) {
      this.setPanelOpen(sceneKey, false);
      const panelScene = this.scene.get(sceneKey);
      if (panelScene && typeof panelScene.requestClose === 'function') {
        panelScene.requestClose();
      } else {
        this.scene.stop(sceneKey);
      }
      return;
    }
    this.openPanel(sceneKey);
  }

  maxSend() {
    if (!G.island) return 0;
    if (G.island.maxSend != null) return G.island.maxSend;
    return 2 + (G.island.extraSend || 0);
  }

  unusedSendSlots() {
    if (G.phase !== 'sending' || !G.island || G.island.healWounded) return 0;
    return Math.max(0, this.maxSend() - G.sent.length);
  }

  shipWageProjection(sentCount = (Array.isArray(G.sent) ? G.sent.length : 0)) {
    const paysWages = !this.isBattleTest() && G.phase === 'sending' && !!G.island && !G.island.healWounded;
    const max = paysWages ? this.maxSend() : 0;
    const sent = Math.max(0, Math.min(max, Math.floor(Number(sentCount) || 0)));
    const unused = paysWages ? Math.max(0, max - sent) : 0;
    const openingCommission = paysWages ? this.projectOpeningCommission(sent) : 0;
    return {
      unused,
      openingCommission,
      wages: paysWages ? unused + 1 + openingCommission : 0,
      alert: unused,
    };
  }

  shipWagePreview() {
    return this.shipWageProjection();
  }

  shipWages() {
    return this.shipWagePreview().wages;
  }

  pendingBoardingAlert() {
    return Math.max(0, Math.floor(Number(G.boardingAlert) || 0));
  }

  boardingAlertGuardCount(amount = this.pendingBoardingAlert()) {
    const alert = Math.max(0, Math.floor(Number(amount) || 0));
    if (alert <= 0) return 0;
    if (alert >= 6) return 3;
    return alert >= 3 ? 2 : 1;
  }

  boardingAlertGuardLabel(guardCount) {
    const count = Math.max(0, Math.min(3, Math.floor(Number(guardCount) || 0)));
    if (count <= 0) return '';
    return `+${count} guard${count === 1 ? '' : 's'}`;
  }

  boardingAlertPlunderLabel(guardCount) {
    const plunder = this.boardingAlertGuardPlunder(guardCount);
    const items = this.boardingAlertPlunderItems(plunder);
    if (!items.length) return '';
    return `win ${items.map((item) => `+${item.count > 1 ? item.count : ''}${item.emoji}`).join(' ')}`;
  }

  boardingAlertRiskText(guardCount, opts = {}) {
    const count = Math.max(0, Math.min(3, Math.floor(Number(guardCount) || 0)));
    const label = opts.compact && count > 0
      ? `+${count}g`
      : this.boardingAlertGuardLabel(count);
    if (!label) return '';
    const includePlunder = opts.includePlunder !== false;
    const plunder = includePlunder ? this.boardingAlertPlunderLabel(guardCount) : '';
    return [label, plunder].filter(Boolean).join(' · ');
  }

  boardingAlertSummary(amount = this.pendingBoardingAlert(), guardCount = this.boardingAlertGuardCount(amount), opts = {}) {
    const alert = Math.max(0, Math.floor(Number(amount) || 0));
    const label = this.boardingAlertRiskText(guardCount, opts);
    return alert > 0 && label ? `Alert ${alert} · ${label}` : null;
  }

  quietDocksCost() {
    return Math.max(0, Math.floor(Number((QUIET_DOCKS && QUIET_DOCKS.cost) || 2) || 0));
  }

  quietDocksAlertReduction() {
    return Math.max(1, Math.floor(Number((QUIET_DOCKS && QUIET_DOCKS.alertReduction) || 1) || 1));
  }

  shopCreditMaxMissing() {
    return Math.max(0, Math.floor(Number((SHOP_CREDIT && SHOP_CREDIT.maxMissing) || 0) || 0));
  }

  shopCreditAlertPerMissing() {
    return Math.max(0, Math.floor(Number((SHOP_CREDIT && SHOP_CREDIT.alertPerMissing) || 0) || 0));
  }

  shopCreditAvailable() {
    return !this.isBattleTest() && G.phase === 'shopping' && !G.shopCreditUsed;
  }

  pendingFullCrewDiscount() {
    return Math.max(0, Math.min(1, Math.floor(Number(G.fullCrewDiscount) || 0)));
  }

  activeFullCrewDiscount() {
    if (this.isBattleTest() || G.phase !== 'shopping') return 0;
    return this.pendingFullCrewDiscount();
  }

  scoutedCounterTypes() {
    if (this.isBattleTest() || typeof scoutedCounterTypesForMap !== 'function') return [];
    return scoutedCounterTypesForMap(G.map, { mode: G.mode });
  }

  isScoutedCounterShopType(type) {
    if (!type) return false;
    return this.scoutedCounterTypes().includes(type);
  }

  counterRecruitReportsEarly(type) {
    if (!type || this.isBattleTest() || !this.isScoutedCounterShopType(type)) return false;
    const intel = this.nextShipIntel();
    const turnsAway = intel ? Math.max(0, Math.floor(Number(intel.turnsAway) || 0)) : 0;
    return !!intel && turnsAway >= 1 && turnsAway <= 3;
  }

  preparedCounterGains(type) {
    const def = TYPES[type];
    return normalizePersonalGains(def && def.ship && def.ship.personalGains);
  }

  updateFullCrewDiscountForCompletedIsland() {
    G.fullCrewDiscount = this.projectFullCrewDiscount(Array.isArray(G.sent) ? G.sent.length : 0);
    return G.fullCrewDiscount;
  }

  projectFullCrewDiscount(sentCount) {
    const max = this.maxSend();
    return !this.isBattleTest()
      && !!G.island
      && !G.island.healWounded
      && max > 0
      && Math.max(0, Math.floor(Number(sentCount) || 0)) >= max
      ? 1
      : 0;
  }

  projectOpeningCommission(sentCount) {
    const max = this.maxSend();
    const sent = Math.max(0, Math.floor(Number(sentCount) || 0));
    const round = Math.max(0, Math.floor(Number(G.round) || 0));
    const boardingCount = Math.max(0, Math.floor(Number(G.boardingCount) || 0));
    return !this.isBattleTest()
      && G.phase === 'sending'
      && !!G.island
      && !G.island.healWounded
      && boardingCount === 0
      && round >= 1
      && round <= 2
      && max > 0
      && sent >= max
      ? 1
      : 0;
  }

  projectPortDrill(sentCount) {
    const gain = normalizePersonalGain(G.island && G.island.fullSendBuff);
    const max = this.maxSend();
    const sent = Math.max(0, Math.floor(Number(sentCount) || 0));
    if (!gain
      || this.isBattleTest()
      || G.phase !== 'sending'
      || !G.island
      || G.island.healWounded
      || max <= 0
      || sent < max) {
      return null;
    }
    return {
      gain,
      text: personalGainText([gain]),
    };
  }

  applyPortDrill(opts = {}) {
    const drill = this.projectPortDrill(Array.isArray(G.sent) ? G.sent.length : 0);
    if (!drill) return null;
    const target = this.leftmostIslandPirateEntry();
    if (!target) return null;

    const applied = this.applyPersonalGainsToPirate(target.pirate, [drill.gain]);
    if (!applied.applied) return null;

    if (!opts.silent && this.L) {
      const point = this.islandPirateEffectPoint(target.sentSlot);
      const x = point ? point.x : this.L.cx;
      const y = point ? point.y : this.endActionY() - 54 * this.L.k;
      this.effectText(x, y, `+${applied.text || drill.text}`, '#66bb6a');
      this.renderIsland();
    }

    return {
      ...applied,
      handIdx: target.handIdx,
      sentSlot: target.sentSlot,
    };
  }

  shopPurchaseQuoteForState(type, state = null) {
    const def = TYPES[type];
    const cost = Math.max(0, Math.floor(Number(def && def.cost) || 0));
    const counter = !!(def && this.isScoutedCounterShopType(type));
    const topDeck = !!(def && this.counterRecruitReportsEarly(type));
    const preparedCounter = !!(topDeck && this.preparedCounterGains(type).length);
    if (!def) {
      return { canBuy: false, credit: false, counter: false, topDeck: false, preparedCounter: false, cost, effectiveCost: cost, discount: 0, missing: 0, alert: 0, spend: 0 };
    }
    const isProjection = !!state;
    const source = state || {};
    const discountPool = source.fullCrewDiscount != null
      ? source.fullCrewDiscount
      : this.activeFullCrewDiscount();
    const discount = Math.min(cost, Math.max(0, Math.min(1, Math.floor(Number(discountPool) || 0))));
    const effectiveCost = Math.max(0, cost - discount);
    const enthusiasmSource = source.enthusiasm != null ? source.enthusiasm : G.enthusiasm;
    const enthusiasm = Math.max(0, Math.floor(Number(enthusiasmSource) || 0));
    if (enthusiasm >= effectiveCost) {
      return { canBuy: true, credit: false, counter, topDeck, preparedCounter, cost, effectiveCost, discount, missing: 0, alert: 0, spend: effectiveCost };
    }
    const missing = effectiveCost - enthusiasm;
    const shopCreditUsed = source.shopCreditUsed != null ? !!source.shopCreditUsed : !!G.shopCreditUsed;
    const allowCredit = source.allowCredit != null ? !!source.allowCredit : (isProjection ? !this.isBattleTest() : this.shopCreditAvailable());
    const canCredit = allowCredit
      && !shopCreditUsed
      && missing >= 1
      && missing <= this.shopCreditMaxMissing();
    return {
      canBuy: canCredit,
      credit: canCredit,
      counter,
      topDeck,
      preparedCounter,
      cost,
      effectiveCost,
      discount,
      missing,
      alert: canCredit ? missing * this.shopCreditAlertPerMissing() : 0,
      spend: canCredit ? enthusiasm : 0,
    };
  }

  shopPurchaseQuote(type, state = null) {
    return this.shopPurchaseQuoteForState(type, state);
  }

  bestVisibleShopPurchase(state = null) {
    if (!Array.isArray(G.shop) || !G.shop.length) return null;
    const candidates = G.shop
      .map((type, index) => ({
        type,
        index,
        quote: this.shopPurchaseQuoteForState(type, state),
      }))
      .filter(item => item.quote && item.quote.canBuy);
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      const tierA = a.quote.credit ? 1 : 0;
      const tierB = b.quote.credit ? 1 : 0;
      if (tierA !== tierB) return tierA - tierB;
      const counterA = a.quote.counter ? 1 : 0;
      const counterB = b.quote.counter ? 1 : 0;
      if (counterA !== counterB) return counterB - counterA;
      const costA = Math.max(0, Number(a.quote.cost) || 0);
      const costB = Math.max(0, Number(b.quote.cost) || 0);
      if (costA !== costB) return costB - costA;
      const creditA = a.quote.credit ? 1 : 0;
      const creditB = b.quote.credit ? 1 : 0;
      if (creditA !== creditB) return creditA - creditB;
      return a.index - b.index;
    });
    return candidates[0];
  }

  shopPlanText(state = null) {
    const best = this.bestVisibleShopPurchase(state);
    if (!best) return 'Shop: no visible buy';
    const def = TYPES[best.type];
    const quote = best.quote;
    const price = quote.discount > 0
      ? `${quote.cost}->${quote.effectiveCost}☠️`
      : `${quote.effectiveCost}☠️`;
    const alertBase = state && state.boardingAlert != null
      ? Math.max(0, Math.floor(Number(state.boardingAlert) || 0))
      : this.pendingBoardingAlert();
    const alertRisk = quote.credit && quote.alert > 0
      ? this.boardingAlertRiskText(this.boardingAlertGuardCount(alertBase + quote.alert), { compact: true })
      : '';
    const credit = quote.credit && quote.alert > 0
      ? `, credit +${quote.alert} Alert${alertRisk ? ` (${alertRisk})` : ''}`
      : '';
    const label = quote.counter ? 'Counter ' : '';
    const prepared = quote.preparedCounter ? ', prepared' : '';
    const topDeck = quote.topDeck ? ', top deck' : '';
    return `Shop: ${label}${def.name} ${price}${prepared}${topDeck}${credit}`;
  }

  sendingPlanProjection(sentCount, opts = {}) {
    const wage = this.shipWageProjection(sentCount);
    const discount = this.projectFullCrewDiscount(sentCount);
    const enthusiasm = Math.max(0, Math.floor(Number(G.enthusiasm) || 0)) + wage.wages;
    const shopState = {
      enthusiasm,
      boardingAlert: this.pendingBoardingAlert() + Math.max(0, Math.floor(Number(wage.alert) || 0)),
      fullCrewDiscount: discount,
      shopCreditUsed: false,
    };
    return {
      wage,
      discount,
      portDrill: opts.includePortDrill ? this.projectPortDrill(sentCount) : null,
      shopText: this.shopPlanText(shopState),
    };
  }

  canUseQuietDocks() {
    if (this.isBattleTest()) return false;
    if (G.phase !== 'shopping' || G.busy || G.shopAnimating) return false;
    return this.pendingBoardingAlert() > 0 && G.enthusiasm >= this.quietDocksCost();
  }

  useQuietDocks(opts = {}) {
    if (!this.canUseQuietDocks()) return false;
    const beforeAlert = this.pendingBoardingAlert();
    const reduction = Math.min(this.quietDocksAlertReduction(), beforeAlert);
    G.enthusiasm -= this.quietDocksCost();
    G.boardingAlert = Math.max(0, beforeAlert - reduction);

    if (!opts.silent && this.L) {
      const summary = this.boardingAlertSummary(G.boardingAlert) || 'Alert cleared';
      this.float(this.L.cx, this.L.Y_ISL_CY - 40 * this.L.k, `Quiet Docks: ${summary}`, '#66bb6a');
    }
    if (opts.deferRender) return true;
    this.renderAll();
    if (!opts.skipPanelRefresh && this.scene.isActive('shopModal')) {
      this.scene.get('shopModal').renderPanel();
    }
    return true;
  }

  enterShoppingPhase() {
    G.phase = 'shopping';
    G.shopCreditUsed = false;
    G.fullCrewDiscount = this.isBattleTest() ? 0 : this.pendingFullCrewDiscount();
  }

  consumeBoardingAlertForBoarding() {
    if (this.isBattleTest()) return { amount: 0, guardCount: 0 };
    const amount = this.pendingBoardingAlert();
    const guardCount = this.boardingAlertGuardCount(amount);
    G.boardingAlert = 0;
    return { amount, guardCount };
  }

  activeBoardingAlertState() {
    if (this.isBattleTest()) return { amount: 0, guardCount: 0 };
    const ship = G.enemyShip || {};
    const amount = Math.max(0, Math.floor(Number(ship.boardingAlert) || 0));
    const guardCount = ship.boardingAlertGuards != null
      ? Math.max(0, Math.min(3, Math.floor(Number(ship.boardingAlertGuards) || 0)))
      : this.boardingAlertGuardCount(amount);
    return { amount, guardCount };
  }

  grantShipWages() {
    const preview = this.shipWagePreview();
    const wages = preview.wages;
    if (wages <= 0) return 0;

    G.enthusiasm += wages;
    let nextAlert = this.pendingBoardingAlert();
    if (!this.isBattleTest() && preview.alert > 0) {
      nextAlert += preview.alert;
      G.boardingAlert = nextAlert;
    }
    const L = this.L;
    const x = this.actionPanelRightX();
    const y = this.endActionY() - 40 * L.k;
    const commissionText = preview.openingCommission > 0
      ? `\nincl. +${preview.openingCommission}☠️ Opening Commission`
      : '';
    const alertSummary = preview.alert > 0 ? this.boardingAlertSummary(nextAlert) : null;
    const alertText = alertSummary ? `\n${alertSummary}` : '';
    this.effectText(x, y, `+${wages}☠️ Wages${commissionText}${alertText}`, '#66bb6a');
    this.animateResourceGain(x, y, [{ emoji: '☠️', count: wages }]);
    return wages;
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

  canPreviewIslandDrop(handIdx) {
    if (G.phase !== 'sending') return false;
    if (handIdx == null) return false;
    if (G.sent.includes(handIdx) || this._sendingToIsland.has(handIdx)) return false;
    if (G.sent.length >= this.maxSend()) return false;

    const pirate = G.hand && G.hand[handIdx];
    if (!pirate) return false;
    const def = TYPES[pirate.type];
    if (!def || !def.canIsland || !def.island) return false;

    if (def.island.convert) {
      const c = def.island.convert;
      if ((G.res[c.cRes] || 0) < c.cN) return false;
    }

    return true;
  }

  sendToIsland(idx, fromPos) {
    if (G.phase !== 'sending') return;
    if (G.sent.includes(idx) || G.sent.length >= this.maxSend()) return;

    const p = G.hand[idx];
    const def = TYPES[p.type];
    const L = this.L;

    const handPos = this.handPos(idx);
    const msgPos = fromPos || handPos;
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

    const { texKey: sendTex } = buildCardTexture(this, p.type, L, {
      slotState: this.pirateHasWeapon(p) ? 'armed' : 'none',
      slotWeaponKey: this.pirateWeaponKey(p),
      wounded: !!p.wounded,
      might: this.pirateMight(p),
      tempo: this.pirateTempo(p),
    });
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
        const cacheDrill = this.applyScoutedCacheDrill(p, { silent: true });

        this.renderAll();
        const effect = this.showIslandResult(p, sentSlot, result, effectPos.x, effectPos.y);
        if (cacheDrill) this.showScoutedCacheDrillResult(cacheDrill);
        const baseWait = isSacrifice ? 1400 : (effect.spendDuration !== false ? 1000 : 800);
        const waitMs = baseWait + (effect.spendDuration || 0);
        this.scheduleEffectFollowup({
          gainStartDelay: effect.gainStartDelay,
          fallbackDelay: waitMs,
          hasPendingWeapons: this._pendingWeaponQueue.length > 0,
          shouldRun: () => G.phase === 'sending',
          tryStartAssignment: () => {
            const sendingDone = this._sendingToIsland.size === 0;
            if (!sendingDone || this._pendingWeaponQueue.length === 0) return false;
            const resume = () => {
              if (G.phase !== 'sending') return;
              if (this._pendingEndSending) this.endSending();
              else this.renderAll();
            };
            if (!this.maybeStartPendingWeaponAssignment({ onComplete: resume })) {
              resume();
            }
            return true;
          },
          fallback: () => {
            const sendingDone = this._sendingToIsland.size === 0;
            if (sendingDone && this._pendingEndSending) {
              this.endSending();
              return;
            }
            this.renderAll();
          },
        });
      },
    });
  }

  resolveIsland(pirate) {
    const def = TYPES[pirate.type];
    const isl = G.island;

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
      if (g.weapon) {
        return { ok: true, weaponGrant: createWeaponGrant(g.weapon, g.count || 1) };
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

    const tgt = def.island.res;
    const amt = this.islandYieldAmount(tgt, def.island.amt, isl);

    const islBonusE = def.island.bonusEnthusiasm || 0;
    if (islBonusE) G.enthusiasm += islBonusE;
    G.res[tgt] += amt;
    return { ok: true, res: tgt, n: amt, bonusEnthusiasm: islBonusE };
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

  playResolvedEffect(opts = {}) {
    const showOverlay = typeof opts.showOverlay === 'function' ? opts.showOverlay : null;
    const effectText = opts.effectText || null;
    const spendItems = Array.isArray(opts.spendItems) ? opts.spendItems : [];
    const gainItems = Array.isArray(opts.gainItems) ? opts.gainItems : [];
    const weaponGrant = opts.weaponGrant || null;
    const weaponTextPos = opts.weaponTextPos || null;
    const fromX = opts.fromX != null ? opts.fromX : this.L.cx;
    const fromY = opts.fromY != null ? opts.fromY : this.L.Y_HAND;

    if (showOverlay && opts.overlayColor) showOverlay(opts.overlayColor);
    if (effectText && effectText.text) {
      this.effectText(effectText.x, effectText.y, effectText.text, effectText.color, effectText.hold);
    }

    let spendDuration = 0;
    if (spendItems.length) {
      spendDuration = this.animateResourceSpend(fromX, fromY, spendItems);
    }
    const gainStartDelay = spendDuration > 0 ? spendDuration : 0;

    const startGain = () => {
      if (!this.sys || !this.sys.isActive()) return;
      this.animateResourceGain(fromX, fromY, gainItems);
    };
    if (gainItems.length) {
      if (gainStartDelay > 0) {
        this.time.delayedCall(gainStartDelay, startGain);
      } else {
        startGain();
      }
    }

    const showWeaponGrantText = () => {
      if (!this.sys || !this.sys.isActive()) return;
      this.effectText(
        weaponTextPos.x,
        weaponTextPos.y,
        '+' + weaponGrantText(weaponGrant),
        weaponTextPos.color || '#66bb6a',
        weaponTextPos.hold
      );
    };
    if (weaponGrant && weaponTextPos) {
      if (gainStartDelay > 0) {
        this.time.delayedCall(gainStartDelay, showWeaponGrantText);
      } else {
        showWeaponGrantText();
      }
    }

    return {
      spendDuration,
      gainStartDelay,
      queuedWeapons: this.queueWeaponGrant(weaponGrant),
    };
  }

  scheduleEffectFollowup(opts = {}) {
    const gainStartDelay = Math.max(0, opts.gainStartDelay || 0);
    const fallbackDelay = Math.max(0, opts.fallbackDelay || 0);
    const hasPendingWeapons = !!opts.hasPendingWeapons;
    const delay = hasPendingWeapons ? gainStartDelay : fallbackDelay;

    this.time.delayedCall(delay, () => {
      if (!this.sys || !this.sys.isActive()) return;
      if (typeof opts.shouldRun === 'function' && !opts.shouldRun()) return;
      if (hasPendingWeapons && typeof opts.tryStartAssignment === 'function' && opts.tryStartAssignment() === true) {
        return;
      }
      if (typeof opts.fallback === 'function') opts.fallback();
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
      return { spendDuration: false, gainStartDelay: 0, queuedWeapons: 0 };
    }
    if (r.exileSent) {
      if (r.ok) {
        this.showIslandEffectOverlay(pirate.type, sentSlot, '#ff8a80');
        this.effectText(x, fy, '💀 Exiled ' + r.name + '!', '#ff8a80');
      } else {
        this.showIslandEffectOverlay(pirate.type, sentSlot, '#ffa726');
        this.effectText(x, fy, 'No one to exile', '#ffa726', 400);
      }
      return { spendDuration: false, gainStartDelay: 0, queuedWeapons: 0 };
    }

    let overlayColor = '#66bb6a';
    let effectText = null;
    let spendItems = [];
    let gainItems = [];
    let weaponTextPos = null;
    if (r.convert) {
      effectText = {
        x,
        y: fy,
        text: r.cN + RES_EMOJI[r.cRes] + ' → ' + r.n + RES_EMOJI[r.res],
        color: '#66bb6a',
      };
      spendItems = [{ emoji: RES_EMOJI[r.cRes], count: r.cN }];
      gainItems = [{ emoji: RES_EMOJI[r.res], count: r.n }];
    } else if (r.weaponGrant) {
      weaponTextPos = { x, y: fy, color: '#66bb6a' };
    } else if (r.items) {
      const msg = r.items.map(i => '+' + i.n + RES_EMOJI[i.res]).join(' ');
      effectText = { x, y: fy, text: msg, color: '#66bb6a' };
      gainItems = r.items.map(i => ({ emoji: RES_EMOJI[i.res], count: i.n }));
    } else {
      const em = RES_EMOJI[r.res] || '';
      const eBonus = r.bonusEnthusiasm ? ' +' + r.bonusEnthusiasm + '☠️' : '';
      gainItems = [{ emoji: em, count: r.n }];
      if (r.bonusEnthusiasm) gainItems.push({ emoji: '☠️', count: r.bonusEnthusiasm });
      overlayColor = '#66bb6a';
      effectText = { x, y: fy, text: '+' + r.n + em + eBonus, color: '#66bb6a' };
    }

    return this.playResolvedEffect({
      fromX: x,
      fromY: y,
      showOverlay: (color) => this.showIslandEffectOverlay(pirate.type, sentSlot, color),
      overlayColor,
      effectText,
      spendItems,
      gainItems,
      weaponGrant: r.weaponGrant || null,
      weaponTextPos,
    });
  }

  endSending() {
    if (G.phase !== 'sending') return;
    if (this._sendingToIsland.size > 0) {
      this._pendingEndSending = true;
      return;
    }
    this._pendingEndSending = false;
    this.closePanels();
    this.applyPortDrill();
    this.updateFullCrewDiscountForCompletedIsland();
    this.grantShipWages();
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
        this.closePanels();
        this.enterShoppingPhase();
        G.busy = false;
        this.renderAll();
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
        if (nextHi >= 0) {
          this._cardHand.highlightShipCard(nextHi, true);
        } else {
          this._cardHand.clearShipSpread();
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
    const spendItems = [];
    const gainItems = [];
    const weaponGrant = r.ok ? (r.weaponGrant || null) : null;
    const personalReward = r.ok ? r.personalReward : null;
    if (r.ok) {
      if (s.costs) {
        for (const c of s.costs) spendItems.push({ emoji: c.res === 'enthusiasm' ? '☠️' : RES_EMOJI[c.res], count: c.n });
      } else if (s.cRes && s.cN > 0) {
        spendItems.push({ emoji: RES_EMOJI[s.cRes], count: s.cN });
      }
      if (Array.isArray(r.gainItems) && r.gainItems.length) {
        for (const gain of r.gainItems) {
          gainItems.push({
            emoji: gain.res === 'enthusiasm' ? '☠️' : RES_EMOJI[gain.res],
            count: gain.n,
          });
        }
      } else if (r.pN > 0) {
        gainItems.push({ emoji: r.pRes === 'enthusiasm' ? '☠️' : RES_EMOJI[r.pRes], count: r.pN });
      }
      if (r.extraEnthusiasm) gainItems.push({ emoji: '☠️', count: r.extraEnthusiasm });
    }
    const effect = this.playResolvedEffect({
      fromX: x,
      fromY: y,
      showOverlay: (color) => this._cardHand.showShipEffectOverlay(hi, color),
      overlayColor: r.ok ? shipEffectSuccessColor : shipEffectFailColor,
      spendItems,
      gainItems,
      weaponGrant,
      weaponTextPos: weaponGrant ? { x, y: y - 116 * L.k, color: '#66bb6a' } : null,
    });
    if (personalReward && personalReward.text) {
      const showPersonalReward = () => {
        if (!this.sys || !this.sys.isActive()) return;
        let fxX = x;
        let fxY = y - 116 * L.k;
        if (personalReward.sentSlot != null) {
          const point = this.islandPirateEffectPoint(personalReward.sentSlot);
          if (point) {
            fxX = point.x;
            fxY = point.y;
          }
        }
        this.effectText(
          fxX,
          fxY,
          personalReward.applied ? `+${personalReward.text}` : personalReward.text,
          personalReward.color || '#66bb6a'
        );
        if (personalReward.applied) this.renderIsland();
      };
      if (effect.gainStartDelay > 0) this.time.delayedCall(effect.gainStartDelay, showPersonalReward);
      else showPersonalReward();
    }
    const shipWait = 1000 + effect.spendDuration;
    this.scheduleEffectFollowup({
      gainStartDelay: effect.gainStartDelay,
      fallbackDelay: shipWait,
      hasPendingWeapons: this._pendingWeaponQueue.length > 0,
      tryStartAssignment: () => this.maybeStartPendingWeaponAssignment({
        onComplete: () => resolveAndContinue(0),
      }),
      fallback: () => resolveAndContinue(0),
    });
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
    const shipGains = Array.isArray(s.gains) ? s.gains.filter(gain => gain && gain.res && gain.n > 0) : [];
    const applyShipGains = () => {
      const gainItems = [];
      if (shipGains.length) {
        for (const gain of shipGains) {
          if (gain.res === 'enthusiasm') G.enthusiasm += gain.n;
          else G.res[gain.res] += gain.n;
          gainItems.push({ res: gain.res, n: gain.n });
        }
      } else if (s.pRes && s.pN > 0) {
        if (s.pRes === 'enthusiasm') G.enthusiasm += s.pN;
        else G.res[s.pRes] += s.pN;
        gainItems.push({ res: s.pRes, n: s.pN });
      }
      if (s.extraEnthusiasm) G.enthusiasm += s.extraEnthusiasm;
      const personalReward = this.applyShipPersonalGains(s.personalGains);
      return {
        gainItems,
        extraEnthusiasm: s.extraEnthusiasm || 0,
        weaponGrant: personalReward.weaponGrant || null,
        personalReward: personalReward.applied || personalReward.lost ? personalReward : null,
      };
    };
    if (s.costs) {
      for (const c of s.costs) {
        if ((G.res[c.res] || 0) < c.n) return { ok: false };
      }
      for (const c of s.costs) G.res[c.res] -= c.n;
      return {
        ok: true,
        ...applyShipGains(),
      };
    }
    if (!s.cRes) {
      return {
        ok: true,
        ...applyShipGains(),
      };
    }
    if ((G.res[s.cRes] || 0) >= s.cN) {
      G.res[s.cRes] -= s.cN;
      return {
        ok: true,
        ...applyShipGains(),
      };
    }
    return { ok: false };
  }

  buyPirate(si, opts = {}) {
    if (G.phase !== 'shopping' || G.busy || (!opts.ignoreAnimating && G.shopAnimating)) return;
    if (si >= G.shop.length) return;
    const L = this.L;
    const type = G.shop[si];
    const def = TYPES[type];
    const quote = this.shopPurchaseQuote(type);
    if (!quote.canBuy) {
      this.float(L.cx, L.Y_ISL_CY - 40 * L.k, 'Not enough ☠️', '#ef5350');
      return;
    }
    if (quote.credit) {
      G.enthusiasm = 0;
      G.boardingAlert = this.pendingBoardingAlert() + quote.alert;
      G.shopCreditUsed = true;
    } else {
      G.enthusiasm = Math.max(0, G.enthusiasm - quote.spend);
    }
    if (quote.discount > 0) G.fullCrewDiscount = 0;
    const p = mkP(type);
    G.allCrew.push(p);
    const toTopDeck = !!quote.topDeck;
    const prepared = quote.preparedCounter
      ? this.applyPersonalGainsToPirate(p, this.preparedCounterGains(type))
      : null;
    if (toTopDeck) G.deck.push(p);
    else G.discard.push(p);

    G.shop.splice(si, 1);
    if (G.shop.length) {
      G.shop.push(randomShopType(G.round, G.shop, { map: G.map, mode: G.mode }));
    }
    if (!opts.silent) {
      const alertText = quote.credit && quote.alert > 0 ? ` +${quote.alert} Alert` : '';
      const discountText = quote.discount > 0 ? ` -${quote.discount}☠️` : '';
      const preparedText = prepared && prepared.applied ? ` Prepared ${prepared.text || ''}` : '';
      const deckText = toTopDeck ? ' Top deck' : '';
      this.float(L.cx, L.Y_ISL_CY - 40 * L.k, '+ ' + def.name + '!' + discountText + alertText + preparedText + deckText, '#66bb6a');
    }
    G.shopAnimating = false;
    if (opts.deferRender) return p;
    this.renderAll();
    if (!opts.skipPanelRefresh && this.scene.isActive('shopModal')) {
      this.scene.get('shopModal').renderPanel();
    }
    return p;
  }

  handleShoppingContinue() {
    this.advanceFromShopping();
  }

  advanceFromShopping() {
    if (G.shop.length) {
      G.shop.shift();
      G.shop.push(randomShopType(G.round + 1, G.shop, { map: G.map, mode: G.mode }));
    }
    this.prepareNextRound();
  }

  prepareNextRound() {
    if (G.phase !== 'shopping') return;
    G.busy = true;
    const discardAnimEnd = this.animateCurrentHandToDiscard();
    const nextTurnDelay = discardAnimEnd + CARD_MOTION.betweenTurnsDelay;
    const allCrewIds = new Set(G.allCrew.map(p => p.id));
    G.discard.push(...G.hand.filter(p => allCrewIds.has(p.id)));
    G.hand = [];
    G.sent = [];
    G.enthusiasm = 0;
    G.fullCrewDiscount = 0;
    this.clearCombatState();
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

  clearCombatTimers() {
    if (this._combatTickTimer && !this._combatTickTimer.hasDispatched) {
      this._combatTickTimer.remove(false);
    }
    this._combatTickTimer = null;
    (this._combatEffectTimers || []).forEach((timer) => {
      if (timer && !timer.hasDispatched) timer.remove(false);
    });
    this._combatEffectTimers = [];
  }

  clearCombatState() {
    this.clearCombatTimers();
    this.clearCombatSetupPopupDismiss();
    if (this._boardingIntroTimer && !this._boardingIntroTimer.hasDispatched) {
      this._boardingIntroTimer.remove(false);
    }
    this._boardingIntroTimer = null;
    this._combatSetupPopupPinned = false;
    this._combatSetupDragState = null;
    this._activeHeldCombatTooltipKey = null;
    this._combatEnemyViews = {};
    this._combatPlayerViews = {};
    this._combatNodes = {};
    this._combatTipState = null;
    if (this._cardTips) this._cardTips.hide();
    G.combat = null;
  }

  currentBoardingNumber() {
    return Math.max(1, (G.enemyShip && G.enemyShip.encounterNo) || G.boardingCount || 1);
  }

  combatReturnedPirateIds(combat = G.combat) {
    return Array.isArray(combat && combat.returnedPirateIds) ? combat.returnedPirateIds : [];
  }

  combatReturnedPirateSet(combat = G.combat) {
    return new Set(this.combatReturnedPirateIds(combat));
  }

  queueCombatPirateReturn(fighter, fromPoint = null, combat = G.combat) {
    if (!combat || !fighter || fighter.side !== 'player' || fighter.pirateId == null) return false;
    const pirate = (G.hand || []).find((entry) => entry && entry.id === fighter.pirateId);
    if (!pirate) return false;
    if (!Array.isArray(combat.returnedPirateIds)) combat.returnedPirateIds = [];
    if (combat.returnedPirateIds.includes(pirate.id)) return false;
    combat.returnedPirateIds.push(pirate.id);
    const start = fromPoint || this.combatWorldPoint(fighter);
    this.queueHandAppear([pirate], {
      from: start,
      delay: 0,
      stagger: 0,
      duration: 420,
      startScale: 0.5,
    });
    return true;
  }

  boardingCanDrawReinforcements() {
    if (this.isBattleTest()) return false;
    if (G.phase !== 'boarding') return false;
    return this.readyCrew().length > 0;
  }

  discardBoardingHand() {
    const allCrewIds = new Set((G.allCrew || []).filter(Boolean).map((pirate) => pirate.id));
    G.discard.push(...(G.hand || []).filter((pirate) => pirate && allCrewIds.has(pirate.id)));
    G.hand = [];
  }

  drawReadyBoardingHand(n) {
    const max = Math.max(0, Math.floor(Number(n) || 0));
    const cards = [];
    const selectedIds = new Set();

    const takeFromDeck = () => {
      for (let idx = G.deck.length - 1; idx >= 0 && cards.length < max; idx--) {
        const pirate = G.deck[idx];
        if (!pirate || this.pirateWounded(pirate) || selectedIds.has(pirate.id)) continue;
        cards.push(pirate);
        selectedIds.add(pirate.id);
        G.deck.splice(idx, 1);
      }
    };

    takeFromDeck();
    if (cards.length < max && G.discard.length) {
      G.deck.push(...Phaser.Utils.Array.Shuffle([...G.discard]));
      G.discard = [];
      takeFromDeck();
    }

    G.hand = cards;
    return cards;
  }

  drawBoardingReinforcements(combat = G.combat) {
    if (!combat || combat.mode !== 'fighting') return false;
    if (!this.boardingCanDrawReinforcements()) return false;

    this.discardBoardingHand();
    const cards = this.drawReadyBoardingHand(5);
    if (!cards.length) return false;

    const rows = this.combatDefaultPlayerSetupRows(combat);
    combat.playerSetupRows = rows;
    combat.playerFighters = this.buildPlayerCombatFighters(rows, combat);
    combat.reinforcementCount = Math.max(0, Math.floor(Number(combat.reinforcementCount) || 0)) + 1;

    const now = this.time.now;
    (combat.playerFighters || []).forEach((fighter) => {
      if (!fighter) return;
      fighter.nextAttackAt = now + Phaser.Math.Between(COMBAT.initialDelayMin, COMBAT.initialDelayMax);
      fighter.incomingUntil = 0;
      fighter.attacksMade = 0;
    });
    combat.nextAttackStartAt = Math.max(combat.nextAttackStartAt || 0, now + COMBAT.attackStartGapMs);

    this.effectText(this.L.cx, this.combatFormationRowY('player', 0) - 42 * this.L.k, 'Reinforcements!', '#8bd17c', false);
    this.renderAll();
    this.scheduleNextCombatAttack();
    return true;
  }

  startBoardingSetupIntroIfNeeded() {
    const combat = G.phase === 'boarding' ? this.ensureBoardingCombat() : null;
    const handCards = Array.isArray(this._cardHand && this._cardHand.cards) ? this._cardHand.cards.slice() : [];
    if (!combat || combat.mode !== 'intro' || combat.introStarted) return;
    if ((this._pendingHandAppearUntil || 0) > this.time.now) {
      this.queueRenderAll();
      return;
    }
    if (!handCards.length) {
      if (Array.isArray(G.hand) && G.hand.length) {
        this.queueRenderAll();
      }
      return;
    }

    const playerRows = this.combatSetupRows('player', combat);
    const playerSlots = this.combatSetupSlotMap('player', playerRows, this.combatFormationVisuals('player'));
    let endAt = 0;
    combat.introStarted = true;

    handCards.forEach((cardData, idx) => {
      const pirate = cardData && cardData.pirate;
      const target = pirate ? playerSlots[pirate.id] : null;
      if (!pirate || !target) return;
      const delay = 140 + idx * 70;
      const duration = 520;
      cardData.container.setDepth(70 + idx);
      this.tweens.add({
        targets: cardData.container,
        x: target.x,
        y: target.y,
        rotation: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        delay,
        duration,
        ease: 'Cubic.easeInOut',
      });
      endAt = Math.max(endAt, delay + duration);
    });

    this._boardingIntroTimer = this.time.delayedCall(endAt + 60, () => {
      this._boardingIntroTimer = null;
      if (!this.sys || !this.sys.isActive()) return;
      if (G.combat !== combat || combat.mode !== 'intro') return;
      combat.mode = 'setup';
      combat.introStarted = false;
      this.renderAll();
    });
  }

  boardingHandVisible(combat = G.combat) {
    if (!combat) return false;
    return combat.mode === 'intro' || combat.mode === 'resolved';
  }

  boardingHandHiddenCard(combat = G.combat) {
    const returnedPirateIds = this.combatReturnedPirateSet(combat);
    return (_pirate, handIdx) => {
      if (!combat || combat.mode === 'intro') return false;
      const pirate = G.hand && G.hand[handIdx];
      if (!pirate) return false;
      return !returnedPirateIds.has(pirate.id);
    };
  }

  combatSetupRowTotal() {
    return 3;
  }

  combatEmptySetupRows() {
    return Array.from({ length: this.combatSetupRowTotal() }, () => []);
  }

  combatDefaultSetupRowCounts(total) {
    const caps = [2, 1, 2];
    const counts = [];
    let remaining = Math.max(0, Math.floor(Number(total) || 0));
    caps.forEach((cap) => {
      const take = Math.min(cap, remaining);
      counts.push(take);
      remaining -= take;
    });
    while (counts.length < this.combatSetupRowTotal()) counts.push(0);
    return counts;
  }

  combatRowsFromCounts(ids, counts) {
    const rowIds = Array.isArray(ids) ? ids.filter((id) => id != null) : [];
    const rows = this.combatEmptySetupRows();
    let cursor = 0;
    rows.forEach((_, rowIndex) => {
      const count = Math.max(0, Math.floor((counts && counts[rowIndex]) || 0));
      rows[rowIndex] = rowIds.slice(cursor, cursor + count);
      cursor += count;
    });
    if (cursor < rowIds.length) rows[0].push(...rowIds.slice(cursor));
    return rows;
  }

  combatDefaultSetupRows(ids) {
    return this.combatRowsFromCounts(ids, this.combatDefaultSetupRowCounts(Array.isArray(ids) ? ids.length : 0));
  }

  combatDefaultPlayerSetupRows(combat = G.combat) {
    const rows = this.combatEmptySetupRows();
    (G.hand || []).forEach((pirate) => {
      if (!pirate) return;
      if (this.pirateWounded(pirate)) return;
      const weaponKey = this.pirateWeaponKey(pirate);
      const weapon = weaponKey ? WEAPON_TYPES[weaponKey] : null;
      const rowIndex = weapon && weapon.range === 'ranged' ? 2 : 0;
      rows[rowIndex].push(pirate.id);
    });
    return this.combatCompactSetupRows(rows);
  }

  combatCompactSetupRows(rows) {
    const compacted = this.combatEmptySetupRows();
    const sourceRows = Array.isArray(rows) ? rows : [];
    let nextRowIndex = 0;
    sourceRows.forEach((row) => {
      if (!Array.isArray(row) || !row.length || nextRowIndex >= compacted.length) return;
      compacted[nextRowIndex] = row.filter((id) => id != null);
      nextRowIndex++;
    });
    return compacted;
  }

  combatNormalizeSetupRows(rows, ids, fallbackRows = null) {
    const validIds = new Set(Array.isArray(ids) ? ids.filter((id) => id != null) : []);
    const normalized = this.combatEmptySetupRows();
    const seen = new Set();
    const consumeRows = (sourceRows) => {
      if (!Array.isArray(sourceRows)) return;
      for (let rowIndex = 0; rowIndex < this.combatSetupRowTotal(); rowIndex++) {
        const row = Array.isArray(sourceRows[rowIndex]) ? sourceRows[rowIndex] : [];
        row.forEach((id) => {
          if (!validIds.has(id) || seen.has(id)) return;
          normalized[rowIndex].push(id);
          seen.add(id);
        });
      }
    };
    consumeRows(rows);
    consumeRows(fallbackRows);
    validIds.forEach((id) => {
      if (!seen.has(id)) normalized[0].push(id);
    });
    return normalized;
  }

  combatEnemyOccupiedRowCount(enemyParty) {
    const enemies = Array.isArray(enemyParty) ? enemyParty.filter(Boolean) : [];
    const total = enemies.length;
    if (total <= 1) return total;
    const maxRows = Math.min(this.combatSetupRowTotal(), total);
    const rangedCount = enemies.filter((enemy) => (enemy.attackRange || 'melee') === 'ranged').length;

    if (total === 2) {
      return rangedCount > 0 && maxRows >= 2 ? 2 : 1;
    }
    if (total === 3) {
      if (rangedCount >= 2 && maxRows >= 3 && Phaser.Math.Between(0, 99) < 35) return 3;
      if (rangedCount >= 1 && maxRows >= 2) return 2;
      return Phaser.Math.Between(0, 99) < 45 ? 2 : 1;
    }

    let occupied = 2;
    if (maxRows >= 3) {
      const wantsBackRow = rangedCount >= 2 || total >= 5 || Phaser.Math.Between(0, 99) < 40;
      if (wantsBackRow) occupied = 3;
    }
    return Math.min(maxRows, occupied);
  }

  combatPreferredEnemySetupRow(enemy, occupiedRows) {
    const rowCount = Math.max(1, Math.min(this.combatSetupRowTotal(), occupiedRows));
    const isRanged = (enemy && (enemy.attackRange || 'melee') === 'ranged');
    if (rowCount <= 1) return 0;

    const roll = Phaser.Math.Between(1, 100);
    if (isRanged) {
      if (rowCount >= 3) {
        if (roll <= 68) return 2;
        if (roll <= 92) return 1;
        return 0;
      }
      return roll <= 78 ? 1 : 0;
    }

    if (rowCount >= 3) {
      if (roll <= 72) return 0;
      if (roll <= 94) return 1;
      return 2;
    }
    return roll <= 82 ? 0 : 1;
  }

  combatRandomEnemySetupRows(enemyParty) {
    const enemies = Array.isArray(enemyParty) ? enemyParty.filter(Boolean) : [];
    if (!enemies.length) return this.combatEmptySetupRows();

    const rows = this.combatEmptySetupRows();
    const occupiedRows = this.combatEnemyOccupiedRowCount(enemies);
    const ranged = Phaser.Utils.Array.Shuffle(enemies.filter((enemy) => (enemy.attackRange || 'melee') === 'ranged'));
    const melee = Phaser.Utils.Array.Shuffle(enemies.filter((enemy) => (enemy.attackRange || 'melee') !== 'ranged'));
    const takeEnemy = (pool) => {
      const enemy = pool.pop();
      if (!enemy) return null;
      return enemy;
    };
    const takeAnyEnemy = () => takeEnemy(melee) || takeEnemy(ranged);
    const takeFrontEnemy = () => takeEnemy(melee) || takeAnyEnemy();
    const takeBackEnemy = () => takeEnemy(ranged) || takeAnyEnemy();

    const frontSeed = takeFrontEnemy();
    if (frontSeed) rows[0].push(frontSeed.id);

    for (let rowIndex = occupiedRows - 1; rowIndex >= 1; rowIndex--) {
      const seeded = takeBackEnemy();
      if (seeded) rows[rowIndex].push(seeded.id);
    }

    const remaining = Phaser.Utils.Array.Shuffle([...melee, ...ranged]);
    remaining.forEach((enemy) => {
      const rowIndex = Phaser.Math.Clamp(
        this.combatPreferredEnemySetupRow(enemy, occupiedRows),
        0,
        Math.max(0, occupiedRows - 1)
      );
      rows[rowIndex].push(enemy.id);
    });

    return this.combatCompactSetupRows(rows);
  }

  combatSetupRows(side, combat = G.combat) {
    if (!combat) return this.combatEmptySetupRows();
    const key = side === 'enemy' ? 'enemySetupRows' : 'playerSetupRows';
    const ids = side === 'enemy'
      ? (combat.enemyParty || []).filter(Boolean).map((enemy) => enemy.id)
      : (G.hand || []).filter((pirate) => pirate && !this.pirateWounded(pirate)).map((pirate) => pirate.id);
    const fallback = side === 'enemy'
      ? this.combatRandomEnemySetupRows(combat.enemyParty || [])
      : this.combatDefaultPlayerSetupRows(combat);
    if (side === 'player') {
      const sourceRows = Array.isArray(combat[key]) ? combat[key] : fallback;
      combat[key] = this.combatCompactSetupRows(this.combatNormalizeSetupRows(sourceRows, ids, fallback));
      return combat[key];
    }
    combat[key] = this.combatNormalizeSetupRows(combat[key], ids, fallback);
    if (side === 'enemy') combat[key] = this.combatCompactSetupRows(combat[key]);
    return combat[key];
  }

  combatFormationSortKey(fighter) {
    if (!fighter) return { row: 0, order: 0 };
    return {
      row: Math.max(0, Math.floor(Number(fighter.row) || 0)),
      order: Math.max(0, Math.floor(Number(fighter.rowOrder) || 0)),
    };
  }

  combatSetupSlotLayout(side, rowIndex, count, opts = {}) {
    const visuals = this.combatFormationVisuals(side);
    const scale = opts.scale != null ? opts.scale : visuals.scale;
    const maxStep = opts.maxStep != null ? opts.maxStep : visuals.maxStep;
    const edgePad = opts.edgePad != null ? opts.edgePad : visuals.edgePad;
    if (count <= 0) return [];
    return cardRowLayout(count, this.L, {
      y: this.combatFormationRowY(side, rowIndex),
      maxStep,
      edgePad,
      scale,
    });
  }

  combatSetupSlotMap(side, rows, opts = {}) {
    const positions = {};
    const setupRows = Array.isArray(rows) ? rows : this.combatEmptySetupRows();
    setupRows.forEach((rowIds, rowIndex) => {
      const slots = this.combatSetupSlotLayout(side, rowIndex, rowIds.length, opts);
      rowIds.forEach((id, idx) => {
        positions[id] = slots[idx] || slots[0] || {
          x: this.L.cx,
          y: this.combatFormationRowY(side, rowIndex),
        };
      });
    });
    return positions;
  }

  combatSetupDropTarget(pirateId, pointer, combat = G.combat) {
    const rows = this.combatSetupRows('player', combat)
      .map((row) => row.filter((id) => id !== pirateId));
    const pointerX = pointer && Number.isFinite(pointer.worldX) ? pointer.worldX : (pointer && pointer.x);
    const pointerY = pointer && Number.isFinite(pointer.worldY) ? pointer.worldY : (pointer && pointer.y);
    let rowIndex = 0;
    let bestRowDist = Infinity;
    for (let idx = 0; idx < this.combatSetupRowTotal(); idx++) {
      const rowDist = Math.abs((Number.isFinite(pointerY) ? pointerY : this.combatFormationRowY('player', 0)) - this.combatFormationRowY('player', idx));
      if (rowDist < bestRowDist) {
        bestRowDist = rowDist;
        rowIndex = idx;
      }
    }

    const insertSlots = this.combatSetupSlotLayout('player', rowIndex, rows[rowIndex].length + 1);
    let insertIndex = 0;
    let bestXDist = Infinity;
    insertSlots.forEach((slot, idx) => {
      const xDist = Math.abs((Number.isFinite(pointerX) ? pointerX : slot.x) - slot.x);
      if (xDist < bestXDist) {
        bestXDist = xDist;
        insertIndex = idx;
      }
    });

    return { rowIndex, insertIndex };
  }

  moveCombatSetupPirate(pirateId, rowIndex, insertIndex, combat = G.combat) {
    if (!combat || combat.mode !== 'setup' || pirateId == null) return false;
    const readyIds = new Set(this.activeCombatHandPirates().map((pirate) => pirate.id));
    if (!readyIds.has(pirateId)) return false;
    const rows = this.combatSetupRows('player', combat)
      .map((row) => row.filter((id) => id !== pirateId));
    const nextRowIndex = Phaser.Math.Clamp(Math.floor(Number(rowIndex) || 0), 0, this.combatSetupRowTotal() - 1);
    const nextInsertIndex = Phaser.Math.Clamp(Math.floor(Number(insertIndex) || 0), 0, rows[nextRowIndex].length);
    rows[nextRowIndex].splice(nextInsertIndex, 0, pirateId);
    combat.playerSetupRows = this.combatCompactSetupRows(rows);
    return true;
  }

  combatSetupDragging() {
    return !!(this._combatSetupDragState && this._combatSetupDragState.pirateId != null);
  }

  buildCombatEnemyMember(archetype, id, overrides = {}) {
    if (!archetype) return null;
    const enemy = {
      id,
      name: archetype.name,
      emoji: archetype.emoji,
      hp: archetype.hp,
      maxHp: archetype.hp,
      damage: archetype.damage,
      attackMs: archetype.attackMs,
      color: archetype.color,
      attackRange: archetype.attackRange || 'melee',
      targetMode: archetype.targetMode || 'frontBand',
      deathEffect: archetype.deathEffect || null,
      deathEffectDamage: archetype.deathEffectDamage != null ? archetype.deathEffectDamage : archetype.damage,
      passiveKey: archetype.passiveKey || null,
      passiveValue: archetype.passiveValue != null ? archetype.passiveValue : null,
      onHitEffectKey: archetype.onHitEffectKey || null,
      onHitEffectValue: archetype.onHitEffectValue ? { ...archetype.onHitEffectValue } : null,
      triggerKey: archetype.triggerKey || null,
      triggerValue: archetype.triggerValue ? { ...archetype.triggerValue } : null,
      summary: archetype.summary || null,
    };
    const merged = Object.assign({}, enemy, overrides || {});
    if (merged.maxHp == null || ((overrides || {}).hp != null && (overrides || {}).maxHp == null)) {
      merged.maxHp = merged.hp;
    }
    return merged;
  }

  combatEnemyLateScaling(boardingNo) {
    const tier = Math.max(0, Math.floor(Number(boardingNo) || 0) - 6);
    if (tier <= 0) return null;
    return {
      tier,
      label: tier >= 2 ? 'Elite' : 'Veteran',
      hpBonus: tier * 4,
      damageBonus: Math.ceil(tier / 2),
      attackMsMultiplier: Math.max(0.78, 1 - tier * 0.06),
    };
  }

  combatScaledEnemyOverrides(archetype, boardingNo) {
    const scaling = this.combatEnemyLateScaling(boardingNo);
    if (!archetype || !scaling) return {};
    const hp = Math.max(1, Math.floor(Number(archetype.hp) || 1) + scaling.hpBonus);
    const damage = Math.max(1, Math.floor(Number(archetype.damage) || 1) + scaling.damageBonus);
    const attackMs = Math.max(250, Math.round((Number(archetype.attackMs) || 1000) * scaling.attackMsMultiplier));
    return {
      name: `${scaling.label} ${archetype.name}`,
      hp,
      maxHp: hp,
      damage,
      attackMs,
      summary: `${archetype.summary || ''} Late-run enemy: +${scaling.hpBonus} HP, +${scaling.damageBonus} damage.`,
    };
  }

  combatArchetypeByKey(key) {
    return COMBAT.enemyArchetypes.find((a) => a.key === key) || null;
  }

  combatEligibleEnemyArchetypes(boardingNo) {
    return COMBAT.enemyArchetypes
      .filter((archetype) => {
        if (archetype.tier === 'weak') return true;
        return boardingNo >= Math.max(1, Math.floor(Number(archetype.unlockAt) || 1));
      });
  }

  combatEncounterArchetypesFromBlueprint(blueprint, boardingNo) {
    if (!blueprint) return this.combatEncounterArchetypesFallback(boardingNo);
    const archetypeMap = new Map(COMBAT.enemyArchetypes.map((a) => [a.key, a]));
    const main = archetypeMap.get(blueprint.mainKey);
    if (!main) return this.combatEncounterArchetypesFallback(boardingNo);

    const archetypes = [main];
    (blueprint.supportKeys || []).forEach((key) => {
      const arch = archetypeMap.get(key);
      if (arch) archetypes.push(arch);
    });
    while (archetypes.length < (blueprint.totalCount || 3)) archetypes.push(main);
    return Phaser.Utils.Array.Shuffle(archetypes);
  }

  combatEncounterArchetypesFallback(boardingNo) {
    const eligible = this.combatEligibleEnemyArchetypes(boardingNo);
    const strong = eligible.filter((a) => a.tier === 'strong');
    const weak = eligible.filter((a) => a.tier === 'weak');
    const count = Phaser.Math.Clamp(2 + Math.floor((boardingNo + 1) / 2), COMBAT.enemyCountMin, COMBAT.enemyCountMax);
    if (!eligible.length || count <= 0) return [];

    const primary = strong.length ? Phaser.Utils.Array.GetRandom(strong) : Phaser.Utils.Array.GetRandom(eligible);
    let strongCount, weakCount;
    if (boardingNo <= 2) {
      strongCount = Math.min(boardingNo, 2);
      weakCount = count - strongCount;
    } else if (boardingNo <= 4) {
      strongCount = Math.min(count - 1, 1 + Math.floor(boardingNo / 2));
      weakCount = count - strongCount;
    } else {
      strongCount = count;
      weakCount = 0;
    }

    const otherStrong = strong.filter((a) => a.key !== primary.key);
    const secondaryCount = (strongCount >= 3 && Math.random() < 0.5 && otherStrong.length) ? 1 : 0;
    const secondary = otherStrong.length ? Phaser.Utils.Array.GetRandom(otherStrong) : null;

    const archetypes = [primary];
    for (let i = 1; i < strongCount - secondaryCount; i++) archetypes.push(primary);
    if (secondary) {
      for (let i = 0; i < secondaryCount; i++) archetypes.push(secondary);
    }
    for (let i = 0; i < weakCount; i++) {
      archetypes.push(weak.length ? Phaser.Utils.Array.GetRandom(weak) : Phaser.Utils.Array.GetRandom(eligible));
    }
    return Phaser.Utils.Array.Shuffle(archetypes);
  }

  boardingAlertGuardArchetypes(guardCount) {
    const count = Math.max(0, Math.min(3, Math.floor(Number(guardCount) || 0)));
    const guardKeys = ['cabinBoy', 'bilgeRat', 'cabinBoy'];
    return guardKeys.slice(0, count)
      .map((key) => this.combatArchetypeByKey(key))
      .filter(Boolean);
  }

  boardingAlertGuardPlunder(guardCount) {
    const plunder = { wood: 0, stone: 0, gold: 0 };
    this.boardingAlertGuardArchetypes(guardCount).forEach((archetype) => {
      if (!archetype) return;
      if (archetype.key === 'cabinBoy') plunder.wood += 1;
      if (archetype.key === 'bilgeRat') plunder.stone += 1;
    });
    plunder.total = (plunder.wood || 0) + (plunder.stone || 0) + (plunder.gold || 0);
    return plunder;
  }

  boardingAlertPlunderItems(plunder) {
    const order = ['wood', 'stone', 'gold'];
    return order
      .map((key) => ({
        key,
        emoji: RES_EMOJI[key],
        count: Math.max(0, Math.floor(Number(plunder && plunder[key]) || 0)),
      }))
      .filter((item) => item.count > 0 && item.emoji);
  }

  grantBoardingAlertPlunder(combat = G.combat) {
    if (!combat || combat.alertGuardPlunderGranted) return null;
    combat.alertGuardPlunderGranted = true;
    if (this.isBattleTest()) return null;

    const guardCount = Math.max(0, Math.min(3, Math.floor(Number(combat.boardingAlertGuards) || 0)));
    const plunder = this.boardingAlertGuardPlunder(guardCount);
    combat.alertGuardPlunder = plunder;
    if (!plunder.total) return plunder;

    if (!G.res) G.res = { wood: 0, stone: 0, gold: 0 };
    this.boardingAlertPlunderItems(plunder).forEach((item) => {
      G.res[item.key] = Math.max(0, Math.floor(Number(G.res[item.key]) || 0)) + item.count;
    });
    return plunder;
  }

  showBoardingAlertPlunder(plunder) {
    if (!plunder || !plunder.total || !this.L) return;
    const items = this.boardingAlertPlunderItems(plunder);
    if (!items.length) return;

    const label = items
      .map((item) => `+${item.count > 1 ? item.count : ''}${item.emoji}`)
      .join(' ');
    const L = this.L;
    const x = L.cx;
    const y = this.islandContinueY() - 84 * L.k;
    this.effectText(x, y, `Guard plunder ${label}`, '#66bb6a', 700);
    if (typeof this.animateResourceGain === 'function') {
      this.animateResourceGain(x, y, items);
    }
  }

  grantBoardingTrophy(combat = G.combat) {
    if (!combat || combat.boardingTrophyGranted) return null;
    combat.boardingTrophyGranted = true;
    if (this.isBattleTest()) return null;

    const fighter = this.combatLiving('player')[0];
    if (!fighter || fighter.pirateId == null) return null;

    const pirate = (G.hand || []).find((entry) => entry && entry.id === fighter.pirateId)
      || (G.allCrew || []).find((entry) => entry && entry.id === fighter.pirateId);
    if (!pirate) return null;

    pirate.might = Math.max(0, Math.floor(Number(pirate.might) || 0)) + 1;
    const def = TYPES[pirate.type] || {};
    combat.boardingTrophy = {
      pirateId: pirate.id,
      type: pirate.type,
      name: def.name || pirate.type,
      count: 1,
      might: pirate.might,
    };
    return combat.boardingTrophy;
  }

  counterTrophyMainKey(combat = G.combat) {
    return (G.enemyShip && G.enemyShip.encounter && G.enemyShip.encounter.mainKey)
      || (combat && combat.encounterMainKey)
      || (this.currentEncounterBlueprint() && this.currentEncounterBlueprint().mainKey)
      || null;
  }

  grantCounterTrophy(combat = G.combat) {
    if (!combat || combat.counterTrophyGranted) return null;
    combat.counterTrophyGranted = true;
    if (this.isBattleTest()) return null;

    const mainKey = this.counterTrophyMainKey(combat);
    const counters = (mainKey && SCOUTED_SHIP_COUNTERS && SCOUTED_SHIP_COUNTERS[mainKey]) || [];
    if (!counters.length) return null;

    const counterSet = new Set(counters);
    const living = this.combatLiving('player');
    for (const fighter of living) {
      if (!fighter || fighter.pirateId == null) continue;
      const pirate = (G.hand || []).find((entry) => entry && entry.id === fighter.pirateId)
        || (G.allCrew || []).find((entry) => entry && entry.id === fighter.pirateId);
      const type = pirate ? pirate.type : fighter.type;
      if (!counterSet.has(type)) continue;

      if (!pirate) return null;
      pirate.tempo = Math.max(0, Math.floor(Number(pirate.tempo) || 0)) + 1;
      const def = TYPES[pirate.type] || {};
      const enemy = this.combatArchetypeByKey(mainKey);
      combat.counterTrophy = {
        pirateId: pirate.id,
        type: pirate.type,
        name: def.name || pirate.type,
        mainKey,
        enemyName: enemy ? enemy.name : mainKey,
        count: 1,
        tempo: pirate.tempo,
      };
      return combat.counterTrophy;
    }

    return null;
  }

  showBoardingTrophy(trophy) {
    if (!trophy || !this.L) return;
    const L = this.L;
    this.effectText(L.cx, this.islandContinueY() - 124 * L.k, 'Boarding Trophy +💪', '#ffca28', 760);
  }

  showCounterTrophy(trophy) {
    if (!trophy || !this.L) return;
    const L = this.L;
    this.effectText(L.cx, this.islandContinueY() - 164 * L.k, 'Counter Trophy +⚡', '#7bdff2', 760);
  }

  currentEncounterBlueprint() {
    if (!G.map || !G.map.currentNodeId) return null;
    const node = mapNodeById(G.map, G.map.currentNodeId);
    return (node && node.encounter) || null;
  }

  encounterBlueprintForLayer(layerIdx) {
    if (!G.map || !Array.isArray(G.map.layers)) return null;
    const layer = G.map.layers[layerIdx];
    if (!layer || layer.length !== 1 || layer[0].type !== 'ship') return null;
    return layer[0].encounter || null;
  }

  generateCombatEncounter() {
    const boardingNo = this.currentBoardingNumber();
    const blueprint = this.currentEncounterBlueprint();
    const alert = this.activeBoardingAlertState();
    const archetypes = this.combatEncounterArchetypesFromBlueprint(blueprint, boardingNo);
    const enemies = [];

    archetypes.forEach((archetype, i) => {
      if (!archetype) return;
      enemies.push(this.buildCombatEnemyMember(
        archetype,
        `${archetype.key}_${boardingNo}_${i}`,
        this.combatScaledEnemyOverrides(archetype, boardingNo)
      ));
    });

    this.boardingAlertGuardArchetypes(alert.guardCount).forEach((archetype, i) => {
      enemies.push(this.buildCombatEnemyMember(
        archetype,
        `alertGuard_${archetype.key}_${boardingNo}_${i}`,
        this.combatScaledEnemyOverrides(archetype, boardingNo)
      ));
    });

    const mainArch = blueprint ? this.combatArchetypeByKey(blueprint.mainKey) : null;
    const encounterDesc = blueprint ? blueprint.encounterDesc : (mainArch ? mainArch.encounterDesc : null);

    return {
      name: `Boarding Party ${boardingNo}`,
      mainKey: blueprint ? blueprint.mainKey : null,
      encounterDesc: encounterDesc || null,
      enemies,
      rows: this.combatRandomEnemySetupRows(enemies),
    };
  }

  ensureBoardingCombat() {
    if (G.phase !== 'boarding') return null;
    if (G.combat && Array.isArray(G.combat.enemyParty)) {
      if (!Object.prototype.hasOwnProperty.call(G.combat, 'inspectedPirateId')) G.combat.inspectedPirateId = null;
      if (!Object.prototype.hasOwnProperty.call(G.combat, 'inspectedEnemyId')) G.combat.inspectedEnemyId = null;
      if (!Object.prototype.hasOwnProperty.call(G.combat, 'returnedPirateIds')) G.combat.returnedPirateIds = [];
      if (!Object.prototype.hasOwnProperty.call(G.combat, 'introStarted')) G.combat.introStarted = false;
      if (!Object.prototype.hasOwnProperty.call(G.combat, 'boardingAlert')) {
        const alert = this.activeBoardingAlertState();
        G.combat.boardingAlert = alert.amount;
      }
      if (!Object.prototype.hasOwnProperty.call(G.combat, 'boardingAlertGuards')) {
        const alert = this.activeBoardingAlertState();
        G.combat.boardingAlertGuards = alert.guardCount;
      }
      if (!Object.prototype.hasOwnProperty.call(G.combat, 'encounterMainKey')) {
        G.combat.encounterMainKey = this.counterTrophyMainKey(G.combat);
      }
      if (!Array.isArray(G.combat.playerSetupRows)) {
        G.combat.playerSetupRows = this.combatDefaultPlayerSetupRows(G.combat);
      }
      if (!Array.isArray(G.combat.enemySetupRows)) {
        G.combat.enemySetupRows = this.combatRandomEnemySetupRows((G.combat.enemyParty || []).filter(Boolean));
      }
      G.combat.playerSetupRows = this.combatSetupRows('player', G.combat);
      G.combat.enemySetupRows = this.combatSetupRows('enemy', G.combat);
      return G.combat;
    }

    const encounter = this.generateCombatEncounter();
    const alert = this.activeBoardingAlertState();
    this.clearCombatSetupPopupDismiss();
    this._combatSetupPopupPinned = false;
    this._combatSetupDragState = null;
    G.combat = {
      mode: 'intro',
      inspectedPirateId: null,
      inspectedEnemyId: null,
      enemyName: encounter.name,
      encounterMainKey: encounter.mainKey || null,
      encounterDesc: encounter.encounterDesc || null,
      boardingAlert: alert.amount,
      boardingAlertGuards: alert.guardCount,
      enemyParty: encounter.enemies,
      playerSetupRows: this.combatDefaultPlayerSetupRows(),
      enemySetupRows: this.combatNormalizeSetupRows(
        encounter.rows,
        (encounter.enemies || []).filter(Boolean).map((enemy) => enemy.id),
        this.combatDefaultSetupRows((encounter.enemies || []).filter(Boolean).map((enemy) => enemy.id))
      ),
      playerFighters: null,
      enemyFighters: null,
      result: null,
      returnedPirateIds: [],
      introStarted: false,
    };
    return G.combat;
  }

  combatAssignedWeaponCount(combat = G.combat, weaponKey = null) {
    if (!combat) return 0;
    const assigned = (G.hand || [])
      .map((pirate) => this.combatPirateWeaponKey(pirate, combat))
      .filter(Boolean);
    if (weaponKey) return assigned.filter((key) => key === weaponKey).length;
    return assigned.length;
  }

  combatPirateWeaponKey(pirate, combat = G.combat) {
    if (!combat || !pirate) return null;
    return this.pirateWeaponKey(pirate);
  }

  combatPirateHasWeapon(pirate, combat = G.combat) {
    return !!this.combatPirateWeaponKey(pirate, combat);
  }

  combatHandIndexByPirateId(pirateId) {
    return G.hand.findIndex((pirate) => pirate && pirate.id === pirateId);
  }

  setCombatSetupInspectedPirate(pirateId, combat = G.combat, opts = {}) {
    if (!combat || combat.mode !== 'setup' || this.combatSetupDragging()) return;
    const nextId = pirateId == null ? null : pirateId;
    const pinned = !!opts.pinned;
    this.clearCombatSetupPopupDismiss();
    if (combat.inspectedPirateId === nextId && this._combatSetupPopupPinned === pinned) return;
    combat.inspectedPirateId = nextId;
    combat.inspectedEnemyId = null;
    this._combatSetupPopupPinned = pinned;
    this.queueRenderAll();
  }

  combatSetupInspectedPirate(combat = G.combat) {
    if (!combat || combat.mode !== 'setup' || combat.inspectedPirateId == null) return null;
    const handIdx = this.combatHandIndexByPirateId(combat.inspectedPirateId);
    return handIdx >= 0 ? G.hand[handIdx] : null;
  }

  setCombatSetupInspectedEnemy(enemyId, combat = G.combat, opts = {}) {
    if (!combat || combat.mode !== 'setup' || this.combatSetupDragging()) return;
    const nextId = enemyId == null ? null : enemyId;
    const pinned = !!opts.pinned;
    this.clearCombatSetupPopupDismiss();
    if (combat.inspectedEnemyId === nextId && this._combatSetupPopupPinned === pinned) return;
    combat.inspectedEnemyId = nextId;
    combat.inspectedPirateId = null;
    this._combatSetupPopupPinned = pinned;
    this.queueRenderAll();
  }

  combatSetupInspectedEnemy(combat = G.combat) {
    if (!combat || combat.mode !== 'setup' || combat.inspectedEnemyId == null) return null;
    return (combat.enemyParty || []).find((enemy) => enemy && enemy.id === combat.inspectedEnemyId) || null;
  }

  combatSetupHasInspection(combat = G.combat) {
    return !!(this.combatSetupInspectedPirate(combat) || this.combatSetupInspectedEnemy(combat));
  }

  combatEnemyCharacteristics(enemy) {
    if (!enemy) return '';
    if (enemy.summary) return enemy.summary;
    const durability = enemy.maxHp >= 11 ? 'Tough' : (enemy.maxHp <= 6 ? 'Fragile' : 'Sturdy');
    const tempo = enemy.attackMs <= 1000 ? 'strikes fast' : (enemy.attackMs >= 1550 ? 'strikes slow' : 'strikes steadily');
    const power = enemy.damage >= 2 ? 'hits hard' : 'hits lightly';
    return `${durability}. ${tempo.charAt(0).toUpperCase()}${tempo.slice(1)}. ${power.charAt(0).toUpperCase()}${power.slice(1)}.`;
  }

  combatTooltipBounds() {
    const L = this.L;
    return {
      left: 18 * L.k,
      top: 90 * L.k,
      right: L.W - 18 * L.k,
      bottom: handCardsTopY(L) - 18 * L.k,
    };
  }

  combatFighterDisplayName(fighter) {
    if (!fighter) return 'Fighter';
    if (fighter.side === 'enemy') return fighter.name || 'Enemy';
    const def = TYPES[fighter.type];
    return (def && def.name) || fighter.type || 'Pirate';
  }

  combatFighterStrengthValue(fighter) {
    if (!fighter) return 0;
    if (fighter.side === 'enemy') return Math.max(0, Number(fighter.damage) || 0);
    return Math.max(0, this.combatAttackDamage(fighter));
  }

  combatFighterDescription(fighter) {
    if (!fighter) return '';
    if (fighter.side === 'enemy') {
      const enemyParts = [this.combatEnemyCharacteristics(fighter)];
      const poison = Math.max(0, Math.floor(Number(fighter.poison) || 0));
      const wounds = Math.max(0, Math.floor(Number(fighter.wounds) || 0));
      const statuses = [];
      if (poison > 0) statuses.push(`${poison} poison`);
      if (wounds > 0) statuses.push(`${wounds} wounds`);
      if (statuses.length) enemyParts.push(`Status: ${statuses.join(', ')}.`);
      return enemyParts.join(' ');
    }
    const parts = [];
    if (fighter.weaponKey && WEAPON_TYPES[fighter.weaponKey]) {
      parts.push(`${this.combatFighterDisplayName(fighter)} attacks with ${WEAPON_TYPES[fighter.weaponKey].emoji} ${WEAPON_TYPES[fighter.weaponKey].name}.`);
    } else {
      parts.push('No weapon equipped. Front-row melee attacker.');
    }
    const buffs = [];
    const might = Math.max(0, Math.floor(Number(fighter.might) || 0));
    const tempo = Math.max(0, Math.floor(Number(fighter.tempo) || 0));
    if (might > 0) buffs.push(`${BUFF_EMOJI.might}${might}`);
    if (tempo > 0) buffs.push(`${BUFF_EMOJI.tempo}${tempo}`);
    if (buffs.length) parts.push(`Buffs: ${buffs.join(' ')}.`);
    const statuses = [];
    const poison = Math.max(0, Math.floor(Number(fighter.poison) || 0));
    const wounds = Math.max(0, Math.floor(Number(fighter.wounds) || 0));
    if (poison > 0) statuses.push(`${poison} poison`);
    if (wounds > 0) statuses.push(`${wounds} wounds`);
    if (statuses.length) parts.push(`Status: ${statuses.join(', ')}.`);
    return parts.join(' ');
  }

  combatFighterTooltipEntries(fighter) {
    if (!fighter) return [];
    return [{
      key: `fighter-${fighter.id}`,
      title: `${this.combatFighterDisplayName(fighter)} · ⚔️ ${this.combatFighterStrengthValue(fighter)}`,
      body: this.combatFighterDescription(fighter),
    }];
  }

  combatWeaponTooltipEntries(weaponKey) {
    const weapon = WEAPON_TYPES[weaponKey];
    if (!weapon) return [];
    return [{
      key: `weapon-${weaponKey}`,
      title: `${weapon.emoji} ${weapon.name}`,
      body: weapon.summary,
    }];
  }

  combatPlayerTooltipEntries(fighter) {
    if (!fighter) return [];
    return [
      ...this.combatFighterTooltipEntries(fighter),
      ...this.combatWeaponTooltipEntries(fighter.weaponKey),
    ];
  }

  clearCombatTooltip() {
    this._combatTipState = null;
    this._activeHeldCombatTooltipKey = null;
    if (this._cardTips) this._cardTips.hide();
  }

  showCombatTooltip(target, entries, opts = {}) {
    if (!this._cardTips) return false;
    const tips = Array.isArray(entries) ? entries.filter(Boolean) : [];
    if (!tips.length) {
      this.clearCombatTooltip();
      return false;
    }
    this._cardTips.setBoundsRect(this.combatTooltipBounds());
    const state = {
      key: opts.key || null,
      kind: opts.kind || null,
      fighterId: opts.fighterId || null,
      targetKind: opts.targetKind || 'body',
      placement: opts.placement || 'side',
      entries: tips.map((entry) => ({ ...entry })),
    };
    const shown = this._cardTips.showForCard(target, tips, {
      key: state.key,
      placement: state.placement,
    });
    this._combatTipState = shown ? state : null;
    return shown;
  }

  hideCombatTooltipForKey(key, opts = {}) {
    if (this._combatTipState && this._combatTipState.key === key) this._combatTipState = null;
    if (this._activeHeldCombatTooltipKey === key) this._activeHeldCombatTooltipKey = null;
    if (!this._cardTips) return false;
    if (opts.force) {
      this._cardTips.hide();
      return true;
    }
    return this._cardTips.hideForKey(key);
  }

  restoreCombatTooltip() {
    if (!this._cardTips || !this._combatTipState || !this._combatTipState.fighterId) return false;
    const node = this._combatNodes ? this._combatNodes[this._combatTipState.fighterId] : null;
    if (!node || !node.scene) return false;
    this._cardTips.setBoundsRect(this.combatTooltipBounds());
    return this._cardTips.showForCard(node, this._combatTipState.entries, {
      key: this._combatTipState.key,
      placement: this._combatTipState.placement || 'side',
    });
  }

  combatOpposingSide(side) {
    return side === 'player' ? 'enemy' : 'player';
  }

  combatWeaponByKey(weaponKey) {
    return weaponKey && WEAPON_TYPES[weaponKey] ? WEAPON_TYPES[weaponKey] : null;
  }

  combatWeaponForFighter(fighter) {
    return this.combatWeaponByKey(fighter && fighter.weaponKey);
  }

  combatWeaponBaseDamage(baseDamage, weapon) {
    if (weapon && weapon.damageOverride != null) return Math.max(0, Number(weapon.damageOverride) || 0);
    return Math.max(0, baseDamage + (weapon && weapon.damageBonus ? weapon.damageBonus : 0));
  }

  combatPirateStats(pirate, combat = G.combat) {
    const weaponKey = this.combatPirateWeaponKey(pirate, combat);
    const weapon = this.combatWeaponByKey(weaponKey);
    const baseDamage = Number(COMBAT.pirateDamage) || 0;
    const might = this.pirateMight(pirate);
    const tempo = this.pirateTempo(pirate);
    const buffCount = might + tempo;
    let damage = this.combatWeaponBaseDamage(baseDamage, weapon) + might;
    if (weapon && weapon.damagePerBuff) damage += buffCount * weapon.damagePerBuff;
    let attackMultiplier = weapon && weapon.attackMsMultiplier ? weapon.attackMsMultiplier : 1;
    if (tempo > 0) attackMultiplier *= Math.pow(0.8, tempo);
    if (weapon && weapon.attackMsMultiplierPerBuff) {
      attackMultiplier *= Math.pow(weapon.attackMsMultiplierPerBuff, buffCount);
    }
    let targetMode = (weapon && weapon.targetMode) || 'frontBand';
    if (weapon && weapon.frontRowAllAtBuffCount && buffCount >= weapon.frontRowAllAtBuffCount) {
      targetMode = 'frontRowAll';
    }
    return {
      hp: COMBAT.pirateHp + (weapon && weapon.hpBonus ? weapon.hpBonus : 0),
      baseDamage,
      damage: Math.max(0, Math.floor(damage)),
      attackMs: Math.max(250, Math.round(COMBAT.pirateAttackMs * attackMultiplier)),
      weaponKey,
      attackRange: (weapon && weapon.range) || 'melee',
      targetMode,
      might,
      tempo,
      buffCount,
    };
  }

  buildPlayerCombatFighter(pirate, row, rowOrder, combat) {
    const stats = this.combatPirateStats(pirate, combat);
    return {
      id: `player_${pirate.id}`,
      side: 'player',
      pirateId: pirate.id,
      type: pirate.type,
      row,
      rowOrder,
      alive: true,
      hp: stats.hp,
      maxHp: stats.hp,
      baseDamage: stats.baseDamage,
      damage: stats.damage,
      attackMs: stats.attackMs,
      attacksMade: 0,
      weaponKey: stats.weaponKey,
      attackRange: stats.attackRange,
      targetMode: stats.targetMode,
      might: stats.might,
      tempo: stats.tempo,
      buffCount: stats.buffCount,
      poison: 0,
      wounds: 0,
    };
  }

  buildEnemyCombatFighter(enemy, row, rowOrder) {
    return {
      id: enemy.id,
      side: 'enemy',
      name: enemy.name,
      emoji: enemy.emoji,
      row,
      rowOrder,
      alive: true,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      damage: enemy.damage,
      attackMs: enemy.attackMs,
      attacksMade: 0,
      color: enemy.color,
      attackRange: enemy.attackRange || 'melee',
      targetMode: enemy.targetMode || 'frontBand',
      deathEffect: enemy.deathEffect || null,
      deathEffectDamage: enemy.deathEffectDamage != null ? enemy.deathEffectDamage : enemy.damage,
      passiveKey: enemy.passiveKey || null,
      passiveValue: enemy.passiveValue != null ? enemy.passiveValue : null,
      onHitEffectKey: enemy.onHitEffectKey || null,
      onHitEffectValue: enemy.onHitEffectValue ? { ...enemy.onHitEffectValue } : null,
      triggerKey: enemy.triggerKey || null,
      triggerValue: enemy.triggerValue ? { ...enemy.triggerValue } : null,
      summary: enemy.summary || null,
      poison: 0,
      wounds: 0,
    };
  }

  buildPlayerCombatFighters(rows, combat) {
    const piratesById = new Map((G.hand || []).filter(Boolean).map((pirate) => [pirate.id, pirate]));
    const fighters = [];
    (Array.isArray(rows) ? rows : []).forEach((rowIds, rowIndex) => {
      (Array.isArray(rowIds) ? rowIds : []).forEach((pirateId, rowOrder) => {
        const pirate = piratesById.get(pirateId);
        if (!pirate) return;
        if (this.pirateWounded(pirate)) return;
        fighters.push(this.buildPlayerCombatFighter(pirate, rowIndex, rowOrder, combat));
      });
    });
    return fighters;
  }

  buildEnemyCombatFighters(rows, combat = G.combat) {
    const enemiesById = new Map(((combat && combat.enemyParty) || []).filter(Boolean).map((enemy) => [enemy.id, enemy]));
    const fighters = [];
    (Array.isArray(rows) ? rows : []).forEach((rowIds, rowIndex) => {
      (Array.isArray(rowIds) ? rowIds : []).forEach((enemyId, rowOrder) => {
        const enemy = enemiesById.get(enemyId);
        if (!enemy) return;
        fighters.push(this.buildEnemyCombatFighter(enemy, rowIndex, rowOrder));
      });
    });
    return fighters;
  }

  combatFighters(side) {
    const combat = G.combat;
    if (!combat) return [];
    if (side === 'player') return Array.isArray(combat.playerFighters) ? combat.playerFighters : [];
    return Array.isArray(combat.enemyFighters) ? combat.enemyFighters : [];
  }

  combatLiving(side) {
    return this.combatFighters(side)
      .filter((fighter) => fighter && fighter.alive)
      .sort((a, b) => {
        const aKey = this.combatFormationSortKey(a);
        const bKey = this.combatFormationSortKey(b);
        if (aKey.row !== bKey.row) return aKey.row - bKey.row;
        return aKey.order - bKey.order;
      });
  }

  combatFindFighter(fighterId) {
    const all = [...this.combatFighters('player'), ...this.combatFighters('enemy')];
    return all.find((fighter) => fighter && fighter.id === fighterId) || null;
  }

  combatFormationRows(fighters, opts = {}) {
    const list = Array.isArray(fighters)
      ? fighters.filter(Boolean).slice().sort((a, b) => {
        const aKey = this.combatFormationSortKey(a);
        const bKey = this.combatFormationSortKey(b);
        if (aKey.row !== bKey.row) return aKey.row - bKey.row;
        return aKey.order - bKey.order;
      })
      : [];
    const rowsByIndex = new Map();
    list.forEach((fighter) => {
      if (opts.livingOnly && !fighter.alive) return;
      const rowIndex = Math.max(0, Math.floor(Number(fighter.row) || 0));
      if (!rowsByIndex.has(rowIndex)) rowsByIndex.set(rowIndex, []);
      rowsByIndex.get(rowIndex).push(fighter);
    });
    const rows = Array.from(rowsByIndex.keys())
      .sort((a, b) => a - b)
      .map((rowIndex) => rowsByIndex.get(rowIndex) || [])
      .filter((row) => row.length > 0);
    return rows;
  }

  combatFormationRowY(side, displayRow) {
    const rowIndex = Math.max(0, displayRow || 0);
    const visuals = this.combatFormationVisuals(side);
    if (side === 'enemy') return visuals.frontY - rowIndex * visuals.rowGap;
    return visuals.frontY + rowIndex * visuals.rowGap;
  }

  combatFormationVisuals(side) {
    const L = this.L || {};
    const k = Number.isFinite(L.k) ? L.k : 1;
    const h = Number.isFinite(L.H) ? L.H : 800 * k;
    const yNav = Number.isFinite(L.Y_NAV) ? L.Y_NAV : h - 26 * k;
    const topSafe = Math.min(h * 0.22, 88 * k);
    const bottomSafe = Math.min(h - 32 * k, yNav - 36 * k);
    const availableH = Math.max(360 * k, bottomSafe - topSafe);
    const scale = Phaser.Math.Clamp(availableH / ((6 * 99 + 5 * 8) * k), 0.68, 1);
    const cardH = 99 * k * scale;
    const halfCardH = cardH / 2;
    const rowGap = cardH + 8 * k * scale;
    const topCenter = topSafe + halfCardH;
    return {
      scale,
      rowGap,
      maxStep: 72 * k * scale,
      edgePad: side === 'enemy' ? 32 * k : 24 * k,
      frontY: side === 'enemy'
        ? topCenter + rowGap * 2
        : topCenter + rowGap * 3,
    };
  }

  combatFormationSlots(side, fighters, opts = {}) {
    const positions = {};
    const rows = this.combatFormationRows(fighters, { livingOnly: !!opts.livingOnly });
    const visuals = this.combatFormationVisuals(side);
    const scale = opts.scale != null ? opts.scale : visuals.scale;
    const maxStep = opts.maxStep != null ? opts.maxStep : visuals.maxStep;
    const edgePad = opts.edgePad != null
      ? opts.edgePad
      : visuals.edgePad;

    rows.forEach((rowFighters, displayRow) => {
      const rowY = this.combatFormationRowY(side, displayRow);
      const slots = cardRowLayout(rowFighters.length, this.L, {
        y: rowY,
        maxStep,
        edgePad,
        scale,
      });
      rowFighters.forEach((fighter, idx) => {
        positions[fighter.id] = slots[idx] || slots[0] || { x: this.L.cx, y: rowY };
      });
    });

    return positions;
  }

  combatFrontRow(side) {
    const rows = this.combatFormationRows(this.combatFighters(side), { livingOnly: true });
    return rows[0] || [];
  }

  combatLastRow(side) {
    const rows = this.combatFormationRows(this.combatFighters(side), { livingOnly: true });
    return rows.length ? rows[rows.length - 1] : [];
  }

  combatRowContext(fighter, opts = {}) {
    if (!fighter) return null;
    const rows = this.combatFormationRows(this.combatFighters(fighter.side), { livingOnly: opts.livingOnly !== false });
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].some((rowFighter) => rowFighter && rowFighter.id === fighter.id)) {
        return { rows, rowIndex: i, row: rows[i] };
      }
    }
    return null;
  }

  combatRowBehind(fighter) {
    const ctx = this.combatRowContext(fighter, { livingOnly: true });
    if (!ctx) return [];
    return ctx.rows[ctx.rowIndex + 1] || [];
  }

  combatIsInFrontRow(fighter) {
    if (!fighter || !fighter.alive) return false;
    return this.combatFrontRow(fighter.side).some((rowFighter) => rowFighter && rowFighter.id === fighter.id);
  }

  combatCanAttack(fighter) {
    if (!fighter || !fighter.alive) return false;
    const weapon = this.combatWeaponForFighter(fighter);
    if (weapon && weapon.maxAttacks != null && (fighter.attacksMade || 0) >= weapon.maxAttacks) return false;
    if ((fighter.attackRange || 'melee') === 'ranged') return true;
    return this.combatIsInFrontRow(fighter);
  }

  combatAttackDamage(attacker) {
    if (!attacker) return 0;
    const weapon = this.combatWeaponForFighter(attacker);
    let damage = Math.max(0, Number(attacker.damage) || 0);
    if (weapon && weapon.damagePerOtherAllyInRow) {
      const ctx = this.combatRowContext(attacker, { livingOnly: true });
      const otherAllies = Math.max(0, (ctx && ctx.row ? ctx.row.length : 1) - 1);
      damage -= otherAllies * weapon.damagePerOtherAllyInRow;
    }
    if (weapon && weapon.damageGrowthPerAttack) {
      damage += (Number(attacker.attacksMade) || 0) * weapon.damageGrowthPerAttack;
    }
    return Math.max(0, Math.floor(damage));
  }

  combatWorldPoint(fighter) {
    if (!fighter) return { x: this.L.cx, y: this.islandCenterY() };
    if (fighter.side === 'player') {
      if (this._combatPlayerViews && this._combatPlayerViews[fighter.id]) {
        return this._combatPlayerViews[fighter.id];
      }
      const positions = this.combatFormationSlots('player', this.combatFighters('player'));
      const slot = positions[fighter.id];
      return {
        x: slot ? slot.x : this.L.cx,
        y: slot ? slot.y : this.combatFormationRowY('player', 0),
      };
    }
    if (this._combatEnemyViews && this._combatEnemyViews[fighter.id]) {
      return this._combatEnemyViews[fighter.id];
    }
    const fallbackEnemies = this.combatFighters('enemy').length
      ? this.combatFighters('enemy')
      : ((G.combat && G.combat.enemyParty) || []);
    const positions = this.combatFormationSlots('enemy', fallbackEnemies);
    const slot = positions[fighter.id];
    return {
      x: slot ? slot.x : this.L.cx,
      y: slot ? slot.y : this.combatFormationRowY('enemy', 0),
    };
  }

  combatFrontBandTarget(attacker, enemySide = this.combatOpposingSide(attacker.side)) {
    const allies = this.combatFrontRow(attacker.side);
    const enemies = this.combatFrontRow(enemySide);
    if (!enemies.length) return null;

    const allyPos = Math.max(0, allies.findIndex((fighter) => fighter.id === attacker.id));
    const X = allyPos + 1;
    const N = Math.max(1, allies.length);
    const M = enemies.length;
    const start = Phaser.Math.Clamp(Math.floor((X - 1) * M / N), 0, M - 1);
    const end = Phaser.Math.Clamp(Math.ceil(X * M / N) - 1, start, M - 1);
    const band = enemies.slice(start, end + 1).filter((fighter) => fighter.alive);
    const pool = band.length ? band : enemies;
    return Phaser.Utils.Array.GetRandom(pool);
  }

  combatTargetByHp(side, mode = 'lowest') {
    const living = this.combatLiving(side);
    if (!living.length) return null;
    const edgeHp = living.reduce((best, fighter) => {
      if (mode === 'highest') return Math.max(best, fighter.hp);
      return Math.min(best, fighter.hp);
    }, mode === 'highest' ? -Infinity : Infinity);
    const pool = living.filter((fighter) => fighter.hp === edgeHp);
    return Phaser.Utils.Array.GetRandom(pool);
  }

  combatTargetBackmost(side, predicate = null) {
    const rows = this.combatFormationRows(this.combatFighters(side), { livingOnly: true });
    for (let i = rows.length - 1; i >= 0; i--) {
      const pool = rows[i].filter((fighter) => !predicate || predicate(fighter));
      if (pool.length) return Phaser.Utils.Array.GetRandom(pool);
    }
    return null;
  }

  combatTargetPlanFor(attacker) {
    if (!attacker) return null;
    const enemySide = this.combatOpposingSide(attacker.side);
    const style = (attacker.attackRange || 'melee') === 'ranged' ? 'ranged' : 'melee';
    const targetMode = attacker.targetMode || 'frontBand';

    if (targetMode === 'frontRowAll') {
      const targets = this.combatFrontRow(enemySide);
      if (!targets.length) return null;
      return {
        style,
        targets,
        primaryTarget: targets[Math.floor((targets.length - 1) / 2)] || targets[0],
      };
    }

    if (targetMode === 'lowestHpAny') {
      const target = this.combatTargetByHp(enemySide, 'lowest');
      return target ? { style, targets: [target], primaryTarget: target } : null;
    }

    if (targetMode === 'highestHpAny') {
      const target = this.combatTargetByHp(enemySide, 'highest');
      return target ? { style, targets: [target], primaryTarget: target } : null;
    }

    if (targetMode === 'lastRowPull') {
      const lastRow = this.combatLastRow(enemySide);
      const target = lastRow.length ? Phaser.Utils.Array.GetRandom(lastRow) : null;
      return target ? { style, targets: [target], primaryTarget: target, pullTarget: target } : null;
    }

    if (targetMode === 'backmostArmed') {
      const target = this.combatTargetBackmost(enemySide, (fighter) => !!fighter.weaponKey)
        || this.combatTargetBackmost(enemySide);
      return target ? { style, targets: [target], primaryTarget: target } : null;
    }

    if (targetMode === 'backmostAny') {
      const target = this.combatTargetBackmost(enemySide);
      return target ? { style, targets: [target], primaryTarget: target } : null;
    }

    const target = this.combatFrontBandTarget(attacker, enemySide);
    return target ? { style, targets: [target], primaryTarget: target } : null;
  }

  combatMoveFighterToFrontRow(fighter) {
    if (!fighter || !fighter.alive) return false;
    if (this.combatIsInFrontRow(fighter)) return false;
    const rows = this.combatFormationRows(this.combatFighters(fighter.side), { livingOnly: true });
    if (!rows.length) return false;
    const frontRow = rows[0];
    const frontRowIndex = Math.max(0, Math.floor(Number(frontRow[0] && frontRow[0].row) || 0));
    fighter.row = frontRowIndex;
    const nextOrder = frontRow.reduce((best, rowFighter) => {
      if (!rowFighter || rowFighter.id === fighter.id) return best;
      return Math.max(best, Math.floor(Number(rowFighter.rowOrder) || 0));
    }, -1) + 1;
    fighter.rowOrder = nextOrder;
    return true;
  }

  delayCombatFighterNextAttack(fighter, delayMs, now = this.time.now) {
    const delay = Math.max(0, Number(delayMs) || 0);
    if (!fighter || !fighter.alive || delay <= 0) return false;
    fighter.nextAttackAt = Math.max(fighter.nextAttackAt || now, now) + delay;
    return true;
  }

  combatPassiveDamageReduction(target, plan) {
    if (!target || !target.alive) return 0;
    const hitCount = Array.isArray(plan && plan.targets) ? plan.targets.length : 0;
    if (hitCount <= 1) return 0;
    const ctx = this.combatRowContext(target, { livingOnly: true });
    if (!ctx || !Array.isArray(ctx.row)) return 0;
    return ctx.row.reduce((best, fighter) => {
      if (!fighter || !fighter.alive) return best;
      if (fighter.passiveKey !== 'braceRowVsMultiTarget') return best;
      return Math.max(best, Math.max(0, Number(fighter.passiveValue) || 0));
    }, 0);
  }

  combatAdjustedDamage(attacker, target, baseDamage, plan) {
    let damage = Math.max(0, Math.floor(Number(baseDamage) || 0));
    if (!attacker || !target || damage <= 0) return damage;
    const reduction = this.combatPassiveDamageReduction(target, plan);
    if (reduction > 0) damage = Math.max(1, damage - reduction);
    return damage;
  }

  combatApplyAttackerOnHitEffect(attacker, target, now, addStatusText) {
    if (!attacker || !target || !target.alive) return;
    if (attacker.onHitEffectKey === 'snareOnHit') {
      const cfg = attacker.onHitEffectValue || {};
      const rangedDelay = Math.max(0, Number(cfg.rangedDelayMs) || 0);
      const baseDelay = Math.max(0, Number(cfg.delayMs) || 0);
      const delay = (target.attackRange || 'melee') === 'ranged' ? rangedDelay : baseDelay;
      if (delay > 0 && this.delayCombatFighterNextAttack(target, delay, now)) {
        addStatusText(target.id, 'Snared!', '#81d4fa');
      }
    }
  }

  combatApplyTargetReaction(target, damageTaken, plan, now, addStatusText) {
    if (!target || !target.alive) return;
    const hitCount = Array.isArray(plan && plan.targets) ? plan.targets.length : 0;
    if (target.triggerKey === 'rushOnHeavyHit' && hitCount === 1) {
      const cfg = target.triggerValue || {};
      const threshold = Math.max(1, Number(cfg.threshold) || 0);
      const nextAttackMs = Math.max(0, Number(cfg.nextAttackMs) || 0);
      if (damageTaken >= threshold && nextAttackMs > 0) {
        const rushedAttackAt = now + nextAttackMs;
        target.nextAttackAt = target.nextAttackAt != null
          ? Math.min(target.nextAttackAt, rushedAttackAt)
          : rushedAttackAt;
        addStatusText(target.id, 'Riled!', '#ffb74d');
      }
    }
  }

  combatApplyPoison(target, stacks = 1, deathPositions = []) {
    const totalStacks = Math.max(0, Math.floor(Number(stacks) || 0));
    if (!target || !target.alive || totalStacks <= 0) {
      return { applied: false, repeats: 0, damage: 0, defeated: false };
    }

    let repeats = 0;
    let damage = 0;
    const wounds = Math.max(0, Math.floor(Number(target.wounds) || 0));
    const totalApplications = totalStacks * (wounds + 1);
    for (let i = 0; i < totalApplications; i++) {
      if (!target.alive) break;
      const poisonDamage = Math.max(0, Math.floor(Number(target.poison) || 0));
      if (poisonDamage > 0) {
        target.hp = Math.max(0, target.hp - poisonDamage);
        damage += poisonDamage;
        if (target.hp <= 0) {
          const defeated = this.defeatCombatFighter(target, deathPositions);
          return { applied: true, repeats: repeats + 1, damage, defeated };
        }
      }
      target.poison = Math.max(0, Math.floor(Number(target.poison) || 0)) + 1;
      repeats += 1;
    }

    return { applied: repeats > 0, repeats, damage, defeated: false };
  }

  combatApplyWounds(target, stacks = 1) {
    const totalStacks = Math.max(0, Math.floor(Number(stacks) || 0));
    if (!target || !target.alive || totalStacks <= 0) {
      return { applied: false, added: 0 };
    }
    target.wounds = Math.max(0, Math.floor(Number(target.wounds) || 0)) + totalStacks;
    return { applied: true, added: totalStacks };
  }

  healCombatRowBehind(attacker, amount) {
    const healAmount = Math.max(0, Number(amount) || 0);
    if (!attacker || healAmount <= 0) return [];
    const heals = [];
    this.combatRowBehind(attacker).forEach((fighter) => {
      if (!fighter || !fighter.alive) return;
      const before = Math.max(0, fighter.hp || 0);
      fighter.hp = Math.min(fighter.maxHp || before, before + healAmount);
      const healed = fighter.hp - before;
      if (healed > 0) {
        heals.push({
          fighter,
          amount: healed,
          point: this.combatWorldPoint(fighter),
        });
      }
    });
    return heals;
  }

  combatResultFromLiving() {
    const livingPlayers = this.combatLiving('player');
    const livingEnemies = this.combatLiving('enemy');
    if (!livingPlayers.length && !this.boardingCanDrawReinforcements()) return 'loss';
    if (!livingEnemies.length) return 'win';
    if (!livingPlayers.length) return this.boardingCanDrawReinforcements() ? 'reinforce' : 'loss';
    return null;
  }

  handleCombatResult(result) {
    if (!result) return false;
    if (result === 'reinforce') {
      if (this.drawBoardingReinforcements()) return true;
      this.finishBoardingCombat('loss');
      return true;
    }
    this.finishBoardingCombat(result);
    return true;
  }

  showCombatAftermath(blastEvents = [], deathPositions = []) {
    blastEvents.forEach((blast) => {
      if (blast.disarmed) {
        if (blast.origin) {
          this.effectText(blast.origin.x, blast.origin.y - 30 * this.L.k, 'Fizzle!', '#b0bec5', false);
        }
        return;
      }
      if (blast.origin) {
        this.effectText(blast.origin.x, blast.origin.y - 30 * this.L.k, 'Boom!', '#ffb74d', false);
      }
      (blast.targetPositions || []).forEach((point) => {
        this.effectText(point.x, point.y - 20 * this.L.k, `-${blast.damage}`, '#ffb74d', false);
      });
    });
    deathPositions.forEach((deathPos) => {
      this.effectText(deathPos.x, deathPos.y - 6 * this.L.k, 'Down!', '#ff8a80', 220);
    });
  }

  scheduleCombatEffect(delayMs, cb) {
    const delay = Math.max(0, Math.floor(Number(delayMs) || 0));
    let timer = null;
    timer = this.time.delayedCall(delay, () => {
      this._combatEffectTimers = (this._combatEffectTimers || []).filter((entry) => entry !== timer);
      if (cb) cb();
    });
    this._combatEffectTimers.push(timer);
    return timer;
  }

  applyCombatBleed(target, bleed) {
    const damage = Math.max(0, Number(bleed && bleed.damage) || 0);
    const ticks = Math.max(0, Math.floor(Number(bleed && bleed.ticks) || 0));
    const intervalMs = Math.max(COMBAT.attackFxMs, Number(bleed && bleed.intervalMs) || 0);
    if (!target || damage <= 0 || ticks <= 0 || intervalMs <= 0) return;

    (target.bleedTimers || []).forEach((timer) => {
      if (timer && !timer.hasDispatched) timer.remove(false);
      this._combatEffectTimers = (this._combatEffectTimers || []).filter((entry) => entry !== timer);
    });
    target.bleedTimers = [];

    for (let tick = 1; tick <= ticks; tick++) {
      let bleedTimer = null;
      bleedTimer = this.scheduleCombatEffect(intervalMs * tick, () => {
        target.bleedTimers = (target.bleedTimers || []).filter((entry) => entry !== bleedTimer);
        const combat = G.combat;
        if (!combat || combat.mode !== 'fighting' || !target.alive) return;

        const now = this.time.now;
        const deathPositions = [];
        const defeatedTargets = [];
        target.hp = Math.max(0, target.hp - damage);

        const point = this.combatWorldPoint(target);
        this.effectText(point.x, point.y - 26 * this.L.k, `-${damage}`, '#ef5350', false);
        if (target.hp <= 0 && this.defeatCombatFighter(target, deathPositions)) {
          defeatedTargets.push(target);
        }

        const blastEvents = this.resolveCombatDeathEffects(defeatedTargets, now, deathPositions);
        this.showCombatAftermath(blastEvents, deathPositions);
        this.renderAll();

        const result = this.combatResultFromLiving();
        if (this.handleCombatResult(result)) return;
        this.scheduleNextCombatAttack();
      });
      target.bleedTimers.push(bleedTimer);
    }
  }

  defeatCombatFighter(fighter, deathPositions) {
    if (!fighter || !fighter.alive) return false;
    const deathPoint = this.combatWorldPoint(fighter);
    fighter.alive = false;
    fighter.incomingUntil = 0;
    if (fighter.side === 'player') {
      if (!this.isBattleTest()) this.markPirateWounded(fighter.pirateId);
      this.queueCombatPirateReturn(fighter, deathPoint);
    }
    if (Array.isArray(deathPositions)) deathPositions.push(deathPoint);
    return true;
  }

  resolveCombatDeathEffects(deadFighters, now, deathPositions) {
    const queued = Array.isArray(deadFighters) ? deadFighters.filter(Boolean) : [];
    const blastEvents = [];
    queued.forEach((fighter) => {
      if (!fighter.alive && fighter.deathEffect === 'frontRowBlast') {
        const origin = this.combatWorldPoint(fighter);
        const wounds = Math.max(0, Math.floor(Number(fighter.wounds) || 0));
        if (wounds > 0) {
          blastEvents.push({ origin, disarmed: true });
          return;
        }
        const damage = Math.max(0, fighter.deathEffectDamage != null ? fighter.deathEffectDamage : fighter.damage || 0);
        if (damage <= 0) return;
        const targets = this.combatFrontRow(this.combatOpposingSide(fighter.side)).slice();
        if (!targets.length) return;
        const targetPositions = [];
        targets.forEach((target) => {
          if (!target || !target.alive) return;
          targetPositions.push(this.combatWorldPoint(target));
          target.incomingUntil = Math.max(target.incomingUntil || 0, now + COMBAT.attackFxMs);
          target.hp = Math.max(0, target.hp - damage);
          if (target.hp <= 0) {
            this.defeatCombatFighter(target, deathPositions);
          }
        });
        blastEvents.push({
          origin,
          damage,
          targetPositions,
        });
      }
    });
    return blastEvents;
  }

  showCombatAttackFx(attacker, targets, damage, opts = {}, onComplete) {
    const hitTargets = Array.isArray(targets) ? targets.filter(Boolean) : [targets].filter(Boolean);
    const start = this.combatWorldPoint(attacker);
    const impactPoints = hitTargets.length
      ? hitTargets.map((target) => this.combatWorldPoint(target))
      : [start];
    const end = hitTargets.length
      ? {
        x: impactPoints.reduce((sum, point) => sum + point.x, 0) / impactPoints.length,
        y: impactPoints.reduce((sum, point) => sum + point.y, 0) / impactPoints.length,
      }
      : start;
    const attackerNode = this._combatNodes ? this._combatNodes[attacker.id] : null;
    const impactDelay = Math.max(40, Math.round(COMBAT.attackFxMs / 2));
    let impactShown = false;
    const showImpact = () => {
      if (impactShown) return;
      impactShown = true;
      hitTargets.forEach((target, idx) => {
        const point = impactPoints[idx] || end;
        const targetDamage = opts.damageByTargetId && target && opts.damageByTargetId[target.id] != null
          ? opts.damageByTargetId[target.id]
          : damage;
        let statusY = point.y - 44 * this.L.k;
        if (targetDamage > 0 || !opts.suppressZeroDamageText) {
          const dmgText = targetDamage > 0 ? `-${targetDamage}` : '0';
          this.effectText(point.x, point.y - 44 * this.L.k, dmgText, attacker.side === 'player' ? '#ffd54f' : '#ff8a80', false);
          statusY = point.y - 20 * this.L.k;
        }
        const statusEntries = opts.statusTextByTargetId && target
          ? opts.statusTextByTargetId[target.id]
          : null;
        const entries = Array.isArray(statusEntries)
          ? statusEntries.filter(Boolean)
          : (statusEntries ? [statusEntries] : []);
        entries.forEach((entry, entryIdx) => {
          const text = typeof entry === 'string' ? entry : entry.text;
          const color = typeof entry === 'string' ? '#81d4fa' : (entry.color || '#81d4fa');
          if (!text) return;
          this.effectText(point.x, statusY - entryIdx * 22 * this.L.k, text, color, false);
        });
      });
    };
    const finish = () => {
      showImpact();
      if (onComplete) onComplete();
    };

    this.time.delayedCall(impactDelay, () => {
      if (!this.sys || !this.sys.isActive()) return;
      showImpact();
    });

    if (!attackerNode || !attackerNode.active) {
      finish();
      return;
    }

    attackerNode.setDepth(65);
    attackerNode.x = start.x;
    attackerNode.y = start.y;
    if (opts.style === 'ranged') {
      const nudgeX = Phaser.Math.Linear(start.x, end.x, 0.18);
      const nudgeY = Phaser.Math.Linear(start.y, end.y, 0.18);
      this.tweens.add({
        targets: attackerNode,
        x: nudgeX,
        y: nudgeY,
        angle: attacker.side === 'player' ? -8 : 8,
        duration: impactDelay,
        ease: 'Sine.easeOut',
        yoyo: true,
        hold: 0,
        onComplete: () => {
          if (attackerNode && attackerNode.active) {
            attackerNode.x = start.x;
            attackerNode.y = start.y;
            attackerNode.angle = 0;
            attackerNode.setDepth(0);
          }
          finish();
        },
      });
      return;
    }
    this.tweens.add({
      targets: attackerNode,
      x: end.x,
      y: end.y,
      angle: attacker.side === 'player' ? 10 : -10,
      duration: impactDelay,
      ease: 'Cubic.easeIn',
      yoyo: true,
      hold: 0,
      onComplete: () => {
        if (attackerNode && attackerNode.active) {
          attackerNode.x = start.x;
          attackerNode.y = start.y;
          attackerNode.angle = 0;
          attackerNode.setDepth(0);
        }
        finish();
      },
    });
  }

  startCombatAutoplay() {
    this.clearCombatTimers();
    const combat = G.combat;
    if (!combat || combat.mode !== 'fighting') return;
    const now = this.time.now;
    combat.nextAttackStartAt = now;
    const fighters = [...this.combatFighters('player'), ...this.combatFighters('enemy')];
    fighters.forEach((fighter) => {
      fighter.nextAttackAt = now + Phaser.Math.Between(COMBAT.initialDelayMin, COMBAT.initialDelayMax);
      fighter.incomingUntil = 0;
      fighter.attacksMade = 0;
    });
    this.scheduleNextCombatAttack();
  }

  scheduleNextCombatAttack() {
    if (this._combatTickTimer && !this._combatTickTimer.hasDispatched) {
      this._combatTickTimer.remove(false);
    }
    this._combatTickTimer = null;

    const combat = G.combat;
    if (!combat || combat.mode !== 'fighting') return;

    const livingPlayers = this.combatLiving('player');
    const livingEnemies = this.combatLiving('enemy');
    if (!livingPlayers.length || !livingEnemies.length) {
      this.handleCombatResult(this.combatResultFromLiving());
      return;
    }

    const now = this.time.now;
    const nextGlobalAttackAt = combat.nextAttackStartAt || 0;
    const living = [...livingPlayers, ...livingEnemies];
    const ready = nextGlobalAttackAt <= now
      ? living.filter((fighter) =>
        this.combatCanAttack(fighter)
          && (fighter.nextAttackAt || 0) <= now
          && (fighter.incomingUntil || 0) <= now)
      : [];

    if (ready.length) {
      let earliestReadyAt = Infinity;
      ready.forEach((fighter) => {
        earliestReadyAt = Math.min(earliestReadyAt, fighter.nextAttackAt || 0);
      });
      const candidates = ready.filter((fighter) => (fighter.nextAttackAt || 0) === earliestReadyAt);
      const nextAttacker = candidates.length === 1 ? candidates[0] : Phaser.Utils.Array.GetRandom(candidates);
      this.performCombatAttack(nextAttacker.id);
      return;
    }

    let nextAllowedAt = Infinity;
    living.forEach((fighter) => {
      if (!this.combatCanAttack(fighter)) return;
      const earliestAttackAt = Math.max(
        nextGlobalAttackAt,
        fighter.nextAttackAt || 0,
        fighter.incomingUntil || 0
      );
      nextAllowedAt = Math.min(nextAllowedAt, earliestAttackAt);
    });
    if (!Number.isFinite(nextAllowedAt)) return;

    const delay = Math.max(0, Math.ceil(nextAllowedAt - now));
    this._combatTickTimer = this.time.delayedCall(delay, () => {
      this._combatTickTimer = null;
      this.scheduleNextCombatAttack();
    });
  }

  performCombatAttack(fighterId) {
    const combat = G.combat;
    if (!combat || combat.mode !== 'fighting') return;

    const now = this.time.now;
    const attacker = this.combatFindFighter(fighterId);
    if (!attacker || !attacker.alive) {
      this.scheduleNextCombatAttack();
      return;
    }
    if (!this.combatCanAttack(attacker)) {
      this.scheduleNextCombatAttack();
      return;
    }
    if ((attacker.incomingUntil || 0) > now) {
      this.scheduleNextCombatAttack();
      return;
    }

    const plan = this.combatTargetPlanFor(attacker);
    if (!plan || !plan.targets || !plan.targets.length) {
      this.handleCombatResult(this.combatResultFromLiving() || (attacker.side === 'player' ? 'win' : 'loss'));
      return;
    }

    const weapon = this.combatWeaponForFighter(attacker);

    // Per-fighter cooldown still comes from that fighter's own attack speed.
    attacker.nextAttackAt = now + Math.max(0, attacker.attackMs || 0);
    combat.nextAttackStartAt = now + COMBAT.attackStartGapMs;

    const damage = this.combatAttackDamage(attacker);
    attacker.attacksMade = (attacker.attacksMade || 0) + 1;
    const deathPositions = [];
    const defeatedTargets = [];
    const bleedTargets = [];
    const damageByTargetId = {};
    const reductionByTargetId = {};
    const statusTextByTargetId = {};
    const addStatusText = (targetId, text, color) => {
      if (!targetId || !text) return;
      if (!statusTextByTargetId[targetId]) statusTextByTargetId[targetId] = [];
      statusTextByTargetId[targetId].push({ text, color });
    };
    plan.targets.forEach((target) => {
      if (!target || !target.id) return;
      const adjustedDamage = this.combatAdjustedDamage(attacker, target, damage, plan);
      damageByTargetId[target.id] = adjustedDamage;
      reductionByTargetId[target.id] = Math.max(0, damage - adjustedDamage);
    });
    plan.targets.forEach((target) => {
      if (!target || !target.alive) return;
      const targetDamage = damageByTargetId[target.id] != null ? damageByTargetId[target.id] : damage;
      target.incomingUntil = now + COMBAT.attackFxMs;
      target.hp = Math.max(0, target.hp - targetDamage);
      if (reductionByTargetId[target.id] > 0) {
        addStatusText(target.id, 'Braced!', '#aed581');
      }
      if (target.hp <= 0 && this.defeatCombatFighter(target, deathPositions)) {
        defeatedTargets.push(target);
        return;
      }
      if (weapon && weapon.nextAttackDelayMsOnHit && this.delayCombatFighterNextAttack(target, weapon.nextAttackDelayMsOnHit, now)) {
        addStatusText(target.id, 'Delayed!', '#81d4fa');
      }
      if (weapon && weapon.bleed) {
        bleedTargets.push(target);
        addStatusText(target.id, 'Bleeding!', '#ef5350');
      }
      this.combatApplyAttackerOnHitEffect(attacker, target, now, addStatusText);
      this.combatApplyTargetReaction(target, targetDamage, plan, now, addStatusText);
      if (weapon && weapon.woundsOnHit) {
        const woundResult = this.combatApplyWounds(target, weapon.woundsOnHit);
        if (woundResult.applied) {
          addStatusText(
            target.id,
            woundResult.added > 1 ? `+${woundResult.added} Wounds` : 'Wounded!',
            '#ffb74d'
          );
        }
      }
      if (weapon && weapon.poisonOnHit) {
        const poisonResult = this.combatApplyPoison(target, weapon.poisonOnHit, deathPositions);
        if (poisonResult.applied) {
          damageByTargetId[target.id] = (damageByTargetId[target.id] || 0) + poisonResult.damage;
          addStatusText(
            target.id,
            poisonResult.repeats > 1 ? `Poison x${poisonResult.repeats}!` : 'Poisoned!',
            '#81c784'
          );
        }
        if (poisonResult.defeated) {
          defeatedTargets.push(target);
          return;
        }
      }
    });
    const blastEvents = this.resolveCombatDeathEffects(defeatedTargets, now, deathPositions);

    if (plan.pullTarget && plan.pullTarget.alive && this.combatMoveFighterToFrontRow(plan.pullTarget)) {
      addStatusText(plan.pullTarget.id, 'Pulled!', '#81d4fa');
    }
    const heals = weapon && weapon.healRowBehindOnHit
      ? this.healCombatRowBehind(attacker, weapon.healRowBehindOnHit)
      : [];

    const combatResult = this.combatResultFromLiving();
    const suppressZeroDamageText = damage <= 0 && !!(weapon && weapon.damageOverride === 0);

    this.showCombatAttackFx(attacker, plan.targets, damage, {
      style: plan.style,
      damageByTargetId,
      suppressZeroDamageText,
      statusTextByTargetId,
    }, () => {
      bleedTargets.forEach((target) => this.applyCombatBleed(target, weapon && weapon.bleed));
      heals.forEach((heal) => {
        const point = heal.point || this.combatWorldPoint(heal.fighter);
        this.effectText(point.x, point.y - 26 * this.L.k, `+${heal.amount}`, '#66bb6a', false);
      });
      this.showCombatAftermath(blastEvents, deathPositions);
      this.renderAll();
      if (this.handleCombatResult(combatResult)) return;
      this.scheduleNextCombatAttack();
    });
  }

  finishBoardingCombat(result) {
    const combat = G.combat;
    if (!combat || combat.mode === 'resolved') return;
    const plunder = result === 'win' ? this.grantBoardingAlertPlunder(combat) : null;
    const trophy = result === 'win' ? this.grantBoardingTrophy(combat) : null;
    const counterTrophy = result === 'win' ? this.grantCounterTrophy(combat) : null;
    combat.mode = 'resolved';
    combat.result = result;
    this.clearCombatTimers();
    G.busy = false;
    this.renderAll();
    this.showBoardingTrophy(trophy);
    this.showCounterTrophy(counterTrophy);
    this.showBoardingAlertPlunder(plunder);
  }

  continueFromResolvedBoarding() {
    if (!this.sys || !this.sys.isActive()) return;
    const combat = G.combat;
    if (!combat || combat.mode !== 'resolved') return;
    if (combat.result !== 'win') {
      this.showGameOver();
      return;
    }
    if (this.isBattleTest()) {
      this.renderAll();
      this.showBattleTestOverlay('win');
      return;
    }

    const discardAnimEnd = this.animateCurrentHandToDiscard();
    const nextTurnDelay = discardAnimEnd + CARD_MOTION.betweenTurnsDelay;
    G.discard.push(...G.hand);
    G.hand = [];
    G.sent = [];
    this._sendingToIsland.clear();
    this._pendingEndSending = false;

    G.phase = 'map';
    G.enemyShip = null;
    this.clearCombatState();
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
  }

  resolveBoarding() {
    if (G.phase !== 'boarding' || G.busy) return;
    const combat = this.ensureBoardingCombat();
    if (!combat || combat.mode !== 'setup') return;
    const playerRows = this.combatCompactSetupRows(this.combatSetupRows('player', combat));
    const enemyRows = this.combatSetupRows('enemy', combat);
    combat.playerSetupRows = playerRows;
    combat.enemySetupRows = enemyRows;

    G.busy = true;
    combat.mode = 'fighting';
    this.clearCombatSetupPopupDismiss();
    this._combatSetupPopupPinned = false;
    this._combatSetupDragState = null;
    combat.inspectedPirateId = null;
    combat.inspectedEnemyId = null;
    combat.result = null;
    combat.playerFighters = this.buildPlayerCombatFighters(playerRows, combat);
    combat.enemyFighters = this.buildEnemyCombatFighters(enemyRows, combat);
    this.renderAll();
    this.startCombatAutoplay();
  }

  restartCurrentMode(opts = {}) {
    this.clearCt('gameover');
    this.closePanels();
    this.scene.restart(this.isBattleTest()
      ? { resetMode: 'battleTest', battleTestRepeat: opts.battleTestRepeat || null }
      : { resetMode: 'run' });
  }

  cloneBattleTestSetupRows(rows) {
    return [0, 1, 2].map((rowIndex) => {
      const row = Array.isArray(rows && rows[rowIndex]) ? rows[rowIndex] : [];
      return row.filter((id) => id != null);
    });
  }

  captureBattleTestRepeatState() {
    if (!this.isBattleTest()) return null;
    const combat = this.ensureBoardingCombat();
    if (!combat || !Array.isArray(combat.enemyParty) || combat.enemyParty.length === 0) return null;

    return {
      crew: (G.hand || []).filter(Boolean).map((pirate) => ({
        id: pirate.id,
        type: pirate.type,
        weaponKey: this.pirateWeaponKey(pirate),
      })),
      round: G.round,
      boardingCount: G.boardingCount,
      enemyShip: G.enemyShip ? { ...G.enemyShip } : null,
      enemyName: combat.enemyName || null,
      encounterDesc: combat.encounterDesc || null,
      enemyParty: combat.enemyParty.filter(Boolean).map((enemy) => ({ ...enemy })),
      playerSetupRows: this.cloneBattleTestSetupRows(this.combatSetupRows('player', combat)),
      enemySetupRows: this.cloneBattleTestSetupRows(this.combatSetupRows('enemy', combat)),
    };
  }

  repeatBattleTest() {
    this.restartCurrentMode({ battleTestRepeat: this.captureBattleTestRepeatState() });
  }

  showBattleTestOverlay(result) {
    if (window.PokiBridge) {
      window.PokiBridge.gameplayStop();
    }
    this.clearCt('gameover');
    const L = this.L;
    const won = result === 'win';
    const combat = G.combat;
    const playerTotal = Math.max(1, (combat && Array.isArray(combat.playerFighters) ? combat.playerFighters.length : G.hand.length) || 1);
    const enemyTotal = Math.max(1, (combat && Array.isArray(combat.enemyParty) ? combat.enemyParty.length : 0) || 1);
    const playerAlive = combat ? this.combatLiving('player').length : playerTotal;
    const enemyAlive = combat ? this.combatLiving('enemy').length : enemyTotal;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 1);
    overlay.fillRect(0, 0, L.W, L.H);
    this.addTo('gameover', overlay);

    this.addTo('gameover', this.add.text(L.cx, L.H * 0.31,
      won ? 'Battle Test Won' : 'Battle Test Lost',
      uiHeadingStyle(L, 42, won ? '#8bd17c' : '#ff8a80')).setOrigin(0.5, 0));
    this.txt('gameover', L.cx, L.H * 0.40,
      `Boarding #${this.currentBoardingNumber()}  ·  ${playerAlive}/${playerTotal} cats standing`,
      { color: UI_THEME.colors.mutedPaper });
    this.txt('gameover', L.cx, L.H * 0.46,
      won
        ? `Cleared ${enemyTotal} foe${enemyTotal === 1 ? '' : 's'} from the deck`
        : `${enemyAlive}/${enemyTotal} foe${enemyTotal === 1 ? '' : 's'} still standing`,
      { color: won ? '#8bd17c' : '#ff8a80' });

    const repeatBtn = makeUiPill(this, {
      x: L.cx,
      y: L.H * 0.56,
      label: 'Repeat',
      L,
      minW: 180 * L.k,
      minH: 56 * L.k,
      fill: UI_THEME.colors.cocoa,
      textColor: UI_THEME.colors.paper,
      textPx: 18,
    }).setInteractive({ useHandCursor: true });
    repeatBtn.on('pointerover', () => repeatBtn.setPillStyle({ fill: UI_THEME.colors.cocoaDark, textColor: UI_THEME.colors.paper }));
    repeatBtn.on('pointerout', () => repeatBtn.setPillStyle({ fill: UI_THEME.colors.cocoa, textColor: UI_THEME.colors.paper }));
    repeatBtn.on('pointerdown', () => this.repeatBattleTest());
    this.addTo('gameover', repeatBtn);

    const nextBtn = makeUiPill(this, {
      x: L.cx,
      y: L.H * 0.66,
      label: 'Another Battle',
      L,
      minW: 210 * L.k,
      minH: 52 * L.k,
      fill: UI_THEME.colors.sandEdge,
      textColor: UI_THEME.colors.ink,
      textPx: 17,
    }).setInteractive({ useHandCursor: true });
    nextBtn.on('pointerover', () => nextBtn.setPillStyle({ fill: UI_THEME.colors.sandBorder, textColor: UI_THEME.colors.ink }));
    nextBtn.on('pointerout', () => nextBtn.setPillStyle({ fill: UI_THEME.colors.sandEdge, textColor: UI_THEME.colors.ink }));
    nextBtn.on('pointerdown', () => this.restartCurrentMode());
    this.addTo('gameover', nextBtn);
  }

  showGameOver() {
    if (this.isBattleTest()) {
      this.showBattleTestOverlay('loss');
      return;
    }
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

    const combat = G.combat;
    const enemyCount = combat && Array.isArray(combat.enemyParty) ? combat.enemyParty.length : 0;
    const enemyAlive = combat ? this.combatLiving('enemy').length : enemyCount;
    const enemyTotal = Math.max(1, enemyCount, enemyAlive);
    this.txt('gameover', L.cx, L.H * 0.46,
      `Boarding #${this.currentBoardingNumber()}  ·  ${enemyAlive}/${enemyTotal} foes still standing`,
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
    btn.on('pointerdown', () => this.restartCurrentMode());
    this.addTo('gameover', btn);
  }

  showVictory() {
    if (this.isBattleTest()) {
      this.showBattleTestOverlay('win');
      return;
    }
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
      `You conquered all ${TOTAL_BATTLES} enemy ships!`,
      { color: UI_THEME.colors.mutedPaper });
    this.txt('gameover', L.cx, L.H * 0.42,
      `${G.round} rounds  ·  Crew of ${G.allCrew.length}`,
      { color: UI_THEME.colors.mutedPaper });

    let inv = '';
    ['wood', 'stone', 'gold'].forEach(r => {
      if (G.res[r] > 0) inv += ` ${G.res[r]}${RES_EMOJI[r]}`;
    });
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
    btn.on('pointerdown', () => this.restartCurrentMode());
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

  queueRenderAll() {
    if (this._renderAllQueued) return;
    this._renderAllQueued = true;
    this.time.delayedCall(0, () => {
      this._renderAllQueued = false;
      if (!this.sys || !this.sys.isActive()) return;
      this.renderAll();
    });
  }

  clearCombatSetupPopupDismiss() {
    if (this._combatSetupPopupDismissTimer && !this._combatSetupPopupDismissTimer.hasDispatched) {
      this._combatSetupPopupDismissTimer.remove(false);
    }
    this._combatSetupPopupDismissTimer = null;
  }

  scheduleCombatSetupPopupDismiss(combat = G.combat, delayMs = 110) {
    if (!combat || combat.mode !== 'setup' || this._combatSetupPopupPinned || this.combatSetupDragging()) return;
    if (combat.inspectedPirateId == null && combat.inspectedEnemyId == null) return;
    this.clearCombatSetupPopupDismiss();
    this._combatSetupPopupDismissTimer = this.time.delayedCall(delayMs, () => {
      this._combatSetupPopupDismissTimer = null;
      if (!combat || combat.mode !== 'setup' || this._combatSetupPopupPinned || this.combatSetupDragging()) return;
      this.clearCombatSetupInspection(combat);
    });
  }

  clearCombatSetupInspection(combat = G.combat, opts = {}) {
    this.clearCombatSetupPopupDismiss();
    this._combatSetupPopupPinned = false;
    if (!combat || combat.mode !== 'setup') return;
    if (combat.inspectedPirateId == null && combat.inspectedEnemyId == null) return;
    combat.inspectedPirateId = null;
    combat.inspectedEnemyId = null;
    if (!opts.silent) this.queueRenderAll();
  }

  addTo(k, obj) { this.ct[k].add(obj); return obj; }

  txt(k, x, y, str, style) {
    const L = this.L;
    const base = uiBodyStyle(L, UI_THEME.colors.paper);
    const t = this.add.text(x, y, str, Object.assign(base, style)).setOrigin(0.5, 0);
    return this.addTo(k, t);
  }

  mapBoardingNumberForLayer(layerIdx) {
    if (!G.map || !Array.isArray(G.map.layers)) return 1;
    let count = 0;
    for (let li = 0; li <= layerIdx; li++) {
      const layer = G.map.layers[li];
      if (layer && layer.length === 1 && layer[0].type === 'ship') count++;
    }
    return Math.max(1, count);
  }

  combatEncounterPreviewArchetypes(blueprint) {
    if (!blueprint || typeof blueprint !== 'object') return [];
    const main = this.combatArchetypeByKey(blueprint.mainKey);
    if (!main) return [];

    const total = Math.max(1, Math.floor(Number(blueprint.totalCount) || 1));
    const archetypes = [main];
    const supportKeys = Array.isArray(blueprint.supportKeys) ? blueprint.supportKeys : [];
    supportKeys.forEach((key) => {
      if (archetypes.length >= total) return;
      const archetype = this.combatArchetypeByKey(key);
      if (archetype) archetypes.push(archetype);
    });
    while (archetypes.length < total) archetypes.push(main);
    return archetypes.slice(0, total);
  }

  enemyRosterMemberLabel(archetype, boardingNo) {
    if (!archetype) return '';
    const scaling = this.combatEnemyLateScaling(boardingNo);
    const name = scaling ? `${scaling.label} ${archetype.name}` : archetype.name;
    return `${archetype.emoji} ${name}`;
  }

  nextShipIntel() {
    if (this.isBattleTest() || !G.map || !Array.isArray(G.map.layers)) return null;
    const currentLayer = Number.isFinite(G.map.currentLayer) ? G.map.currentLayer : -1;

    for (let li = Math.max(0, currentLayer + 1); li < G.map.layers.length; li++) {
      const layer = G.map.layers[li];
      if (!layer || layer.length !== 1 || layer[0].type !== 'ship') continue;
      const node = layer[0];
      const boardingNo = this.mapBoardingNumberForLayer(li);
      const roster = this.combatEncounterPreviewArchetypes(node.encounter);
      const rosterLabels = roster
        .map((archetype) => this.enemyRosterMemberLabel(archetype, boardingNo))
        .filter(Boolean);
      const main = roster[0] || (node.encounter ? this.combatArchetypeByKey(node.encounter.mainKey) : null);
      const encounterDesc = node.encounter && node.encounter.encounterDesc ? node.encounter.encounterDesc : null;
      return {
        nodeId: node.id,
        layerIdx: li,
        turnsAway: li - currentLayer,
        boardingNo,
        mainKey: main ? main.key : (node.encounter && node.encounter.mainKey) || null,
        encounterDesc,
        rosterLabels,
        mainLabel: this.enemyRosterMemberLabel(main, boardingNo),
      };
    }

    return null;
  }

  boardingAlertIntelText(amount = this.pendingBoardingAlert(), guardCount = this.boardingAlertGuardCount(amount), opts = {}) {
    const alert = Math.max(0, Math.floor(Number(amount) || 0));
    if (alert <= 0) return '';
    const label = this.boardingAlertGuardLabel(guardCount);
    const includePlunder = opts.includePlunder !== false;
    const plunder = includePlunder ? this.boardingAlertPlunderLabel(guardCount) : '';
    const suffix = [label, plunder].filter(Boolean).join(', ');
    return suffix ? `Alert ${alert}: ${suffix}` : `Alert ${alert}`;
  }

  nextShipIntelText(intel = null, opts = {}) {
    const info = intel || this.nextShipIntel();
    if (!info) return '';
    const prefix = opts.prefix === false ? '' : 'Next ship: ';
    const rosterLine = info.rosterLabels && info.rosterLabels.length
      ? `${prefix}${info.rosterLabels.join(', ')}`
      : (info.encounterDesc || `Battle #${info.boardingNo}`);
    const alertAmount = opts.alertAmount != null
      ? Math.max(0, Math.floor(Number(opts.alertAmount) || 0))
      : this.pendingBoardingAlert();
    const alertGuardCount = opts.alertGuardCount != null
      ? Math.max(0, Math.min(3, Math.floor(Number(opts.alertGuardCount) || 0)))
      : this.boardingAlertGuardCount(alertAmount);
    const alertLine = opts.includeAlert === false
      ? ''
      : this.boardingAlertIntelText(alertAmount, alertGuardCount, opts);
    return [rosterLine, alertLine].filter(Boolean).join(' · ');
  }

  isLandingRoundPhase() {
    return !!G.island && G.phase !== 'map' && G.phase !== 'boarding';
  }

  nextEnemyState() {
    const intel = this.nextShipIntel();
    if (intel) {
      return {
        icon: '🏴‍☠️',
        line1: `Enemy in ${intel.turnsAway} turn${intel.turnsAway === 1 ? '' : 's'}.`,
        line2: this.nextShipIntelText(intel) || `Battle #${intel.boardingNo}`,
      };
    }
    return { icon: '⭐', line1: 'No more enemy ships.', line2: 'Sail to the end' };
  }

  currentGoalState() {
    if (this.weaponAssignmentActive()) {
      const flow = this.currentWeaponAssignment();
      const weapon = flow ? WEAPON_TYPES[flow.weaponKey] : null;
      return {
        icon: weapon ? weapon.emoji : WEAPON_CATEGORY_EMOJI,
        line1: weapon ? `Assign ${weapon.name}.` : 'Arm a pirate.',
        line2: 'Pick any pirate from this round',
      };
    }

    if (G.phase === 'healing') {
      const wounded = this.woundedCrew().length;
      const remaining = Math.max(0, this.healingLimit() - this.healingUsed());
      return {
        icon: WOUNDED_EMOJI,
        line1: 'Heal wounded pirates.',
        line2: wounded ? `${remaining} heals left` : 'No wounded pirates',
      };
    }

    if (G.phase === 'boarding' && G.enemyShip) {
      const combat = this.ensureBoardingCombat();
      const alert = this.activeBoardingAlertState();
      const alertLine = this.boardingAlertSummary(alert.amount, alert.guardCount);
      if (combat && combat.mode === 'intro') {
        return {
          icon: '🏴‍☠️',
          line1: 'Boarding party spotted.',
          line2: alertLine || 'Crew moving into formation',
        };
      }
      if (combat && combat.mode === 'fighting') {
        const wave = Math.max(0, Math.floor(Number(combat.reinforcementCount) || 0));
        const baseLine = `${this.combatLiving('player').length} cats vs ${this.combatLiving('enemy').length} foes${wave ? ` · hand ${wave + 1}` : ''}`;
        return {
          icon: '⚔️',
          line1: 'Boarding underway.',
          line2: alertLine ? `${baseLine} · ${this.boardingAlertGuardLabel(alert.guardCount)}` : baseLine,
        };
      }
      if (combat && combat.mode === 'resolved') {
        const trophy = combat.boardingTrophy;
        const counterTrophy = combat.counterTrophy;
        const rewardParts = [];
        if (trophy) rewardParts.push(`${trophy.name} +💪`);
        if (counterTrophy) rewardParts.push(`${counterTrophy.name} +⚡`);
        return {
          icon: combat.result === 'win' ? '⚔️' : '💀',
          line1: combat.result === 'win' ? 'Deck cleared.' : 'Crew exhausted.',
          line2: combat.result === 'win'
            ? (rewardParts.length ? `Rewards: ${rewardParts.join(' · ')}` : 'Taking the ship')
            : 'All pirates are wounded',
        };
      }
      const ready = this.activeCombatHandPirates().length;
      const sittingOut = (G.hand || []).filter((pirate) => this.pirateWounded(pirate)).length;
      return {
        icon: '🏴‍☠️',
        line1: 'Arrange boarding formation.',
        line2: alertLine || (sittingOut ? `${ready} ready, ${sittingOut} wounded sit out` : `${ready} pirates ready to fight`),
      };
    }

    if (G.phase === 'removing') {
      return {
        icon: '☠️',
        line1: 'Choose a pirate to exile.',
        line2: 'Pick one cat that is not in hand',
      };
    }

    if (G.phase === 'shopping') {
      const alertLine = this.boardingAlertSummary(this.pendingBoardingAlert());
      const discount = this.activeFullCrewDiscount();
      const discountLine = discount > 0 ? `Full Crew Discount -${discount}☠️` : null;
      return {
        icon: '🛒',
        line1: 'Visit the shop.',
        line2: [discountLine, alertLine].filter(Boolean).join(' · ') || 'Buy crew or continue sailing',
      };
    }

    if (G.phase === 'ship') {
      return {
        icon: '⚒️',
        line1: 'Crew is working on the ship.',
        line2: 'Ship actions resolve automatically',
      };
    }

    if (G.phase === 'sending' && G.island) {
      return {
        icon: '👆',
        line1: 'Swipe a pirate to send on island.',
        line2: 'Other pirates will work on ship',
      };
    }

    if (!G.map || !Array.isArray(G.map.layers)) {
      return { icon: '🗺️', line1: 'Choose a route.', line2: 'Open the map' };
    }

    return { icon: '🗺️', line1: 'Choose a route.', line2: 'Open the map' };
  }

  islandDescription() {
    if (!G.island) return 'Choose a route on the map';
    let base = 'Set sail and gather what you can';
    if (G.island.bonus === 'wood') base = 'Pirates gain twice more wood';
    else if (G.island.bonus === 'stone') base = 'Pirates gain twice more stone';
    else if (G.island.bonus === 'gold') base = 'Pirates gain twice more gold';
    else if (G.island.fullSendBuff) {
      const drillText = personalGainText([G.island.fullSendBuff]);
      base = `Send ${this.maxSend()} pirates. Full crew: leftmost sent gains ${drillText}`;
    } else if (G.island.extraSend) base = 'You can send one extra pirate';
    else if (G.island.maxSend != null) base = `Send up to ${G.island.maxSend} pirates`;
    else if (G.island.bonusEnthusiasm) base = `Gain ${G.island.bonusEnthusiasm}☠️ on landing`;
    else if (G.island.sacrifice) base = 'Pirates sent here are lost forever';
    else if (G.island.healWounded) base = `Heal up to ${G.island.healWounded} wounded pirates`;

    const cacheDrill = this.scoutedCacheDrillDescription();
    return cacheDrill ? `${cacheDrill}. ${base}` : base;
  }

  inventoryDisplayItems(extraKeys = []) {
    const keep = new Set(extraKeys);
    return [
      { key: 'wood', emoji: RES_EMOJI.wood, count: G.res.wood || 0 },
      { key: 'stone', emoji: RES_EMOJI.stone, count: G.res.stone || 0 },
      { key: 'gold', emoji: RES_EMOJI.gold, count: G.res.gold || 0 },
      { key: 'enthusiasm', emoji: '☠️', count: G.enthusiasm || 0 },
    ].filter((item) => item.count > 0 || keep.has(item.key));
  }

  currentIslandAction() {
    if (G.busy) return null;
    if (this.weaponAssignmentActive()) return null;
    if (G.phase === 'healing') {
      return { label: 'Continue', onClick: () => this.continueFromHealing(), variant: 'continue' };
    }
    if (G.phase === 'boarding') {
      const combat = this.ensureBoardingCombat();
      if (!combat || combat.mode === 'intro' || combat.mode === 'fighting') return null;
      if (combat.mode === 'resolved') {
        return {
          label: combat.result === 'win' ? 'Continue' : 'Game Over',
          onClick: () => this.continueFromResolvedBoarding(),
          variant: 'continue',
        };
      }
      return { label: 'Fight!', onClick: () => this.resolveBoarding(), variant: 'continue' };
    }
    if (G.phase === 'sending') {
      if (G.sent.length >= this.maxSend()) {
        if (this._sendingToIsland.size > 0) return null;
        const preview = this.shipWagePreview();
        const wageText = preview.wages > 0 ? ` +${preview.wages}☠️` : '';
        return { label: `Work on Ship${wageText}`, onClick: () => this.endSending(), variant: 'continue' };
      }
      const preview = this.shipWagePreview();
      const wageAlert = this.boardingAlertGuardLabel(this.boardingAlertGuardCount(this.pendingBoardingAlert() + preview.alert));
      const wageLabel = preview.wages > 0
        ? `End +${preview.wages}☠️${wageAlert ? ` ${wageAlert}` : ''}`
        : 'End';
      return { label: wageLabel, onClick: () => this.endSending(), variant: 'end' };
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

  measurePillSize(label, opts = {}) {
    if (!label) {
      return {
        width: Math.max(opts.minW || 0, 0),
        height: Math.max(opts.minH || 0, 0),
      };
    }
    const L = this.L;
    const probe = this.add.text(0, -9999, label, uiHeadingStyle(L, opts.textPx || 16, opts.textColor || UI_THEME.colors.paper));
    const padX = opts.padX != null ? opts.padX : 20 * L.k;
    const padY = opts.padY != null ? opts.padY : 12 * L.k;
    const width = Math.max(opts.minW || 0, probe.width + padX * 2);
    const height = Math.max(opts.minH || 0, probe.height + padY * 2);
    probe.destroy();
    return { width, height };
  }

  measurePillWidth(label, opts = {}) {
    return this.measurePillSize(label, opts).width;
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
      '☠️': 'enthusiasm',
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

  panelButtonRect(sceneKey) {
    const liveBtn = this._panelButtons && this._panelButtons[sceneKey];
    if (liveBtn && liveBtn.scene && liveBtn.active) {
      return {
        x: liveBtn.x - liveBtn.width / 2,
        y: liveBtn.y - liveBtn.height / 2,
        w: liveBtn.width,
        h: liveBtn.height,
      };
    }

    const L = this.L;
    const topGap = 10 * L.k;
    const topY = 60 * L.k;
    const topInset = 22 * L.k;
    const iconOpts = {
      originX: 1,
      textPx: 20,
      minW: 50 * L.k,
      minH: 50 * L.k,
      padX: 12 * L.k,
      padY: 10 * L.k,
    };
    const pileBtnOpts = this.footerPileBtnOpts();

    if (sceneKey === 'shopModal') {
      const size = this.measurePillSize('🛒', iconOpts);
      return { x: L.W - topInset - size.width, y: topY - size.height / 2, w: size.width, h: size.height };
    }
    if (sceneKey === 'map') {
      const shopSize = this.measurePillSize('🛒', iconOpts);
      const size = this.measurePillSize('🗺️', iconOpts);
      const shopLeft = L.W - topInset - shopSize.width;
      return { x: shopLeft - topGap - size.width, y: topY - size.height / 2, w: size.width, h: size.height };
    }
    if (sceneKey === 'drawPileModal') {
      const size = this.measurePillSize('Draw Pile', pileBtnOpts);
      return { x: 22 * L.k, y: L.Y_NAV - size.height / 2, w: size.width, h: size.height };
    }
    if (sceneKey === 'discardPileModal') {
      const size = this.measurePillSize('Discard', pileBtnOpts);
      return { x: L.W - 22 * L.k - size.width, y: L.Y_NAV - size.height / 2, w: size.width, h: size.height };
    }
    return null;
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
    this._pendingHandAppearUntil = Math.max(this._pendingHandAppearUntil || 0, this.time.now + endAt);
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
    this._pendingHandAppearUntil = 0;
    return found ? byIdx : null;
  }

  snapshotHandCardsForDiscard() {
    const visibleByIdx = {};
    (this._cardHand.cards || []).forEach((card) => {
      visibleByIdx[card.handIdx] = card;
    });
    const combatByPirateId = new Map(
      ((G.combat && Array.isArray(G.combat.playerFighters)) ? G.combat.playerFighters : [])
        .map((fighter) => [fighter.pirateId, fighter])
    );
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
          slotState: this.pirateHasWeapon(pirate) ? 'armed' : 'none',
          slotWeaponKey: this.pirateWeaponKey(pirate),
          wounded: !!pirate.wounded,
          might: this.pirateMight(pirate),
          tempo: this.pirateTempo(pirate),
        });
        return;
      }
      const combatFighter = combatByPirateId.get(pirate.id);
      if (combatFighter && this._combatPlayerViews && this._combatPlayerViews[combatFighter.id]) {
        const view = this._combatPlayerViews[combatFighter.id];
        cards.push({
          type: pirate.type,
          x: view.x,
          y: view.y,
          rotation: 0,
          scale: 0.5,
          slotState: combatFighter.weaponKey ? 'armed' : 'none',
          slotWeaponKey: combatFighter.weaponKey || null,
          wounded: !!pirate.wounded,
          might: this.pirateMight(pirate),
          tempo: this.pirateTempo(pirate),
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
        slotState: this.pirateHasWeapon(pirate) ? 'armed' : 'none',
        slotWeaponKey: this.pirateWeaponKey(pirate),
        wounded: !!pirate.wounded,
        might: this.pirateMight(pirate),
        tempo: this.pirateTempo(pirate),
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
      const built = buildCardTexture(this, card.type, L, {
        slotState: card.slotState || 'none',
        slotWeaponKey: card.slotWeaponKey || null,
        wounded: !!card.wounded,
        might: card.might || 0,
        tempo: card.tempo || 0,
      });
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
          slotState: this.pirateHasWeapon(pirate) ? 'armed' : 'none',
          slotWeaponKey: this.pirateWeaponKey(pirate),
          wounded: !!pirate.wounded,
          might: this.pirateMight(pirate),
          tempo: this.pirateTempo(pirate),
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

  combatPreviewStats(pirate, combat = G.combat) {
    return this.combatPirateStats(pirate, combat);
  }

  combatPlayerFighterByPirateId(pirateId) {
    return this.combatFighters('player').find((fighter) => fighter && fighter.pirateId === pirateId) || null;
  }

  addCombatHpBar(container, opts = {}) {
    const L = this.L;
    const x = opts.x || 0;
    const y = opts.y || 0;
    const width = opts.width || 0;
    const height = opts.height || 8 * L.k;
    const radius = opts.radius != null ? opts.radius : height / 2;
    const pad = opts.pad != null ? opts.pad : Math.max(1, Math.round(1 * L.k));
    const ratio = Phaser.Math.Clamp(opts.ratio || 0, 0, 1);
    const bgColor = uiColorInt(opts.bgColor || UI_THEME.colors.shadow);
    const fillColor = uiColorInt(opts.fillColor || '#66bb6a');
    const bar = this.add.graphics();

    bar.fillStyle(bgColor, opts.bgAlpha != null ? opts.bgAlpha : 0.5);
    bar.fillRoundedRect(x - width / 2, y, width, height, radius);

    const innerWidth = Math.max(0, width - pad * 2);
    const innerHeight = Math.max(0, height - pad * 2);
    const fillWidth = Math.max(0, innerWidth * ratio);
    if (fillWidth > 0 && innerHeight > 0) {
      bar.fillStyle(fillColor, 1);
      bar.fillRoundedRect(
        x - width / 2 + pad,
        y + pad,
        fillWidth,
        innerHeight,
        Math.max(1, radius - pad)
      );
    }

    container.add(bar);
    return bar;
  }

  renderCombatSetupRowGuides(containerKey) {
    const L = this.L;
    const guideCfg = {
      stroke: UI_THEME.colors.outline,
      strokeAlpha: 1,
    };
    const visuals = this.combatFormationVisuals('player');
    const sampleSlots = this.combatSetupSlotLayout('player', 0, 5, visuals);
    const cardW = 60 * L.k * visuals.scale;
    const guideW = sampleSlots.length >= 2
      ? (sampleSlots[sampleSlots.length - 1].x - sampleSlots[0].x) + cardW + 14 * L.k
      : (cardW + 14 * L.k);
    const lineX1 = L.cx - guideW / 2;
    const lineX2 = L.cx + guideW / 2;
    const rowTotal = this.combatSetupRowTotal();
    for (let rowIndex = 0; rowIndex < rowTotal - 1; rowIndex++) {
      const rowY = this.combatFormationRowY('player', rowIndex);
      const nextRowY = this.combatFormationRowY('player', rowIndex + 1);
      const lineY = (rowY + nextRowY) / 2;
      const guide = this.add.graphics();
      guide.lineStyle(Math.max(2, Math.round(2 * L.k)), uiColorInt(guideCfg.stroke), guideCfg.strokeAlpha);
      guide.beginPath();
      guide.moveTo(lineX1, lineY);
      guide.lineTo(lineX2, lineY);
      guide.strokePath();
      this.addTo(containerKey, guide);
    }
  }

  renderCombatMiniCard(containerKey, x, y, opts = {}) {
    const L = this.L;
    const scale = opts.scale != null ? opts.scale : 1;
    const w = 60 * L.k * scale;
    const h = 99 * L.k * scale;
    const r = 4 * L.k * scale;
    const maxHp = Math.max(1, opts.maxHp || opts.hp || 1);
    const hp = Math.max(0, opts.hp || 0);
    const hpRatio = hp / maxHp;
    const ct = this.add.container(x, y);
    let weaponNode = null;
    const bg = this.add.graphics();
    bg.fillStyle(uiColorInt(opts.side === 'enemy' ? '#E0AEA8' : UI_THEME.colors.sand), 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    bg.lineStyle(Math.max(1, Math.round(1 * L.k)), uiColorInt(UI_THEME.colors.sandBorder), 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    ct.add(bg);

    if (opts.side === 'player') {
      const sprite = this.add.image(0, -8 * L.k * scale, catTexKey(opts.pirateType)).setOrigin(0.5);
      sprite.setDisplaySize(40 * L.k * scale, 40 * L.k * scale);
      ct.add(sprite);
    } else {
      const emoji = this.add.text(0, -8 * L.k * scale, opts.emoji || '☠️', uiHeadingStyle(L, Math.max(14, 32 * scale), UI_THEME.colors.paper))
        .setOrigin(0.5);
      ct.add(emoji);
    }

    if (opts.weaponKey && WEAPON_TYPES[opts.weaponKey]) {
      weaponNode = this.add.text(-w / 2 + 5 * L.k * scale, -h / 2 + 4 * L.k * scale, WEAPON_TYPES[opts.weaponKey].emoji, uiBodyStyle(L, UI_THEME.colors.ink, {
        fontSize: L.fs(Math.max(10, 14 * scale)),
      })).setOrigin(0, 0);
      ct.add(weaponNode);
    }

    if (opts.side === 'player') {
      const buffParts = [];
      const might = Math.max(0, Math.floor(Number(opts.might) || 0));
      const tempo = Math.max(0, Math.floor(Number(opts.tempo) || 0));
      if (might > 0) buffParts.push(`${BUFF_EMOJI.might}${might}`);
      if (tempo > 0) buffParts.push(`${BUFF_EMOJI.tempo}${tempo}`);
      if (buffParts.length) {
        const buffText = buffParts.join(' ');
        const buffLabel = this.add.text(0, h / 2 - 35 * L.k * scale, buffText, uiBodyStyle(L, UI_THEME.colors.ink, {
          fontSize: L.fs(Math.max(8, 9 * scale)),
          fontStyle: 'bold',
        })).setOrigin(0.5, 0.5);
        const padX = 4 * L.k * scale;
        const padY = 2 * L.k * scale;
        const buffBg = this.add.graphics();
        buffBg.fillStyle(uiColorInt('#f4df74'), 0.92);
        buffBg.lineStyle(Math.max(1, Math.round(1 * L.k * scale)), uiColorInt('#9d8424'), 1);
        buffBg.fillRoundedRect(
          -buffLabel.width / 2 - padX,
          buffLabel.y - buffLabel.height / 2 - padY,
          buffLabel.width + padX * 2,
          buffLabel.height + padY * 2,
          Math.max(2, Math.round(4 * L.k * scale))
        );
        buffBg.strokeRoundedRect(
          -buffLabel.width / 2 - padX,
          buffLabel.y - buffLabel.height / 2 - padY,
          buffLabel.width + padX * 2,
          buffLabel.height + padY * 2,
          Math.max(2, Math.round(4 * L.k * scale))
        );
        ct.add([buffBg, buffLabel]);
      }
    }

    const hpLabel = this.add.text(0, h / 2 - 22 * L.k * scale, `${hp}/${maxHp}`, uiBodyStyle(L, UI_THEME.colors.ink, {
      fontSize: L.fs(Math.max(10, 12 * scale)),
      fontStyle: 'bold',
    })).setOrigin(0.5, 0.5);
    ct.add(hpLabel);
    this.addCombatHpBar(ct, {
      x: 0,
      y: h / 2 - 12 * L.k * scale,
      width: w - 12 * L.k * scale,
      height: 8 * L.k * scale,
      ratio: hpRatio,
      fillColor: opts.side === 'enemy' ? '#d67d4d' : '#66bb6a',
    });

    if (opts.side === 'player') this._combatPlayerViews[opts.id] = { x, y };
    else this._combatEnemyViews[opts.id] = { x, y };
    this._combatNodes[opts.id] = ct;
    ct.setSize(w, h);
    if (opts.interactive) {
      let suppressTap = false;
      let tooltipHoldTimer = null;
      const clearTooltipHold = () => {
        if (tooltipHoldTimer && !tooltipHoldTimer.hasDispatched) {
          tooltipHoldTimer.remove(false);
        }
        tooltipHoldTimer = null;
      };
      const bodyZone = this.add.zone(0, 0, w, h)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      const touchLike = (ptr) => isTouchLikePointer(ptr);
      const useMobileHold = () => !!(this.L && this.L.IS_MOBILE);
      const shouldHoldForTooltip = () => useMobileHold();
      const stopPtr = (ptr) => {
        if (ptr && ptr.event) ptr.event.stopPropagation();
      };
      const startTooltipHold = (ptr) => {
        if (!opts.onHoldTooltip) return;
        clearTooltipHold();
        tooltipHoldTimer = this.time.delayedCall(260, () => {
          tooltipHoldTimer = null;
          opts.onHoldTooltip({ pointer: ptr, targetKind: 'body' });
          this._activeHeldCombatTooltipKey = opts.tooltipKey || null;
        });
      };
      bodyZone.on('pointerdown', (ptr) => {
        suppressTap = false;
        stopPtr(ptr);
        if (shouldHoldForTooltip()) {
          startTooltipHold(ptr);
        }
      });
      if (opts.onHover) {
        bodyZone.on('pointerover', () => {
          if (this.combatSetupDragging()) return;
          if (useMobileHold()) return;
          opts.onHover({ targetKind: 'body' });
        });
      }
      if (opts.onOut) {
        bodyZone.on('pointerout', () => {
          clearTooltipHold();
          if (this.combatSetupDragging()) return;
          opts.onOut({ targetKind: 'body' });
        });
      }
      if (opts.draggable) {
        this.input.setDraggable(bodyZone, true);
        bodyZone.on('dragstart', (pointer) => {
          clearTooltipHold();
          suppressTap = true;
          if (useMobileHold() && opts.onDragPreview) opts.onDragPreview(pointer, ct, { targetKind: 'body' });
          if (opts.onDragStart) opts.onDragStart(pointer, ct);
        });
        bodyZone.on('drag', (pointer) => {
          clearTooltipHold();
          if (useMobileHold() && opts.onDragPreview) opts.onDragPreview(pointer, ct, { targetKind: 'body' });
          if (opts.onDrag) opts.onDrag(pointer, ct);
        });
        bodyZone.on('dragend', (pointer) => {
          clearTooltipHold();
          if (this._activeHeldCombatTooltipKey === (opts.tooltipKey || null)) {
            this.hideCombatTooltipForKey(this._activeHeldCombatTooltipKey, { force: true });
          }
          if (opts.onDragEnd) opts.onDragEnd(pointer, ct);
        });
      }
      if (opts.onTap) {
        bodyZone.on('pointerup', (ptr) => {
          clearTooltipHold();
          stopPtr(ptr);
          if (shouldHoldForTooltip()) {
            if (opts.onOut) opts.onOut({ targetKind: 'body' });
            suppressTap = false;
            return;
          }
          if (suppressTap) {
            suppressTap = false;
            return;
          }
          opts.onTap({ targetKind: 'body' });
        });
      }
      ct.add(bodyZone);
    }
    if (opts.alive === false) ct.setAlpha(0.4);
    this.addTo(containerKey, ct);
  }

  renderBoardingEncounter() {
    const combat = this.ensureBoardingCombat();
    const L = this.L;
    this._combatEnemyViews = {};
    this._combatPlayerViews = {};
    this._combatNodes = {};
    if (this._cardTips) this._cardTips.setBoundsRect(this.combatTooltipBounds());

    if (!combat || combat.mode === 'intro' || combat.mode === 'setup') {
      const enemies = (combat && combat.enemyParty) || [];
      const enemyVisuals = this.combatFormationVisuals('enemy');
      const playerVisuals = this.combatFormationVisuals('player');
      const enemyRows = this.combatSetupRows('enemy', combat);
      const playerRows = this.combatSetupRows('player', combat);
      const enemySlots = this.combatSetupSlotMap('enemy', enemyRows, enemyVisuals);
      const playerSlots = this.combatSetupSlotMap('player', playerRows, playerVisuals);
      const enemyById = new Map(enemies.filter(Boolean).map((enemy) => [enemy.id, enemy]));
      const pirateById = new Map((G.hand || []).filter(Boolean).map((pirate) => [pirate.id, pirate]));
      const inspectedPirate = this.combatSetupInspectedPirate(combat);
      const inspectedEnemy = this.combatSetupInspectedEnemy(combat);

      this.renderCombatSetupRowGuides('island');

      if (this.combatSetupHasInspection(combat)) {
        const outsideHit = this.add.zone(L.W / 2, L.H / 2, L.W, L.H)
          .setOrigin(0.5)
          .setInteractive();
        outsideHit.on('pointerdown', (ptr) => {
          if (ptr && ptr.event) ptr.event.stopPropagation();
          this.clearCombatSetupInspection(combat);
        });
        this.addTo('island', outsideHit);
      }

      enemyRows.forEach((rowIds) => {
        rowIds.forEach((enemyId) => {
          const enemy = enemyById.get(enemyId);
          if (!enemy) return;
          const pos = enemySlots[enemy.id] || { x: L.cx, y: this.combatFormationRowY('enemy', 0) };
          const fighterTipEntries = this.combatFighterTooltipEntries({
            ...enemy,
            side: 'enemy',
          });
          const fighterTipKey = `combat-fighter-${enemy.id}`;
          this.renderCombatMiniCard('island', pos.x, pos.y, {
            id: enemy.id,
            tooltipKey: fighterTipKey,
            side: 'enemy',
            emoji: enemy.emoji,
            hp: enemy.hp,
            maxHp: enemy.maxHp,
            alive: true,
            scale: enemyVisuals.scale,
            interactive: true,
            onHover: () => {
              this.showCombatTooltip(this._combatNodes[enemy.id], fighterTipEntries, {
                key: fighterTipKey,
                kind: 'combat-fighter',
                fighterId: enemy.id,
                targetKind: 'body',
              });
            },
            onOut: () => {
              this.hideCombatTooltipForKey(fighterTipKey);
            },
            onTap: () => {
              if (this._cardTips && this._cardTips.isActiveFor(fighterTipKey)) {
                this.clearCombatTooltip();
                return;
              }
              this.showCombatTooltip(this._combatNodes[enemy.id], fighterTipEntries, {
                key: fighterTipKey,
                kind: 'combat-fighter',
                fighterId: enemy.id,
                targetKind: 'body',
              });
            },
            onHoldTooltip: () => {
              this.showCombatTooltip(this._combatNodes[enemy.id], fighterTipEntries, {
                key: fighterTipKey,
                kind: 'combat-fighter',
                fighterId: enemy.id,
                targetKind: 'body',
              });
            },
          });
        });
      });

      playerRows.forEach((rowIds) => {
        rowIds.forEach((pirateId) => {
          const pirate = pirateById.get(pirateId);
          if (!pirate) return;
          const pos = playerSlots[pirate.id] || { x: L.cx, y: this.combatFormationRowY('player', 0) };
          const preview = this.combatPreviewStats(pirate, combat);
          const fighterModel = {
            id: pirate.id,
            side: 'player',
            type: pirate.type,
            weaponKey: preview.weaponKey,
            damage: preview.damage,
            might: preview.might,
            tempo: preview.tempo,
            buffCount: preview.buffCount,
            poison: 0,
            wounds: 0,
          };
          const playerTipEntries = this.combatPlayerTooltipEntries(fighterModel);
          const playerTipKey = `combat-player-${pirate.id}`;
          const canArrange = combat && combat.mode === 'setup';
          this.renderCombatMiniCard('island', pos.x, pos.y, {
            id: pirate.id,
            tooltipKey: playerTipKey,
            side: 'player',
            pirateType: pirate.type,
            hp: preview.hp,
            maxHp: preview.hp,
            weaponKey: preview.weaponKey,
            might: preview.might,
            tempo: preview.tempo,
            alive: true,
            scale: playerVisuals.scale,
            interactive: true,
            draggable: canArrange,
            onHover: () => {
              this.showCombatTooltip(this._combatNodes[pirate.id], playerTipEntries, {
                key: playerTipKey,
                kind: 'combat-player',
                fighterId: pirate.id,
                targetKind: 'body',
              });
            },
            onOut: () => {
              this.hideCombatTooltipForKey(playerTipKey);
            },
            onTap: () => {
              if (this._cardTips && this._cardTips.isActiveFor(playerTipKey)) {
                this.clearCombatTooltip();
                return;
              }
              this.showCombatTooltip(this._combatNodes[pirate.id], playerTipEntries, {
                key: playerTipKey,
                kind: 'combat-player',
                fighterId: pirate.id,
                targetKind: 'body',
              });
            },
            onHoldTooltip: () => {
              this.showCombatTooltip(this._combatNodes[pirate.id], playerTipEntries, {
                key: playerTipKey,
                kind: 'combat-player',
                fighterId: pirate.id,
                targetKind: 'body',
              });
            },
            onDragStart: (pointer, node) => {
              if (!canArrange) return;
              const dragX = pointer && Number.isFinite(pointer.worldX) ? pointer.worldX : (pointer && pointer.x);
              const dragY = pointer && Number.isFinite(pointer.worldY) ? pointer.worldY : (pointer && pointer.y);
              this.clearCombatSetupInspection(combat, { silent: true });
              this.clearCombatTooltip();
              this._combatSetupDragState = {
                pirateId: pirate.id,
                offsetX: Number.isFinite(dragX) ? dragX - node.x : 0,
                offsetY: Number.isFinite(dragY) ? dragY - node.y : 0,
              };
              node.setDepth(120);
              node.setAlpha(0.9);
            },
            onDrag: (pointer, node) => {
              const dragState = this._combatSetupDragState;
              if (!dragState || dragState.pirateId !== pirate.id) return;
              const dragX = pointer && Number.isFinite(pointer.worldX) ? pointer.worldX : (pointer && pointer.x);
              const dragY = pointer && Number.isFinite(pointer.worldY) ? pointer.worldY : (pointer && pointer.y);
              if (Number.isFinite(dragX)) node.x = dragX - dragState.offsetX;
              if (Number.isFinite(dragY)) node.y = dragY - dragState.offsetY;
            },
            onDragEnd: (pointer) => {
              const dragState = this._combatSetupDragState;
              if (dragState && dragState.pirateId === pirate.id) {
                const target = this.combatSetupDropTarget(pirate.id, pointer, combat);
                this.moveCombatSetupPirate(pirate.id, target.rowIndex, target.insertIndex, combat);
              }
              this._combatSetupDragState = null;
              this.renderAll();
            },
          });
        });
      });
      this.restoreCombatTooltip();
      return;
    }

    const enemyFighters = (combat.enemyFighters || []).filter((fighter) => fighter && fighter.alive);
    const playerFighters = (combat.playerFighters || []).filter((fighter) => fighter && fighter.alive);
    const enemyVisuals = this.combatFormationVisuals('enemy');
    const playerVisuals = this.combatFormationVisuals('player');
    const enemySlots = this.combatFormationSlots('enemy', enemyFighters, { ...enemyVisuals, livingOnly: true });
    const playerSlots = this.combatFormationSlots('player', playerFighters, { ...playerVisuals, livingOnly: true });

    enemyFighters.forEach((enemy) => {
      const pos = enemySlots[enemy.id];
      if (!pos) return;
      const fighterTipEntries = this.combatFighterTooltipEntries(enemy);
      const fighterTipKey = `combat-fighter-${enemy.id}`;
      this.renderCombatMiniCard('island', pos.x, pos.y, {
        id: enemy.id,
        tooltipKey: fighterTipKey,
        side: 'enemy',
        emoji: enemy.emoji,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        alive: enemy.alive,
        scale: enemyVisuals.scale,
        interactive: true,
        onHover: () => {
          this.showCombatTooltip(this._combatNodes[enemy.id], fighterTipEntries, {
            key: fighterTipKey,
            kind: 'combat-fighter',
            fighterId: enemy.id,
            targetKind: 'body',
          });
        },
        onOut: () => {
          this.hideCombatTooltipForKey(fighterTipKey);
        },
        onTap: () => {
          if (this._cardTips && this._cardTips.isActiveFor(fighterTipKey)) {
            this.clearCombatTooltip();
            return;
          }
          this.showCombatTooltip(this._combatNodes[enemy.id], fighterTipEntries, {
            key: fighterTipKey,
            kind: 'combat-fighter',
            fighterId: enemy.id,
            targetKind: 'body',
          });
        },
        onHoldTooltip: () => {
          this.showCombatTooltip(this._combatNodes[enemy.id], fighterTipEntries, {
            key: fighterTipKey,
            kind: 'combat-fighter',
            fighterId: enemy.id,
            targetKind: 'body',
          });
        },
      });
    });

    playerFighters.forEach((fighter) => {
      const pos = playerSlots[fighter.id];
      if (!pos) return;
      const playerTipEntries = this.combatPlayerTooltipEntries(fighter);
      const playerTipKey = `combat-player-${fighter.id}`;
      this.renderCombatMiniCard('island', pos.x, pos.y, {
        id: fighter.id,
        tooltipKey: playerTipKey,
        side: 'player',
        pirateType: fighter.type,
        hp: fighter.hp,
        maxHp: fighter.maxHp,
        weaponKey: fighter.weaponKey,
        might: fighter.might,
        tempo: fighter.tempo,
        alive: fighter.alive,
        scale: playerVisuals.scale,
        interactive: true,
        onHover: () => {
          this.showCombatTooltip(this._combatNodes[fighter.id], playerTipEntries, {
            key: playerTipKey,
            kind: 'combat-player',
            fighterId: fighter.id,
            targetKind: 'body',
          });
        },
        onOut: () => {
          this.hideCombatTooltipForKey(playerTipKey);
        },
        onTap: () => {
          if (this._cardTips && this._cardTips.isActiveFor(playerTipKey)) {
            this.clearCombatTooltip();
            return;
          }
          this.showCombatTooltip(this._combatNodes[fighter.id], playerTipEntries, {
            key: playerTipKey,
            kind: 'combat-player',
            fighterId: fighter.id,
            targetKind: 'body',
          });
        },
        onHoldTooltip: () => {
          this.showCombatTooltip(this._combatNodes[fighter.id], playerTipEntries, {
            key: playerTipKey,
            kind: 'combat-player',
            fighterId: fighter.id,
            targetKind: 'body',
          });
        },
      });
    });
    this.restoreCombatTooltip();
  }

  // ──────────── RENDERING ────────────

  renderAll() {
    this.clearCt('overlay');
    if (G.phase === 'boarding') this.ensureBoardingCombat();
    this.renderTop();
    this.renderIsland();
    this.renderPhase();
    this.renderHand();
    this.renderBtn();
    this.renderNav();
    if (G.phase === 'boarding') this.startBoardingSetupIntroIfNeeded();
  }

  renderTop() {
    this.clearCt('top');
    const L = this.L;
    const pad = 18 * L.k;
    const sectionGap = 16 * L.k;
    const stackGap = 10 * L.k;
    const iconTextGap = 8 * L.k;
    const rightReserve = 188 * L.k;
    const goal = this.currentGoalState();
    const blocks = [{ kind: 'goal', state: goal }];
    const showNextEnemy = !this.isBattleTest()
      && G.phase !== 'boarding'
      && (G.phase === 'map' || G.phase === 'sending' || G.phase === 'shopping' || this.isLandingRoundPhase() || this.pendingBoardingAlert() > 0);
    if (showNextEnemy) {
      const nextEnemy = this.nextEnemyState();
      if (nextEnemy) blocks.push({ kind: 'nextEnemy', state: nextEnemy });
    }
    const stackBlocks = L.IS_MOBILE && blocks.length > 1;

    let blockX = pad;
    let blockY = 18 * L.k;

    blocks.forEach(({ kind, state }) => {
      const remainingWidth = Math.max(120 * L.k, L.W - rightReserve - blockX);
      const icon = this.add.text(blockX, blockY, state.icon, uiHeadingStyle(L, 26, UI_THEME.colors.paper))
        .setOrigin(0, 0);
      const textX = blockX + icon.width + iconTextGap;
      const maxTextWidth = Math.max(96 * L.k, remainingWidth - (textX - blockX));
      const preferredTextWidth = stackBlocks
        ? maxTextWidth
        : Math.min(kind === 'nextEnemy' ? 180 * L.k : 220 * L.k, maxTextWidth);
      const text = this.add.text(textX, blockY + 1 * L.k, `${state.line1}\n${state.line2}`, uiBodyStyle(L, UI_THEME.colors.paper, {
        lineSpacing: uiLineSpacingPx(L, UI_THEME.fonts.bodyPx, 15),
        wordWrap: { width: preferredTextWidth },
      })).setOrigin(0, 0);
      const blockWidth = (textX - blockX) + text.width;
      const blockBottom = Math.max(icon.y + icon.height, text.y + text.height);

      [icon, text].forEach((node) => {
        this.addTo('top', node);
      });

      if (stackBlocks) {
        blockY = blockBottom + stackGap;
      } else {
        blockX += blockWidth + sectionGap;
      }
    });
  }

  renderIsland() {
    if (this._cardTips) this._cardTips.hide();
    this.clearCt('island');
    const L = this.L;
    const cx = L.cx;
    const cy = this.islandCenterY();
    const titleY = cy + 96 * L.k;
    const titleDescMargin = 8 * L.k;
    const titleLineSpacing = Math.round(-18 * L.k);
    const outlineW = Math.min(L.W - 40 * L.k, 360 * L.k);
    const outlineH = 144 * L.k;
    this._combatEnemyViews = {};
    this._combatPlayerViews = {};
    this._combatNodes = {};

    if (G.phase === 'boarding' && G.enemyShip) {
      this.renderBoardingEncounter();
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
        interactive: true,
        slotState: this.weaponAssignmentActive() && !this.pirateHasWeapon(p)
          ? 'assign'
          : (this.pirateHasWeapon(p) ? 'armed' : 'none'),
        slotWeaponKey: this.pirateWeaponKey(p),
        wounded: !!p.wounded,
        might: this.pirateMight(p),
        tempo: this.pirateTempo(p),
        L,
        container: this.ct.island,
      });
      if (this.weaponAssignmentActive()) {
        cardView.cardImg.on('pointerdown', (ptr) => {
          if (ptr && ptr.event) ptr.event.stopPropagation();
          this.assignWeaponToHandPirate(hi);
        });
      } else {
        const tipKey = `island-${p.id}`;
        const showTips = () => this._cardTips && this._cardTips.showForCard(cardView.container, pirateCardEffectTips(p), { key: tipKey });
        cardView.cardImg.on('pointerover', () => {
          showTips();
        });
        cardView.cardImg.on('pointerout', () => {
          if (this._cardTips) this._cardTips.hideForKey(tipKey);
        });
        cardView.cardImg.on('pointerdown', (ptr) => {
          if (ptr && ptr.event) ptr.event.stopPropagation();
          if (!isTouchLikePointer(ptr)) return;
          if (this._cardTips && this._cardTips.isActiveFor(tipKey)) {
            this._cardTips.hide();
            return;
          }
          showTips();
        });
      }
      if (this._sacrificedIds.has(p.id)) {
        cardView.container.setAlpha(0.35);
      }
    });
  }

  renderHealingChoices() {
    const L = this.L;
    const candidates = this.woundedCrew();
    const max = this.healingLimit();
    const used = this.healingUsed();
    const remaining = Math.max(0, max - used);
    const statusText = candidates.length
      ? (remaining > 0 ? `Choose wounded pirates to heal (${used}/${max})` : `Healing limit reached (${used}/${max})`)
      : 'No wounded pirates to heal';

    this.addTo('phase', this.add.text(L.cx, L.Y_ISL_LBL + 118 * L.k, statusText, uiHeadingStyle(L, 22, UI_THEME.colors.paper, {
      align: 'center',
      wordWrap: { width: L.W - 80 * L.k },
    })).setOrigin(0.5, 0.5));

    if (!candidates.length) return;

    const perRow = L.IS_MOBILE ? 4 : 8;
    const baseScale = L.IS_MOBILE ? 0.44 : 0.52;
    const rows = [];
    for (let i = 0; i < candidates.length; i += perRow) {
      rows.push(candidates.slice(i, i + perRow));
    }
    const rowGap = CARD.H * L.k * baseScale * 0.86;
    const firstY = L.Y_ISL_LBL + 206 * L.k;

    rows.forEach((row, rowIndex) => {
      const rowY = firstY + rowIndex * rowGap;
      const slots = cardRowLayout(row.length, L, {
        y: rowY,
        scale: baseScale,
        maxStep: 76 * L.k,
        edgePad: 30 * L.k,
      });
      row.forEach((pirate, idx) => {
        const slot = slots[idx];
        const tipKey = `heal-${pirate.id}`;
        const cardView = createPirateCard(this, {
          type: pirate.type,
          x: slot.x,
          y: slot.y,
          scale: baseScale,
          depth: 22 + rowIndex,
          interactive: true,
          slotState: this.pirateHasWeapon(pirate) ? 'armed' : 'none',
          slotWeaponKey: this.pirateWeaponKey(pirate),
          wounded: true,
          might: this.pirateMight(pirate),
          tempo: this.pirateTempo(pirate),
          L,
          container: this.ct.phase,
        });
        if (remaining <= 0) {
          cardView.cardImg.setTint(0x8a8a8a);
          cardView.cardImg.setAlpha(0.72);
        }
        const showTips = () => this._cardTips && this._cardTips.showForCard(cardView.container, pirateCardEffectTips(pirate), { key: tipKey });
        cardView.cardImg.on('pointerover', showTips);
        cardView.cardImg.on('pointerout', () => {
          if (this._cardTips) this._cardTips.hideForKey(tipKey);
        });
        cardView.cardImg.on('pointerdown', (ptr) => {
          if (ptr && ptr.event) ptr.event.stopPropagation();
          if (remaining <= 0) return;
          this.healPirate(pirate.id);
        });
      });
    });
  }

  shouldShowSendingPlanComparison() {
    return !this.isBattleTest()
      && G.phase === 'sending'
      && !!G.island
      && !G.island.healWounded;
  }

  formatSendingPlanLine(plan) {
    const wage = plan.wage || { wages: 0, alert: 0 };
    const nextAlert = this.pendingBoardingAlert() + Math.max(0, Math.floor(Number(wage.alert) || 0));
    const alertRisk = this.boardingAlertRiskText(this.boardingAlertGuardCount(nextAlert));
    const alertText = wage.alert > 0
      ? `Alert +${wage.alert}${alertRisk ? ` (${alertRisk})` : ''}`
      : 'Alert +0';
    const commissionText = wage.openingCommission > 0
      ? ` (incl. +${wage.openingCommission}☠️ Opening Commission)`
      : '';
    const discountText = plan.discount > 0 ? `Full Crew -${plan.discount}☠️` : 'No discount';
    const drillText = plan.portDrill && plan.portDrill.text ? `Port Drill +${plan.portDrill.text}` : null;
    return `+${wage.wages}☠️ Wages${commissionText} · ${alertText}\n${[discountText, drillText, plan.shopText].filter(Boolean).join(' · ')}`;
  }

  renderSendingPlanComparison() {
    if (!this.shouldShowSendingPlanComparison()) return;
    const L = this.L;
    const max = this.maxSend();
    const currentSent = Array.isArray(G.sent) ? G.sent.length : 0;
    const rows = [
      { label: 'End now', plan: this.sendingPlanProjection(currentSent) },
      { label: 'Fill crew', plan: this.sendingPlanProjection(max, { includePortDrill: true }) },
    ];
    const w = Math.min(L.W - 36 * L.k, (L.IS_MOBILE ? 356 : 620) * L.k);
    const rowH = 54 * L.k;
    const pad = 8 * L.k;
    const h = pad * 2 + rowH * rows.length;
    const topBase = L.IS_MOBILE && (this.isLandingRoundPhase() || this.pendingBoardingAlert() > 0)
      ? 104 * L.k
      : 96 * L.k;
    const topLimit = this.islandCenterY() - 160 * L.k;
    const top = Math.max(92 * L.k, Math.min(topBase, topLimit));
    const x = L.cx;
    const left = x - w / 2;
    const rowLeft = left + pad;
    const labelW = 72 * L.k;
    const detailX = rowLeft + labelW + 8 * L.k;
    const detailW = Math.max(120 * L.k, w - labelW - pad * 2 - 8 * L.k);

    const bg = this.add.graphics();
    bg.fillStyle(uiColorInt(UI_THEME.colors.cocoa), 0.92);
    bg.fillRoundedRect(left, top, w, h, 8 * L.k);
    bg.lineStyle(Math.max(1, Math.round(2 * L.k)), uiColorInt(UI_THEME.colors.sandBorder), 0.9);
    bg.strokeRoundedRect(left, top, w, h, 8 * L.k);
    bg.lineStyle(Math.max(1, Math.round(1 * L.k)), uiColorInt(UI_THEME.colors.sandBorder), 0.65);
    bg.lineBetween(left + pad, top + pad + rowH, left + w - pad, top + pad + rowH);
    this.addTo('phase', bg);

    rows.forEach((row, index) => {
      const rowY = top + pad + index * rowH;
      const label = this.add.text(rowLeft, rowY + rowH / 2, row.label, uiHeadingStyle(L, 13, '#f6d28a', {
        align: 'left',
      })).setOrigin(0, 0.5);
      const detail = this.add.text(detailX, rowY + rowH / 2, this.formatSendingPlanLine(row.plan), uiBodyStyle(L, UI_THEME.colors.paper, {
        fontSize: L.fs(11),
        lineSpacing: uiLineSpacingPx(L, 11, 13),
        wordWrap: { width: detailW },
      })).setOrigin(0, 0.5);
      this.addTo('phase', label);
      this.addTo('phase', detail);
    });
  }

  renderPhase() {
    this.clearCt('phase');
    if (this.weaponAssignmentActive()) {
      return;
    }
    const L = this.L;

    if (G.phase === 'healing') {
      this.renderHealingChoices();
      return;
    }

    if (G.phase === 'boarding') {
      const combat = this.ensureBoardingCombat();
      if (combat && combat.mode === 'resolved') {
        const won = combat.result === 'win';
        const resultText = this.add.text(
          L.cx,
          this.islandContinueY() - 44 * L.k,
          won ? 'Won Combat' : 'Crew Exhausted',
          uiHeadingStyle(L, 28, won ? '#8bd17c' : '#ff8a80')
        ).setOrigin(0.5, 0.5);
        this.addTo('phase', resultText);
        if (won) {
          const rewardLines = [];
          if (combat.boardingTrophy) rewardLines.push('Boarding Trophy +💪');
          if (combat.counterTrophy) rewardLines.push('Counter Trophy +⚡');
          rewardLines.forEach((line, i) => {
            const rewardText = this.add.text(
              L.cx,
              this.islandContinueY() - (76 + i * 22) * L.k,
              line,
              uiBodyStyle(L, UI_THEME.colors.paper, { align: 'center' })
            ).setOrigin(0.5, 0.5);
            this.addTo('phase', rewardText);
          });
        }
      }
    }

    if (G.phase === 'sending') {
      this.renderSendingPlanComparison();
    }

    if (G.phase !== 'removing') return;
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
    const isBoarding = G.phase === 'boarding';
    const combat = isBoarding ? this.ensureBoardingCombat() : null;
    if (G.phase === 'healing') {
      this.clearCt('hand');
      this._cardHand.destroy();
      return;
    }
    if (isBoarding && combat && combat.mode === 'intro' && combat.introStarted) {
      return;
    }
    const prevPositions = this._cardHand.getCardPositions();
    const appearFrom = this.consumeHandAppear();
    if (!(isBoarding && combat) && this._cardTips) this._cardTips.hide();
    this.clearCt('hand');
    this._cardHand.destroy();
    this._handSprites = {};
    const L = this.L;
    const isWeaponAssignment = this.weaponAssignmentActive();
    const onCardHoverChange = (cardData, hovering) => {
      if (!this._cardTips || !cardData || !cardData.pirate) return;
      const key = `hand-${cardData.handIdx}-${cardData.pirate.id}`;
      if (!hovering) {
        this._cardTips.hideForKey(key);
        return;
      }
      this._cardTips.showForCard(cardData.container, pirateCardEffectTips(cardData.pirate), {
        key,
        placement: 'above',
        anchorOffsetY: -CARD.HOVER_LIFT * L.k,
      });
    };

    const isSending = G.phase === 'sending' && !isWeaponAssignment;
    const allowInteraction = isWeaponAssignment || isSending;
    const handVisible = !(isBoarding && combat && !this.boardingHandVisible(combat));

    if (!handVisible) return;

    this._cardHand.render({
      hand: G.hand,
      sent: G.sent,
      sendingSet: this._sendingToIsland,
      isSending,
      allowInteraction,
      prevPositions,
      appearFrom,
      hiddenCard: isBoarding && combat ? this.boardingHandHiddenCard(combat) : undefined,
      layout: isWeaponAssignment ? 'row' : undefined,
      hoverSpread: !isWeaponAssignment,
      rowLayout: isWeaponAssignment ? {
        y: L.Y_HAND_CENTER - 8 * L.k,
        maxStep: 150 * L.k,
      } : undefined,
      cardSlotStateForCard: (pirate) => (
        isWeaponAssignment && !this.pirateHasWeapon(pirate)
          ? 'assign'
          : (this.pirateHasWeapon(pirate) ? 'armed' : 'none')
      ),
      cardSlotWeaponKeyForCard: (pirate) => this.pirateWeaponKey(pirate),
      touchTapPreviewsAction: !isWeaponAssignment,
      onCardPointerDown: isWeaponAssignment ? (handIdx) => this.assignWeaponToHandPirate(handIdx) : null,
      onSendToIsland: isSending ? (idx, fromPos) => this.sendToIsland(idx, fromPos) : null,
      canReleaseDragCard: isSending ? (handIdx) => this.canPreviewIslandDrop(handIdx) : null,
      onCardHoverChange,
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
    this._panelButtons = {};
    const L = this.L;
    this.renderInventory();

    const panelEnabled = !this.weaponAssignmentActive() && G.phase !== 'boarding';
    const mapEnabled = panelEnabled;
    const shopEnabled = panelEnabled && !G.busy;
    const pileEnabled = panelEnabled && !G.busy;
    const pauseEnabled = true;
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
    this._panelButtons.shopModal = shopBtn;

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
    this._panelButtons.map = mapBtn;

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
    const drawBtn = this.mkBtn('nav', 22 * L.k, footerY, 'Draw Pile', () => {
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
    this._panelButtons.drawPileModal = drawBtn;

    const discardOpen = this._discardPilePanelOpen;
    const discardBtn = this.mkBtn('nav', L.W - 22 * L.k, footerY, 'Discard', () => {
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
    this._panelButtons.discardPileModal = discardBtn;
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
