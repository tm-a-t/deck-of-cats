from __future__ import annotations

import asyncio
import contextlib
import logging
import uuid
from collections.abc import Callable

from app.application.ports.lock_port import LockPort
from app.application.ports.notifier_port import NotifierPort
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.accept_merge_decision import AcceptMergeDecisionUseCase
from app.application.workflows.dev_cycle_workflow import DevCycleWorkflow
from app.application.workflows.models import StepResult
from app.application.workflows.steps.base import StepHandler
from app.domain.events.domain_events import DomainEvent
from app.shared.enums import MergeDecision, StepExecutionStatus, StepName, TaskStatus


logger = logging.getLogger(__name__)


class DevCycleOrchestrator:
    def __init__(
        self,
        uow_factory: Callable[[], UnitOfWork],
        workflow: DevCycleWorkflow,
        steps: dict[StepName, StepHandler],
        lock_port: LockPort,
        notifier: NotifierPort,
        max_retries: int,
        decision_ttl_seconds: int,
        auto_decision_use_case: AcceptMergeDecisionUseCase | None = None,
        lock_ttl_seconds: int = 300,
    ) -> None:
        self._uow_factory = uow_factory
        self._workflow = workflow
        self._steps = steps
        self._lock_port = lock_port
        self._notifier = notifier
        self._max_retries = max_retries
        self._decision_ttl_seconds = decision_ttl_seconds
        self._auto_decision_use_case = auto_decision_use_case
        self._lock_ttl_seconds = lock_ttl_seconds

    async def run_task(self, task_id: str) -> None:
        owner = f"orchestrator-{uuid.uuid4()}"
        lock_key = f"task:{task_id}"
        logger.info("Task run requested task_id=%s", task_id)

        if not self._lock_port.acquire(lock_key, owner, ttl_seconds=self._lock_ttl_seconds):
            logger.info("Task run skipped, lock busy task_id=%s", task_id)
            return

        try:
            while True:
                self._lock_port.acquire(lock_key, owner, ttl_seconds=self._lock_ttl_seconds)
                snapshot = self._prepare_step(task_id)
                if snapshot is None:
                    logger.info("Task run finished, no next step task_id=%s", task_id)
                    return

                task, step_name, attempt = snapshot
                step_handler = self._steps[step_name]
                logger.info(
                    "Step started task_id=%s step=%s attempt=%s status=%s",
                    task.id,
                    step_name.value,
                    attempt,
                    task.status.value,
                )
                heartbeat = asyncio.create_task(self._lock_heartbeat(lock_key, owner))
                try:
                    result = await step_handler.execute(task)
                except Exception as exc:  # pragma: no cover - defensive boundary
                    logger.exception(
                        "Step crashed with exception task_id=%s step=%s attempt=%s",
                        task.id,
                        step_name.value,
                        attempt,
                    )
                    result = StepResult(
                        ok=False,
                        summary=f"{step_name.value} step failed with exception",
                        details=repr(exc),
                    )
                finally:
                    heartbeat.cancel()
                    with contextlib.suppress(asyncio.CancelledError):
                        await heartbeat

                logger.info(
                    "Step result task_id=%s step=%s attempt=%s ok=%s summary=%r",
                    task.id,
                    step_name.value,
                    attempt,
                    result.ok,
                    result.summary,
                )
                try:
                    final_state = await self._finalize_step(
                        task_id=task.id,
                        step_name=step_name,
                        attempt=attempt,
                        ok=result.ok,
                        summary=result.summary,
                        details=result.details,
                        metadata=result.metadata,
                    )
                except Exception as exc:  # pragma: no cover - defensive boundary
                    logger.exception(
                        "Step finalization failed task_id=%s step=%s attempt=%s",
                        task.id,
                        step_name.value,
                        attempt,
                    )
                    await self._mark_dead_letter(task.id, f"Finalization error: {exc!r}")
                    return

                logger.info(
                    "Task state updated task_id=%s status=%s pr=%s preview=%s",
                    final_state.id,
                    final_state.status.value,
                    final_state.pr_url or "-",
                    final_state.preview_url or "-",
                )
                await self._notifier.notify_step_result(
                    final_state,
                    step_name.value,
                    f"{result.summary}\n{result.details}".strip(),
                )

                if step_name == StepName.DECISION and result.ok:
                    token = str((result.metadata or {}).get("decision_token", ""))
                    logger.info("Decision requested task_id=%s", final_state.id)
                    await self._notifier.notify_decision_required(final_state, token)
                    return

                if step_name == StepName.LEAD_REVIEW and result.ok and self._auto_decision_use_case is not None:
                    decision_raw = str((result.metadata or {}).get("review_decision", "")).strip()
                    feedback = str((result.metadata or {}).get("review_feedback", "")).strip() or result.details
                    try:
                        decision = MergeDecision(decision_raw)
                    except ValueError:
                        await self._mark_dead_letter(final_state.id, f"Invalid lead review decision: {decision_raw!r}")
                        return
                    await self._auto_decision_use_case.execute_system(
                        task_id=final_state.id,
                        decision=decision,
                        feedback=feedback,
                    )
                    return

                should_wait_for_user_decision = (
                    final_state.status == TaskStatus.AWAITING_DECISION
                    and final_state.decision_token_hash is not None
                )
                if should_wait_for_user_decision or final_state.status in {
                    TaskStatus.RETRY_SCHEDULED,
                    TaskStatus.FAILED,
                } or final_state.is_terminal():
                    logger.info("Task run reached terminal/waiting state task_id=%s status=%s", final_state.id, final_state.status.value)
                    await self._notifier.notify_task_finished(final_state)
                    return
        finally:
            self._lock_port.release(lock_key, owner)
            logger.info("Task lock released task_id=%s", task_id)

    def _prepare_step(self, task_id: str):
        with self._uow_factory() as uow:
            task = uow.tasks.get(task_id)
            if task is None or task.is_terminal():
                return None

            previous_version = task.version
            step_name = self._workflow.next_step(task)
            if step_name is None:
                return None

            attempt = uow.step_executions.get_last_attempt(task.id, step_name) + 1
            idempotency_key = f"{task.id}:{step_name.value}:{attempt}"

            if task.version != previous_version:
                uow.tasks.update(task)
                self._enqueue_events(uow, task.pull_events())
            uow.step_executions.create_attempt(task.id, step_name, attempt, idempotency_key)
            uow.step_executions.mark_status(
                task.id,
                step_name,
                attempt,
                StepExecutionStatus.RUNNING,
            )
            uow.commit()
            return task, step_name, attempt

    async def _finalize_step(
        self,
        task_id: str,
        step_name: StepName,
        attempt: int,
        ok: bool,
        summary: str,
        details: str,
        metadata: dict[str, str | int | bool | list[str]] | None,
    ):
        with self._uow_factory() as uow:
            task = uow.tasks.get(task_id)
            if task is None:
                raise RuntimeError(f"Task {task_id} disappeared")

            if ok:
                self._workflow.apply_success(task, step_name, self._mk_result(summary, details, metadata), self._decision_ttl_seconds)
                uow.step_executions.mark_status(
                    task.id,
                    step_name,
                    attempt,
                    StepExecutionStatus.PASSED,
                    error_payload=details,
                )
            else:
                failed_attempts = uow.step_executions.count_failed_attempts(task.id, step_name) + 1
                if self._is_environment_failure(summary=summary, details=details):
                    task.fail(summary)
                    status = StepExecutionStatus.FAILED
                elif failed_attempts >= self._max_retries:
                    task.mark_dead_letter(summary)
                    status = StepExecutionStatus.FAILED
                elif step_name == StepName.CODEX_VALIDATE:
                    task.schedule_reimplementation_from_tester(summary=summary, details=details)
                    status = StepExecutionStatus.RETRY_SCHEDULED
                else:
                    task.schedule_retry(summary)
                    status = StepExecutionStatus.RETRY_SCHEDULED

                uow.step_executions.mark_status(
                    task.id,
                    step_name,
                    attempt,
                    status,
                    error_code="STEP_FAILED",
                    error_payload=details,
                )

            uow.tasks.update(task)
            self._enqueue_events(uow, task.pull_events())
            uow.commit()
            return task

    @staticmethod
    def _enqueue_events(uow: UnitOfWork, events: list[object]) -> None:
        for event in events:
            if isinstance(event, DomainEvent):
                uow.outbox.enqueue(event.aggregate_id, event.event_type, event.payload)

    @staticmethod
    def _mk_result(
        summary: str,
        details: str,
        metadata: dict[str, str | int | bool | list[str]] | None,
    ):
        return StepResult(ok=True, summary=summary, details=details, metadata=metadata)

    async def _mark_dead_letter(self, task_id: str, reason: str) -> None:
        with self._uow_factory() as uow:
            task = uow.tasks.get(task_id)
            if task is None or task.is_terminal():
                return
            task.mark_dead_letter(reason)
            uow.tasks.update(task)
            self._enqueue_events(uow, task.pull_events())
            uow.commit()
        logger.error("Task moved to dead-letter task_id=%s reason=%r", task_id, reason)

    async def _lock_heartbeat(self, lock_key: str, owner: str) -> None:
        interval = max(1, self._lock_ttl_seconds // 3)
        while True:
            await asyncio.sleep(interval)
            acquired = self._lock_port.acquire(lock_key, owner, ttl_seconds=self._lock_ttl_seconds)
            if not acquired:
                logger.warning("Lock heartbeat lost lock_key=%s owner=%s", lock_key, owner)
                return

    @staticmethod
    def _is_environment_failure(summary: str, details: str) -> bool:
        text = f"{summary}\n{details}".lower()
        markers = (
            "net::err",
            "no internet",
            "internet disconnected",
            "dns",
            "name resolution",
            "temporary failure in name resolution",
            "connection refused",
            "network is unreachable",
            "timed out",
            "timeout exceeded",
            "econnrefused",
            "enotfound",
            "eai_again",
        )
        return any(marker in text for marker in markers)
