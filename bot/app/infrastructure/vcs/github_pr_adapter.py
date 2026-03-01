from __future__ import annotations

import shlex
import time

import httpx

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.domain.entities.pr import PullRequest
from app.infrastructure.execution.sandbox_runner import SandboxRunner
from app.infrastructure.execution.worktree_manager import WorktreeManager
from app.shared.errors import ExternalIntegrationError


class GithubPullRequestAdapter:
    def __init__(
        self,
        owner: str,
        repo: str,
        token: str,
        api_base_url: str,
        remote_name: str,
        base_branch: str,
        git_author_name: str,
        git_author_email: str,
        dry_run: bool,
        runner: SandboxRunner,
        worktree_manager: WorktreeManager,
        timeout_seconds: int,
    ) -> None:
        self._owner = owner
        self._repo = repo
        self._token = token
        self._api_base_url = api_base_url.rstrip("/")
        self._remote_name = remote_name
        self._base_branch = base_branch
        self._git_author_name = git_author_name
        self._git_author_email = git_author_email
        self._dry_run = dry_run
        self._runner = runner
        self._worktree_manager = worktree_manager
        self._timeout_seconds = timeout_seconds

    async def create_pr(self, task: TaskAggregate, branch_name: str) -> PullRequest:
        worktree_path, _ = self._worktree_manager.create(task.id)

        await self._run_git_or_raise(
            command=f"git checkout -B {shlex.quote(branch_name)}",
            cwd=worktree_path,
            op_name="git checkout",
        )
        await self._run_git_or_raise(
            command=f"git config user.name {shlex.quote(self._git_author_name)}",
            cwd=worktree_path,
            op_name="git config user.name",
        )
        await self._run_git_or_raise(
            command=f"git config user.email {shlex.quote(self._git_author_email)}",
            cwd=worktree_path,
            op_name="git config user.email",
        )
        await self._run_git_or_raise(command="git add -A", cwd=worktree_path, op_name="git add")

        staged_check = await self._runner.run(
            command="git diff --cached --quiet",
            cwd=worktree_path,
            timeout_seconds=self._timeout_seconds,
        )
        if staged_check.returncode not in {0, 1}:
            raise ExternalIntegrationError(
                f"git diff --cached check failed: {staged_check.stderr.strip() or staged_check.stdout.strip()}"
            )

        if staged_check.returncode == 1:
            commit_title = task.title.strip() or task.id
            commit_result = await self._runner.run(
                command=f"git commit -m {shlex.quote(f'bot: {commit_title}')}",
                cwd=worktree_path,
                timeout_seconds=self._timeout_seconds,
            )
            if commit_result.returncode != 0:
                raise ExternalIntegrationError(
                    f"git commit failed: {commit_result.stderr.strip() or commit_result.stdout.strip()}"
                )

        fallback_number = int(time.time())
        fallback_url = self._build_compare_url(branch_name)
        if self._dry_run:
            return PullRequest(
                provider="github",
                number=fallback_number,
                url=fallback_url,
                state="open",
                head_sha=None,
            )

        self._ensure_github_config()
        await self._run_git_or_raise(
            command=(
                f"git push --set-upstream {shlex.quote(self._remote_name)} "
                f"{shlex.quote(branch_name)}"
            ),
            cwd=worktree_path,
            op_name="git push",
        )

        url = f"{self._api_base_url}/repos/{self._owner}/{self._repo}/pulls"
        payload = {
            "title": task.title,
            "body": task.body,
            "head": branch_name,
            "base": self._base_branch,
        }
        timeout = httpx.Timeout(self._timeout_seconds)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, headers=self._github_headers(), json=payload)
                if response.status_code == 201:
                    return self._pull_request_from_payload(response.json(), fallback_number, fallback_url)

                if response.status_code == 422:
                    existing = await self._find_existing_open_pr(client, branch_name, fallback_number, fallback_url)
                    if existing is not None:
                        return existing

                raise ExternalIntegrationError(
                    "GitHub PR creation failed "
                    f"(status={response.status_code}): {self._safe_response_text(response)}"
                )
        except httpx.HTTPError as exc:
            raise ExternalIntegrationError(f"GitHub PR request failed: {exc}") from exc

    async def _find_existing_open_pr(
        self,
        client: httpx.AsyncClient,
        branch_name: str,
        fallback_number: int,
        fallback_url: str,
    ) -> PullRequest | None:
        url = f"{self._api_base_url}/repos/{self._owner}/{self._repo}/pulls"
        params = {
            "state": "open",
            "head": f"{self._owner}:{branch_name}",
            "base": self._base_branch,
        }
        response = await client.get(url, headers=self._github_headers(), params=params)
        if response.status_code != 200:
            raise ExternalIntegrationError(
                "GitHub PR lookup failed "
                f"(status={response.status_code}): {self._safe_response_text(response)}"
            )

        payload = response.json()
        if not isinstance(payload, list) or not payload:
            return None
        return self._pull_request_from_payload(payload[0], fallback_number, fallback_url)

    async def _run_git_or_raise(self, command: str, cwd: str, op_name: str) -> None:
        result = await self._runner.run(command=command, cwd=cwd, timeout_seconds=self._timeout_seconds)
        if result.returncode != 0:
            raise ExternalIntegrationError(f"{op_name} failed: {result.stderr.strip() or result.stdout.strip()}")

    def _ensure_github_config(self) -> None:
        if not self._owner or not self._repo:
            raise ExternalIntegrationError("GITHUB_OWNER and GITHUB_REPO must be configured")
        if not self._token:
            raise ExternalIntegrationError("GITHUB_TOKEN must be configured")

    def _build_compare_url(self, branch_name: str) -> str:
        if not self._owner or not self._repo:
            return f"https://example.local/{branch_name}"
        return f"https://github.com/{self._owner}/{self._repo}/compare/{branch_name}?expand=1"

    @staticmethod
    def _safe_response_text(response: httpx.Response) -> str:
        text = response.text.strip()
        return text or "<empty response>"

    def _pull_request_from_payload(
        self,
        payload: object,
        fallback_number: int,
        fallback_url: str,
    ) -> PullRequest:
        if not isinstance(payload, dict):
            return PullRequest(provider="github", number=fallback_number, url=fallback_url, state="open", head_sha=None)
        number_raw = payload.get("number", fallback_number)
        state_raw = payload.get("state", "open")
        url_raw = payload.get("html_url", fallback_url)
        head = payload.get("head")
        head_sha: str | None = None
        if isinstance(head, dict):
            raw_sha = head.get("sha")
            if isinstance(raw_sha, str) and raw_sha.strip():
                head_sha = raw_sha.strip()
        number = int(number_raw) if isinstance(number_raw, (int, str)) and str(number_raw).isdigit() else fallback_number
        url = url_raw if isinstance(url_raw, str) and url_raw else fallback_url
        state = state_raw if isinstance(state_raw, str) and state_raw else "open"
        return PullRequest(provider="github", number=number, url=url, state=state, head_sha=head_sha)

    def _github_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {self._token}",
            "X-GitHub-Api-Version": "2022-11-28",
        }
