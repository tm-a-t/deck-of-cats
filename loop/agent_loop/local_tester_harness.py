from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
import textwrap
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


PLAYWRIGHT_VERSION = "1.59.1"
PLAYWRIGHT_CACHE_DIRS = (
    "deck-cats-local-tester-playwright",
    "deck-cats-pw-node",
)


class QuietStaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - inherited API name.
        return


def json_result(status: str, summary: str, **extra: Any) -> dict[str, Any]:
    return {
        "status": status,
        "summary": summary,
        **extra,
    }


def run_process(args: list[str], cwd: Path, timeout: float) -> dict[str, Any]:
    started = time.monotonic()
    try:
        result = subprocess.run(
            args,
            cwd=cwd,
            text=True,
            capture_output=True,
            timeout=max(1, timeout),
            check=False,
        )
        return {
            "ok": result.returncode == 0,
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "duration_seconds": round(time.monotonic() - started, 3),
            "timed_out": False,
        }
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout or ""
        stderr = exc.stderr or ""
        if isinstance(stdout, bytes):
            stdout = stdout.decode("utf-8", errors="replace")
        if isinstance(stderr, bytes):
            stderr = stderr.decode("utf-8", errors="replace")
        return {
            "ok": False,
            "returncode": None,
            "stdout": stdout,
            "stderr": stderr + "\nTimeout expired",
            "duration_seconds": round(time.monotonic() - started, 3),
            "timed_out": True,
        }


def node_can_resolve_playwright(node_dir: Path) -> bool:
    if not node_dir.exists():
        return False
    result = run_process(
        ["node", "-e", "require.resolve('playwright')"],
        cwd=node_dir,
        timeout=10,
    )
    return bool(result["ok"])


def ensure_playwright_node_dir(timeout_seconds: float) -> tuple[Path | None, str | None]:
    if not shutil.which("node"):
        return None, "node is not available on PATH"
    if not shutil.which("npm"):
        return None, "npm is not available on PATH"

    tmp_roots = [Path(tempfile.gettempdir()), Path("/tmp")]
    candidates = []
    for tmp_root in tmp_roots:
        for name in PLAYWRIGHT_CACHE_DIRS:
            candidate = tmp_root / name
            if candidate not in candidates:
                candidates.append(candidate)
    for candidate in candidates:
        if node_can_resolve_playwright(candidate):
            return candidate, None

    node_dir = candidates[0]
    node_dir.mkdir(parents=True, exist_ok=True)
    package_json = node_dir / "package.json"
    if not package_json.exists():
        package_json.write_text('{"private":true}\n', encoding="utf-8")

    install_timeout = max(20, min(90, timeout_seconds))
    result = run_process(
        ["npm", "install", f"playwright@{PLAYWRIGHT_VERSION}", "--no-save", "--silent"],
        cwd=node_dir,
        timeout=install_timeout,
    )
    if not result["ok"]:
        detail = (result["stderr"] or result["stdout"] or "npm install failed").strip()
        return None, f"failed to install playwright in {node_dir}: {detail}"
    if not node_can_resolve_playwright(node_dir):
        return None, f"playwright installed in {node_dir}, but node could not resolve it"
    return node_dir, None


def start_static_server(root: Path) -> tuple[ThreadingHTTPServer, str]:
    handler = lambda *args, **kwargs: QuietStaticHandler(*args, directory=str(root), **kwargs)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    return server, f"http://{host}:{port}/index.html"


