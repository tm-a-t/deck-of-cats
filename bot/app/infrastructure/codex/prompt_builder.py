from __future__ import annotations

import textwrap

from app.domain.aggregates.task_aggregate import TaskAggregate


class CodexPromptBuilder:
    def build_implement_prompt(self, task: TaskAggregate) -> str:
        return textwrap.dedent(
            f"""
            You are implementing a software task in the current git repository.
            Task ID: {task.id}
            Title: {task.title}
            Request:
            {task.body}

            Requirements:
            - Make code changes directly in the repo.
            - Keep existing behavior intact unless task requires changes.
            - Run relevant local checks for touched code.
            - Return the final answer strictly in the format below.

            RESULT: PASS|FAIL
            SUMMARY: <one line>
            DETAILS: <short text>
            CHANGED_FILES:
            - path/to/file
            """
        ).strip()

    def build_validate_prompt(self, task: TaskAggregate) -> str:
        return textwrap.dedent(
            f"""
            You are validating changes for a software task in the current git repository.
            Task ID: {task.id}
            Title: {task.title}
            Request:
            {task.body}

            Validation requirements:
            - Verify implementation completeness against task request.
            - Run relevant tests/checks, including browser checks when applicable.
            - Return the final answer strictly in the format below.

            RESULT: PASS|FAIL
            SUMMARY: <one line>
            DETAILS: <short text>
            """
        ).strip()
