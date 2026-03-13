from __future__ import annotations

import os
from pathlib import Path
import shutil

import pytest

from app.infrastructure.codex.result_parser import CodexResultParser
from app.infrastructure.execution.process_runner import ProcessRunner


pytestmark = pytest.mark.asyncio


@pytest.mark.skipif(
    os.getenv("RUN_CODEX_E2E") != "1",
    reason="Set RUN_CODEX_E2E=1 to run real codex validation checks",
)
async def test_codex_validator_can_open_homepage_via_playwright_cli() -> None:
    codex_executable = os.getenv("CODEX_CLI_EXECUTABLE", "codex")
    if shutil.which(codex_executable) is None:
        pytest.skip(f"{codex_executable} is not available in PATH")
    project_root = Path(__file__).resolve().parents[3]

    prompt = (
        "Validate that the homepage works in a real browser from current repository root. "
        "Required flow:\n"
        "1) Start local static server on http://127.0.0.1:4173.\n"
        "2) Open http://127.0.0.1:4173/index.html in Playwright CLI.\n"
        "3) Confirm page title is exactly 'Deck of Cats — Deck Builder'.\n"
        "4) Close browser and stop server.\n"
        "Use Playwright CLI in this order: "
        "`playwright-cli` if available, otherwise "
        "`npx --yes --package @playwright/cli playwright-cli`.\n"
        "Return strictly in this format:\n"
        "RESULT: PASS|FAIL\n"
        "SUMMARY: <one line>\n"
        "DETAILS: <short text with exact commands/errors used>"
    )

    runner = ProcessRunner()
    parser = CodexResultParser()

    result = await runner.run(
        args=[codex_executable, "--yolo", "exec", prompt],
        cwd=str(project_root),
        timeout_seconds=420,
    )

    assert result.returncode == 0, result.stderr
    parsed = parser.parse_validate(result.stdout)
    assert parsed.ok is True, f"Validator reported FAIL: {parsed.summary}\n{parsed.details}"
