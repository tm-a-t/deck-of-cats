from __future__ import annotations

from aiogram import Dispatcher

from app.di import Container
from app.interface.telegram.bot_factory import build_dispatcher
from app.interface.telegram.handlers.chat_agent_handler import build_router as build_chat_agent_router
from app.interface.telegram.handlers.decision_handler import build_router as build_decision_router
from app.interface.telegram.handlers.research_handler import build_router as build_research_router
from app.interface.telegram.handlers.start_handler import build_router as build_start_router
from app.interface.telegram.handlers.status_handler import build_router as build_status_router
from app.interface.telegram.handlers.task_handler import build_router as build_task_router



def build_app_dispatcher(container: Container) -> Dispatcher:
    dispatcher = build_dispatcher(container.bot, container.settings.allowed_user_ids)

    dispatcher.include_router(build_start_router())
    dispatcher.include_router(build_task_router(container.use_cases.submit_change_request))
    dispatcher.include_router(build_research_router(container.use_cases.launch_research_project))
    dispatcher.include_router(
        build_status_router(
            container.use_cases.list_active_tasks,
            container.uow_factory,
            container.orchestrator,
            container.callback_signer,
            container.settings.bot_decision_ttl_seconds,
        )
    )
    dispatcher.include_router(
        build_decision_router(
            container.use_cases.accept_merge_decision,
            container.orchestrator,
            container.uow_factory,
            container.callback_signer,
        )
    )
    dispatcher.include_router(
        build_chat_agent_router(
            container.chat_agent,
            container.use_cases.submit_change_request,
            container.use_cases.list_active_tasks,
            container.uow_factory,
        )
    )

    return dispatcher
