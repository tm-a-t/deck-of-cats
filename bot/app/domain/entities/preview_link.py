from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass
class PreviewLink:
    provider: str
    url: str
    ready_at: datetime | None = None
