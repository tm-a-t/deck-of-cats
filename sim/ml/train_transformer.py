#!/usr/bin/env python3

import argparse
import datetime as dt
import json
import math
import os
import random
import subprocess
import sys
import tempfile
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset, random_split

from model import TinyShopTransformer


@dataclass
class Sample:
    tokens: List[int]
    mask: List[int]
    action: int


class ShopDataset(Dataset):
    def __init__(self, samples: List[Sample], seq_len: int):
        self.samples = samples
        self.seq_len = seq_len

    def __len__(self):
        return len(self.samples)

    def _pad_tokens(self, tokens: List[int]) -> List[int]:
        if len(tokens) > self.seq_len:
            return tokens[-self.seq_len :]
        if len(tokens) < self.seq_len:
            return tokens + [0] * (self.seq_len - len(tokens))
        return tokens

    def __getitem__(self, idx):
        s = self.samples[idx]
        tokens = torch.tensor(self._pad_tokens(s.tokens), dtype=torch.long)
        mask = torch.tensor(s.mask, dtype=torch.bool)
        action = torch.tensor(s.action, dtype=torch.long)
        return tokens, mask, action


def read_jsonl(path: str) -> List[Sample]:
    out: List[Sample] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            obj = json.loads(line)
            out.append(Sample(tokens=obj["tokens"], mask=obj["mask"], action=int(obj["action"])))
    return out


def infer_meta(samples: List[Sample]) -> Tuple[int, int]:
    max_token = 0
    max_len = 0
    for s in samples:
        if s.tokens:
            max_token = max(max_token, max(s.tokens))
        max_len = max(max_len, len(s.tokens))
    return max_token + 1, max_len


def masked_ce_loss(logits: torch.Tensor, action_mask: torch.Tensor, actions: torch.Tensor) -> torch.Tensor:
    # logits: [B, A], action_mask: [B, A] bool
    masked = logits.masked_fill(~action_mask, -1e9)
    return F.cross_entropy(masked, actions)


def evaluate(model, loader, device):
    model.eval()
    total_loss = 0.0
    total = 0
    correct = 0
    with torch.no_grad():
        for tokens, mask, actions in loader:
            tokens = tokens.to(device)
            mask = mask.to(device)
            actions = actions.to(device)
            logits = model(tokens)
            loss = masked_ce_loss(logits, mask, actions)
            total_loss += float(loss.item()) * tokens.size(0)
            pred = logits.masked_fill(~mask, -1e9).argmax(dim=-1)
            correct += int((pred == actions).sum().item())
            total += int(tokens.size(0))
    if total == 0:
        return {"loss": math.nan, "acc": math.nan}
    return {"loss": total_loss / total, "acc": correct / total}


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


def build_checkpoint(state_dict, config: Dict[str, Any], training_meta: Optional[Dict[str, Any]] = None):
    out = {
        "state_dict": state_dict,
        "config": config,
    }
    if training_meta is not None:
        out["training"] = training_meta
    return out


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


