from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.aggregates.task_aggregate import TaskAggregate


class TaskRepository(ABC):
    @abstractmethod
    def add(self, task: TaskAggregate) -> None:
        raise NotImplementedError

    @abstractmethod
    def get(self, task_id: str) -> TaskAggregate | None:
        raise NotImplementedError

    @abstractmethod
    def update(self, task: TaskAggregate) -> None:
        raise NotImplementedError

    @abstractmethod
    def list_active(self) -> list[TaskAggregate]:
        raise NotImplementedError

    @abstractmethod
    def find_by_short_id(self, short_id: str) -> TaskAggregate | None:
        raise NotImplementedError
