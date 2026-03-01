from __future__ import annotations

from contextlib import contextmanager


@contextmanager
def trace_context(correlation_id: str):
    _ = correlation_id
    yield
