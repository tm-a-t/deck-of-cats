from __future__ import annotations

import sqlite3
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from aiogram import Bot

from app.application.orchestrators.dev_cycle_orchestrator import DevCycleOrchestrator
from app.application.ports.unit_of_work import UnitOfWork
from app.application.use_cases.accept_merge_decision import AcceptMergeDecisionUseCase
from app.application.use_cases.launch_research_project import LaunchResearchProjectUseCase
from app.application.use_cases.list_active_tasks import ListActiveTasksUseCase
from app.application.use_cases.request_task_status import RequestTaskStatusUseCase
from app.application.use_cases.submit_change_request import SubmitChangeRequestUseCase
from app.application.workflows.dev_cycle_workflow import DevCycleWorkflow
from app.application.workflows.steps.codex_implement_step import CodexImplementStep
from app.application.workflows.steps.codex_lead_review_step import CodexLeadReviewStep
from app.application.workflows.steps.codex_research_step import CodexResearchStep
from app.application.workflows.steps.codex_validate_step import CodexValidateStep
from app.application.workflows.steps.decision_step import DecisionStep
from app.application.workflows.steps.preview_step import PreviewStep
from app.application.workflows.steps.pr_step import PrStep
from app.infrastructure.codex.chat_agent_adapter import CodexChatAgentAdapter
from app.infrastructure.codex.chat_agent_parser import ChatAgentParser
from app.infrastructure.codex.codex_cli_adapter import CodexCliAdapter
from app.infrastructure.codex.json_output_parser import CodexJsonOutputParser
from app.infrastructure.codex.personality import CodexPersonalityRegistry
from app.infrastructure.codex.personality_store import JsonPersonalityStore
from app.infrastructure.codex.prompt_builder import CodexPromptBuilder
from app.infrastructure.codex.result_parser import CodexResultParser
from app.infrastructure.execution.process_runner import ProcessRunner
from app.infrastructure.execution.self_restart_scheduler import DetachedSelfRestartScheduler
from app.infrastructure.execution.sandbox_runner import SandboxRunner
from app.infrastructure.execution.worktree_manager import WorktreeManager
from app.infrastructure.notifier.telegram_notifier import TelegramNotifier
from app.infrastructure.persistence.sqlite.lock_repository_impl import SQLiteLockRepository
from app.infrastructure.persistence.sqlite.models import init_db
from app.infrastructure.persistence.sqlite.uow import SqliteUnitOfWork
from app.infrastructure.preview.netlify_query_adapter import NetlifyQueryAdapter
from app.infrastructure.vcs.github_branch_adapter import GithubBranchAdapter
from app.infrastructure.vcs.github_merge_adapter import GithubMergeAdapter
from app.infrastructure.vcs.github_pr_adapter import GithubPullRequestAdapter
from app.infrastructure.vcs.base_branch_resolver import resolve_base_branch
from app.settings import Settings
from app.shared.enums import StepName
from app.shared.security import CallbackSigner


@dataclass
class UseCases:
    submit_change_request: SubmitChangeRequestUseCase
    launch_research_project: LaunchResearchProjectUseCase
    request_task_status: RequestTaskStatusUseCase
    list_active_tasks: ListActiveTasksUseCase
    accept_merge_decision: AcceptMergeDecisionUseCase


@dataclass
class Container:
    settings: Settings
    bot: Bot
    callback_signer: CallbackSigner
    uow_factory: Callable[[], UnitOfWork]
    orchestrator: DevCycleOrchestrator
    chat_agent: CodexChatAgentAdapter
    use_cases: UseCases


def _exit_current_process(code: int) -> None:
    raise SystemExit(code)


