from __future__ import annotations

import pytest

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.execution.sandbox_runner import CommandResult
from app.shared.errors import ExternalIntegrationError

httpx = pytest.importorskip("httpx")

import app.infrastructure.vcs.github_merge_adapter as merge_module
import app.infrastructure.vcs.github_pr_adapter as pr_module
from app.infrastructure.vcs.github_merge_adapter import GithubMergeAdapter
from app.infrastructure.vcs.github_pr_adapter import GithubPullRequestAdapter


pytestmark = pytest.mark.asyncio


def _task() -> TaskAggregate:
    return TaskAggregate.create(
        task_id="33333333-3333-3333-3333-333333333333",
        author_id=1,
        title="Add feature",
        body="Implement feature details",
        correlation_id="corr-1",
    )


class _FakeRunner:
    def __init__(self, staged_returncode: int = 1) -> None:
        self._staged_returncode = staged_returncode
        self.commands: list[str] = []

    async def run(self, command: str, cwd: str, timeout_seconds: int) -> CommandResult:
        _ = cwd, timeout_seconds
        self.commands.append(command)
        if command == "git diff --cached --quiet":
            return CommandResult(command=command, returncode=self._staged_returncode, stdout="", stderr="")
        return CommandResult(command=command, returncode=0, stdout="", stderr="")


class _FakeWorktreeManager:
    def create(self, task_id: str) -> tuple[str, str]:
        _ = task_id
        return ("/tmp/worktree", "bot/task-33333333")


def _http_response(method: str, status_code: int, payload: object) -> httpx.Response:
    request = httpx.Request(method, "https://api.github.test/request")
    return httpx.Response(status_code=status_code, json=payload, request=request)


async def test_github_pr_adapter_dry_run_runs_git_and_returns_compare_url() -> None:
    runner = _FakeRunner(staged_returncode=1)
    adapter = GithubPullRequestAdapter(
        owner="octo",
        repo="deck",
        token="token",
        api_base_url="https://api.github.com",
        remote_name="origin",
        base_branch="master",
        git_author_name="Codex Bot",
        git_author_email="codex@example.com",
        dry_run=True,
        runner=runner,
        worktree_manager=_FakeWorktreeManager(),
        timeout_seconds=30,
    )

    pr = await adapter.create_pr(_task(), "bot/task-33333333")

    assert pr.url.endswith("/compare/bot/task-33333333?expand=1")
    assert not any(cmd.startswith("git push --set-upstream origin") for cmd in runner.commands)
    assert any(cmd.startswith("git commit -m") for cmd in runner.commands)


async def test_github_pr_adapter_creates_pr_via_api(monkeypatch: pytest.MonkeyPatch) -> None:
    class _FakeAsyncClient:
        post_calls: list[tuple[str, dict[str, str], dict[str, str]]] = []

        def __init__(self, timeout: httpx.Timeout) -> None:
            _ = timeout

        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> bool:
            _ = exc_type, exc, tb
            return False

        async def post(self, url: str, headers: dict[str, str], json: dict[str, str]) -> httpx.Response:
            self.post_calls.append((url, headers, json))
            return _http_response(
                method="POST",
                status_code=201,
                payload={"number": 17, "html_url": "https://github.com/octo/deck/pull/17", "state": "open"},
            )

    monkeypatch.setattr(pr_module.httpx, "AsyncClient", _FakeAsyncClient)

    runner = _FakeRunner(staged_returncode=0)
    adapter = GithubPullRequestAdapter(
        owner="octo",
        repo="deck",
        token="token",
        api_base_url="https://api.github.com",
        remote_name="origin",
        base_branch="master",
        git_author_name="Codex Bot",
        git_author_email="codex@example.com",
        dry_run=False,
        runner=runner,
        worktree_manager=_FakeWorktreeManager(),
        timeout_seconds=30,
    )

    pr = await adapter.create_pr(_task(), "bot/task-33333333")

    assert pr.number == 17
    assert pr.url == "https://github.com/octo/deck/pull/17"
    assert _FakeAsyncClient.post_calls[0][0] == "https://api.github.com/repos/octo/deck/pulls"
    assert _FakeAsyncClient.post_calls[0][2]["head"] == "bot/task-33333333"
    assert any(cmd.startswith("git push --set-upstream origin") for cmd in runner.commands)


