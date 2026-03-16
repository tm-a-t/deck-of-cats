from __future__ import annotations

from app.application.use_cases.list_active_tasks import ListActiveTasksUseCase
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.persistence.sqlite.uow import SqliteUnitOfWork
from app.interface.telegram.handlers.status_handler import _resolve_task_for_chat


def _add_task(uow_factory, task_id: str, chat_id: int, title: str) -> TaskAggregate:
    task = TaskAggregate.create(
        task_id=task_id,
        author_id=1,
        chat_id=chat_id,
        title=title,
        body=f"Body for {title}",
        correlation_id=f"corr-{task_id}",
    )
    with uow_factory() as uow:
        uow.tasks.add(task)
    return task


def test_list_active_tasks_can_filter_by_chat_id(tmp_path) -> None:
    db_path = tmp_path / "bot.sqlite3"
    uow_factory = lambda: SqliteUnitOfWork(str(db_path))
    _add_task(uow_factory, "11111111-1111-1111-1111-111111111111", 100, "Chat 100 task")
    _add_task(uow_factory, "22222222-2222-2222-2222-222222222222", 200, "Chat 200 task")
    use_case = ListActiveTasksUseCase(uow_factory=uow_factory)

    tasks = use_case.execute(chat_id=100)

    assert [task["public_id"] for task in tasks] == ["T-11111111"]
    assert [task["kind"] for task in tasks] == ["change"]
    assert [task["title"] for task in tasks] == ["Chat 100 task"]


def test_task_repository_short_id_lookup_respects_chat_id(tmp_path) -> None:
    db_path = tmp_path / "bot.sqlite3"
    uow_factory = lambda: SqliteUnitOfWork(str(db_path))
    task = _add_task(uow_factory, "33333333-3333-3333-3333-333333333333", 100, "Scoped task")
    _add_task(uow_factory, "44444444-4444-4444-4444-444444444444", 200, "Other chat task")

    with uow_factory() as uow:
        resolved = uow.tasks.find_by_short_id(task.public_id, chat_id=100)
        hidden = uow.tasks.find_by_short_id(task.public_id, chat_id=200)

    assert resolved is not None
    assert resolved.id == task.id
    assert hidden is None


def test_status_handler_task_resolution_respects_chat_id(tmp_path) -> None:
    db_path = tmp_path / "bot.sqlite3"
    uow_factory = lambda: SqliteUnitOfWork(str(db_path))
    task = _add_task(uow_factory, "55555555-5555-5555-5555-555555555555", 100, "Status scoped task")
    _add_task(uow_factory, "66666666-6666-6666-6666-666666666666", 200, "Other status task")

    visible = _resolve_task_for_chat(uow_factory, task.public_id, chat_id=100)
    hidden = _resolve_task_for_chat(uow_factory, task.public_id, chat_id=200)

    assert visible is not None
    assert visible.id == task.id
    assert hidden is None
