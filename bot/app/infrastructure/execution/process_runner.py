from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence


@dataclass
class ProcessResult:
    args: tuple[str, ...]
    returncode: int
    stdout: str
    stderr: str
    timed_out: bool = False


class ProcessRunner:
    async def run(self, args: Sequence[str], cwd: str, timeout_seconds: int) -> ProcessResult:
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=str(Path(cwd)),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_chunks: list[bytes] = []
        stderr_chunks: list[bytes] = []

        async def _drain(stream: asyncio.StreamReader | None, sink: list[bytes]) -> None:
            if stream is None:
                return
            while True:
                chunk = await stream.read(4096)
                if not chunk:
                    return
                sink.append(chunk)

        stdout_task = asyncio.create_task(_drain(proc.stdout, stdout_chunks))
        stderr_task = asyncio.create_task(_drain(proc.stderr, stderr_chunks))
        timed_out = False

        try:
            await asyncio.wait_for(proc.wait(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            timed_out = True
            proc.kill()
            await proc.wait()

        await asyncio.gather(stdout_task, stderr_task)

        stdout = b"".join(stdout_chunks).decode("utf-8", errors="replace")
        stderr = b"".join(stderr_chunks).decode("utf-8", errors="replace")
        if timed_out:
            stderr = (stderr + "\nTimeout exceeded").strip()

        return ProcessResult(
            args=tuple(args),
            returncode=124 if timed_out else (proc.returncode or 0),
            stdout=stdout,
            stderr=stderr,
            timed_out=timed_out,
        )
