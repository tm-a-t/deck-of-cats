from __future__ import annotations

from aiogram import Bot
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.security import CallbackSigner


class TelegramNotifier:
    def __init__(self, bot: Bot, callback_signer: CallbackSigner) -> None:
        self._bot = bot
        self._callback_signer = callback_signer

    async def notify_task_started(self, task: TaskAggregate) -> None:
        await self._bot.send_message(
            chat_id=task.author_id,
            text=f"Task created: {task.id}\n{task.title}",
        )

    async def notify_step_result(self, task: TaskAggregate, step: str, message: str) -> None:
        await self._bot.send_message(
            chat_id=task.author_id,
            text=f"[{step}] {message or 'completed'}",
        )

    async def notify_decision_required(self, task: TaskAggregate, token: str) -> None:
        short_id = task.id[:8]

        merge_payload = f"{short_id}|merge|{token}"
        close_payload = f"{short_id}|close|{token}"
        merge_sig = self._callback_signer.sign(merge_payload)
        close_sig = self._callback_signer.sign(close_payload)

        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="Merge PR",
                        callback_data=f"dec|{short_id}|merge|{token}|{merge_sig}",
                    ),
                    InlineKeyboardButton(
                        text="Close PR",
                        callback_data=f"dec|{short_id}|close|{token}|{close_sig}",
                    ),
                ]
            ]
        )

        await self._bot.send_message(
            chat_id=task.author_id,
            text=(
                "Decision required\n"
                f"Task: {task.id}\n"
                f"PR: {task.pr_url or '-'}\n"
                f"Preview: {task.preview_url or '-'}"
            ),
            reply_markup=keyboard,
        )

    async def notify_task_finished(self, task: TaskAggregate) -> None:
        await self._bot.send_message(
            chat_id=task.author_id,
            text=f"Task {task.id} finished with status {task.status.value}",
        )
