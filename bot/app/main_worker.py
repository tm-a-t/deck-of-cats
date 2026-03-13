from __future__ import annotations

import asyncio
import logging

from app.di import build_container
from app.infrastructure.observability.logger import configure_logging
from app.infrastructure.vcs.base_branch_resolver import resolve_base_branch
from app.settings import Settings

logger = logging.getLogger(__name__)


async def _main() -> None:
    settings = Settings()
    configure_logging(settings.bot_log_level)
    resolved_base_branch = resolve_base_branch(
        settings.repo_path,
        settings.default_base_branch,
        settings.bot_use_current_branch,
    )
    logger.info(
        "Worker startup poll_interval=%ss configured_enabled=%s base_branch=%s",
        settings.bot_poll_interval_seconds,
        settings.bot_enable_worker_loop,
        resolved_base_branch,
    )
    if not settings.bot_enable_worker_loop:
        logger.warning("BOT_ENABLE_WORKER_LOOP=false is ignored in main_worker entrypoint; loop will run")
    container = build_container(settings)

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
