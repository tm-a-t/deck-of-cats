from __future__ import annotations

from abc import ABC, abstractmethod

from app.application.ports.outbox_port import OutboxPort
from app.domain.repositories.step_execution_repository import StepExecutionRepository
from app.domain.repositories.task_repository import TaskRepository


class UnitOfWork(ABC):
    tasks: TaskRepository
    step_executions: StepExecutionRepository
    outbox: OutboxPort

    @abstractmethod
    def __enter__(self) -> "UnitOfWork":
        raise NotImplementedError

    @abstractmethod
    def __exit__(self, exc_type, exc, tb) -> None:
        raise NotImplementedError

    @abstractmethod
    def commit(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def rollback(self) -> None:
        raise NotImplementedError
