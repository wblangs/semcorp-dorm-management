import os
from dataclasses import dataclass
from functools import cached_property
from typing import Optional

from sqlalchemy.engine import make_url


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./dorm_commute.db")
    secret_key: str = os.getenv("SECRET_KEY", "dev-only-change-me")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
    app_env: str = os.getenv("APP_ENV", "DEV").upper()
    cors_origins_raw: str = os.getenv("CORS_ORIGINS", "*")
    # IANA timezone used for "today"/"now" date calculations (e.g. stay risk,
    # default check-in/out dates). The server OS may run in UTC; this keeps
    # date logic anchored to the site's local time.
    app_timezone: str = os.getenv("APP_TIMEZONE", "America/New_York")
    # DingTalk 免登 (auto-login). All three must be set to enable it.
    dingtalk_client_id: str = os.getenv("DINGTALK_CLIENT_ID", "")
    dingtalk_client_secret: str = os.getenv("DINGTALK_CLIENT_SECRET", "")
    dingtalk_corp_id: str = os.getenv("DINGTALK_CORP_ID", "")
    # DingTalk 应用 AgentId — required additionally for sending work notifications (工作通知).
    dingtalk_agent_id: str = os.getenv("DINGTALK_AGENT_ID", "")
    app_version: str = "v0.7"

    @cached_property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()] or ["*"]

    @cached_property
    def database_driver(self) -> str:
        return make_url(self.database_url).drivername

    @cached_property
    def database_type(self) -> str:
        driver = self.database_driver.lower()
        if driver.startswith("sqlite"):
            return "SQLite"
        if driver.startswith("mysql"):
            return "MySQL"
        return driver

    @cached_property
    def safe_database_url(self) -> str:
        return str(make_url(self.database_url).render_as_string(hide_password=True))

    @classmethod
    def from_env(cls, environ: Optional[dict[str, str]] = None) -> "Settings":
        source = environ if environ is not None else os.environ
        return cls(
            database_url=source.get("DATABASE_URL", "sqlite:///./dorm_commute.db"),
            secret_key=source.get("SECRET_KEY", "dev-only-change-me"),
            access_token_expire_minutes=int(source.get("ACCESS_TOKEN_EXPIRE_MINUTES", "480")),
            app_env=source.get("APP_ENV", "DEV").upper(),
            cors_origins_raw=source.get("CORS_ORIGINS", "*"),
            app_timezone=source.get("APP_TIMEZONE", "America/New_York"),
            dingtalk_client_id=source.get("DINGTALK_CLIENT_ID", ""),
            dingtalk_client_secret=source.get("DINGTALK_CLIENT_SECRET", ""),
            dingtalk_corp_id=source.get("DINGTALK_CORP_ID", ""),
            dingtalk_agent_id=source.get("DINGTALK_AGENT_ID", ""),
        )


settings = Settings.from_env()
