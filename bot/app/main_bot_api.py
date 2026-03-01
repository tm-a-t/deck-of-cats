from __future__ import annotations

import asyncio
import logging

from app.bootstrap import build_app_dispatcher
from app.di import build_container
from app.infrastructure.observability.logger import configure_logging
from app.settings import Settings

logger = logging.getLogger(__name__)


async def _main() -> None:
    settings = Settings()
    configure_logging(settings.bot_log_level)
    logger.info(
        "Bot API startup dry_run=%s auto_start=%s worker_loop=%s",
        settings.bot_dry_run,
        settings.bot_auto_start_tasks,
        settings.bot_enable_worker_loop,
    )

    container = build_container(settings)
    dispatcher = build_app_dispatcher(container)

    await dispatcher.start_polling(container.bot)


if __name__ == "__main__":
    asyncio.run(_main())
