from __future__ import annotations

from typing import Protocol


class BranchPort(Protocol):
    async def prepare_branch(self, task_id: str) -> str:
        ...
