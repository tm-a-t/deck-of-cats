from __future__ import annotations

from collections.abc import Callable

from aiogram import F, Router
from aiogram.types import Message

from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.list_active_tasks import ListActiveTasksUseCase
from app.application.use_cases.submit_change_request import SubmitChangeRequestUseCase
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.codex.chat_agent_adapter import ChatAgentAdapterError, ChatAgentRequest, CodexChatAgentAdapter
from app.infrastructure.codex.chat_agent_parser import ChatAgentAction
from app.interface.telegram.keyboards.main_menu_keyboard import build_main_menu_keyboard
from app.interface.telegram.message_utils import derive_title_from_body, is_system_menu_input
from app.interface.telegram.presenters.task_card import render_task_card, render_task_list_row


LOG_CHUNK_SIZE = 3500


def build_router(
    chat_agent: CodexChatAgentAdapter,
    submit_use_case: SubmitChangeRequestUseCase,
    list_active_use_case: ListActiveTasksUseCase,
    uow_factory: Callable[[], UnitOfWork],
) -> Router:
    router = Router(name="chat-agent")

    def _chunk_text(text: str, max_len: int = LOG_CHUNK_SIZE) -> list[str]:
        normalized = text.strip()
        if not normalized:
            return [""]
        if len(normalized) <= max_len:
            return [normalized]

        chunks: list[str] = []
        remaining = normalized
        while remaining:
            if len(remaining) <= max_len:
                chunks.append(remaining)
                break

            split_at = remaining.rfind("\n", 0, max_len)
            if split_at < max_len // 2:
                split_at = remaining.rfind(" ", 0, max_len)
            if split_at <= 0:
                split_at = max_len

            chunks.append(remaining[:split_at].rstrip())
            remaining = remaining[split_at:].lstrip("\n ")
        return chunks

    def _resolve_task(ref: str | None, chat_id: int) -> TaskAggregate | None:
        normalized_ref = (ref or "").strip()
        with uow_factory() as tx:
            if normalized_ref:
                task = tx.tasks.get(normalized_ref)
                if task is not None and task.chat_id == chat_id:
                    return task
                task = tx.tasks.find_by_short_id(normalized_ref, chat_id=chat_id)
                return task

            active_tasks = tx.tasks.list_active(chat_id=chat_id)
            return active_tasks[0] if active_tasks else None

    def _load_log_text(task: TaskAggregate) -> str:
        with uow_factory() as tx:
            latest_payload = tx.step_executions.get_latest_error_payload(task.id)
        return latest_payload or task.last_error or "Подробные логи пока не сохранены."

    @router.message(F.text)
    async def chat_agent_message(message: Message) -> None:
        text = (message.text or "").strip()
        if not text or text.startswith("/") or is_system_menu_input(text):
            return

        active_tasks = list_active_use_case.execute(chat_id=message.chat.id)
        try:
            decision = await chat_agent.plan(
                ChatAgentRequest(
                    chat_id=message.chat.id,
                    user_message=text,
                    active_tasks=active_tasks[:20],
                )
            )
        except ChatAgentAdapterError as exc:
            await message.answer(
                "Не смог обработать сообщение через chat-agent.\n"
                f"Ошибка: {exc}",
                reply_markup=build_main_menu_keyboard(),
            )
            return

        if decision.action == ChatAgentAction.CREATE_TASK:
            body_en = decision.body_en.strip()
            if not body_en:
                await message.answer(
                    "Нужно чуть точнее сформулировать задачу. Попробуй одним сообщением описать цель, ограничения и ожидаемый результат.",
                    reply_markup=build_main_menu_keyboard(),
                )
                return

            user = message.from_user
            title_en = decision.title_en.strip() or derive_title_from_body(body_en, limit=80)
            try:
                task_id = await submit_use_case.execute(
                    author_id=user.id if user else 0,
                    chat_id=message.chat.id,
                    title=title_en,
                    body=body_en,
                    author_username=user.username if user else None,
                    author_display_name=user.full_name if user else None,
                    notify_started=False,
                    start_immediately=True,
                )
            except Exception as exc:  # pragma: no cover - transport-level safeguard
                await message.answer(f"Не удалось создать задачу: {exc}", reply_markup=build_main_menu_keyboard())
                return

            public_id = TaskAggregate.derive_public_id(task_id)
            lead_in = decision.reply_text or "Сформировал задачу и перевёл требования на английский."
            await message.answer(
                f"{lead_in}\n"
                f"Задача: {public_id}\n"
                "Запуск поставлен в очередь. Дальше я буду писать статусы сюда.",
                reply_markup=build_main_menu_keyboard(),
            )
            return

        if decision.action == ChatAgentAction.LIST_TASKS:
            if not active_tasks:
                await message.answer("Сейчас нет открытых задач.", reply_markup=build_main_menu_keyboard())
                return

            rows = active_tasks[:10]
            lines = [render_task_list_row(item) for item in rows]
            prefix = f"{decision.reply_text}\n" if decision.reply_text else ""
            await message.answer(
                prefix + "📂 Открытые задачи:\n" + "\n".join(lines),
                reply_markup=build_main_menu_keyboard(),
            )
            return

        if decision.action == ChatAgentAction.SHOW_TASK:
            task = _resolve_task(decision.task_ref, chat_id=message.chat.id)
            if task is None:
                await message.answer("Не нашёл подходящую задачу.", reply_markup=build_main_menu_keyboard())
                return
            prefix = f"{decision.reply_text}\n" if decision.reply_text else ""
            await message.answer(prefix + render_task_card(task), reply_markup=build_main_menu_keyboard())
            return

        if decision.action == ChatAgentAction.SHOW_LOGS:
            task = _resolve_task(decision.task_ref, chat_id=message.chat.id)
            if task is None:
                await message.answer(
                    "Не нашёл задачу, для которой можно показать логи.",
                    reply_markup=build_main_menu_keyboard(),
                )
                return
            intro = decision.reply_text or f"Показываю логи для {task.public_id}."
            await message.answer(intro, reply_markup=build_main_menu_keyboard())
            for index, chunk in enumerate(_chunk_text(_load_log_text(task))):
                suffix = "" if index == 0 else " (продолжение)"
                await message.answer(f"🧾 {task.public_id}{suffix}\n{chunk}")
            return

        if decision.action == ChatAgentAction.HELP:
            help_text = decision.reply_text or (
                "Я могу принять задачу обычным сообщением, показать открытые задачи, статус и логи. "
                "Если пишешь новую задачу, я сам структурирую требования на английском и создам запуск."
            )
            await message.answer(help_text, reply_markup=build_main_menu_keyboard())
            return

        reply_text = decision.reply_text or (
            "Могу принять новую задачу, показать открытые задачи, статус конкретной задачи или её логи."
        )
        await message.answer(reply_text, reply_markup=build_main_menu_keyboard())

    return router
