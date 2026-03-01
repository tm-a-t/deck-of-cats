from __future__ import annotations

from aiogram import F, Router
from aiogram.dispatcher.event.bases import SkipHandler
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from app.application.use_cases.submit_change_request import SubmitChangeRequestUseCase
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.interface.telegram.fsm.states import TaskStates
from app.interface.telegram.keyboards.main_menu_keyboard import (
    CANCEL_BUTTON,
    HELP_BUTTON,
    MENU_BUTTON,
    NEW_TASK_BUTTON,
    OPEN_TASKS_BUTTON,
    build_main_menu_keyboard,
)


SYSTEM_MENU_TEXTS = {
    OPEN_TASKS_BUTTON,
    HELP_BUTTON,
    MENU_BUTTON,
    NEW_TASK_BUTTON,
}
SYSTEM_MENU_COMMANDS = ("/tasks", "/active", "/status", "/task", "/start", "/help", "/new")


def _is_command_message(text: str, command: str) -> bool:
    first_token = text.split(maxsplit=1)[0]
    return first_token == command or first_token.startswith(f"{command}@")


def _is_system_menu_input(text: str) -> bool:
    value = text.strip()
    if not value:
        return False
    if value in SYSTEM_MENU_TEXTS:
        return True
    lowered = value.lower()
    return any(_is_command_message(lowered, command) for command in SYSTEM_MENU_COMMANDS)


def _derive_title_from_body(body: str, limit: int = 64) -> str:
    normalized = " ".join(body.split()).strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip() + "…"


def build_router(submit_use_case: SubmitChangeRequestUseCase) -> Router:
    router = Router(name="task")

    async def _create_task(message: Message, title: str, body: str) -> None:
        user = message.from_user
        try:
            task_id = await submit_use_case.execute(
                author_id=user.id if user else 0,
                title=title,
                body=body,
                author_username=user.username if user else None,
                author_display_name=user.full_name if user else None,
            )
        except Exception as exc:  # pragma: no cover - transport-level safeguard
            await message.answer(f"Failed to submit task: {exc}")
            return

        public_id = TaskAggregate.derive_public_id(task_id)
        await message.answer(
            f"Задача отправлена: {public_id}\n"
            "Открой список: «📂 Открытые задачи»",
            reply_markup=build_main_menu_keyboard(),
        )

    async def _start_new_flow(message: Message, state: FSMContext) -> None:
        await state.clear()
        await state.set_state(TaskStates.awaiting_task_text)
        await message.answer(
            "Введи описание задачи (шаг 1/1). Заголовок не нужен.",
            reply_markup=build_main_menu_keyboard(include_cancel=True),
        )

    @router.message(Command("new"))
    @router.message(F.text == NEW_TASK_BUTTON)
    async def create_task(message: Message, state: FSMContext) -> None:
        text = (message.text or "").strip()
        payload = ""
        if text.startswith("/"):
            parts = text.split(maxsplit=1)
            command_token = parts[0].lower()
            if _is_command_message(command_token, "/new") and len(parts) > 1:
                payload = parts[1].strip()

        if not payload:
            await _start_new_flow(message, state)
            return

        # Fast-path /new <title>|<body> should always reset stale FSM session.
        await state.clear()
        if "|" in payload:
            left, right = [part.strip() for part in payload.split("|", 1)]
            body = right or left
        else:
            body = payload.strip()

        if not body:
            await message.answer("Нужно описание задачи. Формат: /new <task text>.")
            return

        title = _derive_title_from_body(body)
        await _create_task(message, title=title, body=body)

    @router.message(TaskStates.awaiting_title)
    async def receive_title(message: Message, state: FSMContext) -> None:
        text = (message.text or "").strip()
        if text == CANCEL_BUTTON:
            await state.clear()
            await message.answer("Создание задачи отменено.", reply_markup=build_main_menu_keyboard())
            return
        if _is_system_menu_input(text):
            await state.clear()
            raise SkipHandler()
        await state.set_state(TaskStates.awaiting_task_text)
        await message.answer("Заголовок больше не нужен. Введи описание задачи.")

    @router.message(TaskStates.awaiting_task_text)
    async def receive_body(message: Message, state: FSMContext) -> None:
        body = (message.text or "").strip()
        if body == CANCEL_BUTTON:
            await state.clear()
            await message.answer("Создание задачи отменено.", reply_markup=build_main_menu_keyboard())
            return
        if _is_system_menu_input(body):
            await state.clear()
            raise SkipHandler()
        if not body:
            await message.answer("Описание не должно быть пустым. Введи описание задачи.")
            return

        title = _derive_title_from_body(body)
        await _create_task(message, title=title, body=body)
        await state.clear()

    return router
