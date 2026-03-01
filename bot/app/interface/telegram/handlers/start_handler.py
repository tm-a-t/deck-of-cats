from __future__ import annotations

from aiogram import Router
from aiogram.filters import Command, CommandStart
from aiogram.types import Message


def build_router() -> Router:
    router = Router(name="start")

    @router.message(CommandStart())
    async def start(message: Message) -> None:
        await message.answer(
            "Dev bot ready.\n"
            "Commands:\n"
            "/new <title> | <task text>\n"
            "/status <task_id>\n"
            "/active\n"
            "/help"
        )

    @router.message(Command("help"))
    async def help_cmd(message: Message) -> None:
        await message.answer(
            "Usage:\n"
            "/new <title> | <task text>\n"
            "Example:\n"
            "/new Add sum utility | Create sum.py with sum_two(a, b)\n\n"
            "/status <task_id> - show current task status\n"
            "/active - list active tasks\n"
            "Merge/Close is handled by inline buttons when decision is required."
        )

    return router
