from __future__ import annotations

import asyncio
import hashlib
import secrets
from collections.abc import Callable

from aiogram import Router
from aiogram.exceptions import TelegramBadRequest
from aiogram import F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from app.application.orchestrators.dev_cycle_orchestrator import DevCycleOrchestrator
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.list_active_tasks import ListActiveTasksUseCase
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.domain.events.domain_events import DomainEvent
from app.interface.telegram.fsm.states import TaskStates
from app.interface.telegram.keyboards.decision_keyboard import build_decision_request_keyboard
from app.interface.telegram.keyboards.task_keyboard import (
    build_task_card_keyboard,
    build_task_list_keyboard,
)
from app.interface.telegram.keyboards.main_menu_keyboard import (
    OPEN_TASKS_BUTTON,
    build_main_menu_keyboard,
)
from app.interface.telegram.presenters.task_card import render_task_card, render_task_list_row
from app.shared.enums import TaskStatus
from app.shared.errors import AppError
from app.shared.security import CallbackSigner


def build_router(
    list_active_use_case: ListActiveTasksUseCase,
    uow_factory: Callable[[], UnitOfWork],
    orchestrator: DevCycleOrchestrator,
    callback_signer: CallbackSigner,
    decision_ttl_seconds: int,
) -> Router:
    router = Router(name="status")

    def _is_not_modified_error(exc: TelegramBadRequest) -> bool:
        return "message is not modified" in str(exc).lower()

    def _resolve_task(value: str) -> TaskAggregate | None:
        with uow_factory() as tx:
            task = tx.tasks.get(value)
            if task is not None:
                return task
            return tx.tasks.find_by_short_id(value)

    async def _send_task_card(message: Message, task: TaskAggregate) -> None:
        await message.answer(
            render_task_card(task),
            reply_markup=build_task_card_keyboard(task),
        )

    async def _edit_or_send_task_card(callback: CallbackQuery, task: TaskAggregate) -> None:
        if callback.message is None:
            return

        try:
            await callback.message.edit_text(
                render_task_card(task),
                reply_markup=build_task_card_keyboard(task),
            )
            return
        except TelegramBadRequest as exc:
            if _is_not_modified_error(exc):
                return

        await callback.message.answer(
            render_task_card(task),
            reply_markup=build_task_card_keyboard(task),
        )

    @router.message(Command("status"))
    async def status(message: Message) -> None:
        parts = (message.text or "").split()
        if len(parts) < 2:
            await message.answer("Use format: /status <public_id|task_id>")
            return

        ref = parts[1].strip()
        task = _resolve_task(ref)
        if task is None:
            await message.answer(f"Task {ref} not found")
            return

        await _send_task_card(message, task)

    @router.message(Command("task"))
    async def task_card(message: Message) -> None:
        parts = (message.text or "").split()
        if len(parts) < 2:
            await message.answer("Use format: /task <public_id>")
            return
        ref = parts[1].strip()
        task = _resolve_task(ref)
        if task is None:
            await message.answer(f"Task {ref} not found")
            return
        await _send_task_card(message, task)

    async def _send_active_tasks(message: Message) -> None:
        await _send_active_tasks_page(message, page=0)

    async def _send_active_tasks_page(message: Message, page: int) -> None:
        tasks = list_active_use_case.execute()
        if not tasks:
            await message.answer("Нет открытых задач")
            return
        page_size = 10
        max_page = max((len(tasks) - 1) // page_size, 0)
        safe_page = min(max(page, 0), max_page)
        start = safe_page * page_size
        end = start + page_size
        rows = tasks[start:end]
        lines = [render_task_list_row(item) for item in rows]
        text = "📂 Открытые задачи:\n" + "\n".join(lines)
        text += f"\n\nСтраница {safe_page + 1}/{max_page + 1}"
        await message.answer(
            text,
            reply_markup=build_task_list_keyboard(
                rows,
                page=safe_page,
                has_prev=safe_page > 0,
                has_next=safe_page < max_page,
            ),
        )
        await message.answer("Используй кнопки из карточек для действий.", reply_markup=build_main_menu_keyboard())

    @router.message(Command("tasks"))
    @router.message(F.text == OPEN_TASKS_BUTTON)
    async def tasks(message: Message) -> None:
        await _send_active_tasks(message)

    @router.message(Command("active"))
    async def active(message: Message) -> None:
        await _send_active_tasks(message)

    @router.callback_query(lambda c: bool(c.data and c.data.startswith("tasks|")))
    async def on_tasks_page(callback: CallbackQuery) -> None:
        parts = callback.data.split("|")
        if len(parts) != 2:
            await callback.answer("Invalid pagination payload", show_alert=True)
            return
        try:
            page = int(parts[1])
        except ValueError:
            await callback.answer("Invalid page", show_alert=True)
            return

        tasks = list_active_use_case.execute()
        if not tasks:
            await callback.answer("Нет открытых задач", show_alert=True)
            return
        page_size = 10
        max_page = max((len(tasks) - 1) // page_size, 0)
        safe_page = min(max(page, 0), max_page)
        start = safe_page * page_size
        end = start + page_size
        rows = tasks[start:end]
        lines = [render_task_list_row(item) for item in rows]
        text = "📂 Открытые задачи:\n" + "\n".join(lines)
        text += f"\n\nСтраница {safe_page + 1}/{max_page + 1}"

        if callback.message is not None:
            try:
                await callback.message.edit_text(
                    text,
                    reply_markup=build_task_list_keyboard(
                        rows,
                        page=safe_page,
                        has_prev=safe_page > 0,
                        has_next=safe_page < max_page,
                    ),
                )
            except TelegramBadRequest as exc:
                if not _is_not_modified_error(exc):
                    await callback.message.answer(
                        text,
                        reply_markup=build_task_list_keyboard(
                            rows,
                            page=safe_page,
                            has_prev=safe_page > 0,
                            has_next=safe_page < max_page,
                        ),
                    )
        await callback.answer("Обновлено")

    @router.callback_query(lambda c: bool(c.data and c.data.startswith("task|")))
    async def on_task_callback(callback: CallbackQuery, state: FSMContext) -> None:
        parts = callback.data.split("|")
        if len(parts) != 3:
            await callback.answer("Invalid action payload", show_alert=True)
            return

        _, public_id, action = parts
        task = _resolve_task(public_id)
        if task is None:
            await callback.answer("Task not found", show_alert=True)
            return

        if action in {"open", "refresh"}:
            await _edit_or_send_task_card(callback, task)
            await callback.answer("Обновлено")
            return

        if action == "rework":
            if task.status != TaskStatus.AWAITING_REWORK_INPUT:
                await callback.answer("Правки доступны только в AWAITING_REWORK_INPUT", show_alert=True)
                return
            await state.set_state(TaskStates.awaiting_rework_feedback)
            await state.update_data(task_id=task.id, public_id=task.public_id)
            if callback.message is not None:
                await callback.message.answer(
                    f"Напиши, что исправить для {task.public_id}.\n"
                    "Я добавлю это в историю правок текущего PR и запущу доработку.",
                )
            await callback.answer("Жду текст правок")
            return

        if action == "run":
            if task.status not in {TaskStatus.NEW, TaskStatus.RETRY_SCHEDULED, TaskStatus.FAILED}:
                await callback.answer("Запуск доступен только для NEW/RETRY/FAILED", show_alert=True)
                return
            if task.status == TaskStatus.FAILED:
                with uow_factory() as tx:
                    current = tx.tasks.get(task.id)
                    if current is None:
                        await callback.answer("Task not found", show_alert=True)
                        return
                    current.schedule_retry("Manual retry requested from FAILED status")
                    tx.tasks.update(current)
                    for event in current.pull_events():
                        if isinstance(event, DomainEvent):
                            tx.outbox.enqueue(event.aggregate_id, event.event_type, event.payload)
                    tx.commit()
            asyncio.create_task(orchestrator.run_task(task.id))
            await callback.answer("Запуск поставлен в очередь")
            task_after = _resolve_task(public_id)
            if task_after is not None:
                await _edit_or_send_task_card(callback, task_after)
            return

        if action == "logs":
            log_text = task.last_error or "Подробные логи пока не сохранены. Используй статус и step-уведомления."
            if callback.message is not None:
                await callback.message.answer(f"🧾 {task.public_id}\n{log_text}")
            await callback.answer("Показал детали")
            return

        if action == "decision":
            if task.status != TaskStatus.AWAITING_DECISION:
                await callback.answer("Решение доступно только в AWAITING_DECISION", show_alert=True)
                return

            token = secrets.token_urlsafe(8)
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
            try:
                with uow_factory() as tx:
                    current = tx.tasks.get(task.id)
                    if current is None:
                        await callback.answer("Task not found", show_alert=True)
                        return
                    current.request_decision(token_hash=token_hash, ttl_seconds=decision_ttl_seconds)
                    tx.tasks.update(current)
                    for event in current.pull_events():
                        if isinstance(event, DomainEvent):
                            tx.outbox.enqueue(event.aggregate_id, event.event_type, event.payload)
                    tx.commit()
                    task = current
            except AppError as exc:
                await callback.answer(str(exc), show_alert=True)
                return

            keyboard = build_decision_request_keyboard(task.public_id, token, callback_signer)
            if callback.message is not None:
                await callback.message.answer(
                    f"Требуется решение по задаче {task.public_id}\n"
                    f"PR: {task.pr_url or '-'}\n"
                    f"Preview: {task.preview_url or '-'}",
                    reply_markup=keyboard,
                )
            await callback.answer("Кнопки решения отправлены")
            return

        await callback.answer("Unknown action", show_alert=True)

    return router
