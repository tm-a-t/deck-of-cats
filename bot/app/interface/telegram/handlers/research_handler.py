from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import Message

from app.application.use_cases.launch_research_project import LaunchResearchProjectUseCase
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.interface.telegram.keyboards.main_menu_keyboard import RESEARCH_BUTTON, build_main_menu_keyboard


def build_router(launch_research_use_case: LaunchResearchProjectUseCase) -> Router:
    router = Router(name="research")

    @router.message(Command("research"))
    @router.message(F.text == RESEARCH_BUTTON)
    async def launch_research(message: Message) -> None:
        user = message.from_user
        try:
            task_id = await launch_research_use_case.execute(
                author_id=user.id if user else 0,
                chat_id=message.chat.id,
                author_username=user.username if user else None,
                author_display_name=user.full_name if user else None,
            )
        except Exception as exc:  # pragma: no cover - transport-level safeguard
            await message.answer(f"Не удалось запустить research: {exc}", reply_markup=build_main_menu_keyboard())
            return

        public_id = TaskAggregate.derive_public_id(task_id)
        await message.answer(
            "Запускаю отдельный research-проект по логам, поведению бота и недостающим фичам.\n"
            f"Задача: {public_id}\n"
            "Когда research завершится, открой задачу и логи для полного отчёта.",
            reply_markup=build_main_menu_keyboard(),
        )

    return router
