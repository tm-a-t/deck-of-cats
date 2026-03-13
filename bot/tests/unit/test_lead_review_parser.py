from __future__ import annotations

import pytest

from app.infrastructure.codex.lead_review_parser import CodexLeadReviewParseError, CodexLeadReviewParser
from app.shared.enums import MergeDecision


def test_parse_lead_review_success() -> None:
    parser = CodexLeadReviewParser()

    parsed = parser.parse(
        """
        DECISION: MERGE
        SUMMARY: Ready
        DETAILS: Looks good
        """
    )

    assert parsed.decision == MergeDecision.MERGE
    assert parsed.summary == "Ready"
    assert parsed.details == "Looks good"


def test_parse_lead_review_rejects_unknown_decision() -> None:
    parser = CodexLeadReviewParser()

    with pytest.raises(CodexLeadReviewParseError):
        parser.parse(
            """
            DECISION: MAYBE
            SUMMARY: Unknown
            DETAILS: Unsupported
            """
        )