def run_sim_eval(checkpoint_path: str, args, seed: int) -> Dict[str, Any]:
    cmd = [
        args.sim_eval_node_bin,
        args.sim_eval_script,
        "--runs",
        str(args.sim_eval_runs),
        "--k",
        str(args.sim_eval_k),
        "--seed",
        str(seed),
        "--max-steps",
        str(args.sim_eval_max_steps),
        "--policy",
        "ml",
        "--python-bin",
        args.sim_eval_python_bin,
        "--model-path",
        checkpoint_path,
        "--json",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        return {
            "ok": False,
            "returncode": proc.returncode,
            "error": (proc.stderr or proc.stdout).strip() or "sim eval failed",
        }
    try:
        summary = parse_json_from_stdout(proc.stdout)
        return {
            "ok": True,
            "avg_rounds": as_finite_float(summary["averages"]["rounds"]),
            "win_rate": as_finite_float(summary["outcomes"]["winRate"]),
            "games_per_sec": as_finite_float(summary["perf"]["gamesPerSec"]),
            "losses": int(summary["outcomes"]["losses"]),
            "wins": int(summary["outcomes"]["wins"]),
        }
    except Exception as exc:
        return {
            "ok": False,
            "returncode": proc.returncode,
            "error": f"sim eval json parse failed: {exc}",
        }


def mixed_seed(seed: int, salt: int) -> int:
    x = (seed ^ salt) & 0xFFFFFFFF
    x = (x + 0x9E3779B9) & 0xFFFFFFFF
    x = ((x ^ (x >> 16)) * 0x85EBCA6B) & 0xFFFFFFFF
    x = ((x ^ (x >> 13)) * 0xC2B2AE35) & 0xFFFFFFFF
    return (x ^ (x >> 16)) & 0xFFFFFFFF


def build_eval_seeds(args, epoch: int, rng: random.Random) -> List[int]:
    out: List[int] = []
    per_epoch = max(1, args.sim_eval_seeds_per_epoch)
    for i in range(per_epoch):
        if args.sim_eval_seed_mode == "fixed":
            s = mixed_seed(args.sim_eval_seed, i)
        elif args.sim_eval_seed_mode == "epoch":
            s = mixed_seed(args.sim_eval_seed, epoch * 1000 + i)
        else:
            s = rng.getrandbits(32)
        out.append(int(s))
    return out


def run_epoch_sim_eval(checkpoint_path: str, args, epoch: int, rng: random.Random) -> Dict[str, Any]:
    seeds = build_eval_seeds(args, epoch, rng)
    trials = []
    avg_rounds_values = []
    win_rates = []
    for seed in seeds:
        one = run_sim_eval(checkpoint_path, args, seed)
        one["seed"] = int(seed)
        trials.append(one)
        if one.get("ok") and one.get("avg_rounds") is not None:
            avg_rounds_values.append(float(one["avg_rounds"]))
        if one.get("ok") and one.get("win_rate") is not None:
            win_rates.append(float(one["win_rate"]))
    ok_count = sum(1 for t in trials if t.get("ok"))
    if ok_count == 0:
        return {
            "ok": False,
            "seed_mode": args.sim_eval_seed_mode,
            "seeds": seeds,
            "trials": trials,
            "error": "all sim eval trials failed",
        }
    avg_rounds = sum(avg_rounds_values) / len(avg_rounds_values) if avg_rounds_values else None
    avg_win_rate = sum(win_rates) / len(win_rates) if win_rates else None
    return {
        "ok": True,
        "seed_mode": args.sim_eval_seed_mode,
        "seeds": seeds,
        "ok_trials": ok_count,
        "total_trials": len(trials),
        "avg_rounds": as_finite_float(avg_rounds) if avg_rounds is not None else None,
        "avg_win_rate": as_finite_float(avg_win_rate) if avg_win_rate is not None else None,
        "trials": trials,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--epochs", type=int, default=8)
    p.add_argument("--batch-size", type=int, default=256)
    p.add_argument("--lr", type=float, default=2e-3)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--val-ratio", type=float, default=0.1)
    p.add_argument("--d-model", type=int, default=128)
    p.add_argument("--layers", type=int, default=3)
    p.add_argument("--heads", type=int, default=4)
    p.add_argument("--ff", type=int, default=256)
    p.add_argument("--dropout", type=float, default=0.1)
    p.add_argument("--metrics-out", default=None, help="Per-epoch metrics for this run (JSONL)")
    p.add_argument("--history-out", default=None, help="Append-only metrics across runs (JSONL)")
    p.add_argument("--run-name", default=None, help="Optional run id for logs")
    p.add_argument(
        "--sim-eval-runs",
        type=int,
        default=100,
        help="How many simulator runs per eval trial (0 disables sim eval)",
    )
    p.add_argument("--sim-eval-k", type=int, default=1)
    p.add_argument("--sim-eval-seed", type=int, default=12345)
    p.add_argument(
        "--sim-eval-seed-mode",
        choices=["fixed", "epoch", "random"],
        default="epoch",
        help="How eval seed changes across epochs",
    )
    p.add_argument(
        "--sim-eval-seeds-per-epoch",
        type=int,
        default=2,
        help="How many different eval seeds to average per epoch",
    )
    p.add_argument("--sim-eval-max-steps", type=int, default=5000)
    p.add_argument("--sim-eval-node-bin", default="node")
    p.add_argument("--sim-eval-python-bin", default=sys.executable)
    p.add_argument(
        "--sim-eval-script",
        default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "fast-sim.js")),
    )
    args = p.parse_args()

    random.seed(args.seed)
    torch.manual_seed(args.seed)

    samples = read_jsonl(args.data)
    if not samples:
        raise RuntimeError("empty dataset")

    vocab_size, seq_len = infer_meta(samples)
    n_val = max(1, int(len(samples) * args.val_ratio))
    n_train = max(1, len(samples) - n_val)
    if n_train + n_val > len(samples):
        n_val = len(samples) - n_train
    dataset = ShopDataset(samples, seq_len=seq_len)
    train_set, val_set = random_split(
        dataset,
        [n_train, n_val],
        generator=torch.Generator().manual_seed(args.seed),
    )

    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_set, batch_size=args.batch_size, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = TinyShopTransformer(
        vocab_size=vocab_size,
        seq_len=seq_len,
        d_model=args.d_model,
        nhead=args.heads,
        num_layers=args.layers,
        dim_feedforward=args.ff,
        dropout=args.dropout,
        num_actions=5,
    ).to(device)

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr)
    best_val = float("inf")
    best_epoch = 0
    best_state = None

    now_dt = dt.datetime.now(dt.timezone.utc)
    run_id = args.run_name
    if not run_id:
        run_id = f"run-{now_dt.strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:6]}"
    now_utc = now_dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")

    metrics_out = args.metrics_out or f"{args.out}.metrics.jsonl"
    history_out = args.history_out or os.path.join(os.path.dirname(args.out) or ".", "training-history.jsonl")
    init_jsonl(metrics_out)

    if args.sim_eval_runs > 0 and not os.path.exists(args.sim_eval_script):
        raise RuntimeError(f"sim eval script not found: {args.sim_eval_script}")

    config = {
        "vocab_size": vocab_size,
        "seq_len": seq_len,
        "d_model": args.d_model,
        "nhead": args.heads,
        "num_layers": args.layers,
        "dim_feedforward": args.ff,
        "dropout": args.dropout,
        "num_actions": 5,
    }

    prev_score = None
    best_score = None
    score_name = "val_acc"
    temp_ckpt_path = None
    if args.sim_eval_runs > 0:
        tmp = tempfile.NamedTemporaryFile(prefix="shop_policy_epoch_", suffix=".pt", delete=False)
        temp_ckpt_path = tmp.name
        tmp.close()
    eval_seed_rng = random.Random(mixed_seed(args.seed, 0x1234ABCD))

    run_started = time.time()
    for epoch in range(1, args.epochs + 1):
        epoch_started = time.time()
        model.train()
        running = 0.0
        seen = 0
        for tokens, mask, actions in train_loader:
            tokens = tokens.to(device)
            mask = mask.to(device)
            actions = actions.to(device)

            logits = model(tokens)
            loss = masked_ce_loss(logits, mask, actions)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()

            running += float(loss.item()) * tokens.size(0)
            seen += int(tokens.size(0))

        train_loss = running / max(1, seen)
        val_metrics = evaluate(model, val_loader, device)

        sim_eval = None
        state_cpu = {k: v.cpu() for k, v in model.state_dict().items()}
        if temp_ckpt_path is not None:
            torch.save(
                build_checkpoint(
                    state_cpu,
                    config,
                    training_meta={
                        "run_id": run_id,
                        "epoch": epoch,
                    },
                ),
                temp_ckpt_path,
            )
            sim_eval = run_epoch_sim_eval(temp_ckpt_path, args, epoch, eval_seed_rng)

        score_name = "val_acc"
        score_value = as_finite_float(val_metrics["acc"])
        if sim_eval is not None and sim_eval.get("ok") and sim_eval.get("avg_rounds") is not None:
            score_name = "sim_avg_rounds"
            score_value = as_finite_float(sim_eval.get("avg_rounds"))

        improved_vs_prev = False
        new_best_score = False
        if score_value is not None:
            improved_vs_prev = prev_score is None or score_value > prev_score
            new_best_score = best_score is None or score_value > best_score
            prev_score = score_value
            if new_best_score:
                best_score = score_value

        epoch_sec = time.time() - epoch_started
        msg = (
            f"epoch={epoch} train_loss={train_loss:.4f} "
            f"val_loss={val_metrics['loss']:.4f} val_acc={val_metrics['acc']:.4f} "
            f"{score_name}={(score_value if score_value is not None else float('nan')):.4f} "
            f"improved={1 if improved_vs_prev else 0} new_best={1 if new_best_score else 0} "
            f"epoch_sec={epoch_sec:.2f}"
        )
        if sim_eval is not None and not sim_eval.get("ok"):
            msg += " sim_eval=error"
        print(msg)

        rec = {
            "time_utc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "run_id": run_id,
            "epoch": epoch,
            "train_loss": as_finite_float(train_loss),
            "val_loss": as_finite_float(val_metrics["loss"]),
            "val_acc": as_finite_float(val_metrics["acc"]),
            "score_name": score_name,
            "score_value": score_value,
            "improved_vs_prev": improved_vs_prev,
            "new_best_score": new_best_score,
            "best_score_so_far": best_score,
            "epoch_sec": as_finite_float(epoch_sec),
            "samples_train": n_train,
            "samples_val": n_val,
            "dataset_samples": len(samples),
            "seed": args.seed,
            "sim_eval": sim_eval,
        }
        append_jsonl(metrics_out, rec)
        append_jsonl(history_out, rec)

        if val_metrics["loss"] < best_val:
            best_val = val_metrics["loss"]
            best_epoch = epoch
            best_state = state_cpu

    out_dir = os.path.dirname(args.out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    checkpoint = build_checkpoint(
        best_state if best_state is not None else model.state_dict(),
        config,
        training_meta={
            "run_id": run_id,
            "run_started_utc": now_utc,
            "run_duration_sec": as_finite_float(time.time() - run_started),
            "best_epoch_by_val_loss": best_epoch,
            "best_val_loss": as_finite_float(best_val),
            "score_name": score_name,
            "best_score": best_score,
            "metrics_out": os.path.abspath(metrics_out),
            "history_out": os.path.abspath(history_out),
        },
    )
    torch.save(checkpoint, args.out)
    if temp_ckpt_path and os.path.exists(temp_ckpt_path):
        os.remove(temp_ckpt_path)

    print(f"saved={args.out}")
    print(f"metrics_out={metrics_out}")
    print(f"history_out={history_out}")
    print(f"best_epoch_by_val_loss={best_epoch} best_val_loss={best_val:.4f}")
    if best_score is not None:
        print(f"best_{score_name}={best_score:.4f}")


if __name__ == "__main__":
    main()
