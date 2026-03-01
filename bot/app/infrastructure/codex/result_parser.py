from __future__ import annotations

from dataclasses import dataclass


class CodexResultParseError(ValueError):
    pass


@dataclass(frozen=True)
class ParsedCodexResult:
    ok: bool
    summary: str
    details: str
    changed_files: list[str] | None = None


class CodexResultParser:
    def parse_validate(self, output: str) -> ParsedCodexResult:
        return self._parse(output, require_changed_files=False)

    def parse_implement(self, output: str) -> ParsedCodexResult:
        return self._parse(output, require_changed_files=True)

    def _parse(self, output: str, require_changed_files: bool) -> ParsedCodexResult:
        lines = [line.strip() for line in output.splitlines() if line.strip()]
        if not lines:
            raise CodexResultParseError("Empty output")

        result_index = self._find_last_result_line(lines)
        block = lines[result_index:]

        if len(block) < 3:
            raise CodexResultParseError("Output does not contain full RESULT/SUMMARY/DETAILS block")

        raw_result = self._extract_value(block[0], "RESULT:")
        summary = self._extract_value(block[1], "SUMMARY:")
        details = self._extract_value(block[2], "DETAILS:")

        if not summary:
            raise CodexResultParseError("SUMMARY must be non-empty")
        if not details:
            raise CodexResultParseError("DETAILS must be non-empty")

        if raw_result not in {"PASS", "FAIL"}:
            raise CodexResultParseError(f"Unsupported RESULT value: {raw_result}")

        changed_files: list[str] | None = None
        if require_changed_files:
            if len(block) < 4:
                raise CodexResultParseError("Missing CHANGED_FILES section")
            if block[3] != "CHANGED_FILES:":
                raise CodexResultParseError("Missing CHANGED_FILES section")

            changed_files = []
            for line in block[4:]:
                if not line.startswith("- "):
                    raise CodexResultParseError("CHANGED_FILES must contain only '- path' entries")
                path = line[2:].strip()
                if not path:
                    raise CodexResultParseError("CHANGED_FILES entries must be non-empty")
                changed_files.append(path)
        elif len(block) != 3:
            raise CodexResultParseError("Unexpected lines after DETAILS for validate result")

        return ParsedCodexResult(
            ok=raw_result == "PASS",
            summary=summary,
            details=details,
            changed_files=changed_files,
        )

    @staticmethod
    def _find_last_result_line(lines: list[str]) -> int:
        for i in range(len(lines) - 1, -1, -1):
            if lines[i].startswith("RESULT:"):
                return i
        raise CodexResultParseError("Missing RESULT line")

    @staticmethod
    def _extract_value(line: str, prefix: str) -> str:
        if not line.startswith(prefix):
            raise CodexResultParseError(f"Expected '{prefix}' line")
        return line.split(":", 1)[1].strip()
