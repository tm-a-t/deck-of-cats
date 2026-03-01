from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject


logger = logging.getLogger(__name__)


def _short(value: str, limit: int = 180) -> str:
    if len(value) <= limit:
        return value
    return value[: limit - 3] + "..."


class LoggingMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        if isinstance(event, Message):
            user_id = event.from_user.id if event.from_user else None
            chat_id = event.chat.id if event.chat else None
            content = (event.text or event.caption or "").strip()
            logger.info(
                "Incoming telegram message user_id=%s chat_id=%s text=%r",
                user_id,
                chat_id,
                _short(content),
            )
        elif isinstance(event, CallbackQuery):
            user_id = event.from_user.id if event.from_user else None
            logger.info(
                "Incoming telegram callback user_id=%s data=%r",
                user_id,
                _short((event.data or "").strip()),
            )
        return await handler(event, data)
