from __future__ import annotations

import asyncio
import logging

from app.bootstrap import build_app_dispatcher
from app.di import build_container
from app.infrastructure.observability.logger import configure_logging
from app.settings import Settings

logger = logging.getLogger(__name__)


async def _worker_loop(container, poll_interval_seconds: int) -> None:
    while True:
        with container.uow_factory() as uow:
            tasks = uow.tasks.list_active()

        for task in tasks:
            try:
                await container.orchestrator.run_task(task.id)
            except Exception:
                logger.exception("Worker failed while processing task %s", task.id)
        await asyncio.sleep(poll_interval_seconds)


async def _main() -> None:
    settings = Settings()
    configure_logging(settings.bot_log_level)
    logger.info(
        "Bot startup mode dry_run=%s auto_start=%s worker_loop=%s poll_interval=%ss base_branch=%s",
        settings.bot_dry_run,
        settings.bot_auto_start_tasks,
        settings.bot_enable_worker_loop,
        settings.bot_poll_interval_seconds,
        settings.default_base_branch,
    )
    container = build_container(settings)
    dispatcher = build_app_dispatcher(container)

    if settings.bot_enable_worker_loop:
        await asyncio.gather(
            dispatcher.start_polling(container.bot),
            _worker_loop(container, settings.bot_poll_interval_seconds),
        )
        return

    logger.info("Worker loop is disabled by BOT_ENABLE_WORKER_LOOP=false")
    await dispatcher.start_polling(container.bot)


if __name__ == "__main__":
    asyncio.run(_main())
