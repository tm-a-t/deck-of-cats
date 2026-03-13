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

    def build_chat_agent_prompt(
        self,
        personality_key: str,
        guide_path: str,
        is_new_session: bool,
        chat_id: int,
        user_message: str,
        active_tasks: list[dict[str, str]],
    ) -> str:
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
        active_tasks_block = self._active_tasks_block(active_tasks)
        return textwrap.dedent(
            f"""
            {session_instruction}
            Personality: {personality_key}
            This is a new chat turn.
            {guide_instruction}
            - {guide_path}

            You are handling a Telegram bot message for chat_id={chat_id}.
            Latest user message:
            {user_message}

            Active tasks currently visible to the bot:
            {active_tasks_block}

            Decide exactly one action:
            - create_task: user is asking for new software work. Rewrite the request into concise structured English for downstream agents.
            - list_tasks: user is asking about open tasks in general.
            - show_task: user wants status/details for one task.
            - show_logs: user wants logs/details for one task.
            - help: user asks what you can do.
            - reply: any other conversational answer.

            Rules:
            - Reply to the user in Russian in `reply_text`.
            - If action is `create_task`, produce `title_en` and `body_en` in English.
            - `body_en` must be a clean downstream task description, not a translation dump.
            - Preserve concrete constraints, expected behavior, and acceptance criteria.
            - Prefer an existing public task id from the active task list when the user asks about status/logs.
            - Return raw JSON only. No markdown fences, no extra commentary.

            JSON schema:
            {{
              "action": "create_task|list_tasks|show_task|show_logs|help|reply",
              "reply_text": "string",
              "title_en": "string",
              "body_en": "string",
              "task_ref": "string"
            }}
            """
        ).strip()

    def build_chat_agent_log_summary_prompt(
        self,
        personality_key: str,
        guide_path: str,
        is_new_session: bool,
        chat_id: int,
        user_message: str,
        task_public_id: str,
        task_title: str,
        task_status: str,
        log_text: str,
    ) -> str:
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
        log_excerpt = self._truncate_log_excerpt(log_text)
        return textwrap.dedent(
            f"""
            {session_instruction}
            Personality: {personality_key}
            This is a new chat turn.
            {guide_instruction}
            - {guide_path}

            You are handling a Telegram bot message for chat_id={chat_id}.
            The user is asking about an existing task log. Read the metadata and raw log text below, then answer in Russian.

            Latest user message:
            {user_message}

            Task metadata:
            - Public ID: {task_public_id}
            - Status: {task_status}
            - Title: {task_title}

            Raw log text:
            {log_excerpt}

            Requirements:
            - Do not return JSON.
            - Do not dump the raw log text back to the user.
            - Summarize the important result in plain Russian.
            - Explain what was tested, what passed or failed, and the main blocker or outcome.
            - Mention the next practical step if the logs make it clear.
            - Keep the answer concise but informative.
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
            - Before any Python/backend check in `bot/`, read and follow this guide exactly:
              bot/docs/codex-python-validation-guide.md
            - For Python/backend changes in `bot/`, always run from `bot/` and use `./.venv/bin/python -m pytest ...`.
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

    @staticmethod
    def _active_tasks_block(active_tasks: list[dict[str, str]]) -> str:
        if not active_tasks:
            return "- <none>"
        lines = []
        for item in active_tasks[:20]:
            public_id = item.get("public_id", "").strip() or "<unknown>"
            status = item.get("status", "").strip() or "<unknown>"
            title = item.get("title", "").strip() or "<untitled>"
            lines.append(f"- {public_id} | {status} | {title}")
        return "\n".join(lines)

    @staticmethod
    def _truncate_log_excerpt(value: str, limit: int = 12000) -> str:
        normalized = value.strip()
        if not normalized:
            return "<empty>"
        if len(normalized) <= limit:
            return normalized
        return "[truncated to last log section]\n" + normalized[-limit:].lstrip()
