from __future__ import annotations

from app.interface.telegram.keyboards.main_menu_keyboard import (
    HELP_BUTTON,
    MENU_BUTTON,
    NEW_TASK_BUTTON,
    OPEN_TASKS_BUTTON,
)


SYSTEM_MENU_TEXTS = {
    OPEN_TASKS_BUTTON,
    HELP_BUTTON,
    MENU_BUTTON,
    NEW_TASK_BUTTON,
}
SYSTEM_MENU_COMMANDS = ("/tasks", "/active", "/status", "/task", "/start", "/help", "/new")


def is_command_message(text: str, command: str) -> bool:
    first_token = text.split(maxsplit=1)[0]
    return first_token == command or first_token.startswith(f"{command}@")


def is_system_menu_input(text: str) -> bool:
    value = text.strip()
    if not value:
        return False
    if value in SYSTEM_MENU_TEXTS:
        return True
    lowered = value.lower()
    return any(is_command_message(lowered, command) for command in SYSTEM_MENU_COMMANDS)


def derive_title_from_body(body: str, limit: int = 64) -> str:
    normalized = " ".join(body.split()).strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip() + "…"
