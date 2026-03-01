from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from app.application.ports.unit_of_work import UnitOfWork


@dataclass
class ListActiveTasksUseCase:
    uow_factory: Callable[[], UnitOfWork]

    def execute(self) -> list[dict[str, str]]:
        with self.uow_factory() as uow:
            tasks = uow.tasks.list_active()
            return [
                {
                    "task_id": task.id,
                    "title": task.title,
                    "status": task.status.value,
                }
                for task in tasks
            ]
