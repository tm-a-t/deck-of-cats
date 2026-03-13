from __future__ import annotations

from dataclasses import dataclass

from app.shared.enums import MergeDecision


class CodexLeadReviewParseError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedLeadReview:
    decision: MergeDecision
    summary: str
    details: str


class CodexLeadReviewParser:
    def parse(self, output: str) -> ParsedLeadReview:
        lines = [line.strip() for line in output.splitlines() if line.strip()]
        if len(lines) < 3:
            raise CodexLeadReviewParseError("Output does not contain full DECISION/SUMMARY/DETAILS block")

        decision_raw = self._extract_value(lines[0], "DECISION:")
        summary = self._extract_value(lines[1], "SUMMARY:")
        details = self._extract_value(lines[2], "DETAILS:")

        if not summary:
            raise CodexLeadReviewParseError("SUMMARY must be non-empty")
        if not details:
            raise CodexLeadReviewParseError("DETAILS must be non-empty")

        normalized_decision = decision_raw.strip().upper()
        mapping = {
            "MERGE": MergeDecision.MERGE,
            "CLOSE": MergeDecision.CLOSE,
            "RERUN_TESTS": MergeDecision.RERUN_TESTS,
        }
        decision = mapping.get(normalized_decision)
        if decision is None:
            raise CodexLeadReviewParseError(f"Unsupported DECISION value: {decision_raw}")

        return ParsedLeadReview(
            decision=decision,
            summary=summary,
            details=details,
        )

    @staticmethod
    def _extract_value(line: str, prefix: str) -> str:
        if not line.startswith(prefix):
            raise CodexLeadReviewParseError(f"Expected '{prefix}' line")
        return line.split(":", 1)[1].strip()
