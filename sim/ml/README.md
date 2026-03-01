# Tiny Transformer Policy (Gameplay)

Python components for training and serving a small transformer policy used by `sim/fast-sim.js`.

## Files

- `model.py` — `TinyShopTransformer`
- `train_transformer.py` — supervised training from JSONL dataset
- `train_online.py` — online RL loop (model trains on its own gameplay trajectories)
- `policy_server.py` — stdin/stdout inference server for Node simulator

## Requirements

- Python 3.10+
- PyTorch (`pip install torch`)

## Dataset format (JSONL, supervised)

Each line:

```json
{"tokens":[12,48,7,91,3],"mask":[0,1,1,0,1],"action":2,"round":10,"buysThisShop":1,"policy":"heuristic"}
```

- `tokens`: encoded state
- `mask`: valid actions for this state
- `action`: chosen action id

This supervised dataset path is mostly for shop-only imitation pretrain.
For full gameplay control use online RL (`train_online.py`), which reads trajectories with kinds:

- `map_step`
- `sending_step`
- `remove_step`
- `shop_step`

## Train

```bash
sim/.venv/bin/python sim/ml/train_transformer.py \
  --data sim/ml/data/shop_train.jsonl \
  --out sim/ml/checkpoints/shop_policy.pt \
  --epochs 8
```

Что сохраняется после обучения:

- `sim/ml/checkpoints/shop_policy.pt` — лучшая модель (по `val_loss`)
- `sim/ml/checkpoints/shop_policy.pt.metrics.jsonl` — метрики эпох текущего запуска
- `sim/ml/checkpoints/training-history.jsonl` — общий лог всех запусков

В `*.metrics.jsonl` и `training-history.jsonl` есть:

- `score_name=sim_avg_rounds` и `score_value` — насколько далеко проходит (средний достигнутый раунд)
- `improved_vs_prev` и `new_best_score` — улучшилась ли модель относительно прошлой эпохи/лучшего результата

Оценка проходит на симуляторе автоматически после каждой эпохи:

- `--sim-eval-runs` (по умолчанию `100`) — сколько игр в одном eval-прогоне
- `--sim-eval-seed-mode epoch` (по умолчанию) — сид меняется на каждой эпохе
- `--sim-eval-seeds-per-epoch` (по умолчанию `2`) — усреднение по нескольким разным сидам

Это защищает от заучивания одного и того же сценария.

## Online RL (во время игры)

Онлайн-цикл:
1. текущая модель играет в `fast-sim` (с эксплорацией),
2. сохраняются траектории ее собственных действий,
3. считается reward за прогресс,
4. делается actor-critic (GAE) апдейт.

Запуск:

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

По умолчанию reward:
- `episodeRounds` (насколько поздно умер / как далеко дошел по раундам)
- `+1 * episodeBoardingsPassed` (бонус за выигранные абордажи)

Логи прогресса:
- `<out>.online.metrics.jsonl` — поколения текущего запуска
- `sim/ml/checkpoints/online-history.jsonl` — накопительный лог по запускам
- `train_steps_loaded` / `train_steps_used` — сколько шагов загрузили и сколько реально пошло в апдейт после memory cap

## Serve (manual)

```bash
sim/.venv/bin/python sim/ml/policy_server.py --model sim/ml/checkpoints/shop_policy.pt
```

Input line to stdin:

```json
{"tokens":[1,2,3],"mask":[1,0,0,0,1]}
```

Output line from stdout:

```json
{"action":4}
```

`mask` length may be larger than model head size (for backward compatibility with older checkpoints). In that case server safely handles mismatch.
