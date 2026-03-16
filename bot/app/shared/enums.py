from __future__ import annotations

from enum import Enum


class TaskKind(str, Enum):
    CHANGE = "change"
    RESEARCH = "research"


class TaskStatus(str, Enum):
    NEW = "NEW"
    RESEARCH_RUNNING = "RESEARCH_RUNNING"
    RESEARCH_COMPLETED = "RESEARCH_COMPLETED"
    CODEX_IMPLEMENT_RUNNING = "CODEX_IMPLEMENT_RUNNING"
    CODEX_VALIDATE_RUNNING = "CODEX_VALIDATE_RUNNING"
    PR_CREATING = "PR_CREATING"
    AWAITING_PREVIEW = "AWAITING_PREVIEW"
    AWAITING_DECISION = "AWAITING_DECISION"
    AWAITING_REWORK_INPUT = "AWAITING_REWORK_INPUT"
    DECISION_APPLYING = "DECISION_APPLYING"
    MERGED = "MERGED"
    CLOSED = "CLOSED"
    FAILED = "FAILED"
    RETRY_SCHEDULED = "RETRY_SCHEDULED"
    DEAD_LETTER = "DEAD_LETTER"


class StepName(str, Enum):
    RESEARCH = "research"
    CODEX_IMPLEMENT = "codex_implement"
    CODEX_VALIDATE = "codex_validate"
    PR = "pr"
    PREVIEW = "preview"
    DECISION = "decision"
    LEAD_REVIEW = "lead_review"


class StepExecutionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PASSED = "PASSED"
    FAILED = "FAILED"
    RETRY_SCHEDULED = "RETRY_SCHEDULED"
    SKIPPED = "SKIPPED"


class MergeDecision(str, Enum):
    MERGE = "merge"
    CLOSE = "close"
    RERUN_TESTS = "rerun_tests"
