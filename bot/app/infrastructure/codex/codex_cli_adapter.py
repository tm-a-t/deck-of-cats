from __future__ import annotations

from app.application.workflows.models import StepResult
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.codex.prompt_builder import CodexPromptBuilder
from app.infrastructure.codex.result_parser import CodexResultParseError, CodexResultParser
from app.infrastructure.execution.process_runner import ProcessRunner
from app.infrastructure.execution.worktree_manager import WorktreeManager


class CodexCliAdapter:
    def __init__(
        self,
        runner: ProcessRunner,
        worktree_manager: WorktreeManager,
        prompt_builder: CodexPromptBuilder,
        result_parser: CodexResultParser,
        timeout_seconds: int,
        codex_executable: str = "codex",
    ) -> None:
        self._runner = runner
        self._worktree_manager = worktree_manager
        self._prompt_builder = prompt_builder
        self._result_parser = result_parser
        self._timeout_seconds = timeout_seconds
        self._codex_executable = codex_executable

    async def implement(self, task: TaskAggregate) -> StepResult:
        prompt = self._prompt_builder.build_implement_prompt(task)
        return await self._run(task, prompt=prompt, require_changed_files=True)

    async def validate(self, task: TaskAggregate) -> StepResult:
        prompt = self._prompt_builder.build_validate_prompt(task)
        return await self._run(task, prompt=prompt, require_changed_files=False)

    async def _run(self, task: TaskAggregate, prompt: str, require_changed_files: bool) -> StepResult:
        worktree_path, branch = self._worktree_manager.create(task.id)
        result = await self._runner.run(
            args=[self._codex_executable, "exec", prompt],
            cwd=worktree_path,
            timeout_seconds=self._timeout_seconds,
        )

        if result.returncode != 0:
            summary = "codex exec timed out" if result.timed_out else "codex exec failed"
            return StepResult(
                ok=False,
                summary=summary,
                details=self._format_output(
                    branch=branch,
                    worktree_path=worktree_path,
                    stdout=result.stdout,
                    stderr=result.stderr,
                ),
            )

        try:
            parsed = (
                self._result_parser.parse_implement(result.stdout)
                if require_changed_files
                else self._result_parser.parse_validate(result.stdout)
            )
        except CodexResultParseError as exc:
            return StepResult(
                ok=False,
                summary="codex result parse failed",
                details=f"{exc}\n\n{self._format_output(branch=branch, worktree_path=worktree_path, stdout=result.stdout, stderr=result.stderr)}",
            )

        metadata: dict[str, str | int | bool | list[str]] = {
            "branch": branch,
            "worktree_path": worktree_path,
        }
        if parsed.changed_files is not None:
            metadata["changed_files"] = parsed.changed_files

        return StepResult(
            ok=parsed.ok,
            summary=parsed.summary,
            details=parsed.details,
            metadata=metadata,
        )

    @staticmethod
    def _format_output(branch: str, worktree_path: str, stdout: str, stderr: str) -> str:
        sections = [
            f"branch={branch}",
            f"worktree={worktree_path}",
            "stdout:",
            stdout.strip() or "<empty>",
            "stderr:",
            stderr.strip() or "<empty>",
        ]
        return "\n".join(sections)
