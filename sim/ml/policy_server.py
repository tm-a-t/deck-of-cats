#!/usr/bin/env python3

import argparse
import json
import sys

import torch

from model import TinyShopTransformer


def load_model(path: str):
    ckpt = torch.load(path, map_location="cpu")
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
    )
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    return model, cfg


def pad_tokens(tokens, seq_len):
    if len(tokens) > seq_len:
        return tokens[-seq_len:]
    if len(tokens) < seq_len:
        return tokens + [0] * (seq_len - len(tokens))
    return tokens


def choose_action(model, cfg, tokens, mask, sample=False, temperature=1.0, epsilon=0.0):
    seq_len = int(cfg["seq_len"])
    vocab_size = int(cfg.get("vocab_size", 1))
    tokens = [max(0, min(int(t), vocab_size - 1)) for t in pad_tokens(tokens, seq_len)]
    full_valid = [i for i, v in enumerate(mask) if int(v)]
    if not full_valid:
        return 0
    with torch.no_grad():
        x = torch.tensor(tokens, dtype=torch.long).unsqueeze(0)
        logits = model(x).squeeze(0)
        num_actions = int(logits.numel())
        mask_list = list(mask)
        if len(mask_list) < num_actions:
            mask_list.extend([0] * (num_actions - len(mask_list)))
        elif len(mask_list) > num_actions:
            mask_list = mask_list[:num_actions]
        mask_t = torch.tensor(mask_list, dtype=torch.bool)
        if mask_t.sum().item() == 0:
            # Backward compatibility for older checkpoints with smaller actor head:
            # if no valid action fits into model logits, choose a valid index from full mask.
            return int(full_valid[0])
        masked_logits = logits.masked_fill(~mask_t, -1e9)

        if not sample:
            return int(torch.argmax(masked_logits).item())

        valid_idx = torch.nonzero(mask_t, as_tuple=False).squeeze(-1)
        if valid_idx.numel() == 0:
            return int(full_valid[0])

        eps = max(0.0, min(1.0, float(epsilon)))
        if eps > 0 and torch.rand(1).item() < eps:
            r = int(torch.randint(low=0, high=valid_idx.numel(), size=(1,)).item())
            return int(valid_idx[r].item())

        temp = max(1e-3, float(temperature))
        probs = torch.softmax(masked_logits / temp, dim=-1)
        if torch.isnan(probs).any() or probs.sum().item() <= 0:
            return int(torch.argmax(masked_logits).item())
        action = torch.multinomial(probs, num_samples=1).item()
        return int(action)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    args = parser.parse_args()

    model, cfg = load_model(args.model)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            action = choose_action(
                model,
                cfg,
                obj["tokens"],
                obj["mask"],
                sample=bool(obj.get("sample", False)),
                temperature=float(obj.get("temperature", 1.0)),
                epsilon=float(obj.get("epsilon", 0.0)),
            )
            sys.stdout.write(json.dumps({"action": action}) + "\n")
            sys.stdout.flush()
        except Exception as exc:
            sys.stdout.write(json.dumps({"action": 0, "error": str(exc)}) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
