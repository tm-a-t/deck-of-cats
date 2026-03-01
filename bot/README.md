# Telegram Dev Bot

Сервис автоматизирует разработческий цикл через Telegram:

1. Получает задачу на изменение проекта.
2. Запускает реализацию через `codex exec`.
3. Запускает отдельную валидацию через `codex exec` (включая Playwright по промпту).
4. Создаёт pull request.
5. Получает фидбек из GitHub по PR.
6. Просит решение `merge/close` у пользователя.

## Локальный запуск

```bash
cd bot
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
python -m app.main_bot_api
python -m app.main_worker
```

Или запустить bot + worker в одном процессе:

```bash
python -m app.main_all_in_one
```

## Telegram команды

- `/start` - приветствие и список команд
- `/help` - как отправлять задачи
- `/new <title> | <task text>` - создать задачу
- `/status <task_id>` - статус задачи
- `/active` - список активных задач

## Smoke test Codex

```bash
cd bot
RUN_CODEX_E2E=1 pytest tests/integration/test_codex_smoke_sum.py -q
```

Тест вызывает реальный `codex exec`, проверяет что создан `sum.py`, что в ответе есть `RESULT: PASS`, и удаляет `sum.py` после проверки.

## Важно

- Это production-oriented каркас с упором на OOP, идемпотентность и расширяемость.
- Для реальной работы нужны токены Telegram/GitHub и доступ к API.
- Для GitHub-интеграции заполни: `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_TOKEN`, `GITHUB_REMOTE_NAME`.
- Шаг preview читает комментарии PR через GitHub API и берет первую найденную ссылку (приоритет у `netlify` ссылок).
- Для merge-стратегии используется `GITHUB_MERGE_METHOD` (`merge|squash|rebase`).
- Если `BOT_AUTO_START_TASKS=true`, задачи стартуют сразу из `bot-api` без ожидания отдельного worker.
- По умолчанию фоновой цикл выключен (`BOT_ENABLE_WORKER_LOOP=false`), чтобы задачи не крутились постоянно.
- Для включения цикла в будущем: поставь `BOT_ENABLE_WORKER_LOOP=true`.
