# Codex Playwright Validation Guide

Use this guide when a task requires browser validation for this repository. Follow it in order. Do not improvise.

## Goal

Run a short, deterministic browser check through `js_repl` and Playwright.
Prefer clear evidence over long exploratory sessions.

## Quick Checklist

1. Decide whether browser validation is actually needed.
2. Confirm `js_repl` is available in the current Codex session.
3. Prepare a disposable Playwright runtime outside the repo.
4. Open the target URL with persistent Playwright handles.
5. Validate the required behavior.
6. For this Phaser game, use runtime state plus canvas clicks instead of relying on DOM text alone.
7. Clean up browser handles.
8. Return strict `RESULT/SUMMARY/DETAILS`.

## 1) When Browser Validation Is Needed

Run browser validation when the task changes:
- UI, HTML, CSS, canvas rendering, layout, or input behavior;
- Phaser scene flow or game-state transitions;
- browser-visible regressions;
- preview or deployment behavior that must be checked in a real page.

Skip browser automation for backend-only or docs-only work and state that clearly in `DETAILS`.

## 2) Preconditions

The current workflow depends on `js_repl`.

Required conditions:
- Codex session has `js_repl` enabled.
- The Node runtime used by `js_repl` is new enough.
- Playwright can launch Chromium in this environment.

Fail fast if the session says `js_repl` is unavailable or disabled.
Do not try to recover with a different browser toolchain.

For this workflow, prefer running Codex with `danger-full-access`.

## 3) Prepare a Disposable Playwright Runtime

Do not install Playwright into the repository itself.
That can dirty the git worktree and interfere with validation.

Instead, create a disposable runtime in `/tmp`:

```bash
mkdir -p /tmp/codex-playwright-runtime
cd /tmp/codex-playwright-runtime
test -f package.json || npm init -y
npm install playwright
npx playwright install chromium
node -e "import('playwright').then(() => console.log('playwright import ok')).catch((error) => { console.error(error); process.exit(1); })"
```

If browser launch fails on Linux because of missing shared libraries, install OS dependencies once:

```bash
sudo npx playwright install-deps chromium
```

If setup fails, stop and return `FAIL` with the exact command and error.

## 4) Bootstrap Playwright in `js_repl`

Run this once:

```javascript
const { createRequire } = await import("node:module");
const requireFromRuntime = createRequire("/tmp/codex-playwright-runtime/package.json");
const { chromium } = requireFromRuntime("playwright");

var browser;
var context;
var page;

var ensureBrowser = async function () {
  if (browser && !browser.isConnected()) {
    browser = undefined;
    context = undefined;
    page = undefined;
  }
  browser ??= await chromium.launch({ headless: true });
  return browser;
};
```

Rules:
- Use `var` for shared Playwright handles.
- Reuse the same `browser`, `context`, and `page` across the validation pass.
- Do not reset the whole `js_repl` kernel unless the session is genuinely broken.

## 5) Open the Target URL

If you already have a deployed preview URL, open it directly.
If you need a local build, start a local server first and prefer `127.0.0.1` over `localhost`.

Remote or preview URL:

```javascript
var TARGET_URL = "https://example-preview-url";

await ensureBrowser();
context ??= await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
page ??= await context.newPage();

await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
console.log("Loaded:", await page.title());
console.log("URL:", page.url());
```

Local server example:

```bash
python3 -m http.server 4173 >/tmp/codex_validate_server.log 2>&1 &
SERVER_PID=$!
sleep 1
curl --max-time 4 -I http://127.0.0.1:4173/index.html
```

Then use:

```javascript
var TARGET_URL = "http://127.0.0.1:4173/index.html";
```

If `curl` or `page.goto()` fails, stop and return `FAIL`.

## 6) Phaser / Canvas-Specific Rules For This Repo

This repository is a Phaser canvas game.
Standard DOM queries are often not enough.

Important observations:
- `document.body.innerText` may be empty or low-value.
- Buttons and labels may exist only inside Phaser objects, not normal DOM.
- Runtime truth is often in `G` and in active Phaser scenes, not in canvas text alone.
- Map node coordinates may be in scene-space and require container offsets before you can click them accurately.
- Canvas button labels can lag during transitions; confirm behavior with game state, not text alone.

