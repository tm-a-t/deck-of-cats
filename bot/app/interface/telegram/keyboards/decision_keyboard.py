from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


def build_decision_keyboard(merge_payload: str, close_payload: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Merge PR", callback_data=merge_payload),
                InlineKeyboardButton(text="Close PR", callback_data=close_payload),
            ]
        ]
    )
