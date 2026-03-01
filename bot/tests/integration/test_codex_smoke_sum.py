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
    reason="Set RUN_CODEX_E2E=1 to run real codex smoke tests",
)
async def test_codex_creates_sum_file_and_reports_pass() -> None:
    codex_executable = os.getenv("CODEX_CLI_EXECUTABLE", "codex")
    if shutil.which(codex_executable) is None:
        pytest.skip(f"{codex_executable} is not available in PATH")

    repo_root = Path(__file__).resolve().parents[2]

    prompt = (
        "Create file sum.py in current directory. "
        "Write a function sum_two(a, b) that returns a + b. "
        "Do not create extra files. "
        "Return strictly in this format:\n"
        "RESULT: PASS|FAIL\n"
        "SUMMARY: <one line>\n"
        "DETAILS: <short text>\n"
        "CHANGED_FILES:\n"
        "- sum.py"
    )

    runner = ProcessRunner()
    parser = CodexResultParser()
    sum_path = repo_root / "sum.py"

    try:
        result = await runner.run(
            args=[codex_executable, "exec", prompt],
            cwd=str(repo_root),
            timeout_seconds=180,
        )

        assert result.returncode == 0, result.stderr
        assert "RESULT: PASS" in result.stdout

        parsed = parser.parse_implement(result.stdout)
        assert parsed.ok is True
        assert sum_path.exists(), "sum.py was not created"
    finally:
        if sum_path.exists():
            sum_path.unlink()

    assert not sum_path.exists(), "sum.py was not removed in cleanup"
