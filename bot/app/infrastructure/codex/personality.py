from __future__ import annotations

from dataclasses import dataclass

from app.shared.enums import StepName


@dataclass(frozen=True)
class CodexPersonality:
    key: str
    guide_path: str
    persist_session: bool


class CodexPersonalityRegistry:
    def __init__(self, by_step: dict[StepName, CodexPersonality]) -> None:
        self._by_step = dict(by_step)

    @classmethod
    def default(cls) -> "CodexPersonalityRegistry":
        return cls(
            {
                StepName.CODEX_IMPLEMENT: CodexPersonality(
                    key="developer",
                    guide_path="bot/personalities/developer.md",
                    persist_session=True,
                ),
                StepName.CODEX_VALIDATE: CodexPersonality(
                    key="tester",
                    guide_path="bot/personalities/tester.md",
                    persist_session=False,
                ),
                StepName.LEAD_REVIEW: CodexPersonality(
                    key="lead",
                    guide_path="bot/personalities/lead.md",
                    persist_session=True,
                ),
            }
        )

    def for_step(self, step: StepName) -> CodexPersonality:
        try:
            return self._by_step[step]
        except KeyError as exc:  # pragma: no cover - defensive guard
            raise KeyError(f"No Codex personality configured for step {step.value}") from exc
