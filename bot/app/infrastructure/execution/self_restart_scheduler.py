from __future__ import annotations

import datetime as dt
import shlex
import subprocess
import uuid
from pathlib import Path


class DetachedSelfRestartScheduler:
    def __init__(
        self,
        repo_path: str,
        bot_path: str,
        base_branch: str,
        remote_name: str,
        python_executable: str,
        restart_module: str,
        startup_delay_seconds: int = 1,
        shell_executable: str = "/bin/sh",
    ) -> None:
        self._repo_path = Path(repo_path)
        self._bot_path = Path(bot_path)
        self._base_branch = base_branch
        self._remote_name = remote_name
        self._python_executable = python_executable
        self._restart_module = restart_module
        self._startup_delay_seconds = startup_delay_seconds
        self._shell_executable = shell_executable
        self._queue_root = self._bot_path / "runtime" / "restart_queue"
        self._queue_root.mkdir(parents=True, exist_ok=True)

    def enqueue(self) -> str:
        run_id = f"{dt.datetime.now(dt.UTC).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}"
        script_path = self._queue_root / f"{run_id}.sh"
        log_path = self._queue_root / f"{run_id}.log"

        script = "\n".join(
            [
                "#!/bin/sh",
                "set -eu",
                f"sleep {self._startup_delay_seconds}",
                (
                    f"git -C {shlex.quote(str(self._repo_path))} pull --ff-only "
                    f"{shlex.quote(self._remote_name)} {shlex.quote(self._base_branch)}"
                ),
                f"cd {shlex.quote(str(self._bot_path))}",
                (
                    f"nohup {shlex.quote(self._python_executable)} -m {shlex.quote(self._restart_module)} "
                    f">> {shlex.quote(str(log_path))} 2>&1 &"
                ),
                "exit 0",
                "",
            ]
        )
        script_path.write_text(script, encoding="utf-8")
        script_path.chmod(0o700)

        subprocess.Popen(
            [self._shell_executable, str(script_path)],
            cwd=str(self._bot_path),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )

        return str(script_path)
