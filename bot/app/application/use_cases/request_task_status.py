from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from app.application.ports.unit_of_work import UnitOfWork
from app.shared.errors import NotFoundError


@dataclass
class RequestTaskStatusUseCase:
    uow_factory: Callable[[], UnitOfWork]

    def execute(self, task_id: str) -> dict[str, str | int | None]:
        with self.uow_factory() as uow:
            task = uow.tasks.get(task_id)
            if task is None:
                raise NotFoundError(f"Task {task_id} not found")

            return {
                "task_id": task.id,
                "public_id": task.public_id,
                "title": task.title,
                "status": task.status.value,
                "pr_url": task.pr_url,
                "preview_url": task.preview_url,
                "last_error": task.last_error,
                "version": task.version,
                "updated_at": task.updated_at.isoformat(),
            }
