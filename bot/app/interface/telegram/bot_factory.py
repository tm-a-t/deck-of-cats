from __future__ import annotations

from aiogram import Bot, Dispatcher

from app.interface.telegram.middlewares.auth_middleware import AuthMiddleware
from app.interface.telegram.middlewares.logging_middleware import LoggingMiddleware


def build_dispatcher(bot: Bot, allowed_users: set[int]) -> Dispatcher:
    dispatcher = Dispatcher()
    dispatcher.message.middleware(LoggingMiddleware())
    dispatcher.callback_query.middleware(LoggingMiddleware())
    dispatcher.message.middleware(AuthMiddleware(allowed_users))
    dispatcher.callback_query.middleware(AuthMiddleware(allowed_users))
    return dispatcher
