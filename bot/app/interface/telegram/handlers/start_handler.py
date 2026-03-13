from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import Message

from app.interface.telegram.keyboards.main_menu_keyboard import (
    HELP_BUTTON,
    MENU_BUTTON,
    build_main_menu_keyboard,
)


def build_router() -> Router:
    router = Router(name="start")

    @router.message(CommandStart())
    async def start(message: Message) -> None:
        await message.answer(
            "Dev bot ready.\n"
            "Можешь просто писать в чат обычным текстом.\n"
            "Я сам пойму: это новая задача, запрос статуса, список задач или просьба показать логи.\n"
            "Кнопки внизу остаются как fallback.",
            reply_markup=build_main_menu_keyboard(),
        )

    @router.message(Command("help"))
    @router.message(F.text == HELP_BUTTON)
    async def help_cmd(message: Message) -> None:
        await message.answer(
            "Как пользоваться:\n"
            "• Просто напиши задачу обычным сообщением — я переведу и структурирую её для пайплайна\n"
            "• Напиши «какие задачи открыты», «статус T-XXXXXXX» или «логи T-XXXXXXX»\n"
            "• «➕ Новая задача» — пошаговое создание\n"
            "• «📂 Открытые задачи» — список и карточки\n"
            "• В карточке: «Обновить», «Логи», «Запустить», «Решение»\n"
            "• Merge/Close делается кнопками через подтверждение\n\n"
            "Slash-команды оставлены только как fallback.",
            reply_markup=build_main_menu_keyboard(),
        )

    @router.message(F.text == MENU_BUTTON)
    async def menu(message: Message) -> None:
        await message.answer(
            "Главное меню. Выбери действие кнопкой ниже.",
            reply_markup=build_main_menu_keyboard(),
        )

    return router
