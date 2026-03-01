from __future__ import annotations

import asyncio
import logging

from app.di import build_container
from app.infrastructure.observability.logger import configure_logging
from app.settings import Settings

logger = logging.getLogger(__name__)


async def _main() -> None:
    settings = Settings()
    configure_logging(settings.bot_log_level)
    logger.info(
        "Worker startup enabled=%s poll_interval=%ss",
        settings.bot_enable_worker_loop,
        settings.bot_poll_interval_seconds,
    )
    container = build_container(settings)

    if not settings.bot_enable_worker_loop:
        logger.info("Worker loop is disabled by BOT_ENABLE_WORKER_LOOP=false")
        return

    while True:
        with container.uow_factory() as uow:
            tasks = uow.tasks.list_active()

        for task in tasks:
            try:
                await container.orchestrator.run_task(task.id)
            except Exception:
                logger.exception("Worker failed while processing task %s", task.id)
                continue

        await asyncio.sleep(settings.bot_poll_interval_seconds)


if __name__ == "__main__":
    asyncio.run(_main())
