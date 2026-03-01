from __future__ import annotations

import asyncio
import shlex
from dataclasses import dataclass
from pathlib import Path


@dataclass
class CommandResult:
    command: str
    returncode: int
    stdout: str
    stderr: str


class SandboxRunner:
    async def run(self, command: str, cwd: str, timeout_seconds: int) -> CommandResult:
        args = shlex.split(command)
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
            return CommandResult(
                command=command,
                returncode=124,
                stdout=out.decode("utf-8", errors="replace"),
                stderr=(err.decode("utf-8", errors="replace") + "\nTimeout exceeded").strip(),
            )

        return CommandResult(
            command=command,
            returncode=proc.returncode,
            stdout=out.decode("utf-8", errors="replace"),
            stderr=err.decode("utf-8", errors="replace"),
        )