Always inspect runtime state first:

```javascript
const snapshot = await page.evaluate(() => ({
  title: document.title,
  canvasCount: document.querySelectorAll("canvas").length,
  activeScenes: window.__PHASER_GAME__?.scene.getScenes(true).map((s) => s.scene.key) ?? [],
  hasG: typeof G !== "undefined",
  phase: typeof G !== "undefined" ? G.phase : null,
  round: typeof G !== "undefined" ? G.round : null,
}));

console.log(JSON.stringify(snapshot, null, 2));
```

Prefer assertions based on:
- `G.phase`
- `G.round`
- `G.island`
- `G.enemyShip`
- `G.hand`
- `window.__PHASER_GAME__.scene.getScenes(true)`

## 7) Repo-Specific Happy Path

For Deck of Cats, a minimal sanity path is:

1. Load the page and confirm title `Deck of Cats — Deck Builder`.
2. Confirm the initial active scene is `menu`.
3. Click `Start` on the canvas.
4. Confirm active scenes become `game` plus `map`, and `G.phase === "map"`.
5. Select an available map node.
6. Confirm `G.phase === "sending"`, `G.round === 1`, and `G.island` is set.
7. Advance the phase once and confirm the run continues without crashing.

Example runtime check after entering the game:

```javascript
const state = await page.evaluate(() => ({
  activeScenes: window.__PHASER_GAME__.scene.getScenes(true).map((s) => s.scene.key),
  phase: G.phase,
  round: G.round,
  handSize: G.hand.length,
  resources: G.res,
}));
console.log(JSON.stringify(state, null, 2));
```

## 8) Canvas Click Strategy

For simple menu buttons, direct coordinates are acceptable when they are stable and easy to infer from layout.

For Phaser map nodes, compute the click target from scene helpers and offsets:

```javascript
const target = await page.evaluate(() => {
  const mapScene = window.__PHASER_GAME__.scene.getScene("map");
  const nodeId = getAvailableNodes(G.map)[0];

  for (let li = 0; li < G.map.layers.length; li++) {
    const layer = G.map.layers[li];
    for (let ni = 0; ni < layer.length; ni++) {
      const node = layer[ni];
      if (node.id !== nodeId) continue;
      return {
        x: mapScene.nodeScreenX(ni, layer.length),
        y: mapScene.layerScreenY(li) + mapScene.mapGfx.y,
      };
    }
  }

  return null;
});

if (!target) throw new Error("Could not resolve map node click target");
await page.mouse.click(target.x, target.y);
```

Do not guess blindly after repeated misses.
If clicks do not land after two serious attempts, inspect Phaser runtime state and explain the blocker.

## 9) Validation Style

Keep the pass focused:
- one clear happy path;
- one or two state assertions per important transition;
- one off-happy-path check only if it is strongly relevant.

Avoid:
- repeated trial-and-error clicking with no state checks;
- generic DOM scraping for a canvas app;
- long visual wandering without a concrete validation goal.

## 10) Cleanup

Always clean up browser handles:

```javascript
await page?.close().catch(() => {});
await context?.close().catch(() => {});
await browser?.close().catch(() => {});
page = undefined;
context = undefined;
browser = undefined;
```

If you started a local server, stop it too:

```bash
kill "$SERVER_PID" || true
```

## 11) Fail-Fast Policy

Stop early and return `FAIL` when:
- `js_repl` is unavailable in the current session;
- Playwright runtime setup fails;
- Chromium launch fails;
- target URL is unreachable;
- repeated canvas-click attempts do not produce any state change and runtime inspection does not clarify the path quickly.

Do not waste time on:
- repeated `--help` calls;
- multiple unrelated browser strategies;
- long exploratory loops after the required state checks are already blocked.

## 12) Response Format

Return exactly:

```text
RESULT: PASS|FAIL
SUMMARY: <one line>
DETAILS: <short text with exact commands, URLs, and state evidence used>
```
