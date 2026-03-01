from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from string import hexdigits
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.domain.events.domain_events import (
    MergeDecisionRequested,
    TaskCreated,
    TaskStatusChanged,
)
from app.shared.enums import MergeDecision, TaskStatus
from app.shared.errors import InvalidTransitionError
from app.shared.time import utcnow


TERMINAL_STATUSES = {TaskStatus.MERGED, TaskStatus.CLOSED, TaskStatus.DEAD_LETTER}
EXPECTED_HEAD_SHA_FRAGMENT_KEY = "bot_expected_head_sha"
REWORK_HISTORY_HEADER = "Rework history:"


@dataclass
class TaskAggregate:
    id: str
    public_id: str
    author_id: int
    title: str
    body: str
    correlation_id: str
    author_username: str | None = None
    author_display_name: str | None = None
    status: TaskStatus = TaskStatus.NEW
    version: int = 0
    pr_url: str | None = None
    pr_number: int | None = None
    preview_url: str | None = None
    decision_token_hash: str | None = None
    decision_expires_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime = field(default_factory=utcnow)
    updated_at: datetime = field(default_factory=utcnow)
    _events: list[object] = field(default_factory=list)

    @classmethod
    def create(
        cls,
        task_id: str,
        author_id: int,
        title: str,
        body: str,
        correlation_id: str,
        author_username: str | None = None,
        author_display_name: str | None = None,
    ) -> "TaskAggregate":
        public_id = cls.derive_public_id(task_id)
        task = cls(
            id=task_id,
            public_id=public_id,
            author_id=author_id,
            author_username=author_username,
            author_display_name=author_display_name,
            title=title,
            body=body,
            correlation_id=correlation_id,
        )
        task._events.append(
            TaskCreated(
                aggregate_id=task.id,
                event_type="TaskCreated",
                payload={"title": task.title, "author_id": task.author_id, "public_id": task.public_id},
            )
        )
        return task

    @staticmethod
    def derive_public_id(task_id: str) -> str:
        compact = task_id.replace("-", "").upper()
        return f"T-{compact[:8]}"

    @property
    def events(self) -> list[object]:
        return list(self._events)

    def pull_events(self) -> list[object]:
        events = list(self._events)
        self._events.clear()
        return events

    def _set_status(self, new_status: TaskStatus) -> None:
        old_status = self.status
        self.status = new_status
        self.version += 1
        self.updated_at = utcnow()
        self._events.append(
            TaskStatusChanged(
                aggregate_id=self.id,
                event_type="TaskStatusChanged",
                payload={"from": old_status.value, "to": new_status.value},
            )
        )

    def _ensure(self, allowed_from: set[TaskStatus], action: str) -> None:
        if self.status not in allowed_from:
            allowed = ", ".join(sorted(s.value for s in allowed_from))
            raise InvalidTransitionError(
                f"Cannot '{action}' from status '{self.status.value}', allowed: {allowed}"
            )

    def start_codex_implement(self) -> None:
        self._ensure({TaskStatus.NEW, TaskStatus.RETRY_SCHEDULED}, "start_codex_implement")
        self._set_status(TaskStatus.CODEX_IMPLEMENT_RUNNING)

    def mark_codex_implement_passed(self) -> None:
        self._ensure(
            {TaskStatus.CODEX_IMPLEMENT_RUNNING},
            "mark_codex_implement_passed",
        )
        self._set_status(TaskStatus.CODEX_VALIDATE_RUNNING)

    def mark_codex_validate_passed(self) -> None:
        self._ensure(
            {TaskStatus.CODEX_VALIDATE_RUNNING},
            "mark_codex_validate_passed",
        )
        self._set_status(TaskStatus.PR_CREATING)

    def mark_pr_created(self, pr_number: int, pr_url: str) -> None:
        self._ensure({TaskStatus.PR_CREATING}, "mark_pr_created")
        self.pr_number = pr_number
        self.pr_url = pr_url
        self._set_status(TaskStatus.AWAITING_PREVIEW)

    def mark_preview_ready(self, preview_url: str) -> None:
        self._ensure({TaskStatus.AWAITING_PREVIEW}, "mark_preview_ready")
        self.preview_url = preview_url
        self._set_status(TaskStatus.AWAITING_DECISION)

    def request_decision(
        self,
        token_hash: str,
        ttl_seconds: int,
        expected_merge_head_sha: str | None = None,
    ) -> None:
        self._ensure({TaskStatus.AWAITING_DECISION}, "request_decision")
        self.decision_token_hash = token_hash
        self.decision_expires_at = utcnow() + timedelta(seconds=ttl_seconds)
        if expected_merge_head_sha:
            self.pr_url = self.attach_expected_head_sha(self.pr_url, expected_merge_head_sha)
        self.version += 1
        self.updated_at = utcnow()
        self._events.append(
            MergeDecisionRequested(
                aggregate_id=self.id,
                event_type="MergeDecisionRequested",
                payload={
                    "pr_url": self.pr_url,
                    "preview_url": self.preview_url,
                },
            )
        )

    def start_decision_applying(self) -> None:
        self._ensure({TaskStatus.AWAITING_DECISION}, "start_decision_applying")
        self._set_status(TaskStatus.DECISION_APPLYING)

    def finalize_decision(self, decision: MergeDecision) -> None:
        self._ensure({TaskStatus.DECISION_APPLYING}, "finalize_decision")
        if decision == MergeDecision.MERGE:
            self._set_status(TaskStatus.MERGED)
            self.decision_token_hash = None
            self.decision_expires_at = None
            return
        if decision == MergeDecision.CLOSE:
            self._set_status(TaskStatus.CLOSED)
            self.decision_token_hash = None
            self.decision_expires_at = None
            return
        if decision == MergeDecision.RERUN_TESTS:
            self.last_error = "Requested rework by user decision"
            self._set_status(TaskStatus.AWAITING_REWORK_INPUT)
            self.decision_token_hash = None
            self.decision_expires_at = None
            return
        raise InvalidTransitionError(f"Unsupported decision: {decision}")

    def apply_rework_feedback(self, feedback: str) -> None:
        self._ensure({TaskStatus.AWAITING_REWORK_INPUT}, "apply_rework_feedback")
        normalized_feedback = " ".join(feedback.split()).strip()
        if not normalized_feedback:
            raise InvalidTransitionError("Rework feedback cannot be empty")

        timestamp = utcnow().strftime("%Y-%m-%d %H:%M:%S")
        body = self.body.rstrip()
        if REWORK_HISTORY_HEADER not in body:
            body = f"{body}\n\n{REWORK_HISTORY_HEADER}"
        body = f"{body}\n- [{timestamp} UTC] {normalized_feedback}"

        self.body = body
        self.last_error = f"Rework requested: {normalized_feedback}"
        self._set_status(TaskStatus.RETRY_SCHEDULED)

    def rollback_decision_applying(self, reason: str) -> None:
        self._ensure({TaskStatus.DECISION_APPLYING}, "rollback_decision_applying")
        self.last_error = reason
        self._set_status(TaskStatus.AWAITING_DECISION)

    def fail(self, reason: str) -> None:
        if self.status in TERMINAL_STATUSES:
            raise InvalidTransitionError("Cannot fail a terminal task")
        self.last_error = reason
        self._set_status(TaskStatus.FAILED)

    def schedule_retry(self, reason: str) -> None:
        if self.status in TERMINAL_STATUSES:
            raise InvalidTransitionError("Cannot retry a terminal task")
        self.last_error = reason
        self._set_status(TaskStatus.RETRY_SCHEDULED)

    def mark_dead_letter(self, reason: str) -> None:
        if self.status in TERMINAL_STATUSES:
            raise InvalidTransitionError("Already terminal")
        self.last_error = reason
        self._set_status(TaskStatus.DEAD_LETTER)

    def is_terminal(self) -> bool:
        return self.status in TERMINAL_STATUSES

    @classmethod
    def attach_expected_head_sha(cls, pr_url: str | None, head_sha: str) -> str | None:
        if not pr_url or not cls._is_git_sha(head_sha):
            return pr_url
        parts = urlsplit(pr_url)
        fragment = dict(parse_qsl(parts.fragment, keep_blank_values=True))
        fragment[EXPECTED_HEAD_SHA_FRAGMENT_KEY] = head_sha
        return urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, urlencode(fragment)))

    @classmethod
    def extract_expected_head_sha(cls, pr_url: str | None) -> str | None:
        if not pr_url:
            return None
        fragment = dict(parse_qsl(urlsplit(pr_url).fragment, keep_blank_values=True))
        value = fragment.get(EXPECTED_HEAD_SHA_FRAGMENT_KEY, "").strip()
        if not value or not cls._is_git_sha(value):
            return None
        return value

    @staticmethod
    def _is_git_sha(value: str) -> bool:
        if not (7 <= len(value) <= 64):
            return False
        return all(char in hexdigits for char in value)
