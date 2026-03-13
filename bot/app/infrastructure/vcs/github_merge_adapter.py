from __future__ import annotations

import logging

import httpx

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.errors import ExternalIntegrationError


logger = logging.getLogger(__name__)


class GithubMergeAdapter:
    def __init__(
        self,
        owner: str,
        repo: str,
        token: str,
        api_base_url: str,
        merge_method: str,
        dry_run: bool,
        timeout_seconds: int,
    ) -> None:
        self._owner = owner
        self._repo = repo
        self._token = token
        self._api_base_url = api_base_url.rstrip("/")
        self._merge_method = merge_method
        self._dry_run = dry_run
        self._timeout_seconds = timeout_seconds

    async def approve_pr(self, task: TaskAggregate) -> None:
        if self._dry_run:
            return
        pr_number = self._require_pr_number(task)
        self._ensure_github_config()

        url = f"{self._api_base_url}/repos/{self._owner}/{self._repo}/pulls/{pr_number}/reviews"
        payload = {"event": "APPROVE"}
        timeout = httpx.Timeout(self._timeout_seconds)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, headers=self._github_headers(), json=payload)
        except httpx.HTTPError as exc:
            raise ExternalIntegrationError(f"GitHub approve PR request failed: {exc}") from exc

        if response.status_code not in {200, 201}:
            if self._is_self_approval_rejected(response):
                logger.warning(
                    "GitHub refused self-approval for PR %s; continuing without approval",
                    pr_number,
                )
                return
            raise ExternalIntegrationError(
                f"GitHub approve PR failed (status={response.status_code}): {self._safe_response_text(response)}"
            )

    async def merge_pr(self, task: TaskAggregate) -> None:
        if self._dry_run:
            return
        pr_number = self._require_pr_number(task)
        self._ensure_github_config()
        self._ensure_merge_method()

        url = f"{self._api_base_url}/repos/{self._owner}/{self._repo}/pulls/{pr_number}/merge"
        payload = {
            "merge_method": self._merge_method,
            "commit_title": f"bot: {task.title.strip() or task.id}",
        }
        expected_head_sha = TaskAggregate.extract_expected_head_sha(task.pr_url)
        if expected_head_sha:
            payload["sha"] = expected_head_sha

        timeout = httpx.Timeout(self._timeout_seconds)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.put(url, headers=self._github_headers(), json=payload)
        except httpx.HTTPError as exc:
            raise ExternalIntegrationError(f"GitHub merge request failed: {exc}") from exc

        if response.status_code != 200:
            raise ExternalIntegrationError(
                f"GitHub merge failed (status={response.status_code}): {self._safe_response_text(response)}"
            )

        data = response.json()
        if not isinstance(data, dict) or not data.get("merged", False):
            raise ExternalIntegrationError(f"GitHub merge failed: {self._safe_response_text(response)}")

    async def close_pr(self, task: TaskAggregate) -> None:
        if self._dry_run:
            return
        pr_number = self._require_pr_number(task)
        self._ensure_github_config()

        url = f"{self._api_base_url}/repos/{self._owner}/{self._repo}/pulls/{pr_number}"
        payload = {"state": "closed"}
        timeout = httpx.Timeout(self._timeout_seconds)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.patch(url, headers=self._github_headers(), json=payload)
        except httpx.HTTPError as exc:
            raise ExternalIntegrationError(f"GitHub close PR request failed: {exc}") from exc

        if response.status_code != 200:
            raise ExternalIntegrationError(
                f"GitHub close PR failed (status={response.status_code}): {self._safe_response_text(response)}"
            )

        data = response.json()
        if not isinstance(data, dict) or data.get("state") != "closed":
            raise ExternalIntegrationError(f"GitHub close PR failed: {self._safe_response_text(response)}")

    def _require_pr_number(self, task: TaskAggregate) -> int:
        if task.pr_number is None:
            raise ExternalIntegrationError("PR number is missing for merge/close operation")
        return task.pr_number

    def _ensure_github_config(self) -> None:
        if not self._owner or not self._repo:
            raise ExternalIntegrationError("GITHUB_OWNER and GITHUB_REPO must be configured")
        if not self._token:
            raise ExternalIntegrationError("GITHUB_TOKEN must be configured")

    def _ensure_merge_method(self) -> None:
        if self._merge_method not in {"merge", "squash", "rebase"}:
            raise ExternalIntegrationError(
                "GITHUB_MERGE_METHOD must be one of: merge, squash, rebase"
            )

    @staticmethod
    def _safe_response_text(response: httpx.Response) -> str:
        text = response.text.strip()
        return text or "<empty response>"

    @classmethod
    def _is_self_approval_rejected(cls, response: httpx.Response) -> bool:
        if response.status_code != 422:
            return False
        return "approve your own pull request" in cls._safe_response_text(response).lower()

    def _github_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {self._token}",
            "X-GitHub-Api-Version": "2022-11-28",
        }
