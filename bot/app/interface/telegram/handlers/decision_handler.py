from __future__ import annotations

import asyncio
from collections.abc import Callable

from aiogram import Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from app.application.orchestrators.dev_cycle_orchestrator import DevCycleOrchestrator
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.accept_merge_decision import AcceptMergeDecisionUseCase
from app.domain.events.domain_events import DomainEvent
from app.interface.telegram.callback_alerts import (
    build_callback_alert_text,
    build_callback_details_text,
)
from app.interface.telegram.fsm.states import TaskStates
from app.interface.telegram.keyboards.decision_keyboard import build_decision_confirm_keyboard
from app.interface.telegram.keyboards.main_menu_keyboard import CANCEL_BUTTON, build_main_menu_keyboard
from app.shared.enums import MergeDecision, TaskStatus
from app.shared.errors import AppError
from app.shared.security import CallbackSigner


def build_router(
    use_case: AcceptMergeDecisionUseCase,
    orchestrator: DevCycleOrchestrator,
    uow_factory: Callable[[], UnitOfWork],
    callback_signer: CallbackSigner,
) -> Router:
    router = Router(name="decision")

    @router.callback_query(lambda c: bool(c.data and c.data.startswith("dec|")))
    async def on_decision(callback: CallbackQuery, state: FSMContext) -> None:
        if callback.message is None:
            await callback.answer("Chat context missing", show_alert=True)
            return
        # formats:
        # legacy: dec|<public_id>|<decision>|<token>|<signature>
        # current: dec|<public_id>|<decision>|<token>|<signature>|<stage>
        parts = callback.data.split("|")
        if len(parts) not in {5, 6}:
            await callback.answer("Invalid decision payload", show_alert=True)
            return

        if len(parts) == 5:
            _, public_id, decision_raw, token, signature = parts
            stage = "do"
            legacy_payload = f"{public_id}|{decision_raw}|{token}"
            if not callback_signer.verify(legacy_payload, signature):
                await callback.answer("Signature check failed", show_alert=True)
                return
        else:
            _, public_id, decision_raw, token, signature, stage = parts
            payload = f"{public_id}|{decision_raw}|{token}|{stage}"
            if not callback_signer.verify(payload, signature):
                await callback.answer("Signature check failed", show_alert=True)
                return

        if stage == "ask":
            if decision_raw not in {
                MergeDecision.MERGE.value,
                MergeDecision.CLOSE.value,
                MergeDecision.RERUN_TESTS.value,
            }:
                await callback.answer("Invalid decision action", show_alert=True)
                return
            keyboard = build_decision_confirm_keyboard(public_id, decision_raw, token, callback_signer)
            if callback.message is not None:
                await callback.message.answer(
                    f"Подтверждение для {public_id}: {decision_raw}",
                    reply_markup=keyboard,
                )
            await callback.answer("Нужно подтверждение")
            return

        if stage != "do":
            await callback.answer("Unknown decision stage", show_alert=True)
            return

        if decision_raw == "cancel":
            await callback.answer("Действие отменено")
            return

        with uow_factory() as tx:
            task = tx.tasks.find_by_short_id(public_id, chat_id=callback.message.chat.id)
            if task is None:
                await callback.answer("Task not found", show_alert=True)
                return
            task_id = task.id

        try:
            decision = MergeDecision(decision_raw)
            await use_case.execute(task_id=task_id, decision=decision, decision_token=token)
        except AppError as exc:
            if callback.message is not None:
                await callback.message.answer(
                    build_callback_details_text(
                        f"Не удалось применить решение для {public_id}.",
                        exc,
                    )
                )
            await callback.answer(
                build_callback_alert_text(exc, fallback="Не удалось применить решение"),
                show_alert=True,
            )
            return

        if decision == MergeDecision.RERUN_TESTS:
            await state.set_state(TaskStates.awaiting_rework_feedback)
            await state.update_data(task_id=task_id, public_id=public_id)
            if callback.message is not None:
                await callback.message.answer(
                    f"Напиши, что именно исправить для {public_id}.\n"
                    "Я добавлю это в историю правок текущего PR и запущу доработку.",
                    reply_markup=build_main_menu_keyboard(include_cancel=True),
                )
            await callback.answer("Жду текст правок")
            return

        await callback.answer("Decision applied")

    @router.message(TaskStates.awaiting_rework_feedback)
    async def on_rework_feedback(message: Message, state: FSMContext) -> None:
        text = (message.text or "").strip()
        if text == CANCEL_BUTTON:
            await state.clear()
            await message.answer("Ок, доработку не запускал. Нажми «📝 Отправить правки» в карточке задачи, когда будешь готов.")
            return
        if not text:
            await message.answer("Нужно текстом описать правки одним сообщением.")
            return

        data = await state.get_data()
        task_id = str(data.get("task_id", "")).strip()
        public_id = str(data.get("public_id", "")).strip()
        if not task_id:
            await state.clear()
            await message.answer("Сессия правок устарела. Открой карточку и нажми «⚖️ Решение» заново.")
            return

        with uow_factory() as tx:
            task = tx.tasks.get(task_id)
            if task is None:
                await state.clear()
                await message.answer(f"Задача {public_id or task_id} не найдена.")
                return
            if task.chat_id != message.chat.id:
                await state.clear()
                await message.answer(f"Задача {public_id or task_id} не найдена.")
                return

            if task.status != TaskStatus.AWAITING_REWORK_INPUT:
                await state.clear()
                await message.answer(f"Задача {task.public_id} уже не ждёт правки.")
                return

            task.apply_rework_feedback(text)
            tx.tasks.update(task)
            for event in task.pull_events():
                if isinstance(event, DomainEvent):
                    tx.outbox.enqueue(event.aggregate_id, event.event_type, event.payload)
            tx.commit()

        await state.clear()
        asyncio.create_task(orchestrator.run_task(task_id))
        await message.answer(f"Принял правки для {public_id or task_id}. Запускаю доработку.")

    return router