async def test_github_pr_adapter_returns_existing_open_pr_on_422(monkeypatch: pytest.MonkeyPatch) -> None:
    class _FakeAsyncClient:
        def __init__(self, timeout: httpx.Timeout) -> None:
            _ = timeout
            self.calls: list[str] = []

        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> bool:
            _ = exc_type, exc, tb
            return False

        async def post(self, url: str, headers: dict[str, str], json: dict[str, str]) -> httpx.Response:
            _ = url, headers, json
            self.calls.append("post")
            return _http_response(method="POST", status_code=422, payload={"message": "Validation Failed"})

        async def get(
            self, url: str, headers: dict[str, str], params: dict[str, str]
        ) -> httpx.Response:
            _ = url, headers, params
            self.calls.append("get")
            return _http_response(
                method="GET",
                status_code=200,
                payload=[{"number": 22, "html_url": "https://github.com/octo/deck/pull/22", "state": "open"}],
            )

    monkeypatch.setattr(pr_module.httpx, "AsyncClient", _FakeAsyncClient)

    adapter = GithubPullRequestAdapter(
        owner="octo",
        repo="deck",
        token="token",
        api_base_url="https://api.github.com",
        remote_name="origin",
        base_branch="master",
        git_author_name="Codex Bot",
        git_author_email="codex@example.com",
        dry_run=False,
        runner=_FakeRunner(staged_returncode=0),
        worktree_manager=_FakeWorktreeManager(),
        timeout_seconds=30,
    )

    pr = await adapter.create_pr(_task(), "bot/task-33333333")

    assert pr.number == 22
    assert pr.url.endswith("/pull/22")


async def test_github_merge_adapter_calls_merge_and_close_endpoints(monkeypatch: pytest.MonkeyPatch) -> None:
    class _FakeAsyncClient:
        put_calls: list[tuple[str, dict[str, str], dict[str, str]]] = []
        patch_calls: list[tuple[str, dict[str, str], dict[str, str]]] = []

        def __init__(self, timeout: httpx.Timeout) -> None:
            _ = timeout

        async def __aenter__(self) -> _FakeAsyncClient:
            return self

        async def __aexit__(self, exc_type, exc, tb) -> bool:
            _ = exc_type, exc, tb
            return False

        async def put(self, url: str, headers: dict[str, str], json: dict[str, str]) -> httpx.Response:
            self.put_calls.append((url, headers, json))
            return _http_response(method="PUT", status_code=200, payload={"merged": True, "message": "ok"})

        async def patch(self, url: str, headers: dict[str, str], json: dict[str, str]) -> httpx.Response:
            self.patch_calls.append((url, headers, json))
            return _http_response(method="PATCH", status_code=200, payload={"state": "closed"})

    monkeypatch.setattr(merge_module.httpx, "AsyncClient", _FakeAsyncClient)

    task = _task()
    task.pr_number = 19
    adapter = GithubMergeAdapter(
        owner="octo",
        repo="deck",
        token="token",
        api_base_url="https://api.github.com",
        merge_method="squash",
        dry_run=False,
        timeout_seconds=30,
    )

    await adapter.merge_pr(task)
    await adapter.close_pr(task)

    assert _FakeAsyncClient.put_calls[0][0].endswith("/repos/octo/deck/pulls/19/merge")
    assert _FakeAsyncClient.patch_calls[0][0].endswith("/repos/octo/deck/pulls/19")
    assert _FakeAsyncClient.put_calls[0][2]["merge_method"] == "squash"


async def test_github_merge_adapter_raises_without_pr_number() -> None:
    adapter = GithubMergeAdapter(
        owner="octo",
        repo="deck",
        token="token",
        api_base_url="https://api.github.com",
        merge_method="squash",
        dry_run=False,
        timeout_seconds=30,
    )

    with pytest.raises(ExternalIntegrationError):
        await adapter.merge_pr(_task())
