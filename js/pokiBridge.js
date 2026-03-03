/* ============================================================
   Poki SDK bridge
   ============================================================ */

(function attachPokiBridge(global) {
  const state = {
    initialized: false,
    initPromise: null,
    queue: [],
    readySent: false,
    desiredGameplay: false,
    actualGameplay: false,
  };

  function getSdk() {
    if (!global || !global.PokiSDK) return null;
    if (typeof global.PokiSDK.init !== 'function') return null;
    return global.PokiSDK;
  }

  function runOrQueue(fn) {
    if (state.initialized) {
      fn();
      return;
    }
    state.queue.push(fn);
  }

  function flushQueue() {
    const pending = state.queue.splice(0);
    pending.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.warn('[PokiBridge] queued action failed:', err);
      }
    });
  }

  function callSdk(name, ...args) {
    const sdk = getSdk();
    if (!sdk || typeof sdk[name] !== 'function') return undefined;
    try {
      return sdk[name](...args);
    } catch (err) {
      console.warn(`[PokiBridge] ${name} failed:`, err);
      return undefined;
    }
  }

  function syncGameplay() {
    runOrQueue(() => {
      if (state.desiredGameplay === state.actualGameplay) return;
      if (state.desiredGameplay) {
        callSdk('gameplayStart');
        state.actualGameplay = true;
      } else {
        callSdk('gameplayStop');
        state.actualGameplay = false;
      }
    });
  }

  function init() {
    if (state.initPromise) return state.initPromise;
    state.initPromise = new Promise((resolve) => {
      const sdk = getSdk();
      if (!sdk) {
        state.initialized = true;
        flushQueue();
        resolve(false);
        return;
      }

      sdk.init().then(() => {
        state.initialized = true;
        flushQueue();
        resolve(true);
      }).catch((err) => {
        console.warn('[PokiBridge] PokiSDK.init failed, continuing without SDK:', err);
        state.initialized = true;
        flushQueue();
        resolve(false);
      });
    });
    return state.initPromise;
  }

  function markGameReady() {
    if (state.readySent) return;
    state.readySent = true;
    runOrQueue(() => {
      callSdk('gameLoadingFinished');
    });
  }

  function gameplayStart() {
    state.desiredGameplay = true;
    syncGameplay();
  }

  function gameplayStop() {
    state.desiredGameplay = false;
    syncGameplay();
  }

  global.PokiBridge = {
    init,
    markGameReady,
    gameplayStart,
    gameplayStop,
    isAvailable: () => !!getSdk(),
  };
})(typeof window !== 'undefined' ? window : globalThis);
