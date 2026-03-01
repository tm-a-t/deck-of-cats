from __future__ import annotations

import subprocess

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
        sandbox_mode: str = "workspace-write",
        approval_policy: str = "never",
    ) -> None:
        self._runner = runner
        self._worktree_manager = worktree_manager
        self._prompt_builder = prompt_builder
        self._result_parser = result_parser
        self._timeout_seconds = timeout_seconds
        self._codex_executable = codex_executable
        self._sandbox_mode = sandbox_mode
        self._approval_policy = approval_policy

    async def implement(self, task: TaskAggregate) -> StepResult:
        prompt = self._prompt_builder.build_implement_prompt(task)
        return await self._run(task, prompt=prompt, require_changed_files=True)

    async def validate(self, task: TaskAggregate) -> StepResult:
        prompt = self._prompt_builder.build_validate_prompt(task)
        return await self._run(task, prompt=prompt, require_changed_files=False)

    async def _run(self, task: TaskAggregate, prompt: str, require_changed_files: bool) -> StepResult:
        worktree_path, branch = self._worktree_manager.create(task.id)
        args = [
            self._codex_executable,
            "-a",
            self._approval_policy,
            "exec",
            "--sandbox",
            self._sandbox_mode,
        ]
        args.append(prompt)
        result = await self._runner.run(
            args=args,
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

        if require_changed_files and parsed.ok:
            mismatch_details = self._validate_changed_files(
                worktree_path=worktree_path,
                declared_files=parsed.changed_files or [],
            )
            if mismatch_details is not None:
                return StepResult(
                    ok=False,
                    summary="codex changed files mismatch",
                    details=f"{mismatch_details}\n\n{self._format_output(branch=branch, worktree_path=worktree_path, stdout=result.stdout, stderr=result.stderr)}",
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

    @classmethod
    def _validate_changed_files(cls, worktree_path: str, declared_files: list[str]) -> str | None:
        actual_files, inspect_error = cls._collect_changed_files(worktree_path)
        if inspect_error is not None:
            return inspect_error
        if not actual_files:
            return "No changed files found in git diff/status"

        declared_set: set[str] = set()
        for path in declared_files:
            normalized = cls._normalize_path(path)
            if normalized:
                declared_set.add(normalized)

        actual_set: set[str] = set()
        for path in actual_files:
            normalized = cls._normalize_path(path)
            if normalized:
                actual_set.add(normalized)
        missing = sorted(declared_set - actual_set)
        undeclared = sorted(actual_set - declared_set)
        if missing or undeclared:
            actual_lines = "\n".join(f"- {path}" for path in sorted(actual_set))
            missing_lines = "\n".join(f"- {path}" for path in missing) or "- <none>"
            undeclared_lines = "\n".join(f"- {path}" for path in undeclared) or "- <none>"
            return (
                "CHANGED_FILES mismatch against git diff/status.\n"
                f"missing:\n{missing_lines}\n"
                f"undeclared:\n{undeclared_lines}\n"
                f"actual:\n{actual_lines}"
            )
        return None

    @staticmethod
    def _collect_changed_files(worktree_path: str) -> tuple[list[str], str | None]:
        diff_result = subprocess.run(
            ["git", "-C", worktree_path, "diff", "--name-only", "HEAD"],
            check=False,
            capture_output=True,
            text=True,
        )
        if diff_result.returncode != 0:
            message = diff_result.stderr.strip() or diff_result.stdout.strip() or "git diff failed"
            return [], f"Failed to inspect worktree changes: {message}"

        untracked_result = subprocess.run(
            ["git", "-C", worktree_path, "ls-files", "--others", "--exclude-standard"],
            check=False,
            capture_output=True,
            text=True,
        )
        if untracked_result.returncode != 0:
            message = untracked_result.stderr.strip() or untracked_result.stdout.strip() or "git ls-files failed"
            return [], f"Failed to inspect worktree changes: {message}"

        files: set[str] = set()
        for chunk in (diff_result.stdout, untracked_result.stdout):
            for raw_line in chunk.splitlines():
                normalized = CodexCliAdapter._normalize_path(raw_line)
                if normalized:
                    files.add(normalized)
        return sorted(files), None

    @staticmethod
    def _normalize_path(path: str) -> str:
        normalized = path.strip().replace("\\", "/")
        while normalized.startswith("./"):
            normalized = normalized[2:]
        return normalized
