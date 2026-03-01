from __future__ import annotations

from app.domain.aggregates.task_aggregate import TaskAggregate
from app.infrastructure.codex.prompt_builder import CodexPromptBuilder


def _task() -> TaskAggregate:
    return TaskAggregate.create(
        task_id="99999999-9999-9999-9999-999999999999",
        author_id=1,
        title="Validate homepage",
        body="Check homepage title and controls",
        correlation_id="corr-x",
    )


def test_validate_prompt_includes_playwright_guide_path() -> None:
    prompt = CodexPromptBuilder().build_validate_prompt(_task())

    assert "bot/docs/codex-playwright-validation-guide.md" in prompt
    assert "Before any browser check, read and follow this guide exactly" in prompt

