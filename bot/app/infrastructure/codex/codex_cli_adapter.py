from __future__ import annotations

import subprocess

from app.application.workflows.models import StepResult
from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.codex.json_output_parser import CodexJsonOutputParseError, CodexJsonOutputParser
from app.infrastructure.codex.lead_review_parser import CodexLeadReviewParseError, CodexLeadReviewParser
from app.infrastructure.codex.personality import CodexPersonality, CodexPersonalityRegistry
from app.infrastructure.codex.personality_store import JsonPersonalityStore
from app.infrastructure.codex.prompt_builder import CodexPromptBuilder
from app.infrastructure.codex.result_parser import CodexResultParseError, CodexResultParser
from app.infrastructure.execution.process_runner import ProcessRunner
from app.infrastructure.execution.worktree_manager import WorktreeManager
from app.shared.enums import StepName


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
        personality_registry: CodexPersonalityRegistry | None = None,
        personality_store: JsonPersonalityStore | None = None,
        json_output_parser: CodexJsonOutputParser | None = None,
        lead_review_parser: CodexLeadReviewParser | None = None,
    ) -> None:
        self._runner = runner
        self._worktree_manager = worktree_manager
        self._prompt_builder = prompt_builder
        self._result_parser = result_parser
        self._timeout_seconds = timeout_seconds
        self._codex_executable = codex_executable
        self._sandbox_mode = sandbox_mode
        self._approval_policy = approval_policy
        self._personality_registry = personality_registry or CodexPersonalityRegistry.default()
        self._personality_store = personality_store
        self._json_output_parser = json_output_parser or CodexJsonOutputParser()
        self._lead_review_parser = lead_review_parser or CodexLeadReviewParser()

    async def implement(self, task: TaskAggregate) -> StepResult:
        return await self._run(task, step=StepName.CODEX_IMPLEMENT, require_changed_files=True)

    async def validate(self, task: TaskAggregate) -> StepResult:
        return await self._run(task, step=StepName.CODEX_VALIDATE, require_changed_files=False)

    async def lead_review(self, task: TaskAggregate) -> StepResult:
        return await self._run(task, step=StepName.LEAD_REVIEW, require_changed_files=False)

    async def _run(self, task: TaskAggregate, step: StepName, require_changed_files: bool) -> StepResult:
        worktree_path, branch = self._worktree_manager.create(task.id)
        personality = self._personality_registry.for_step(step)
        stored_session_id = self._load_session_id(personality)
        use_resume = bool(personality.persist_session and stored_session_id)
        prompt = self._build_prompt(task=task, step=step, personality=personality, is_new_session=not use_resume)
        args = self._build_args(prompt=prompt, session_id=stored_session_id if use_resume else None)
        result = await self._runner.run(
            args=args,
            cwd=worktree_path,
            timeout_seconds=self._timeout_seconds,
        )
        parsed_output = self._parse_json_output(result.stdout)
        self._store_session_if_needed(personality, parsed_output.session_id)

        if result.returncode != 0:
            summary = "codex exec timed out" if result.timed_out else "codex exec failed"
            return StepResult(
                ok=False,
                summary=summary,
                details=self._format_output(
                    personality=personality,
                    run_mode="resume" if use_resume else "exec",
                    session_id=parsed_output.session_id or stored_session_id,
                    branch=branch,
                    worktree_path=worktree_path,
                    stdout=result.stdout,
                    stderr=result.stderr,
                ),
                metadata=self._build_metadata(
                    branch=branch,
                    worktree_path=worktree_path,
                    personality=personality,
                    run_mode="resume" if use_resume else "exec",
                    session_id=parsed_output.session_id or stored_session_id,
                ),
            )

        message = parsed_output.final_message
        if not message:
            return StepResult(
                ok=False,
                summary="codex result parse failed",
                details=self._format_output(
                    personality=personality,
                    run_mode="resume" if use_resume else "exec",
                    session_id=parsed_output.session_id or stored_session_id,
                    branch=branch,
                    worktree_path=worktree_path,
                    stdout=result.stdout,
                    stderr=result.stderr,
                ),
                metadata=self._build_metadata(
                    branch=branch,
                    worktree_path=worktree_path,
                    personality=personality,
                    run_mode="resume" if use_resume else "exec",
                    session_id=parsed_output.session_id or stored_session_id,
                ),
            )

        try:
            if step == StepName.CODEX_IMPLEMENT:
                parsed = self._result_parser.parse_implement(message)
                parsed_review = None
            elif step == StepName.CODEX_VALIDATE:
                parsed = self._result_parser.parse_validate(message)
                parsed_review = None
            else:
                parsed = None
                parsed_review = self._lead_review_parser.parse(message)
        except (CodexResultParseError, CodexLeadReviewParseError) as exc:
            formatted_output = self._format_output(
                personality=personality,
                run_mode="resume" if use_resume else "exec",
                session_id=parsed_output.session_id or stored_session_id,
                branch=branch,
                worktree_path=worktree_path,
                stdout=result.stdout,
                stderr=result.stderr,
            )
            return StepResult(
                ok=False,
                summary="codex result parse failed",
                details=f"{exc}\n\n{formatted_output}",
                metadata=self._build_metadata(
                    branch=branch,
                    worktree_path=worktree_path,
                    personality=personality,
                    run_mode="resume" if use_resume else "exec",
                    session_id=parsed_output.session_id or stored_session_id,
                ),
            )

        if step == StepName.LEAD_REVIEW and parsed_review is not None:
            metadata = self._build_metadata(
                branch=branch,
                worktree_path=worktree_path,
                personality=personality,
                run_mode="resume" if use_resume else "exec",
                session_id=parsed_output.session_id or stored_session_id,
            )
            metadata["review_decision"] = parsed_review.decision.value
            metadata["review_feedback"] = parsed_review.details
            return StepResult(
                ok=True,
                summary=parsed_review.summary,
                details=parsed_review.details,
                metadata=metadata,
            )

        if parsed is not None and require_changed_files and parsed.ok:
            mismatch_details = self._validate_changed_files(
                worktree_path=worktree_path,
                declared_files=parsed.changed_files or [],
            )
            if mismatch_details is not None:
                formatted_output = self._format_output(
                    personality=personality,
                    run_mode="resume" if use_resume else "exec",
                    session_id=parsed_output.session_id or stored_session_id,
                    branch=branch,
                    worktree_path=worktree_path,
                    stdout=result.stdout,
                    stderr=result.stderr,
                )
                return StepResult(
                    ok=False,
                    summary="codex changed files mismatch",
                    details=f"{mismatch_details}\n\n{formatted_output}",
                    metadata=self._build_metadata(
                        branch=branch,
                        worktree_path=worktree_path,
                        personality=personality,
                        run_mode="resume" if use_resume else "exec",
                        session_id=parsed_output.session_id or stored_session_id,
                    ),
                )

        metadata = self._build_metadata(
            branch=branch,
            worktree_path=worktree_path,
            personality=personality,
            run_mode="resume" if use_resume else "exec",
            session_id=parsed_output.session_id or stored_session_id,
        )
        if parsed is not None and parsed.changed_files is not None:
            metadata["changed_files"] = parsed.changed_files

        return StepResult(
            ok=parsed.ok if parsed is not None else False,
            summary=parsed.summary if parsed is not None else "codex result parse failed",
            details=parsed.details if parsed is not None else "Lead review parser returned no result",
            metadata=metadata,
        )

    @staticmethod
    def _format_output(
        personality: CodexPersonality,
        run_mode: str,
        session_id: str | None,
        branch: str,
        worktree_path: str,
        stdout: str,
        stderr: str,
    ) -> str:
        sections = [
            f"personality={personality.key}",
            f"guide={personality.guide_path}",
            f"run_mode={run_mode}",
            f"session_id={session_id or '<none>'}",
            f"branch={branch}",
            f"worktree={worktree_path}",
            "stdout:",
            stdout.strip() or "<empty>",
            "stderr:",
            stderr.strip() or "<empty>",
        ]
        return "\n".join(sections)

    def _build_prompt(
        self,
        task: TaskAggregate,
        step: StepName,
        personality: CodexPersonality,
        is_new_session: bool,
    ) -> str:
        preamble = self._prompt_builder.build_personality_preamble(
            personality_key=personality.key,
            guide_path=personality.guide_path,
            is_new_session=is_new_session,
        )
        base_prompt = (
            self._prompt_builder.build_implement_prompt(task)
            if step == StepName.CODEX_IMPLEMENT
            else (
                self._prompt_builder.build_validate_prompt(task)
                if step == StepName.CODEX_VALIDATE
                else self._prompt_builder.build_lead_review_prompt(task)
            )
        )
        return f"{preamble}\n\n{base_prompt}"

    def _build_args(self, prompt: str, session_id: str | None) -> list[str]:
        args = [
            self._codex_executable,
            "-a",
            self._approval_policy,
            "-s",
            self._sandbox_mode,
            "exec",
        ]
        if session_id:
            args.extend(["resume", "--json", session_id, prompt])
            return args

        args.extend(["--json", prompt])
        return args

    def _load_session_id(self, personality: CodexPersonality) -> str | None:
        if self._personality_store is None or not personality.persist_session:
            return None
        stored = self._personality_store.get(personality.key)
        return None if stored is None else stored.session_id

    def _store_session_if_needed(self, personality: CodexPersonality, session_id: str | None) -> None:
        if self._personality_store is None or not personality.persist_session or not session_id:
            return
        self._personality_store.save(personality.key, session_id, personality.guide_path)

    def _parse_json_output(self, output: str):
        try:
            return self._json_output_parser.parse(output)
        except CodexJsonOutputParseError:
            return self._json_output_parser.parse("")

    @staticmethod
    def _build_metadata(
        branch: str,
        worktree_path: str,
        personality: CodexPersonality,
        run_mode: str,
        session_id: str | None,
    ) -> dict[str, str | int | bool | list[str]]:
        metadata: dict[str, str | int | bool | list[str]] = {
            "branch": branch,
            "worktree_path": worktree_path,
            "personality_key": personality.key,
            "personality_guide_path": personality.guide_path,
            "personality_run_mode": run_mode,
        }
        if session_id:
            metadata["codex_session_id"] = session_id
        return metadata

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