def playwright_script() -> str:
    return textwrap.dedent(
        r"""
        const { chromium } = require('playwright');

        const baseUrl = process.argv[2];
        const timeoutMs = Math.max(5000, Number(process.argv[3] || 120000));
        const deadline = Date.now() + timeoutMs;
        const evidence = {
          boot: {},
          rounds: [],
          decisions: [],
          console: [],
          requestFailures: [],
          bugs: [],
        };

        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const remaining = (cap = 10000) => Math.max(1000, Math.min(cap, deadline - Date.now()));

        async function getState(page) {
          return await page.evaluate(() => {
            if (!window.__deckOfCatsTest || typeof window.__deckOfCatsTest.getState !== 'function') return null;
            return window.__deckOfCatsTest.getState();
          });
        }

        async function waitForState(page, predicateSource, label, timeout = 8000) {
          const started = Date.now();
          const limit = Math.min(timeout, remaining(timeout));
          while (Date.now() - started < limit) {
            const state = await getState(page);
            if (state) {
              const predicate = new Function('state', `return (${predicateSource})(state);`);
              if (predicate(state)) return state;
            }
            await sleep(100);
          }
          throw new Error(`Timed out waiting for ${label}`);
        }

        async function speedUpRuntime(page) {
          await page.evaluate(() => {
            const hook = window.__deckOfCatsTest;
            const game = hook && hook.game;
            if (!game || !game.scene || !Array.isArray(game.scene.scenes)) return;
            game.scene.scenes.forEach(scene => {
              if (scene && scene.time) scene.time.timeScale = 12;
              if (scene && scene.tweens) scene.tweens.timeScale = 12;
            });
          });
        }

        async function startRun(page) {
          return await page.evaluate(() => {
            const hook = window.__deckOfCatsTest;
            const game = hook && hook.game;
            const menu = game && game.scene && game.scene.getScene('menu');
            if (!menu || typeof menu.startGame !== 'function') return { ok: false, reason: 'menu scene is unavailable' };
            menu.startGame();
            return { ok: true };
          });
        }

        async function selectMapNode(page) {
          return await page.evaluate(() => {
            const hook = window.__deckOfCatsTest;
            const state = hook && hook.getState();
            const game = hook && hook.game && hook.game.scene && hook.game.scene.getScene('game');
            if (!state || state.phase !== 'map') return { ok: false, reason: `phase is ${state && state.phase}` };
            const ids = Array.isArray(state.mapAvailable) ? state.mapAvailable : [];
            if (!ids.length) return { ok: false, reason: 'no available map nodes' };
            const nodeId = ids[0];
            const applied = game && typeof game.applyMapNodeSelection === 'function'
              ? game.applyMapNodeSelection(nodeId)
              : false;
            return { ok: !!applied, nodeId };
          });
        }

        async function playSending(page) {
          return await page.evaluate(() => {
            const hook = window.__deckOfCatsTest;
            const game = hook && hook.game && hook.game.scene && hook.game.scene.getScene('game');
            const state = hook && hook.getState();
            if (!game || !state || state.phase !== 'sending') return { ok: false, reason: `phase is ${state && state.phase}` };
            const maxSend = typeof game.maxSend === 'function' ? game.maxSend() : 1;
            let sent = 0;
            const safeIndices = state.hand
              .map((pirate, idx) => ({ pirate, idx }))
              .filter(({ pirate }) => {
                const def = pirate && typeof TYPES !== 'undefined' ? TYPES[pirate.type] : null;
                return def && def.island && def.island.res && !def.island.guaranteed && !def.island.convert;
              })
              .map(({ idx }) => idx);
            const fallbackIndices = state.hand.map((_, idx) => idx).filter(idx => !safeIndices.includes(idx));
            for (const idx of [...safeIndices, ...fallbackIndices]) {
              if (sent >= maxSend) break;
              const canSend = typeof game.canPreviewIslandDrop === 'function'
                ? game.canPreviewIslandDrop(idx)
                : true;
              if (!canSend) continue;
              const pirate = state.hand[idx];
              const def = pirate && typeof TYPES !== 'undefined' ? TYPES[pirate.type] : null;
              const canResolveDirectly = hook && typeof hook.sendIslandDirect === 'function'
                && def && def.island && def.island.res
                && !def.island.guaranteed
                && !def.island.convert;
              if (canResolveDirectly) {
                const direct = hook.sendIslandDirect(idx);
                if (!direct || !direct.ok) continue;
              } else if (typeof game.sendToIsland === 'function') {
                game.sendToIsland(idx);
              } else {
                continue;
              }
              sent += 1;
            }
            if (typeof game.renderAll === 'function') game.renderAll();
            if (typeof game.endSending === 'function') game.endSending();
            return { ok: true, sent, maxSend };
          });
        }

        async function handleShopping(page) {
          return await page.evaluate(() => {
            const hook = window.__deckOfCatsTest;
            const state = hook && hook.getState();
            const game = hook && hook.game && hook.game.scene && hook.game.scene.getScene('game');
            if (!game || !state || state.phase !== 'shopping') return { ok: false, reason: `phase is ${state && state.phase}` };
            let bought = null;
            if (Array.isArray(state.shop) && typeof game.buyPirate === 'function') {
              for (let idx = 0; idx < state.shop.length; idx++) {
                const type = state.shop[idx];
                const def = typeof TYPES !== 'undefined' ? TYPES[type] : null;
                if (def && state.enthusiasm >= def.cost) {
                  const pirate = game.buyPirate(idx, { silent: true, skipPanelRefresh: true, ignoreAnimating: true });
                  bought = pirate ? { type, cost: def.cost } : null;
                  break;
                }
              }
            }
            if (typeof game.advanceFromShopping === 'function') game.advanceFromShopping();
            return { ok: true, bought };
          });
        }

        async function handleHealing(page) {
          return await page.evaluate(() => {
            const hook = window.__deckOfCatsTest;
            const state = hook && hook.getState();
            const game = hook && hook.game && hook.game.scene && hook.game.scene.getScene('game');
            if (!game || !state || state.phase !== 'healing') return { ok: false, reason: `phase is ${state && state.phase}` };
            if (typeof game.continueFromHealing === 'function') game.continueFromHealing();
            return { ok: true };
          });
        }

        async function forceBoardingSetup(page) {
          return await page.evaluate(() => {
            const hook = window.__deckOfCatsTest;
            const game = hook && hook.game && hook.game.scene && hook.game.scene.getScene('game');
            if (!game || typeof game.ensureBoardingCombat !== 'function') return { ok: false, reason: 'boarding API unavailable' };
            const combat = game.ensureBoardingCombat();
            if (!combat) return { ok: false, reason: 'combat state unavailable' };
            if (combat.mode === 'intro') {
              combat.mode = 'setup';
              combat.introStarted = false;
              if (typeof game.renderAll === 'function') game.renderAll();
            }
            return {
              ok: true,
              mode: combat.mode,
              enemies: Array.isArray(combat.enemyParty) ? combat.enemyParty.map(e => e.name || e.key || 'enemy') : [],
            };
          });
        }

        (async () => {
          const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
          const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

          page.on('console', msg => {
            if (['error', 'warning'].includes(msg.type())) {
              evidence.console.push({ type: msg.type(), text: msg.text().slice(0, 500) });
            }
          });
          page.on('pageerror', err => evidence.bugs.push(`Page error: ${err.message}`));
          page.on('requestfailed', req => {
            const url = req.url();
            if (!url.includes('fonts.gstatic.com') && !url.includes('fonts.googleapis.com')) {
              evidence.requestFailures.push({ url, error: req.failure() && req.failure().errorText });
            }
          });

          await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: remaining(15000) });
          await page.waitForSelector('canvas', { timeout: remaining(15000) });
          await page.waitForFunction(() => {
            const hook = window.__deckOfCatsTest;
            if (!hook || typeof hook.getState !== 'function') return false;
            const state = hook.getState();
            return state && Array.isArray(state.activeScenes) && state.activeScenes.includes('menu');
          }, null, { timeout: remaining(15000) });

          await speedUpRuntime(page);
          evidence.boot.menu = await getState(page);
          const start = await startRun(page);
          if (!start.ok) throw new Error(start.reason);
          let state = await waitForState(
            page,
            "state => Array.isArray(state.activeScenes) && state.activeScenes.includes('game') && ['map', 'sending'].includes(state.phase)",
            'run start',
            8000
          );
          evidence.boot.start = state;

          for (let step = 0; step < 12; step++) {
            state = await getState(page);
            if (!state) throw new Error('test hook state disappeared');
            evidence.rounds.push({
              step,
              phase: state.phase,
              round: state.round,
              layer: state.layer,
              enthusiasm: state.enthusiasm,
              resources: state.resources,
              alert: state.alert,
              crew: state.crew,
            });

            if (state.round >= 2 && evidence.rounds.some(round => round.phase === 'shopping')) {
              evidence.decisions.push({ kind: 'stop', reason: 'observed early round progression through shopping' });
              break;
            }

            if (state.phase === 'boarding') {
              const setup = await forceBoardingSetup(page);
              evidence.decisions.push({ kind: 'boarding', setup });
              break;
            }

            if (state.phase === 'map') {
              const picked = await selectMapNode(page);
              evidence.decisions.push({ kind: 'map', picked });
              if (!picked.ok) throw new Error(picked.reason);
              await waitForState(page, "state => state.phase !== 'map'", 'map selection', 5000);
              continue;
            }

            if (state.phase === 'sending') {
              const sent = await playSending(page);
              evidence.decisions.push({ kind: 'sending', sent });
              if (!sent.ok) throw new Error(sent.reason);
              await waitForState(page, "state => ['shopping', 'removing', 'boarding'].includes(state.phase) && !state.busy", 'island and ship resolution', 12000);
              continue;
            }

            if (state.phase === 'shopping') {
              const shop = await handleShopping(page);
              evidence.decisions.push({ kind: 'shopping', shop });
              if (!shop.ok) throw new Error(shop.reason);
              await waitForState(page, "state => ['map', 'sending', 'boarding', 'healing'].includes(state.phase) && !state.busy", 'shopping continue', 12000);
              continue;
            }

            if (state.phase === 'healing') {
              const healing = await handleHealing(page);
              evidence.decisions.push({ kind: 'healing', healing });
              await waitForState(page, "state => state.phase !== 'healing'", 'healing continue', 5000);
              continue;
            }

            if (state.phase === 'removing') {
              evidence.bugs.push('Automation reached the removing phase and stopped because exile target choice is interactive.');
              break;
            }

            await sleep(100);
          }

          evidence.final = await getState(page);
          await browser.close();
          const reachedGameplay = evidence.boot.start && ['map', 'sending'].includes(evidence.boot.start.phase);
          const reachedProgress = evidence.rounds.some(round => round.phase === 'shopping' || round.phase === 'boarding' || round.round >= 2);
          const result = {
            status: reachedGameplay && reachedProgress ? 'ok' : 'failed',
            summary: reachedGameplay && reachedProgress
              ? `Booted through menu and exercised ${evidence.rounds.length} gameplay states; final phase=${evidence.final && evidence.final.phase}, round=${evidence.final && evidence.final.round}.`
              : 'The game booted, but the harness did not observe meaningful gameplay progress.',
            playable: reachedGameplay && reachedProgress,
            reachedGameplay,
            reachedProgress,
            evidence,
          };
          console.log(JSON.stringify(result));
        })().catch(async (err) => {
          evidence.bugs.push(err && (err.stack || err.message) || String(err));
          const result = {
            status: 'failed',
            summary: err && err.message ? err.message : 'local tester harness failed',
            playable: false,
            reachedGameplay: !!evidence.boot.start,
            reachedProgress: false,
            evidence,
          };
          console.log(JSON.stringify(result));
          process.exit(1);
        });
        """
    ).strip()


