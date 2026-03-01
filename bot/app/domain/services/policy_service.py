from __future__ import annotations

from dataclasses import dataclass

from app.shared.errors import SecurityViolationError


@dataclass
class PolicyService:
    allowed_user_ids: set[int]

    def ensure_user_allowed(self, user_id: int) -> None:
        if user_id not in self.allowed_user_ids:
            raise SecurityViolationError(f"User {user_id} is not allowed")
