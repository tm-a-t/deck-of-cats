from __future__ import annotations

from aiogram import Bot

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.interface.telegram.keyboards.decision_keyboard import build_decision_request_keyboard
from app.interface.telegram.presenters.task_card import render_task_card
from app.shared.enums import TaskStatus
from app.shared.security import CallbackSigner


class TelegramNotifier:
    def __init__(self, bot: Bot, callback_signer: CallbackSigner) -> None:
        self._bot = bot
        self._callback_signer = callback_signer

    async def notify_task_started(self, task: TaskAggregate) -> None:
        await self._bot.send_message(
            chat_id=task.author_id,
            text=(
                f"🆕 Задача создана: {task.public_id}\n"
                f"{task.title}\n"
                "Открой «📂 Открытые задачи» и выбери карточку."
            ),
        )

    async def notify_step_result(self, task: TaskAggregate, step: str, message: str) -> None:
        await self._bot.send_message(
            chat_id=task.author_id,
            text=f"[{task.public_id}] {step}: {message or 'completed'}",
        )

    async def notify_decision_required(self, task: TaskAggregate, token: str) -> None:
        keyboard = build_decision_request_keyboard(task.public_id, token, self._callback_signer)
        preview_line = f"\nPreview: {task.preview_url}" if task.preview_url else ""

        await self._bot.send_message(
            chat_id=task.author_id,
            text=(
                "Требуется решение по PR\n"
                f"Задача: {task.public_id}\n"
                f"PR: {task.pr_url or '-'}"
                f"{preview_line}"
            ),
            reply_markup=keyboard,
        )

    async def notify_task_finished(self, task: TaskAggregate) -> None:
        status_line = f"ℹ️ Статус задачи {task.public_id}: {task.status.value}"
        if task.status == TaskStatus.MERGED:
            status_line = f"✅ Задача {task.public_id} завершена (merged)"
        elif task.status == TaskStatus.CLOSED:
            status_line = f"🛑 Задача {task.public_id} закрыта"
        elif task.status == TaskStatus.AWAITING_DECISION:
            status_line = f"⏳ Задача {task.public_id} ждёт решения"
        elif task.status == TaskStatus.AWAITING_REWORK_INPUT:
            status_line = f"📝 Задача {task.public_id} ждёт ваших правок"
        elif task.status == TaskStatus.RETRY_SCHEDULED:
            status_line = f"🔁 Задача {task.public_id} поставлена на повтор"
        elif task.status in {TaskStatus.FAILED, TaskStatus.DEAD_LETTER}:
            status_line = f"❌ Задача {task.public_id} завершилась ошибкой"

        await self._bot.send_message(
            chat_id=task.author_id,
            text=f"{status_line}\n{render_task_card(task)}",
        )
