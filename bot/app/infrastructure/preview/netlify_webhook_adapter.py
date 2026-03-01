from __future__ import annotations

import hashlib
import hmac


class NetlifyWebhookAdapter:
    def __init__(self, secret: str) -> None:
        self._secret = secret.encode("utf-8")

    async def verify_signature(self, payload: bytes, signature: str) -> bool:
        digest = hmac.new(self._secret, payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(digest, signature)
