from __future__ import annotations

from abc import ABC, abstractmethod


class LockPort(ABC):
    @abstractmethod
    def acquire(self, key: str, owner: str, ttl_seconds: int) -> bool:
        raise NotImplementedError

    @abstractmethod
    def release(self, key: str, owner: str) -> None:
        raise NotImplementedError
