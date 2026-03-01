from __future__ import annotations

from dataclasses import dataclass


@dataclass
class PullRequest:
    provider: str
    number: int
    url: str
    state: str
