from __future__ import annotations

import textwrap

from app.domain.aggregates.task_aggregate import TaskAggregate


class CodexPromptBuilder:
    def build_personality_preamble(self, personality_key: str, guide_path: str, is_new_session: bool) -> str:
        session_instruction = (
            "You are starting a new Codex agent personality for this repository."
            if is_new_session
            else "Continue as the existing Codex agent personality for this repository."
        )
        guide_instruction = (
            "Before doing any work, read and follow this guide exactly:"
            if is_new_session
            else "If you are not fully sure you remember the role or workflow, re-read this guide:"
        )
        return textwrap.dedent(
            f"""
            {session_instruction}
            Personality: {personality_key}
            This is a new task.
            {guide_instruction}
            - {guide_path}
            """
        ).strip()

    def build_implement_prompt(self, task: TaskAggregate) -> str:
        changed_files_block = self._changed_files_block(task)
        return textwrap.dedent(
            f"""
            You are implementing a software task in the current git repository.
            Task ID: {task.id}
            Title: {task.title}
            Request:
            {task.body}
            {changed_files_block}

            Requirements:
            - Make code changes directly in the repo.
            - Keep existing behavior intact unless task requires changes.
            - If request includes "Rework history:", "Tester feedback history:", or "Lead review history:", treat that feedback as mandatory incremental fixes for the same PR.
            - Do not run tests, browser validation, or broad verification commands. The tester personality handles validation later.
            - Return the final answer strictly in the format below.

            RESULT: PASS|FAIL
            SUMMARY: <one line>
            DETAILS: <short text>
            CHANGED_FILES:
            - path/to/file
            """
        ).strip()

    def build_validate_prompt(self, task: TaskAggregate) -> str:
        changed_files_block = self._changed_files_block(task)
        return textwrap.dedent(
            f"""
            You are validating changes for a software task in the current git repository.
            Task ID: {task.id}
            Title: {task.title}
            Request:
            {task.body}
            {changed_files_block}

            Validation requirements:
            - Verify implementation completeness against task request.
            - The developer already reported the changed files above. Use that list to focus your checks first.
            - Run relevant tests/checks, including browser checks when applicable.
            - For Python/backend validation inside `bot/`, always run tests from `bot/` and use `./.venv/bin/python -m pytest ...`.
            - Never use plain `pytest` or `python3 -m pytest` for `bot/` tests.
            - If `bot/.venv/bin/python` is missing, return FAIL with that exact missing-path error instead of guessing another interpreter.
            - Before any Python/backend check inside `bot/`, read and follow this guide exactly:
              bot/docs/codex-python-validation-guide.md
            - Before any browser check, read and follow this guide exactly:
              bot/docs/codex-playwright-validation-guide.md
            - Use fail-fast behavior: avoid long exploratory loops and stop after repeated tool-syntax errors.
            - If environment/tooling blocks validation (network/DNS/tool missing), return FAIL quickly with exact command/error.
            - Return the final answer strictly in the format below.

            RESULT: PASS|FAIL
            SUMMARY: <one line>
            DETAILS: <short text>
            """
        ).strip()

    def build_lead_review_prompt(self, task: TaskAggregate) -> str:
        changed_files_block = self._changed_files_block(task)
        return textwrap.dedent(
            f"""
            You are reviewing a completed task after the tester reported a passing validation result.
            Task ID: {task.id}
            Title: {task.title}
            Request:
            {task.body}
            PR URL: {task.pr_url or "-"}
            {changed_files_block}

            Lead review requirements:
            - Review the changed code against the current task request.
            - Judge whether the implementation is good enough to merge as-is.
            - Do not edit files, do not run tests, and do not create commits.
            - Choose exactly one decision:
              - MERGE: code is good and matches the task.
              - RERUN_TESTS: code needs rework and should go back to the developer.
              - CLOSE: the PR should be closed instead of iterated further.
            - Return the final answer strictly in the format below.

            DECISION: MERGE|RERUN_TESTS|CLOSE
            SUMMARY: <one line>
            DETAILS: <short text>
            """
        ).strip()

    @staticmethod
    def _changed_files_block(task: TaskAggregate) -> str:
        if not task.changed_files:
            return "Developer-reported changed files:\n- <not provided>"
        lines = "\n".join(f"- {path}" for path in task.changed_files)
        return f"Developer-reported changed files:\n{lines}"
