from __future__ import annotations

from abc import ABC, abstractmethod


class OutboxPort(ABC):
    @abstractmethod
    def enqueue(self, aggregate_id: str, event_type: str, payload: dict) -> None:
        raise NotImplementedError
