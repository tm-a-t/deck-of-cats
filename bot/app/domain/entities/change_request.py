from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ChangeRequest:
    title: str
    body: str
