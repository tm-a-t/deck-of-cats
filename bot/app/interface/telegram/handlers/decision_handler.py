from __future__ import annotations

from collections.abc import Callable

from aiogram import Router
from aiogram.types import CallbackQuery

from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.accept_merge_decision import AcceptMergeDecisionUseCase
from app.interface.telegram.keyboards.decision_keyboard import build_decision_confirm_keyboard
from app.shared.enums import MergeDecision
from app.shared.errors import AppError
from app.shared.security import CallbackSigner


def build_router(
    use_case: AcceptMergeDecisionUseCase,
    uow_factory: Callable[[], UnitOfWork],
    callback_signer: CallbackSigner,
) -> Router:
    router = Router(name="decision")

    @router.callback_query(lambda c: bool(c.data and c.data.startswith("dec|")))
    async def on_decision(callback: CallbackQuery) -> None:
        if not callback.data:
            await callback.answer("Invalid callback", show_alert=True)
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
            if decision_raw not in {MergeDecision.MERGE.value, MergeDecision.CLOSE.value}:
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
            task = tx.tasks.find_by_short_id(public_id)
            if task is None:
                await callback.answer("Task not found", show_alert=True)
                return
            task_id = task.id

        try:
            decision = MergeDecision(decision_raw)
            await use_case.execute(task_id=task_id, decision=decision, decision_token=token)
        except AppError as exc:
            await callback.answer(str(exc), show_alert=True)
            return

        await callback.answer("Decision applied")

    return router
