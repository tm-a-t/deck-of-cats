# Telegram Dev Bot: OOP Architecture Plan (Codex-First)

## 1) Главный принцип

Вся инженерная работа выполняется нейросетью Codex через терминальный вызов:

- `codex exec "<prompt>"`

Бот не интерпретирует пользовательский текст как произвольные shell-команды.
Бот выступает оркестратором: принимает задачу в Telegram, формирует промпты для Codex, запускает `codex exec`, анализирует результат, создаёт PR, читает обратную связь по PR из GitHub (checks/comments) и запрашивает решение о merge.

## 2) Цель

Сделать Telegram-бота, который закрывает полный цикл разработки:

1. Пользователь отправляет задачу в Telegram.
2. Бот запускает `codex exec` на реализацию изменений.
3. Бот запускает отдельный `codex exec` на проверку (включая Playwright).
4. Бот сообщает `PASS/FAIL` с кратким отчётом.
5. При `PASS` создаёт PR в `master`.
6. Ждёт обратную связь по PR из GitHub (статусы проверок и комментарии).
7. Отправляет пользователю ссылку и спрашивает `merge или close`.
8. Применяет решение.

## 3) Технологии

- Python 3.12+
- `aiogram 3.x`
- `httpx`
- `pydantic-settings`
- `structlog` + `logging`
- SQLite (MVP), затем PostgreSQL
- GitHub API (GitHub App)
- GitHub Checks API + PR comments API
- Codex CLI (`codex exec`) как обязательная внешняя зависимость

## 4) Архитектурный стиль

- Clean Architecture + DDD-lite.
- Слои: `interface -> application -> domain -> infrastructure`.
- `TaskAggregate` хранит инварианты и transitions.
- Workflow идемпотентен, с lock/retry/resume.
- Все внешние интеграции через порты и адаптеры.

## 5) End-to-End pipeline (только через Codex)

### 5.1 Step A: Implement

Бот формирует prompt:

- контекст репозитория
- задача пользователя
- ограничения (не ломать существующий код, запуск нужных проверок и т.д.)
- требуемый формат финального ответа

И запускает:

- `codex exec "<implementation prompt>"`

### 5.2 Step B: Validate

Бот формирует отдельный prompt для валидации и запускает:

- `codex exec "<validation prompt with Playwright request>"`

Codex обязан вернуть статус в машиночитаемом виде (`PASS/FAIL` + summary).

### 5.3 Step C: PR

Если `PASS`:

- создать ветку
- commit/push
- открыть PR

### 5.4 Step D: GitHub Feedback + Decision

- ждать статусы проверок и комментарии в PR через GitHub API
- отправить пользователю PR + сводку по проверкам/комментариям
- получить `merge/close`
- выполнить действие

## 6) Контракт с Codex (Prompt/Result)

Для стабильного парсинга каждый `codex exec` должен завершаться блоком:

```text
RESULT: PASS|FAIL
SUMMARY: <one line>
DETAILS: <short text>
```

Для имплементации дополнительно:

```text
CHANGED_FILES:
- path/a
- path/b
```

Если формат не распарсился, шаг считается `FAIL` и идёт retry по политике.

## 7) Структура проекта

```text
bot/
  ARCHITECTURE_PLAN.md
  README.md
  pyproject.toml
  .env.example

  app/
    main_bot_api.py
    main_worker.py
    bootstrap.py
    di.py
    settings.py

    interface/
      telegram/
        bot_factory.py
        handlers/
          start_handler.py
          task_handler.py
          status_handler.py
          decision_handler.py
        middlewares/
          auth_middleware.py
          logging_middleware.py

    domain/
      aggregates/
        task_aggregate.py
      entities/
        change_request.py
        pr.py
        pr_feedback.py
      events/
        domain_events.py
      repositories/
        task_repository.py
        step_execution_repository.py

    application/
      use_cases/
        submit_change_request.py
        request_task_status.py
        accept_merge_decision.py
      workflows/
        dev_cycle_workflow.py
        steps/
          codex_implement_step.py
          codex_validate_step.py
          pr_step.py
          pr_feedback_step.py
          decision_step.py
      orchestrators/
        dev_cycle_orchestrator.py
      ports/
        codex_exec_port.py
        vcs/
          branch_port.py
          pr_port.py
          merge_port.py
          checks_port.py
          comments_port.py
        notifier_port.py
        unit_of_work.py
        lock_port.py
        outbox_port.py

    infrastructure/
      codex/
        codex_cli_adapter.py
        prompt_builder.py
        result_parser.py
      vcs/
        github_branch_adapter.py
        github_pr_adapter.py
        github_merge_adapter.py
        github_checks_adapter.py
        github_comments_adapter.py
      execution/
        worktree_manager.py
        process_runner.py
      persistence/
        sqlite/
          models.py
          task_repository_impl.py
          step_execution_repository_impl.py
          outbox_repository_impl.py
          lock_repository_impl.py
          uow.py
      notifier/
        telegram_notifier.py
      observability/
        logger.py

  tests/
    unit/
    integration/
```

