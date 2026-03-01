import torch
import torch.nn as nn


class TinyShopTransformer(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        seq_len: int,
        d_model: int = 128,
        nhead: int = 4,
        num_layers: int = 3,
        dim_feedforward: int = 256,
        dropout: float = 0.1,
        num_actions: int = 5,
    ):
        super().__init__()
        self.vocab_size = int(vocab_size)
        self.seq_len = int(seq_len)
        self.num_actions = int(num_actions)

        self.token_emb = nn.Embedding(self.vocab_size, d_model)
        self.pos_emb = nn.Embedding(self.seq_len, d_model)

        enc_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            batch_first=True,
            norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(
            enc_layer,
            num_layers=num_layers,
            enable_nested_tensor=False,
        )
        self.norm = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, self.num_actions)

    def encode(self, tokens: torch.Tensor) -> torch.Tensor:
        # tokens: [B, T] int64 -> features: [B, d_model]
        bsz, t = tokens.shape
        if t > self.seq_len:
            tokens = tokens[:, -self.seq_len :]
            t = self.seq_len
        elif t < self.seq_len:
            pad = torch.zeros((bsz, self.seq_len - t), dtype=tokens.dtype, device=tokens.device)
            tokens = torch.cat([tokens, pad], dim=1)
            t = self.seq_len

        pos = torch.arange(t, device=tokens.device).unsqueeze(0).expand(tokens.size(0), t)
        x = self.token_emb(tokens) + self.pos_emb(pos)
        x = self.encoder(x)
        return self.norm(x[:, -1, :])

    def forward(self, tokens: torch.Tensor) -> torch.Tensor:
        features = self.encode(tokens)
        return self.head(features)
