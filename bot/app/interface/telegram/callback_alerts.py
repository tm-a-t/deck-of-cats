from __future__ import annotations

CALLBACK_ALERT_MAX_LEN = 180
MESSAGE_DETAILS_MAX_LEN = 3500


def build_callback_alert_text(error: Exception | str, *, fallback: str) -> str:
    text = str(error).strip()
    if not text:
        return fallback
    if len(text) <= CALLBACK_ALERT_MAX_LEN:
        return text
    return f"{text[: CALLBACK_ALERT_MAX_LEN - 3].rstrip()}..."


def build_callback_details_text(prefix: str, error: Exception | str) -> str:
    text = str(error).strip()
    if not text:
        return prefix
    message = f"{prefix}\n{text}"
    if len(message) <= MESSAGE_DETAILS_MAX_LEN:
        return message
    return f"{message[: MESSAGE_DETAILS_MAX_LEN - 3].rstrip()}..."
