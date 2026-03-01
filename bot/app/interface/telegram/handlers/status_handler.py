from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.application.use_cases.list_active_tasks import ListActiveTasksUseCase
from app.application.use_cases.request_task_status import RequestTaskStatusUseCase
from app.shared.errors import NotFoundError


def build_router(
    request_status_use_case: RequestTaskStatusUseCase,
    list_active_use_case: ListActiveTasksUseCase,
) -> Router:
    router = Router(name="status")

    @router.message(Command("status"))
    async def status(message: Message) -> None:
        parts = (message.text or "").split()
        if len(parts) < 2:
            await message.answer("Use format: /status <task_id>")
            return

        task_id = parts[1].strip()
        try:
            data = request_status_use_case.execute(task_id)
        except NotFoundError as exc:
            await message.answer(str(exc))
            return

        await message.answer(
            f"Task: {data['task_id']}\n"
            f"Title: {data['title']}\n"
            f"Status: {data['status']}\n"
            f"PR: {data['pr_url'] or '-'}\n"
            f"Preview: {data['preview_url'] or '-'}\n"
            f"Error: {data['last_error'] or '-'}"
        )

    @router.message(Command("active"))
    async def active(message: Message) -> None:
        tasks = list_active_use_case.execute()
        if not tasks:
            await message.answer("No active tasks")
            return

        lines = [f"{item['task_id']} | {item['status']} | {item['title']}" for item in tasks]
        await message.answer("Active tasks:\n" + "\n".join(lines))

    return router
