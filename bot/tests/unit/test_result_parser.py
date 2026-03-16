from __future__ import annotations

import pytest

from app.infrastructure.codex.result_parser import CodexResultParseError, CodexResultParser


def test_parse_validate_success() -> None:
    parser = CodexResultParser()

    parsed = parser.parse_validate(
        """
        RESULT: PASS
        SUMMARY: Validation completed
        DETAILS: All checks are green
        """
    )

    assert parsed.ok is True
    assert parsed.summary == "Validation completed"
    assert parsed.details == "All checks are green"
    assert parsed.changed_files is None


def test_parse_implement_success_with_changed_files() -> None:
    parser = CodexResultParser()

    parsed = parser.parse_implement(
        """
        RESULT: PASS
        SUMMARY: Implementation done
        DETAILS: Added codex workflow
        CHANGED_FILES:
        - app/di.py
        - app/shared/enums.py
        """
    )

    assert parsed.ok is True
    assert parsed.summary == "Implementation done"
    assert parsed.details == "Added codex workflow"
    assert parsed.changed_files == ["app/di.py", "app/shared/enums.py"]


def test_parse_implement_requires_changed_files_block() -> None:
    parser = CodexResultParser()

    with pytest.raises(CodexResultParseError):
        parser.parse_implement(
            """
            RESULT: PASS
            SUMMARY: Done
            DETAILS: Changed files omitted
            """
        )


def test_parse_validate_rejects_invalid_result() -> None:
    parser = CodexResultParser()

    with pytest.raises(CodexResultParseError):
        parser.parse_validate(
            """
            RESULT: MAYBE
            SUMMARY: Unknown
            DETAILS: Invalid result value
            """
        )


def test_parse_implement_pass_requires_non_empty_changed_files() -> None:
    parser = CodexResultParser()

    with pytest.raises(CodexResultParseError):
        parser.parse_implement(
            """
            RESULT: PASS
            SUMMARY: Done
            DETAILS: No files listed
            CHANGED_FILES:
            """
        )


def test_parse_validate_ignores_trailing_lines_after_details() -> None:
    parser = CodexResultParser()

    parsed = parser.parse_validate(
        """
        RESULT: PASS
        SUMMARY: Validation completed
        DETAILS: Checks passed
        EXTRA: this should be ignored
        some trailing line
        """
    )

    assert parsed.ok is True
    assert parsed.summary == "Validation completed"
    assert parsed.details == "Checks passed"


def test_parse_research_supports_multiline_details_block() -> None:
    parser = CodexResultParser()

    parsed = parser.parse_research(
        """
        RESULT: PASS
        SUMMARY: Research completed
        DETAILS:
        Problems:
        - The bot retries the wrong path.
        Missing features:
        - No dedicated research button.
        """
    )

    assert parsed.ok is True
    assert parsed.summary == "Research completed"
    assert "Problems:" in parsed.details
    assert "No dedicated research button." in parsed.details
