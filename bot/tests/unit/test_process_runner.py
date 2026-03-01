from __future__ import annotations

import sys
from pathlib import Path

import pytest

from app.infrastructure.execution.process_runner import ProcessRunner


pytestmark = pytest.mark.asyncio


async def test_process_runner_collects_stdout_and_stderr_without_timeout() -> None:
    runner = ProcessRunner()
    result = await runner.run(
        args=[sys.executable, "-c", "import sys;sys.stdout.write('OUT\\n');sys.stderr.write('ERR\\n')"],
        cwd=str(Path.cwd()),
        timeout_seconds=5,
    )

    assert result.returncode == 0
    assert result.timed_out is False
    assert "OUT" in result.stdout
    assert "ERR" in result.stderr


async def test_process_runner_preserves_partial_output_on_timeout() -> None:
    runner = ProcessRunner()
    result = await runner.run(
        args=[
            sys.executable,
            "-c",
            (
                "import sys,time;"
                "sys.stdout.write('EARLY_OUT\\n');sys.stdout.flush();"
                "sys.stderr.write('EARLY_ERR\\n');sys.stderr.flush();"
                "time.sleep(2)"
            ),
        ],
        cwd=str(Path.cwd()),
        timeout_seconds=1,
    )

    assert result.returncode == 124
    assert result.timed_out is True
    assert "EARLY_OUT" in result.stdout
    assert "EARLY_ERR" in result.stderr
    assert "Timeout exceeded" in result.stderr
