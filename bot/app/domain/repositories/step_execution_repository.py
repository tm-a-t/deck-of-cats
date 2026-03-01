from __future__ import annotations

from abc import ABC, abstractmethod

from app.shared.enums import StepExecutionStatus, StepName


class StepExecutionRepository(ABC):
    @abstractmethod
    def create_attempt(
        self,
        task_id: str,
        step: StepName,
        attempt: int,
        idempotency_key: str,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    def mark_status(
        self,
        task_id: str,
        step: StepName,
        attempt: int,
        status: StepExecutionStatus,
        log_path: str | None = None,
        error_code: str | None = None,
        error_payload: str | None = None,
    ) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_last_attempt(self, task_id: str, step: StepName) -> int:
        raise NotImplementedError

    @abstractmethod
    def count_failed_attempts(self, task_id: str, step: StepName) -> int:
        raise NotImplementedError

    @abstractmethod
    def get_latest_error_payload(self, task_id: str) -> str | None:
        raise NotImplementedError