def run_harness(root: Path, timeout_seconds: float) -> dict[str, Any]:
    if not (root / "index.html").exists():
        return json_result("blocked", f"index.html not found in {root}", playable=False)

    node_dir, error = ensure_playwright_node_dir(timeout_seconds)
    if error or node_dir is None:
        return json_result("blocked", error or "playwright setup failed", playable=False)

    try:
        server, url = start_static_server(root)
    except OSError as exc:
        return json_result("blocked", f"failed to start local HTTP server: {exc}", playable=False)

    try:
        script_path = node_dir / "deck-cats-local-tester-harness.js"
        script_path.write_text(playwright_script(), encoding="utf-8")
        result = run_process(
            ["node", str(script_path), url, str(int(timeout_seconds * 1000))],
            cwd=node_dir,
            timeout=timeout_seconds,
        )
    finally:
        server.shutdown()
        server.server_close()

    raw = (result["stdout"] or "").strip().splitlines()
    payload_text = raw[-1] if raw else ""
    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError:
        detail = (result["stderr"] or result["stdout"] or "node harness produced no JSON").strip()
        return json_result(
            "failed" if result["ok"] else "blocked",
            f"local tester harness produced invalid JSON: {detail}",
            playable=False,
            process=result,
        )

    payload.setdefault(
        "process",
        {
            "ok": result["ok"],
            "returncode": result["returncode"],
            "duration_seconds": result["duration_seconds"],
            "timed_out": result["timed_out"],
            "stderr": result["stderr"] if not result["ok"] else "",
        },
    )
    if not result["ok"] and payload.get("status") == "ok":
        payload["status"] = "failed"
    return payload


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a bounded local Deck of Cats browser harness.")
    parser.add_argument("--json", action="store_true", help="Print compact JSON.")
    parser.add_argument("--timeout-seconds", type=float, default=240.0)
    parser.add_argument("--root", default=".", help="Repo/worktree root to serve.")
    args = parser.parse_args(argv)

    payload = run_harness(Path(args.root).resolve(), max(10.0, args.timeout_seconds))
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    else:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if payload.get("status") == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
