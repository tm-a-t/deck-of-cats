from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class DomainEvent:
    aggregate_id: str
    event_type: str
    payload: dict[str, Any]


@dataclass(frozen=True)
class TaskCreated(DomainEvent):
    pass


@dataclass(frozen=True)
class TaskStatusChanged(DomainEvent):
    pass


@dataclass(frozen=True)
class MergeDecisionRequested(DomainEvent):
    pass
