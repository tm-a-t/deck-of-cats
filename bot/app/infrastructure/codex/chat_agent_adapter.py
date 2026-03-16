from __future__ import annotations

from dataclasses import dataclass, replace

from app.infrastructure.codex.chat_agent_parser import ChatAgentAction, ChatAgentDecision, ChatAgentParser
from app.infrastructure.codex.json_output_parser import CodexJsonOutputParseError, CodexJsonOutputParser
from app.infrastructure.codex.personality_store import JsonPersonalityStore
from app.infrastructure.codex.prompt_builder import CodexPromptBuilder
from app.infrastructure.execution.process_runner import ProcessRunner


class ChatAgentAdapterError(RuntimeError):
    pass


@dataclass(frozen=True)
class ChatAgentRequest:
    chat_id: int
    user_message: str
    active_tasks: list[dict[str, str]]


@dataclass(frozen=True)
class ChatAgentLogSummaryRequest:
    chat_id: int
    user_message: str
    task_public_id: str
    task_title: str
    task_status: str
    log_text: str


class CodexChatAgentAdapter:
    def __init__(
        self,
        runner: ProcessRunner,
        prompt_builder: CodexPromptBuilder,
        parser: ChatAgentParser,
        json_output_parser: CodexJsonOutputParser,
        personality_store: JsonPersonalityStore,
        repo_path: str,
        timeout_seconds: int,
        codex_executable: str = "codex",
        sandbox_mode: str = "workspace-write",
        approval_policy: str = "never",
        guide_path: str = "bot/personalities/chat-agent.md",
        personality_key_prefix: str = "chat-agent",
        conversation_reply_model: str | None = None,
    ) -> None:
        self._runner = runner
        self._prompt_builder = prompt_builder
        self._parser = parser
        self._json_output_parser = json_output_parser
        self._personality_store = personality_store
        self._repo_path = repo_path
        self._timeout_seconds = timeout_seconds
        self._codex_executable = codex_executable
        self._sandbox_mode = sandbox_mode
        self._approval_policy = approval_policy
        self._guide_path = guide_path
        self._personality_key_prefix = personality_key_prefix
        self._conversation_reply_model = (conversation_reply_model or "").strip() or None

    async def plan(self, request: ChatAgentRequest) -> ChatAgentDecision:
        decision = await self._plan_routing(request)
        if decision.action != ChatAgentAction.REPLY or not self._conversation_reply_model:
            return decision

        reply_text = await self._generate_reply(request, model=self._conversation_reply_model)
        return replace(decision, reply_text=reply_text)

    async def _plan_routing(self, request: ChatAgentRequest) -> ChatAgentDecision:
        personality_key = f"{self._personality_key_prefix}:{request.chat_id}"
        stored = self._personality_store.get(personality_key)
        use_resume = stored is not None and bool(stored.session_id)
        prompt = self._prompt_builder.build_chat_agent_prompt(
            personality_key=personality_key,
            guide_path=self._guide_path,
            is_new_session=not use_resume,
            chat_id=request.chat_id,
            user_message=request.user_message,
            active_tasks=request.active_tasks,
        )
        parsed_output = await self._run_prompt(
            personality_key=personality_key,
            prompt=prompt,
            session_id=stored.session_id if use_resume and stored else None,
        )

        if not parsed_output.final_message:
            raise ChatAgentAdapterError("chat agent returned no final message")

        try:
            return self._parser.parse(parsed_output.final_message)
        except Exception as exc:
            raise ChatAgentAdapterError(f"chat agent parse failed: {exc}") from exc

    async def _generate_reply(self, request: ChatAgentRequest, model: str) -> str:
        personality_key = f"{self._personality_key_prefix}-reply:{request.chat_id}"
        stored = self._personality_store.get(personality_key)
        use_resume = stored is not None and bool(stored.session_id)
        prompt = self._prompt_builder.build_chat_reply_prompt(
            personality_key=personality_key,
            guide_path=self._guide_path,
            is_new_session=not use_resume,
            chat_id=request.chat_id,
            user_message=request.user_message,
        )
        parsed_output = await self._run_prompt(
            personality_key=personality_key,
            prompt=prompt,
            session_id=stored.session_id if use_resume and stored else None,
            model=model,
        )
        final_message = (parsed_output.final_message or "").strip()
        if not final_message:
            raise ChatAgentAdapterError("chat agent returned no conversational reply")
        return final_message

    async def explain_logs(self, request: ChatAgentLogSummaryRequest) -> str:
        personality_key = f"{self._personality_key_prefix}:{request.chat_id}"
        stored = self._personality_store.get(personality_key)
        use_resume = stored is not None and bool(stored.session_id)
        prompt = self._prompt_builder.build_chat_agent_log_summary_prompt(
            personality_key=personality_key,
            guide_path=self._guide_path,
            is_new_session=not use_resume,
            chat_id=request.chat_id,
            user_message=request.user_message,
            task_public_id=request.task_public_id,
            task_title=request.task_title,
            task_status=request.task_status,
            log_text=request.log_text,
        )
        parsed_output = await self._run_prompt(
            personality_key=personality_key,
            prompt=prompt,
            session_id=stored.session_id if use_resume and stored else None,
        )
        final_message = (parsed_output.final_message or "").strip()
        if not final_message:
            raise ChatAgentAdapterError("chat agent returned no log explanation")
        return final_message

    async def _run_prompt(
        self,
        personality_key: str,
        prompt: str,
        session_id: str | None,
        model: str | None = None,
    ):
        args = self._build_args(prompt=prompt, session_id=session_id, model=model)
        result = await self._runner.run(
            args=args,
            cwd=self._repo_path,
            timeout_seconds=self._timeout_seconds,
        )
        parsed_output = self._parse_json_output(result.stdout)
        if parsed_output.session_id:
            self._personality_store.save(personality_key, parsed_output.session_id, self._guide_path)

        if result.returncode != 0:
            summary = "timed out" if result.timed_out else "failed"
            raise ChatAgentAdapterError(
                f"chat agent codex exec {summary}: {result.stderr.strip() or result.stdout.strip() or 'no output'}"
            )
        return parsed_output

    def _build_args(self, prompt: str, session_id: str | None, model: str | None = None) -> list[str]:
        args = [
            self._codex_executable,
            "-a",
            self._approval_policy,
            "-s",
            self._sandbox_mode,
        ]
        if model:
            args.extend(["-m", model])
        args.append("exec")
        if session_id:
            args.extend(["resume", "--json", session_id, prompt])
            return args
        args.extend(["--json", prompt])
        return args

    def _parse_json_output(self, output: str):
        try:
            return self._json_output_parser.parse(output)
        except CodexJsonOutputParseError:
            return self._json_output_parser.parse("")
