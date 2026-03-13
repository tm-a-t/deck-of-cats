from __future__ import annotations

from app.interface.telegram.callback_alerts import (
    CALLBACK_ALERT_MAX_LEN,
    MESSAGE_DETAILS_MAX_LEN,
    build_callback_alert_text,
    build_callback_details_text,
)


def test_build_callback_alert_text_truncates_long_errors() -> None:
    text = build_callback_alert_text("x" * 400, fallback="fallback")

    assert len(text) <= CALLBACK_ALERT_MAX_LEN
    assert text.endswith("...")


def test_build_callback_alert_text_uses_fallback_for_empty_text() -> None:
    assert build_callback_alert_text("", fallback="fallback") == "fallback"


def test_build_callback_details_text_keeps_prefix_and_truncates() -> None:
    text = build_callback_details_text("prefix", "x" * 5000)

    assert text.startswith("prefix\n")
    assert len(text) <= MESSAGE_DETAILS_MAX_LEN
    assert text.endswith("...")
