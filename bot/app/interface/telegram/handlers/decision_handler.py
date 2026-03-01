from __future__ import annotations

from collections.abc import Callable

from aiogram import Router
from aiogram.types import CallbackQuery

from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.accept_merge_decision import AcceptMergeDecisionUseCase
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

        # format: dec|<task_id_short>|<decision>|<token>|<signature>
        parts = callback.data.split("|")
        if len(parts) != 5:
            await callback.answer("Invalid decision payload", show_alert=True)
            return

        _, short_id, decision_raw, token, signature = parts
        payload = f"{short_id}|{decision_raw}|{token}"
        if not callback_signer.verify(payload, signature):
            await callback.answer("Signature check failed", show_alert=True)
            return

        with uow_factory() as tx:
            task = tx.tasks.find_by_short_id(short_id)
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
