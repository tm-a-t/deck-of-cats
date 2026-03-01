#!/usr/bin/env python3

import argparse
import datetime as dt
import json
import math
import os
import random
import shutil
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

from model import TinyShopTransformer


@dataclass
class TrajectoryStep:
    tokens: List[int]
    valid_actions: List[int]
    action: int
    terminal_reward: float
    episode_id: str
    step_in_episode: int


def as_finite_float(value: Any) -> Optional[float]:
    x = float(value)
    if math.isnan(x) or math.isinf(x):
        return None
    return x


def append_jsonl(path: str, obj: Dict[str, Any]) -> None:
    out_dir = os.path.dirname(path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def init_jsonl(path: str) -> None:
    out_dir = os.path.dirname(path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(path, "w", encoding="utf-8"):
        pass


def parse_json_from_stdout(text: str) -> Dict[str, Any]:
    text = text.strip()
    if not text:
        raise ValueError("empty stdout")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        for line in reversed(lines):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
        raise


def mixed_seed(seed: int, salt: int) -> int:
    x = (seed ^ salt) & 0xFFFFFFFF
    x = (x + 0x9E3779B9) & 0xFFFFFFFF
    x = ((x ^ (x >> 16)) * 0x85EBCA6B) & 0xFFFFFFFF
    x = ((x ^ (x >> 13)) * 0xC2B2AE35) & 0xFFFFFFFF
    return (x ^ (x >> 16)) & 0xFFFFFFFF


class ValueHead(nn.Module):
    def __init__(self, d_model: int):
        super().__init__()
        h = max(32, d_model // 2)
        self.net = nn.Sequential(
            nn.Linear(d_model, h),
            nn.Tanh(),
            nn.Linear(h, 1),
        )

    def forward(self, features: torch.Tensor) -> torch.Tensor:
        return self.net(features).squeeze(-1)


def build_checkpoint(
    state_dict,
    config: Dict[str, Any],
    training_meta: Optional[Dict[str, Any]] = None,
    critic_state_dict: Optional[Dict[str, Any]] = None,
):
    out = {
        "state_dict": state_dict,
        "config": config,
    }
    if training_meta is not None:
        out["training"] = training_meta
    if critic_state_dict is not None:
        out["critic_state_dict"] = critic_state_dict
    return out


def save_checkpoint(
    path: str,
    model: TinyShopTransformer,
    config: Dict[str, Any],
    meta: Optional[Dict[str, Any]],
    critic: Optional[ValueHead] = None,
):
    out_dir = os.path.dirname(path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    state_cpu = {k: v.detach().cpu() for k, v in model.state_dict().items()}
    critic_state = None
    if critic is not None:
        critic_state = {k: v.detach().cpu() for k, v in critic.state_dict().items()}
    torch.save(build_checkpoint(state_cpu, config, meta, critic_state_dict=critic_state), path)


def load_checkpoint(path: str, device: torch.device) -> Tuple[TinyShopTransformer, Dict[str, Any], Dict[str, Any], Optional[Dict[str, Any]]]:
    ckpt = torch.load(path, map_location=device)
    cfg = ckpt["config"]
    model = TinyShopTransformer(
        vocab_size=int(cfg["vocab_size"]),
        seq_len=int(cfg["seq_len"]),
        d_model=int(cfg["d_model"]),
        nhead=int(cfg["nhead"]),
        num_layers=int(cfg["num_layers"]),
        dim_feedforward=int(cfg["dim_feedforward"]),
        dropout=float(cfg["dropout"]),
        num_actions=int(cfg.get("num_actions", 5)),
    ).to(device)
    model.load_state_dict(ckpt["state_dict"])
    model.train()
    training_meta = ckpt.get("training", {})
    critic_state = ckpt.get("critic_state_dict")
    return model, cfg, training_meta, critic_state


def init_random_model(args, device: torch.device) -> Tuple[TinyShopTransformer, Dict[str, Any]]:
    cfg = {
        "vocab_size": int(args.vocab_size),
        "seq_len": int(args.seq_len),
        "d_model": int(args.d_model),
        "nhead": int(args.heads),
        "num_layers": int(args.layers),
        "dim_feedforward": int(args.ff),
        "dropout": float(args.dropout),
        "num_actions": int(args.num_actions),
    }
    model = TinyShopTransformer(
        vocab_size=cfg["vocab_size"],
        seq_len=cfg["seq_len"],
        d_model=cfg["d_model"],
        nhead=cfg["nhead"],
        num_layers=cfg["num_layers"],
        dim_feedforward=cfg["dim_feedforward"],
        dropout=cfg["dropout"],
        num_actions=cfg["num_actions"],
    ).to(device)
    model.train()
    return model, cfg


def maybe_resize_actor_model(model: TinyShopTransformer, cfg: Dict[str, Any], args, device: torch.device):
    target_vocab = max(int(cfg["vocab_size"]), int(args.vocab_size))
    target_seq = max(int(cfg["seq_len"]), int(args.seq_len))
    target_actions = max(int(cfg.get("num_actions", 5)), int(args.num_actions))

    same = (
        target_vocab == int(cfg["vocab_size"])
        and target_seq == int(cfg["seq_len"])
        and target_actions == int(cfg.get("num_actions", 5))
    )
    if same:
        return model, cfg, False

    new_cfg = dict(cfg)
    new_cfg["vocab_size"] = target_vocab
    new_cfg["seq_len"] = target_seq
    new_cfg["num_actions"] = target_actions

    new_model = TinyShopTransformer(
        vocab_size=int(new_cfg["vocab_size"]),
        seq_len=int(new_cfg["seq_len"]),
        d_model=int(new_cfg["d_model"]),
        nhead=int(new_cfg["nhead"]),
        num_layers=int(new_cfg["num_layers"]),
        dim_feedforward=int(new_cfg["dim_feedforward"]),
        dropout=float(new_cfg["dropout"]),
        num_actions=int(new_cfg["num_actions"]),
    ).to(device)

    old_sd = model.state_dict()
    new_sd = new_model.state_dict()
    for k, v in old_sd.items():
        if k not in new_sd:
            continue
        if k == "token_emb.weight":
            rows = min(v.shape[0], new_sd[k].shape[0])
            new_sd[k][:rows] = v[:rows]
            continue
        if k == "pos_emb.weight":
            rows = min(v.shape[0], new_sd[k].shape[0])
            new_sd[k][:rows] = v[:rows]
            continue
        if k in ("head.weight", "head.bias"):
            rows = min(v.shape[0], new_sd[k].shape[0])
            new_sd[k][:rows] = v[:rows]
            continue
        if new_sd[k].shape == v.shape:
            new_sd[k] = v
    new_model.load_state_dict(new_sd, strict=False)
    new_model.train()
    return new_model, new_cfg, True


def run_sim_json(cmd: List[str]) -> Dict[str, Any]:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        msg = (proc.stderr or proc.stdout).strip()
        raise RuntimeError(msg or f"sim command failed: {proc.returncode}")
    return parse_json_from_stdout(proc.stdout)


def collect_trajectories(args, model_path: str, trajectory_path: str, seed: int) -> Dict[str, Any]:
    cmd = [
        args.node_bin,
        args.sim_script,
        "--runs",
        str(args.collect_runs),
        "--seed",
        str(seed),
        "--max-steps",
        str(args.max_steps),
        "--policy",
        "ml",
        "--policy-actions",
        str(args.num_actions),
        "--python-bin",
        args.python_bin,
        "--model-path",
        model_path,
        "--trajectory-out",
        trajectory_path,
        "--json",
    ]
    if args.collect_sample:
        cmd.append("--ml-sample")
    cmd.extend(["--ml-temperature", str(args.collect_temperature)])
    cmd.extend(["--ml-epsilon", str(args.collect_epsilon)])
    return run_sim_json(cmd)


def eval_model(args, model_path: str, seed: int) -> Dict[str, Any]:
    cmd = [
        args.node_bin,
        args.sim_script,
        "--runs",
        str(args.eval_runs),
        "--seed",
        str(seed),
        "--max-steps",
        str(args.max_steps),
        "--policy",
        "ml",
        "--policy-actions",
        str(args.num_actions),
        "--python-bin",
        args.python_bin,
        "--model-path",
        model_path,
        "--json",
    ]
    return run_sim_json(cmd)


def reward_from_record(rec: Dict[str, Any], args) -> float:
    if args.reward_scope == "episode":
        rounds = float(rec.get("episodeRounds", 0))
        if "episodeBoardingsPassed" in rec:
            boardings = float(rec.get("episodeBoardingsPassed", 0))
        else:
            b = float(rec.get("episodeBoardings", 0))
            boardings = b if rec.get("outcome") in ("passed_epoch", "win") else max(0.0, b - 1.0)
    else:
        rounds = float(rec.get("episodeSimRounds", 0))
        if "episodeSimBoardingsPassed" in rec:
            boardings = float(rec.get("episodeSimBoardingsPassed", 0))
        else:
            b = float(rec.get("episodeSimBoardings", 0))
            boardings = b if rec.get("outcome") in ("passed_epoch", "win") else max(0.0, b - 1.0)
    reward = rounds + args.reward_boarding_bonus * boardings
    outcome = str(rec.get("outcome", ""))
    if outcome == "loss":
        reward += args.loss_penalty
    if outcome == "win":
        reward += args.win_bonus
    return float(reward)


def load_trajectory_steps(path: str, args) -> List[TrajectoryStep]:
    out: List[TrajectoryStep] = []
    expected_actions = int(args.num_actions)
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            kind = str(obj.get("kind", ""))
            if not kind.endswith("_step"):
                continue
            tokens = [int(x) for x in obj["tokens"]]
            mask = [int(x) for x in obj["mask"]]
            action = int(obj["action"])
            if len(mask) > expected_actions:
                continue
            valid_actions = [i for i, v in enumerate(mask) if v and i < expected_actions]
            if action < 0 or action >= expected_actions or action not in valid_actions:
                continue
            if len(valid_actions) < int(args.min_valid_actions):
                continue
            reward = reward_from_record(obj, args)
            episode_id = f"{obj.get('runIndex','?')}:{obj.get('runSeed','?')}:{obj.get('epoch','?')}:{obj.get('attemptGlobal','?')}"
            step_in_episode = int(obj.get("stepInAttempt", 0))
            out.append(
                TrajectoryStep(
                    tokens=tokens,
                    valid_actions=valid_actions,
                    action=action,
                    terminal_reward=reward,
                    episode_id=episode_id,
                    step_in_episode=step_in_episode,
                )
            )
    out.sort(key=lambda s: (s.episode_id, s.step_in_episode))
    return out


def cap_steps_by_episode(steps: List[TrajectoryStep], max_steps: int, seed: int) -> List[TrajectoryStep]:
    if max_steps <= 0 or len(steps) <= max_steps:
        return steps

    episode_sizes: Dict[str, int] = {}
    for s in steps:
        episode_sizes[s.episode_id] = episode_sizes.get(s.episode_id, 0) + 1
    episode_ids = list(episode_sizes.keys())
    rng = random.Random(seed)
    rng.shuffle(episode_ids)

    selected = set()
    picked = 0
    for eid in episode_ids:
        cnt = episode_sizes[eid]
        if picked > 0 and picked + cnt > max_steps:
            continue
        selected.add(eid)
        picked += cnt
        if picked >= max_steps:
            break

    if not selected and episode_ids:
        selected.add(episode_ids[0])

    out = [s for s in steps if s.episode_id in selected]
    out.sort(key=lambda s: (s.episode_id, s.step_in_episode))
    return out


def to_tensors(steps: List[TrajectoryStep], seq_len: int, num_actions: int, device: torch.device):
    n = len(steps)
    tokens = torch.zeros((n, seq_len), dtype=torch.long)
    masks = torch.zeros((n, num_actions), dtype=torch.bool)
    actions = torch.zeros((n,), dtype=torch.long)
    terminal_rewards = torch.zeros((n,), dtype=torch.float32)
    episode_ids: List[str] = []
    step_pos = torch.zeros((n,), dtype=torch.long)

    for i, s in enumerate(steps):
        t = s.tokens
        if len(t) > seq_len:
            t = t[-seq_len:]
        if len(t) < seq_len:
            t = t + [0] * (seq_len - len(t))
        tokens[i] = torch.tensor(t, dtype=torch.long)
        if s.valid_actions:
            masks[i, s.valid_actions] = True
        actions[i] = int(s.action)
        terminal_rewards[i] = float(s.terminal_reward)
        episode_ids.append(s.episode_id)
        step_pos[i] = int(s.step_in_episode)

    return (
        tokens.to(device),
        masks.to(device),
        actions.to(device),
        terminal_rewards.to(device),
        episode_ids,
        step_pos.to(device),
    )


def actor_critic_update(model, critic, optimizer, steps: List[TrajectoryStep], cfg: Dict[str, Any], args, device):
    if not steps:
        raise RuntimeError("no trajectory steps to train on")

    tokens, masks, actions, terminal_rewards, episode_ids, step_pos = to_tensors(
        steps, int(cfg["seq_len"]), int(cfg.get("num_actions", args.num_actions)), device
    )
    n = tokens.size(0)

    rewards = torch.zeros((n,), dtype=torch.float32, device=device)
    done = torch.zeros((n,), dtype=torch.float32, device=device)
    episode_to_indices: Dict[str, List[int]] = {}
    for idx, eid in enumerate(episode_ids):
        episode_to_indices.setdefault(eid, []).append(idx)
    for _, idxs in episode_to_indices.items():
        idxs.sort(key=lambda i: int(step_pos[i].item()))
        last = idxs[-1]
        rewards[last] = terminal_rewards[last]
        done[last] = 1.0

    with torch.no_grad():
        values = critic(model.encode(tokens))

    gamma = float(args.gamma)
    gae_lambda = float(args.gae_lambda)
    adv = torch.zeros((n,), dtype=torch.float32, device=device)
    returns = torch.zeros((n,), dtype=torch.float32, device=device)
    for _, idxs in episode_to_indices.items():
        idxs.sort(key=lambda i: int(step_pos[i].item()))
        gae = torch.tensor(0.0, device=device)
        next_value = torch.tensor(0.0, device=device)
        for i in reversed(idxs):
            d = done[i]
            delta = rewards[i] + gamma * (1.0 - d) * next_value - values[i]
            gae = delta + gamma * gae_lambda * (1.0 - d) * gae
            adv[i] = gae
            returns[i] = gae + values[i]
            next_value = values[i]

    rewards_mean = rewards.mean()
    rewards_std = rewards.std(unbiased=False)
    if args.normalize_rewards:
        adv = (adv - adv.mean()) / (adv.std(unbiased=False) + 1e-6)
    if args.adv_clip > 0:
        adv = torch.clamp(adv, -args.adv_clip, args.adv_clip)

    batch_size = max(1, int(args.batch_size))
    actor_loss_sum = 0.0
    value_loss_sum = 0.0
    entropy_sum = 0.0
    items = 0

    for _ in range(max(1, int(args.update_epochs))):
        perm = torch.randperm(n, device=device)
        for start in range(0, n, batch_size):
            idx = perm[start : start + batch_size]
            x = tokens[idx]
            m = masks[idx]
            a = actions[idx]
            g = adv[idx]
            ret = returns[idx]

            features = model.encode(x)
            logits = model.head(features)
            masked_logits = logits.masked_fill(~m, -1e9)
            log_probs = F.log_softmax(masked_logits, dim=-1)
            probs = torch.softmax(masked_logits, dim=-1)
            chosen_logp = log_probs.gather(1, a.unsqueeze(1)).squeeze(1)
            entropy = -(probs * log_probs).sum(dim=-1)
            value_pred = critic(features)

            loss_actor = -(chosen_logp * g).mean()
            loss_value = F.smooth_l1_loss(value_pred, ret)
            loss = (
                loss_actor
                + float(args.value_coef) * loss_value
                - float(args.entropy_coef) * entropy.mean()
            )

            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            if args.grad_clip > 0:
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=float(args.grad_clip))
                torch.nn.utils.clip_grad_norm_(critic.parameters(), max_norm=float(args.grad_clip))
            optimizer.step()

            bs = idx.numel()
            actor_loss_sum += float(loss_actor.item()) * bs
            value_loss_sum += float(loss_value.item()) * bs
            entropy_sum += float(entropy.mean().item()) * bs
            items += bs

    return {
        "steps": int(n),
        "reward_mean": as_finite_float(rewards_mean.item()),
        "reward_std": as_finite_float(rewards_std.item()),
        "adv_mean": as_finite_float(adv.mean().item()),
        "adv_std": as_finite_float(adv.std(unbiased=False).item()),
        "actor_loss": as_finite_float(actor_loss_sum / max(1, items)),
        "value_loss": as_finite_float(value_loss_sum / max(1, items)),
        "entropy": as_finite_float(entropy_sum / max(1, items)),
        "episodes": int(len(episode_to_indices)),
    }


def gather_eval_stats(args, model_path: str, gen_seed: int) -> Dict[str, Any]:
    if args.eval_runs <= 0:
        return {"ok": False, "reason": "eval disabled"}
    rounds_vals = []
    win_vals = []
    trials = []
    for i in range(max(1, int(args.eval_seeds_per_gen))):
        s = mixed_seed(gen_seed, i + 5000)
        one = eval_model(args, model_path, s)
        rounds = float(one["averages"]["rounds"])
        win_rate = float(one["outcomes"]["winRate"])
        rounds_vals.append(rounds)
        win_vals.append(win_rate)
        trials.append(
            {
                "seed": int(s),
                "avg_rounds": as_finite_float(rounds),
                "win_rate": as_finite_float(win_rate),
                "games_per_sec": as_finite_float(float(one["perf"]["gamesPerSec"])),
            }
        )
    return {
        "ok": True,
        "avg_rounds": as_finite_float(sum(rounds_vals) / len(rounds_vals)),
        "avg_win_rate": as_finite_float(sum(win_vals) / len(win_vals)),
        "trials": trials,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True, help="Best checkpoint path")
    p.add_argument("--latest-out", default=None, help="Latest checkpoint path")
    p.add_argument("--init-model", default=None, help="Optional starting checkpoint")
    p.add_argument("--generations", type=int, default=12)
    p.add_argument("--seed", type=int, default=42)

    p.add_argument("--node-bin", default="node")
    p.add_argument("--python-bin", default=sys.executable)
    p.add_argument(
        "--sim-script",
        default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "fast-sim.js")),
    )
    p.add_argument("--max-steps", type=int, default=5000)

    p.add_argument("--collect-runs", type=int, default=300)
    p.add_argument("--collect-k", type=int, default=1, help="deprecated no-op (retry system removed)")
    p.add_argument("--collect-sample", action="store_true", default=True)
    p.add_argument("--collect-deterministic", action="store_false", dest="collect_sample")
    p.add_argument("--collect-temperature", type=float, default=1.0)
    p.add_argument("--collect-epsilon", type=float, default=0.0)
    p.add_argument("--trajectory-out", default=None)

    p.add_argument("--eval-runs", type=int, default=120)
    p.add_argument("--eval-k", type=int, default=1, help="deprecated no-op (retry system removed)")
    p.add_argument("--eval-seeds-per-gen", type=int, default=2)

    p.add_argument("--reward-scope", choices=["segment", "episode"], default="episode")
    p.add_argument("--reward-boarding-bonus", type=float, default=1.0)
    p.add_argument("--loss-penalty", type=float, default=-2.0)
    p.add_argument("--win-bonus", type=float, default=6.0)

    p.add_argument("--update-epochs", type=int, default=1)
    p.add_argument("--batch-size", type=int, default=512)
    p.add_argument("--lr-actor", type=float, default=3e-4)
    p.add_argument("--lr-critic", type=float, default=6e-4)
    p.add_argument("--weight-decay", type=float, default=1e-4)
    p.add_argument("--value-coef", type=float, default=0.5)
    p.add_argument("--entropy-coef", type=float, default=0.01)
    p.add_argument("--gamma", type=float, default=0.97)
    p.add_argument("--gae-lambda", type=float, default=0.95)
    p.add_argument("--grad-clip", type=float, default=1.0)
    p.add_argument("--adv-clip", type=float, default=5.0)
    p.add_argument("--min-valid-actions", type=int, default=2)
    p.add_argument("--max-train-steps", type=int, default=60000)
    p.add_argument("--normalize-rewards", action="store_true", default=True)
    p.add_argument("--no-normalize-rewards", action="store_false", dest="normalize_rewards")

    p.add_argument("--vocab-size", type=int, default=4096)
    p.add_argument("--seq-len", type=int, default=256)
    p.add_argument("--num-actions", type=int, default=1024)
    p.add_argument("--d-model", type=int, default=128)
    p.add_argument("--layers", type=int, default=3)
    p.add_argument("--heads", type=int, default=4)
    p.add_argument("--ff", type=int, default=256)
    p.add_argument("--dropout", type=float, default=0.1)

    p.add_argument("--metrics-out", default=None)
    p.add_argument("--history-out", default=None)
    p.add_argument("--run-name", default=None)
    args = p.parse_args()

    random.seed(args.seed)
    torch.manual_seed(args.seed)

    if not os.path.exists(args.sim_script):
        raise RuntimeError(f"sim script not found: {args.sim_script}")

    out_dir = os.path.dirname(args.out) or "."
    os.makedirs(out_dir, exist_ok=True)
    latest_out = args.latest_out or f"{args.out}.latest.pt"
    metrics_out = args.metrics_out or f"{args.out}.online.metrics.jsonl"
    history_out = args.history_out or os.path.join(out_dir, "online-history.jsonl")
    trajectory_out = args.trajectory_out or os.path.join(out_dir, "online-trajectories.jsonl")
    init_jsonl(metrics_out)

    now_dt = dt.datetime.now(dt.timezone.utc)
    run_id = args.run_name or f"online-{now_dt.strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:6]}"
    now_utc = now_dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    start_path = args.init_model
    if start_path is None and os.path.exists(latest_out):
        start_path = latest_out
    if start_path is None and os.path.exists(args.out):
        start_path = args.out

    if start_path:
        model, config, training_meta, critic_state = load_checkpoint(start_path, device)
        best_score = training_meta.get("best_score")
        best_score = float(best_score) if best_score is not None else None
        model, config, _resized = maybe_resize_actor_model(model, config, args, device)
    else:
        model, config = init_random_model(args, device)
        critic_state = None
        best_score = None

    critic = ValueHead(d_model=int(config["d_model"])).to(device)
    if critic_state is not None:
        critic.load_state_dict(critic_state, strict=False)
    optimizer = torch.optim.AdamW(
        [
            {"params": model.parameters(), "lr": float(args.lr_actor)},
            {"params": critic.parameters(), "lr": float(args.lr_critic)},
        ],
        weight_decay=float(args.weight_decay),
    )
    run_started = time.time()

    save_checkpoint(
        latest_out,
        model,
        config,
        {
            "run_id": run_id,
            "run_started_utc": now_utc,
            "best_score": best_score,
            "score_name": "eval_avg_rounds",
            "note": "latest checkpoint for online RL loop",
        },
        critic=critic,
    )

    for gen in range(1, max(1, int(args.generations)) + 1):
        gen_started = time.time()
        collect_seed = mixed_seed(args.seed, gen * 101 + 7)
        eval_seed = mixed_seed(args.seed, gen * 101 + 17)

        collect_summary = collect_trajectories(args, latest_out, trajectory_out, collect_seed)
        steps = load_trajectory_steps(trajectory_out, args)
        if not steps:
            raise RuntimeError("trajectory file contains no valid decision steps")
        loaded_steps = len(steps)
        steps = cap_steps_by_episode(steps, int(args.max_train_steps), mixed_seed(collect_seed, 701))

        pg_stats = actor_critic_update(model, critic, optimizer, steps, config, args, device)

        save_checkpoint(
            latest_out,
            model,
            config,
            {
                "run_id": run_id,
                "generation": gen,
                "run_started_utc": now_utc,
                "best_score": best_score,
                "score_name": "eval_avg_rounds",
            },
            critic=critic,
        )

        eval_stats = gather_eval_stats(args, latest_out, eval_seed)
        score_name = "eval_avg_rounds" if eval_stats.get("ok") else "reward_mean"
        score_value = (
            eval_stats.get("avg_rounds") if eval_stats.get("ok") else pg_stats.get("reward_mean")
        )
        improved = False
        if score_value is not None:
            score_v = float(score_value)
            improved = best_score is None or score_v > float(best_score)
            if improved:
                best_score = score_v
                shutil.copyfile(latest_out, args.out)

        gen_sec = time.time() - gen_started
        rec = {
            "time_utc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "run_id": run_id,
            "generation": gen,
            "score_name": score_name,
            "score_value": as_finite_float(score_value) if score_value is not None else None,
            "new_best_score": improved,
            "best_score_so_far": as_finite_float(best_score) if best_score is not None else None,
            "generation_sec": as_finite_float(gen_sec),
            "collect_seed": int(collect_seed),
            "eval_seed_base": int(eval_seed),
            "collect": {
                "runs": int(args.collect_runs),
                "k": int(args.collect_k),
                "sample": bool(args.collect_sample),
                "temperature": as_finite_float(args.collect_temperature),
                "epsilon": as_finite_float(args.collect_epsilon),
                "summary": collect_summary,
            },
            "pg": pg_stats,
            "train_steps_loaded": int(loaded_steps),
            "train_steps_used": int(len(steps)),
            "eval": eval_stats,
        }
        append_jsonl(metrics_out, rec)
        append_jsonl(history_out, rec)

        score_txt = "nan" if rec["score_value"] is None else f"{rec['score_value']:.4f}"
        print(
            f"gen={gen} steps={pg_stats['steps']} reward_mean={pg_stats['reward_mean']:.4f} "
            f"eval_avg_rounds={eval_stats.get('avg_rounds') if eval_stats.get('ok') else float('nan'):.4f} "
            f"score={score_txt} improved={1 if improved else 0} gen_sec={gen_sec:.2f}"
        )

    run_sec = time.time() - run_started
    print(f"saved_best={args.out}")
    print(f"saved_latest={latest_out}")
    print(f"metrics_out={metrics_out}")
    print(f"history_out={history_out}")
    print(f"run_duration_sec={run_sec:.2f}")


if __name__ == "__main__":
    main()
