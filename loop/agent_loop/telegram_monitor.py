from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path
from typing import Callable
from urllib import parse, request
from urllib.error import HTTPError, URLError

from loop.agent_loop.logging_utils import emit_log


TELEGRAM_MESSAGE_LIMIT = 3900
DEFAULT_TIMEOUT_SECONDS = 8.0


class TelegramNotificationError(RuntimeError):
    """Raised when a Telegram notification cannot be delivered."""


TelegramTransport = Callable[[str, dict[str, object], float], dict[str, object]]


def compact_text(value: object, limit: int = 280) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 3)].rstrip() + "..."


def compact_list(items: list[object] | tuple[object, ...] | None, limit: int = 5) -> str:
    values = [compact_text(item, 80) for item in (items or []) if str(item or "").strip()]
    if not values:
        return "none"
    shown = values[:limit]
    suffix = f" and {len(values) - limit} more" if len(values) > limit else ""
    return ", ".join(shown) + suffix


def truncate_message(text: str, limit: int = TELEGRAM_MESSAGE_LIMIT) -> str:
    cleaned = str(text or "").strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: max(0, limit - 3)].rstrip() + "..."


def sanitize_error(error: object, token: str) -> str:
    text = compact_text(error, 500)
    if token:
        text = text.replace(token, "<redacted-token>")
    return text


def _default_transport(url: str, payload: dict[str, object], timeout_seconds: float) -> dict[str, object]:
    data = parse.urlencode(payload, encoding="utf-8").encode("utf-8")
    req = request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded; charset=utf-8"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=timeout_seconds) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8", errors="replace")
        except Exception:  # noqa: BLE001 - best-effort diagnostic from Telegram.
            detail = str(exc.reason)
        raise TelegramNotificationError(f"Telegram API HTTP {exc.code}: {compact_text(detail)}") from exc
    except URLError as exc:
        raise TelegramNotificationError(f"Telegram API network error: {exc.reason}") from exc

    try:
        body = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise TelegramNotificationError("Telegram API returned invalid JSON") from exc

    if not body.get("ok"):
        description = body.get("description") or "request failed"
        raise TelegramNotificationError(f"Telegram API rejected message: {compact_text(description)}")
    return body


@dataclass
class TelegramMonitor:
    bot_token: str
    chat_id: str
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    transport: TelegramTransport = _default_transport

    @classmethod
    def from_env(
        cls,
        environ: dict[str, str] | None = None,
        *,
        transport: TelegramTransport = _default_transport,
    ) -> "TelegramMonitor | None":
        env = os.environ if environ is None else environ
        bot_token = env.get("TELEGRAM_BOT_TOKEN", "").strip()
        chat_id = env.get("TELEGRAM_ADMIN_CHAT_ID", "").strip()
        if not bot_token or not chat_id:
            return None
        return cls(bot_token=bot_token, chat_id=chat_id, transport=transport)

    def send_message(self, text: str) -> None:
        payload = {
            "chat_id": self.chat_id,
            "text": truncate_message(text),
            "disable_web_page_preview": "true",
        }
        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        try:
            self.transport(url, payload, self.timeout_seconds)
        except Exception as exc:  # noqa: BLE001 - notification boundary must not leak secrets.
            raise TelegramNotificationError(sanitize_error(exc, self.bot_token)) from exc

    def safe_send(
        self,
        run_dir: Path | None,
        text: str,
        *,
        reason: str,
        log_failure: bool = True,
    ) -> bool:
        try:
            self.send_message(text)
            return True
        except TelegramNotificationError as exc:
            if log_failure and run_dir is not None:
                emit_log(
                    run_dir,
                    "telegram_notification_failed",
                    "Telegram update was not sent",
                    reason=reason,
                    error=sanitize_error(exc, self.bot_token),
                )
            return False
