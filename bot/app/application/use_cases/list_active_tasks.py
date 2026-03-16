from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from app.application.ports.unit_of_work import UnitOfWork


@dataclass
class ListActiveTasksUseCase:
    uow_factory: Callable[[], UnitOfWork]

    def execute(self, chat_id: int | None = None) -> list[dict[str, str]]:
        with self.uow_factory() as uow:
            tasks = uow.tasks.list_active(chat_id=chat_id)
            return [
                {
                    "task_id": task.id,
                    "public_id": task.public_id,
                    "kind": task.kind.value,
                    "title": task.title,
                    "status": task.status.value,
                    "updated_at": task.updated_at.isoformat(),
                }
                for task in tasks
            ]
