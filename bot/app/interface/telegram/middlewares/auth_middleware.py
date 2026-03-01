from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject


class AuthMiddleware(BaseMiddleware):
    def __init__(self, allowed_users: set[int]) -> None:
        self._allowed_users = allowed_users

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        user_id = None
        if isinstance(event, Message) and event.from_user:
            user_id = event.from_user.id
        elif isinstance(event, CallbackQuery) and event.from_user:
            user_id = event.from_user.id

        if user_id is None or user_id not in self._allowed_users:
            if isinstance(event, Message):
                await event.answer("Access denied")
            elif isinstance(event, CallbackQuery):
                await event.answer("Access denied", show_alert=True)
            return None

        return await handler(event, data)
