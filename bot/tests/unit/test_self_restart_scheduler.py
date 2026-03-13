from __future__ import annotations

from pathlib import Path

import app.infrastructure.execution.self_restart_scheduler as scheduler_module
from app.infrastructure.execution.self_restart_scheduler import DetachedSelfRestartScheduler


def test_scheduler_writes_script_and_detaches_process(monkeypatch, tmp_path: Path) -> None:
    popen_calls: list[dict[str, object]] = []

    class _FakePopen:
        def __init__(self, args, **kwargs) -> None:
            popen_calls.append({"args": args, "kwargs": kwargs})

    monkeypatch.setattr(scheduler_module.subprocess, "Popen", _FakePopen)

    repo_path = tmp_path / "repo"
    bot_path = repo_path / "bot"
    bot_path.mkdir(parents=True)

    scheduler = DetachedSelfRestartScheduler(
        repo_path=str(repo_path),
        bot_path=str(bot_path),
        base_branch="codex-evolve",
        remote_name="origin",
        python_executable="/venv/bin/python",
        restart_module="app.main_all_in_one",
        startup_delay_seconds=2,
    )

    script_path = Path(scheduler.enqueue())
    script = script_path.read_text(encoding="utf-8")

    assert "sleep 2" in script
    assert "git -C" in script
    assert "pull --ff-only origin codex-evolve" in script
    assert "nohup /venv/bin/python -m app.main_all_in_one" in script
    assert popen_calls[0]["args"][0] == "/bin/sh"
    assert popen_calls[0]["kwargs"]["start_new_session"] is True
    assert script_path.parent == bot_path / "runtime" / "restart_queue"