## 8) Что делает каждый ключевой модуль

- `codex_cli_adapter.py`: единственная точка запуска `codex exec`.
- `prompt_builder.py`: шаблоны промптов (implement, validate, review, auto-generation).
- `result_parser.py`: парсит `RESULT/SUMMARY/DETAILS/CHANGED_FILES`.
- `codex_implement_step.py`: вызывает Codex для внесения изменений.
- `codex_validate_step.py`: вызывает Codex для проверки изменений и Playwright.
- `pr_feedback_step.py`: получает статусы проверок и комментарии PR из GitHub.
- `dev_cycle_orchestrator.py`: state machine, retry, lock heartbeat, уведомления.
- `task_aggregate.py`: инварианты статусов и управление decision lifecycle.

## 9) Машина состояний

- `NEW`
- `CODEX_IMPLEMENT_RUNNING`
- `CODEX_VALIDATE_RUNNING`
- `PR_CREATING`
- `AWAITING_GITHUB_FEEDBACK`
- `AWAITING_DECISION`
- `DECISION_APPLYING`
- `MERGED`
- `CLOSED`
- `FAILED`
- `RETRY_SCHEDULED`
- `DEAD_LETTER`

## 10) Модель данных

- `tasks`: id, author_id, title, body, status, version, correlation_id, created_at, updated_at
- `step_executions`: task_id, step, attempt, status, idempotency_key, started_at, ended_at, error_code, error_payload
- `codex_runs`: task_id, step, command_line, prompt_hash, stdout_path, stderr_path, exit_code, parsed_result
- `pull_requests`: task_id, provider, pr_number, url, state
- `pr_feedback_events`: task_id, check_name, check_status, check_conclusion, comment_author, comment_body, captured_at
- `decisions`: task_id, user_id, decision, decision_token_hash, expires_at, decided_at
- `outbox_events`: aggregate_id, event_type, payload, published_at
- `locks`: key, owner, lock_until

## 11) Безопасность

- Пользовательские сообщения не выполняются как shell.
- Разрешён только сценарий запуска Codex: `codex exec "..."`.
- Промпт в `codex exec` формируется ботом по шаблону (не сырой passthrough).
- Callback-data (`merge/close`) подписана HMAC.
- ACL по Telegram user id.
- Audit trail по всем вызовам Codex и decision шагам.

## 12) Надёжность

- `UnitOfWork + Outbox`
- Lease-lock + heartbeat
- Retry/backoff/jitter
- Resume после рестарта
- Оптимистичная блокировка (`version`) на update task
- Разделение decision на 2 фазы:
  1. `AWAITING_DECISION -> DECISION_APPLYING`
  2. внешний merge/close
  3. `DECISION_APPLYING -> MERGED/CLOSED` или rollback в `AWAITING_DECISION`

## 13) Telegram UX

- `/new <title> | <требование>`
- `/status <task_id>`
- `/active`
- Inline-кнопки: `Merge PR`, `Close PR`, `Rerun validation`

## 14) Расширение: авто-генерация паков карт

Через отдельный cron-workflow, где тоже всё делает Codex:

1. `codex exec` на генерацию идей карт.
2. `codex exec` на баланс-валидацию и тесты.
3. Автосоздание PR.
4. Автопринятие только по quality gates.

## 15) План внедрения

### Этап 1 (MVP)

1. Codex CLI adapter + prompt templates + parser.
2. Steps: implement/validate через `codex exec`.
3. PR + GitHub feedback + decision через Telegram.

### Этап 2 (надежность)

1. UoW/outbox/locks/retry/resume.
2. Полный audit и trace по Codex runs.
3. Улучшение decision safety.

### Этап 3 (масштаб)

1. PostgreSQL.
2. Мульти-инстанс worker.
3. Авто-режим генерации паков карт через Codex.

## 16) Definition of Done v1

- Каждое изменение делается через `codex exec`.
- Каждая проверка (включая Playwright) инициируется через `codex exec`.
- Бот выдаёт понятный `PASS/FAIL` и отчёт в Telegram.
- PR + GitHub checks/comments + merge/close работают end-to-end.
- Архитектура готова к авто-режиму генерации контента.
