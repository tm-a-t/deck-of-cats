from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.enums import TaskKind, TaskStatus


def build_task_list_keyboard(
    items: list[dict[str, str]],
    page: int = 0,
    has_prev: bool = False,
    has_next: bool = False,
) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    for item in items:
        public_id = item.get("public_id", "")
        kind = item.get("kind", "")
        title = item.get("title", "")
        status = item.get("status", "")
        prefix = "🔎 " if kind == TaskKind.RESEARCH.value else ""
        text = f"{prefix}{public_id} · {status} · {title}"
        if len(text) > 58:
            text = text[:57] + "…"
        rows.append([InlineKeyboardButton(text=text, callback_data=f"task|{public_id}|open")])
    nav_row: list[InlineKeyboardButton] = []
    if has_prev:
        nav_row.append(InlineKeyboardButton(text="⬅️", callback_data=f"tasks|{page - 1}"))
    if has_next:
        nav_row.append(InlineKeyboardButton(text="➡️", callback_data=f"tasks|{page + 1}"))
    if nav_row:
        rows.append(nav_row)
    return InlineKeyboardMarkup(inline_keyboard=rows)


def build_task_card_keyboard(task: TaskAggregate) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = [
        [
            InlineKeyboardButton(text="🔄 Обновить", callback_data=f"task|{task.public_id}|refresh"),
            InlineKeyboardButton(text="🧾 Логи", callback_data=f"task|{task.public_id}|logs"),
        ]
    ]

    if task.status in {TaskStatus.NEW, TaskStatus.RETRY_SCHEDULED, TaskStatus.FAILED}:
        rows.append([InlineKeyboardButton(text="▶️ Запустить", callback_data=f"task|{task.public_id}|run")])

    if task.status == TaskStatus.AWAITING_DECISION:
        rows.append([InlineKeyboardButton(text="⚖️ Решение", callback_data=f"task|{task.public_id}|decision")])
    if task.status == TaskStatus.AWAITING_REWORK_INPUT:
        rows.append([InlineKeyboardButton(text="📝 Отправить правки", callback_data=f"task|{task.public_id}|rework")])

    if task.pr_url:
        rows.append([InlineKeyboardButton(text="🔗 Открыть PR", url=task.pr_url)])
    if task.preview_url:
        rows.append([InlineKeyboardButton(text="🌐 Открыть Preview", url=task.preview_url)])

    return InlineKeyboardMarkup(inline_keyboard=rows)
