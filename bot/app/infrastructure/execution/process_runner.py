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
        try:
            out, err = await asyncio.wait_for(proc.communicate(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            proc.kill()
            out, err = await proc.communicate()
            return ProcessResult(
                args=tuple(args),
                returncode=124,
                stdout=out.decode("utf-8", errors="replace"),
                stderr=err.decode("utf-8", errors="replace"),
                timed_out=True,
            )

        return ProcessResult(
            args=tuple(args),
            returncode=proc.returncode,
            stdout=out.decode("utf-8", errors="replace"),
            stderr=err.decode("utf-8", errors="replace"),
            timed_out=False,
        )
