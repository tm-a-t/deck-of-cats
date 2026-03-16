from __future__ import annotations

from aiogram.types import KeyboardButton, ReplyKeyboardMarkup

NEW_TASK_BUTTON = "➕ Новая задача"
RESEARCH_BUTTON = "🔎 Research"
OPEN_TASKS_BUTTON = "📂 Открытые задачи"
HELP_BUTTON = "❓ Помощь"
CANCEL_BUTTON = "↩️ Отмена"
MENU_BUTTON = "🏠 Меню"


def build_main_menu_keyboard(include_cancel: bool = False) -> ReplyKeyboardMarkup:
    rows = [
        [KeyboardButton(text=NEW_TASK_BUTTON), KeyboardButton(text=RESEARCH_BUTTON)],
        [KeyboardButton(text=OPEN_TASKS_BUTTON), KeyboardButton(text=HELP_BUTTON)],
        [KeyboardButton(text=MENU_BUTTON)],
    ]
    if include_cancel:
        rows.append([KeyboardButton(text=CANCEL_BUTTON)])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True, is_persistent=True)