def build_container(settings: Settings) -> Container:
    bot = Bot(token=settings.telegram_bot_token)
    callback_signer = CallbackSigner(settings.telegram_bot_token)

    process_runner = ProcessRunner()
    sandbox_runner = SandboxRunner()
    resolved_base_branch = resolve_base_branch(
        settings.repo_path,
        settings.default_base_branch,
        settings.bot_use_current_branch,
    )
    worktree_manager = WorktreeManager(settings.repo_path, resolved_base_branch)

    db_path = Path(settings.bot_db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    uow_factory = lambda: SqliteUnitOfWork(str(db_path))
    lock_conn = sqlite3.connect(str(db_path), check_same_thread=False)
    init_db(lock_conn)
    lock_port = SQLiteLockRepository(lock_conn)

    notifier = TelegramNotifier(bot, callback_signer)
    personality_store = JsonPersonalityStore(str(Path(settings.repo_path) / "bot" / "runtime" / "agent_personalities.json"))
    personality_registry = CodexPersonalityRegistry.default()
    prompt_builder = CodexPromptBuilder()
    json_output_parser = CodexJsonOutputParser()

    codex_adapter = CodexCliAdapter(
        runner=process_runner,
        worktree_manager=worktree_manager,
        prompt_builder=prompt_builder,
        result_parser=CodexResultParser(),
        timeout_seconds=settings.bot_step_timeout_seconds,
        codex_executable=settings.codex_cli_executable,
        sandbox_mode=settings.codex_cli_sandbox_mode,
        approval_policy=settings.codex_cli_approval_policy,
        personality_registry=personality_registry,
        personality_store=personality_store,
        json_output_parser=json_output_parser,
    )
    chat_agent = CodexChatAgentAdapter(
        runner=process_runner,
        prompt_builder=prompt_builder,
        parser=ChatAgentParser(),
        json_output_parser=json_output_parser,
        personality_store=personality_store,
        repo_path=settings.repo_path,
        timeout_seconds=settings.bot_step_timeout_seconds,
        codex_executable=settings.codex_cli_executable,
        sandbox_mode=settings.codex_cli_sandbox_mode,
        approval_policy=settings.codex_cli_approval_policy,
    )

    branch_port = GithubBranchAdapter(
        runner=sandbox_runner,
        worktree_manager=worktree_manager,
        timeout_seconds=settings.bot_step_timeout_seconds,
    )
    pr_port = GithubPullRequestAdapter(
        owner=settings.github_owner,
        repo=settings.github_repo,
        token=settings.github_token,
        api_base_url=settings.github_api_base_url,
        remote_name=settings.github_remote_name,
        base_branch=resolved_base_branch,
        git_author_name=settings.git_author_name,
        git_author_email=settings.git_author_email,
        dry_run=settings.bot_dry_run,
        runner=sandbox_runner,
        worktree_manager=worktree_manager,
        timeout_seconds=settings.bot_step_timeout_seconds,
    )
    merge_port = GithubMergeAdapter(
        owner=settings.github_owner,
        repo=settings.github_repo,
        token=settings.github_token,
        api_base_url=settings.github_api_base_url,
        merge_method=settings.github_merge_method,
        dry_run=settings.bot_dry_run,
        timeout_seconds=settings.bot_step_timeout_seconds,
    )
    preview_port = NetlifyQueryAdapter(
        poll_interval_seconds=settings.bot_poll_interval_seconds,
        owner=settings.github_owner,
        repo=settings.github_repo,
        token=settings.github_token,
        api_base_url=settings.github_api_base_url,
    )

    workflow = DevCycleWorkflow(auto_lead_review=settings.bot_enable_lead_autoreview)
    steps = {
        StepName.RESEARCH: CodexResearchStep(codex_adapter),
        StepName.CODEX_IMPLEMENT: CodexImplementStep(codex_adapter),
        StepName.CODEX_VALIDATE: CodexValidateStep(codex_adapter),
        StepName.LEAD_REVIEW: CodexLeadReviewStep(codex_adapter),
        StepName.PR: PrStep(branch_port, pr_port),
        StepName.PREVIEW: PreviewStep(preview_port, timeout_seconds=settings.bot_step_timeout_seconds),
        StepName.DECISION: DecisionStep(),
    }

    restart_scheduler = DetachedSelfRestartScheduler(
        repo_path=settings.repo_path,
        bot_path=str(Path(settings.repo_path) / "bot"),
        base_branch=resolved_base_branch,
        remote_name=settings.github_remote_name,
        python_executable=sys.executable,
        restart_module=settings.bot_self_restart_module,
    )

    accept_merge_decision = AcceptMergeDecisionUseCase(
        uow_factory=uow_factory,
        merge_port=merge_port,
        notifier=notifier,
        worktree_cleanup=worktree_manager.cleanup,
        self_approve_prs=settings.bot_self_approve_prs,
        self_restart_scheduler=restart_scheduler.enqueue if settings.bot_self_approve_prs else None,
        exit_handler=_exit_current_process if settings.bot_self_approve_prs else None,
    )

    orchestrator = DevCycleOrchestrator(
        uow_factory=uow_factory,
        workflow=workflow,
        steps=steps,
        lock_port=lock_port,
        notifier=notifier,
        max_retries=settings.bot_max_retries,
        decision_ttl_seconds=settings.bot_decision_ttl_seconds,
        auto_decision_use_case=accept_merge_decision if settings.bot_enable_lead_autoreview else None,
    )

    submit_change_request = SubmitChangeRequestUseCase(
        uow_factory=uow_factory,
        notifier=notifier,
        orchestrator=orchestrator,
        auto_start=settings.bot_auto_start_tasks,
    )

    use_cases = UseCases(
        submit_change_request=submit_change_request,
        launch_research_project=LaunchResearchProjectUseCase(
            uow_factory=uow_factory,
            submit_change_request=submit_change_request,
        ),
        request_task_status=RequestTaskStatusUseCase(uow_factory=uow_factory),
        list_active_tasks=ListActiveTasksUseCase(uow_factory=uow_factory),
        accept_merge_decision=accept_merge_decision,
    )

    return Container(
        settings=settings,
        bot=bot,
        callback_signer=callback_signer,
        uow_factory=uow_factory,
        orchestrator=orchestrator,
        chat_agent=chat_agent,
        use_cases=use_cases,
    )
