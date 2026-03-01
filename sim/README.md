# Fast Headless Simulator

Separate high-speed gameplay simulator that reuses game logic/data from:

- `js/constants.js`
- `js/map.js`
- `js/state.js`
- `js/scene.js`

It does not open a browser and does not run UI/animations.

## Run

```bash
node sim/fast-sim.js --runs 10 --seed 42 --max-steps 5000
```

Options:

- `--games`, `-g`: number of meta-runs/campaigns (default `10000`)
- `--runs`, `-r`: alias for `--games`
- `--k`, `-k`: deprecated no-op (legacy retry system removed)
- `--seed`, `-s`: base RNG seed (default `12345`)
- `--max-steps`, `-m`: safety cap for loop steps per game (default `5000`)
- `--json`: print summary as JSON
- `--policy heuristic|ml`: action policy for gameplay decisions (default `heuristic`)
- `--model-path <path>`: PyTorch checkpoint for `--policy ml`
- `--python-bin <bin>`: Python executable for `policy_server.py` (default `python3`)
- `--dataset-out <path>`: write shop decision dataset JSONL
- `--trajectory-out <path>`: write per-step online-RL trajectories (with episode reward fields)
- `--best-log <path>`: file for "new best run" purchase logs
- `--ml-sample`: for `--policy ml`, sample actions instead of argmax
- `--ml-temperature <float>`: sampling temperature for ML policy (default `1.0`)
- `--ml-epsilon <0..1>`: epsilon-greedy exploration for ML policy (default `0.0`)
- `--policy-actions <int>`: action-space size for ML policy masks/head (default `1024`)

By default best-run purchase log is written to:

- `sim/best-purchases.log`

## Run model

- One run is now one full campaign from start to terminal state (`win`/`loss`/`max_steps`/`error`).
- There are no retries from boss checkpoints anymore.

## Death stats

The simulator now prints loss distributions:

- `lossByRound` — at which round the run died
- `lossByLayer` — at which map layer the run died
- `lossByEpoch` — alias of boarding index at death (kept for backward compatibility)
- `lossByBoarding` — at which boarding number the run died
- `lossByEnemyStrength` — enemy ship strength at death

In `--json` mode the same data is in `lossDistributions`.

## Performance metrics

- `rounds/sec` in text output = simulated rounds across all runs
- `finalRounds/sec` = same metric from final run states
- `attempts/sec` = runs throughput (kept as compatibility metric name)

## Policies

- `heuristic`: built-in dumb policy (default), fastest
- `ml`: Python tiny-transformer policy for all interactive decisions (`sim/ml/policy_server.py`)

`heuristic` mode remains fully available and unchanged as fallback.

In `ml` mode the simulator routes decisions through model policy for:

- map node selection (`map_step`)
- island sending choices (`sending_step`)
- deck-remove target selection for `removeFromDeck` skills (`remove_step`)
- shop buy/skip decisions (`shop_step`)

## Train tiny transformer (PyTorch)

1. Collect dataset from simulator:

```bash
node sim/fast-sim.js --runs 5000 --policy heuristic --dataset-out sim/ml/data/shop_train.jsonl
```

2. Train model:

```bash
sim/.venv/bin/python sim/ml/train_transformer.py \
  --data sim/ml/data/shop_train.jsonl \
  --out sim/ml/checkpoints/shop_policy.pt \
  --epochs 8
```

By default trainer now logs "is it getting smarter" in gameplay terms:

- `sim/ml/checkpoints/shop_policy.pt.metrics.jsonl` (current run)
- `sim/ml/checkpoints/training-history.jsonl` (all runs)

Main score is `sim_avg_rounds` (how far the model survives in simulator).
Eval uses changing seeds per epoch by default (`--sim-eval-seed-mode epoch`) and averages over multiple seeds (`--sim-eval-seeds-per-epoch 2`) to avoid overfitting to one fixed trajectory.

## Online RL training (model learns while playing)

This loop does not train on heuristic/random labels.
It repeatedly runs the simulator with current model policy, collects model's own trajectories + reward, then updates the policy via actor-critic (GAE).

```bash
sim/.venv/bin/python sim/ml/train_online.py \
  --out sim/ml/checkpoints/shop_policy_rl.pt \
  --latest-out sim/ml/checkpoints/shop_policy_rl.latest.pt \
  --python-bin sim/.venv/bin/python \
  --num-actions 1024 \
  --vocab-size 4096 \
  --seq-len 256 \
  --max-train-steps 60000 \
  --generations 12 \
  --collect-runs 300 \
  --collect-epsilon 0.10 \
  --collect-temperature 1.0
```

Outputs:

- best model: `--out`
- latest model each generation: `--latest-out`
- per-generation metrics: `<out>.online.metrics.jsonl`
- cumulative history: `sim/ml/checkpoints/online-history.jsonl`
- `train_steps_loaded` / `train_steps_used` in metrics to track memory-safe step cap usage

Primary score is `eval_avg_rounds` (how far it survives).
By default reward is:

- reached round in campaign (`episodeRounds`)
- plus `+1 * episodeBoardingsPassed` (each won boarding gives bonus)

3. Run simulator with ML policy:

```bash
node sim/fast-sim.js --runs 10 --policy ml --policy-actions 1024 --python-bin sim/.venv/bin/python --model-path sim/ml/checkpoints/shop_policy_rl.latest.pt
```

## Best run purchase log

During simulation, if any attempt reaches a strictly higher round than all previous attempts in this process, the simulator appends one line to the best log file.

Each line contains only purchased pirate names for that new-best run, in purchase order.

The file is reset at the start of each simulator run.

## Built-in strategy

- map: pick random available node
- island phase: send maximum count of pirates, random valid order
- shop: consider most expensive affordable pirate first, but may skip buys to avoid deck bloat
