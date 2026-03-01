from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4


@dataclass(frozen=True)
class TaskId:
    value: str

    @staticmethod
    def new() -> "TaskId":
        return TaskId(value=str(uuid4()))
