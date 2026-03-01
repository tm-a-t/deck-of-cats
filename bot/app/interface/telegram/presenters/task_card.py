from __future__ import annotations

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.enums import TaskStatus


STATUS_LABELS: dict[TaskStatus, str] = {
    TaskStatus.NEW: "NEW",
    TaskStatus.CODEX_IMPLEMENT_RUNNING: "RUNNING",
    TaskStatus.CODEX_VALIDATE_RUNNING: "RUNNING",
    TaskStatus.PR_CREATING: "RUNNING",
    TaskStatus.AWAITING_PREVIEW: "WAITING",
    TaskStatus.AWAITING_DECISION: "WAITING_DECISION",
    TaskStatus.AWAITING_REWORK_INPUT: "WAITING_REWORK",
    TaskStatus.DECISION_APPLYING: "RUNNING",
    TaskStatus.MERGED: "DONE",
    TaskStatus.CLOSED: "CLOSED",
    TaskStatus.FAILED: "FAILED",
    TaskStatus.RETRY_SCHEDULED: "RETRY",
    TaskStatus.DEAD_LETTER: "FAILED_FINAL",
}


CURRENT_STEP_LABELS: dict[TaskStatus, str] = {
    TaskStatus.NEW: "ожидает запуска",
    TaskStatus.CODEX_IMPLEMENT_RUNNING: "codex implement",
    TaskStatus.CODEX_VALIDATE_RUNNING: "codex validate",
    TaskStatus.PR_CREATING: "создание PR",
    TaskStatus.AWAITING_PREVIEW: "ожидание preview",
    TaskStatus.AWAITING_DECISION: "ожидание решения",
    TaskStatus.AWAITING_REWORK_INPUT: "ожидание ваших правок",
    TaskStatus.DECISION_APPLYING: "применение решения",
    TaskStatus.MERGED: "завершено (merged)",
    TaskStatus.CLOSED: "завершено (closed)",
    TaskStatus.FAILED: "ошибка",
    TaskStatus.RETRY_SCHEDULED: "готов к повтору",
    TaskStatus.DEAD_LETTER: "окончательная ошибка",
}


def short_title(value: str, limit: int = 46) -> str:
    if len(value) <= limit:
        return value
    return value[: limit - 1] + "…"


def render_task_list_row(task: dict[str, str]) -> str:
    public_id = task.get("public_id") or task.get("task_id", "")[:8]
    status = task.get("status", "-")
    title = short_title(task.get("title", ""))
    return f"{public_id} · {status} · {title}"


def render_task_card(task: TaskAggregate) -> str:
    status_label = STATUS_LABELS.get(task.status, task.status.value)
    current = CURRENT_STEP_LABELS.get(task.status, task.status.value)
    pr_value = task.pr_url or "еще не создан"
    preview_value = task.preview_url or "еще не готов"

    lines = [
        f"🧩 Задача {task.public_id} · {status_label}",
        short_title(task.title, limit=96),
        "",
        f"Сейчас: {current}",
        f"PR: {pr_value}",
        f"Preview: {preview_value}",
    ]
    if task.last_error:
        lines.append(f"Ошибка: {short_title(task.last_error, limit=180)}")
    lines.append(f"Обновлено: {task.updated_at.strftime('%Y-%m-%d %H:%M:%S')} UTC")
    return "\n".join(lines)
