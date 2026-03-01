from __future__ import annotations


class Metrics:
    def increment(self, metric: str, value: int = 1) -> None:
        _ = (metric, value)

    def gauge(self, metric: str, value: int | float) -> None:
        _ = (metric, value)
