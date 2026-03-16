from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
import textwrap

from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.submit_change_request import SubmitChangeRequestUseCase
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.enums import TaskKind, TaskStatus


@dataclass
class LaunchResearchProjectUseCase:
    uow_factory: Callable[[], UnitOfWork]
    submit_change_request: SubmitChangeRequestUseCase
    recent_task_limit: int = 8
    active_task_limit: int = 8
    log_excerpt_limit: int = 700

    async def execute(
        self,
        author_id: int,
        chat_id: int,
        author_username: str | None = None,
        author_display_name: str | None = None,
    ) -> str:
        title, body = self._build_research_request(chat_id)
        return await self.submit_change_request.execute(
            author_id=author_id,
            chat_id=chat_id,
            title=title,
            body=body,
            task_kind=TaskKind.RESEARCH,
            author_username=author_username,
            author_display_name=author_display_name,
            notify_started=False,
            start_immediately=True,
        )

    def _build_research_request(self, chat_id: int) -> tuple[str, str]:
        with self.uow_factory() as uow:
            recent_tasks = [
                task
                for task in uow.tasks.list_recent(limit=self.recent_task_limit, chat_id=chat_id)
                if task.kind != TaskKind.RESEARCH
            ]
            active_tasks = [
                task
                for task in uow.tasks.list_active(chat_id=chat_id)
                if task.kind != TaskKind.RESEARCH
            ][: self.active_task_limit]

            evidence_rows: list[str] = []
            for task in recent_tasks:
                latest_payload = uow.step_executions.get_latest_error_payload(task.id)
                if not latest_payload and not task.last_error and task.status not in {
                    TaskStatus.FAILED,
                    TaskStatus.RETRY_SCHEDULED,
                    TaskStatus.AWAITING_REWORK_INPUT,
                    TaskStatus.DEAD_LETTER,
                }:
                    continue

                lines = [
                    f"- {task.public_id} | status={task.status.value} | title={task.title}",
                ]
                if task.last_error:
                    lines.append(f"  last_error: {self._truncate(task.last_error, self.log_excerpt_limit // 2)}")
                if latest_payload:
                    lines.append(f"  log_excerpt: {self._truncate(latest_payload, self.log_excerpt_limit)}")
                evidence_rows.append("\n".join(lines))

            if not evidence_rows:
                fallback_rows: list[str] = []
                for task in recent_tasks[:3]:
                    fallback_rows.append(f"- {task.public_id} | status={task.status.value} | title={task.title}")
                evidence_rows = fallback_rows or ["- <no recent tasks in this chat>"]

        active_block = "\n".join(
            f"- {task.public_id} | status={task.status.value} | title={task.title}"
            for task in active_tasks
        ) or "- <no currently active non-research tasks>"
        evidence_block = "\n\n".join(evidence_rows)

        title = "Research bot behavior gaps and missing features"
        body = textwrap.dedent(
            f"""
            Research the current Telegram bot behavior for this chat and the surrounding multi-agent workflow.

            Primary goals:
            - Read the recent task and log excerpts below.
            - Identify where the bot or agent pipeline behaves incorrectly.
            - Explain what should change in the bot behavior, prompts, orchestration, or UX.
            - Separately identify missing product or workflow features that would reduce user friction.
            - Return the best 3-5 ideas, prioritized by leverage.

            Constraints:
            - This is a research-only task. Do not implement code.
            - Use the provided evidence first, then inspect repository files when needed to verify causes.
            - Be concrete about root causes, recommended behavior changes, and why each idea matters.

            Currently active tasks in this chat:
            {active_block}

            Recent task and log evidence:
            {evidence_block}
            """
        ).strip()
        return title, body

    @staticmethod
    def _truncate(value: str, limit: int) -> str:
        normalized = " ".join(value.split()).strip()
        if len(normalized) <= limit:
            return normalized
        return normalized[: limit - 1].rstrip() + "…"
