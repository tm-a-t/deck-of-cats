from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4


@dataclass(frozen=True)
class CorrelationId:
    value: str

    @staticmethod
    def new() -> "CorrelationId":
        return CorrelationId(value=str(uuid4()))
