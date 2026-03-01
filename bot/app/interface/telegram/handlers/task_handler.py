from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.application.use_cases.submit_change_request import SubmitChangeRequestUseCase


def build_router(submit_use_case: SubmitChangeRequestUseCase) -> Router:
    router = Router(name="task")

    @router.message(Command("new"))
    async def create_task(message: Message) -> None:
        text = (message.text or "").strip()
        payload = text.replace("/new", "", 1).strip()

        if "|" not in payload:
            await message.answer("Use format: /new <title> | <task text>")
            return

        title, body = [part.strip() for part in payload.split("|", 1)]
        if not title or not body:
            await message.answer("Both title and body are required")
            return

        try:
            task_id = await submit_use_case.execute(
                author_id=message.from_user.id if message.from_user else 0,
                title=title,
                body=body,
            )
        except Exception as exc:  # pragma: no cover - transport-level safeguard
            await message.answer(f"Failed to submit task: {exc}")
            return

        await message.answer(
            f"Task submitted: {task_id}\n"
            "Use /status <task_id> to track progress."
        )

    return router
