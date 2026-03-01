from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from app.shared.security import CallbackSigner


def build_decision_request_keyboard(
    public_id: str,
    token: str,
    callback_signer: CallbackSigner,
) -> InlineKeyboardMarkup:
    merge_payload = f"{public_id}|merge|{token}|ask"
    close_payload = f"{public_id}|close|{token}|ask"
    merge_sig = callback_signer.sign(merge_payload)
    close_sig = callback_signer.sign(close_payload)
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ Принять merge",
                    callback_data=f"dec|{public_id}|merge|{token}|{merge_sig}|ask",
                ),
                InlineKeyboardButton(
                    text="❌ Принять close",
                    callback_data=f"dec|{public_id}|close|{token}|{close_sig}|ask",
                ),
            ]
        ]
    )


def build_decision_confirm_keyboard(
    public_id: str,
    decision: str,
    token: str,
    callback_signer: CallbackSigner,
) -> InlineKeyboardMarkup:
    confirm_payload = f"{public_id}|{decision}|{token}|do"
    cancel_payload = f"{public_id}|cancel|{token}|do"
    confirm_sig = callback_signer.sign(confirm_payload)
    cancel_sig = callback_signer.sign(cancel_payload)
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=f"Подтвердить {decision}",
                    callback_data=f"dec|{public_id}|{decision}|{token}|{confirm_sig}|do",
                ),
            ],
            [
                InlineKeyboardButton(
                    text="Отмена",
                    callback_data=f"dec|{public_id}|cancel|{token}|{cancel_sig}|do",
                )
            ],
        ]
    )

