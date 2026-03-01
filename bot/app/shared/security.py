from __future__ import annotations

import hashlib
import hmac


class CallbackSigner:
    def __init__(self, secret: str) -> None:
        self._secret = secret.encode("utf-8")

    def sign(self, payload: str) -> str:
        digest = hmac.new(self._secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()
        return digest[:10]

    def verify(self, payload: str, signature: str) -> bool:
        return hmac.compare_digest(self.sign(payload), signature)
