from __future__ import annotations

from typing import Protocol


class PreviewWebhookPort(Protocol):
    async def verify_signature(self, payload: bytes, signature: str) -> bool:
        ...
