from __future__ import annotations

from dataclasses import dataclass

from app.shared.enums import StepName


@dataclass
class StepResult:
    ok: bool
    summary: str
    details: str = ""
    artifact_path: str | None = None
    metadata: dict[str, str | int | bool | list[str]] | None = None


@dataclass
class WorkflowContext:
    task_id: str
    step: StepName
    attempt: int
    idempotency_key: str
