from __future__ import annotations

import asyncio
import logging

from app.bootstrap import build_app_dispatcher
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
        "Bot API startup dry_run=%s auto_start=%s worker_loop=%s base_branch=%s",
        settings.bot_dry_run,
        settings.bot_auto_start_tasks,
        settings.bot_enable_worker_loop,
        resolved_base_branch,
    )

    container = build_container(settings)
    dispatcher = build_app_dispatcher(container)

    await dispatcher.start_polling(container.bot)


if __name__ == "__main__":
    asyncio.run(_main())
