from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ExecutionReport:
    ok: bool
    summary: str
    details: str = ""
    artifact_path: str | None = None
