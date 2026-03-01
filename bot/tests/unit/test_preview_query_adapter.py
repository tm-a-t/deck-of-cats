from __future__ import annotations

import pytest

from app.domain.aggregates.task_aggregate import TaskAggregate

httpx = pytest.importorskip("httpx")

import app.infrastructure.preview.netlify_query_adapter as preview_module
from app.infrastructure.preview.netlify_query_adapter import NetlifyQueryAdapter


pytestmark = pytest.mark.asyncio


def _task() -> TaskAggregate:
    task = TaskAggregate.create(
        task_id="44444444-4444-4444-4444-444444444444",
        author_id=1,
        title="Preview test",
        body="b",
        correlation_id="c",
    )
    task.pr_url = "https://github.com/octo/deck/pull/44"
    task.pr_number = 44
    return task


def _http_response(method: str, status_code: int, payload: object) -> httpx.Response:
    request = httpx.Request(method, "https://api.github.test/request")
    return httpx.Response(status_code=status_code, json=payload, request=request)


async def test_preview_adapter_falls_back_to_stub_without_github_config() -> None:
    adapter = NetlifyQueryAdapter(poll_interval_seconds=1)

    preview_url = await adapter.wait_preview_url(_task(), timeout_seconds=2)

    assert preview_url == "https://github.com/octo/deck/pull/44#netlify-preview"


async def test_preview_adapter_extracts_netlify_url_from_pr_comments(monkeypatch: pytest.MonkeyPatch) -> None:
    class _FakeAsyncClient:
        def __init__(self, timeout: httpx.Timeout) -> None:
            _ = timeout

        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> bool:
            _ = exc_type, exc, tb
            return False

        async def get(self, url: str, headers: dict[str, str]) -> httpx.Response:
            _ = headers
            if "/issues/" in url:
                return _http_response(
                    method="GET",
                    status_code=200,
                    payload=[{"body": "Preview: https://deploy-preview-44--deck.netlify.app"}],
                )
            return _http_response(method="GET", status_code=200, payload=[{"body": "Some review note"}])

    monkeypatch.setattr(preview_module.httpx, "AsyncClient", _FakeAsyncClient)

    adapter = NetlifyQueryAdapter(
        poll_interval_seconds=1,
        owner="octo",
        repo="deck",
        token="token",
        api_base_url="https://api.github.com",
    )

    preview_url = await adapter.wait_preview_url(_task(), timeout_seconds=2)

    assert preview_url == "https://deploy-preview-44--deck.netlify.app"


async def test_pick_preview_url_strips_netlify_path_and_query() -> None:
    bodies = [
        "Build ready: https://deploy-preview-3--pirate-islands.netlify.app/index.html?from=pr#top",
    ]

    preview_url = NetlifyQueryAdapter._pick_preview_url(bodies, pr_number=3)

    assert preview_url == "https://deploy-preview-3--pirate-islands.netlify.app"


async def test_pick_preview_url_rejects_non_matching_links() -> None:
    bodies = [
        "Random: https://example.com/some-page",
        "Another: https://my-site.netlify.app",
        "Wrong PR: https://deploy-preview-5--pirate-islands.netlify.app",
    ]

    preview_url = NetlifyQueryAdapter._pick_preview_url(bodies, pr_number=3)

    assert preview_url is None
