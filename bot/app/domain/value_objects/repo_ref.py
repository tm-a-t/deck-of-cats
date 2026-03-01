from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RepoRef:
    base_branch: str
    working_branch: str
