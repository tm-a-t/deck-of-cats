from __future__ import annotations

from functools import cached_property

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    telegram_bot_token: str = Field(alias="TELEGRAM_BOT_TOKEN")
    telegram_allowed_user_ids: str = Field(default="", alias="TELEGRAM_ALLOWED_USER_IDS")

    bot_db_path: str = Field(default="bot/runtime/dev_bot.sqlite3", alias="BOT_DB_PATH")
    bot_log_level: str = Field(default="INFO", alias="BOT_LOG_LEVEL")
    bot_poll_interval_seconds: int = Field(default=10, alias="BOT_POLL_INTERVAL_SECONDS")
    bot_decision_ttl_seconds: int = Field(default=3600, alias="BOT_DECISION_TTL_SECONDS")
    bot_max_retries: int = Field(default=3, alias="BOT_MAX_RETRIES")
    bot_step_timeout_seconds: int = Field(default=300, alias="BOT_STEP_TIMEOUT_SECONDS")
    bot_dry_run: bool = Field(default=True, alias="BOT_DRY_RUN")
    bot_auto_start_tasks: bool = Field(default=False, alias="BOT_AUTO_START_TASKS")
    bot_enable_worker_loop: bool = Field(default=False, alias="BOT_ENABLE_WORKER_LOOP")

    repo_path: str = Field(alias="REPO_PATH")
    default_base_branch: str = Field(default="master", alias="DEFAULT_BASE_BRANCH")

    github_owner: str = Field(default="", alias="GITHUB_OWNER")
    github_repo: str = Field(default="", alias="GITHUB_REPO")
    github_token: str = Field(default="", alias="GITHUB_TOKEN")
    github_api_base_url: str = Field(default="https://api.github.com", alias="GITHUB_API_BASE_URL")
    github_remote_name: str = Field(default="origin", alias="GITHUB_REMOTE_NAME")
    github_merge_method: str = Field(default="squash", alias="GITHUB_MERGE_METHOD")
    git_author_name: str = Field(default="Codex Bot", alias="GIT_AUTHOR_NAME")
    git_author_email: str = Field(default="codex-bot@example.com", alias="GIT_AUTHOR_EMAIL")

    codex_cli_executable: str = Field(default="codex", alias="CODEX_CLI_EXECUTABLE")

    @cached_property
    def allowed_user_ids(self) -> set[int]:
        result: set[int] = set()
        for item in self.telegram_allowed_user_ids.split(","):
            item = item.strip()
            if not item:
                continue
            result.add(int(item))
        return result
