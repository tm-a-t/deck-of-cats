from __future__ import annotations

import asyncio
import re
import time
from urllib.parse import urlsplit, urlunsplit

import httpx

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.shared.errors import ExternalIntegrationError


class NetlifyQueryAdapter:
    _URL_RE = re.compile(r"https?://[^\s<>\)\]\}\"']+")

    def __init__(
        self,
        poll_interval_seconds: int = 5,
        owner: str = "",
        repo: str = "",
        token: str = "",
        api_base_url: str = "https://api.github.com",
    ) -> None:
        self._poll_interval_seconds = poll_interval_seconds
        self._owner = owner
        self._repo = repo
        self._token = token
        self._api_base_url = api_base_url.rstrip("/")

    async def wait_preview_url(self, task: TaskAggregate, timeout_seconds: int) -> str | None:
        if task.preview_url:
            return task.preview_url

        if task.pr_number is None:
            return self._fallback_preview(task)

        if not self._owner or not self._repo or not self._token:
            return self._fallback_preview(task)

        deadline = time.monotonic() + max(timeout_seconds, 0)
        while True:
            found = await self._find_preview_url_from_github(task.pr_number)
            if found:
                return found

            if time.monotonic() >= deadline:
                return None

            sleep_seconds = min(self._poll_interval_seconds, max(deadline - time.monotonic(), 0))
            if sleep_seconds <= 0:
                return None
            await asyncio.sleep(sleep_seconds)

    async def _find_preview_url_from_github(self, pr_number: int) -> str | None:
        issue_comments_url = f"{self._api_base_url}/repos/{self._owner}/{self._repo}/issues/{pr_number}/comments"
        review_comments_url = f"{self._api_base_url}/repos/{self._owner}/{self._repo}/pulls/{pr_number}/comments"
        timeout = httpx.Timeout(self._poll_interval_seconds + 5)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                issue_response = await client.get(issue_comments_url, headers=self._github_headers())
                review_response = await client.get(review_comments_url, headers=self._github_headers())
        except httpx.HTTPError as exc:
            raise ExternalIntegrationError(f"GitHub comments request failed: {exc}") from exc

        if issue_response.status_code != 200:
            raise ExternalIntegrationError(
                "GitHub issue comments request failed "
                f"(status={issue_response.status_code}): {self._safe_response_text(issue_response)}"
            )
        if review_response.status_code != 200:
            raise ExternalIntegrationError(
                "GitHub review comments request failed "
                f"(status={review_response.status_code}): {self._safe_response_text(review_response)}"
            )

        bodies = self._extract_bodies(issue_response.json()) + self._extract_bodies(review_response.json())
        return self._pick_preview_url(bodies, pr_number=pr_number)

    @classmethod
    def _pick_preview_url(cls, bodies: list[str], pr_number: int) -> str | None:
        for body in reversed(bodies):
            for match in cls._URL_RE.findall(body):
                url = match.rstrip(".,;:!?)")
                if cls._is_expected_netlify_preview_url(url, pr_number=pr_number):
                    return cls._normalize_preview_url(url)
        return None

    @staticmethod
    def _is_expected_netlify_preview_url(url: str, pr_number: int) -> bool:
        parsed = urlsplit(url)
        host = (parsed.netloc or "").lower()
        if not host.endswith(".netlify.app"):
            return False
        expected_prefix = f"deploy-preview-{pr_number}--"
        return host.startswith(expected_prefix)

    @staticmethod
    def _normalize_preview_url(url: str) -> str:
        if "netlify.app" not in url.lower():
            return url
        parsed = urlsplit(url)
        if not parsed.scheme or not parsed.netloc:
            return url
        return urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))

    @staticmethod
    def _extract_bodies(payload: object) -> list[str]:
        if not isinstance(payload, list):
            return []
        result: list[str] = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            body = item.get("body")
            if isinstance(body, str) and body.strip():
                result.append(body)
        return result

    @staticmethod
    def _safe_response_text(response: httpx.Response) -> str:
        text = response.text.strip()
        return text or "<empty response>"

    def _fallback_preview(self, task: TaskAggregate) -> str | None:
        if task.pr_url and "github.com" in task.pr_url:
            return f"{task.pr_url}#netlify-preview"
        return None

    def _github_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {self._token}",
            "X-GitHub-Api-Version": "2022-11-28",
        }
