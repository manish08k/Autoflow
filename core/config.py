"""
AutoFlow – Central configuration
All secrets come from environment variables.
Operators register their own OAuth apps once (in .env / docker secrets);
end-users never touch credentials — they just click "Connect".
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── App ──────────────────────────────────────────────────────────
    APP_NAME: str = "AutoFlow"
    APP_ENV: str = "production"
    APP_BASE_URL: str = "http://localhost:8000"
    APP_SECRET_KEY: str = Field(..., min_length=32)
    DEBUG: bool = False

    # ── Database ─────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://autoflow:autoflow@localhost:5432/autoflow"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40

    # ── Redis / Celery ────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ── Credential encryption (AES-256-GCM) ──────────────────────────
    CREDENTIAL_ENCRYPTION_KEY: str = Field(..., min_length=32)

    # ── OAuth – Google ────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # ── OAuth – Slack ─────────────────────────────────────────────────
    SLACK_CLIENT_ID: str = ""
    SLACK_CLIENT_SECRET: str = ""
    SLACK_SIGNING_SECRET: str = ""

    # ── OAuth – GitHub ────────────────────────────────────────────────
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    # ── OAuth – Notion ────────────────────────────────────────────────
    NOTION_CLIENT_ID: str = ""
    NOTION_CLIENT_SECRET: str = ""

    # ── OAuth – Discord ───────────────────────────────────────────────
    DISCORD_CLIENT_ID: str = ""
    DISCORD_CLIENT_SECRET: str = ""

    # ── OAuth – HubSpot ───────────────────────────────────────────────
    HUBSPOT_CLIENT_ID: str = ""
    HUBSPOT_CLIENT_SECRET: str = ""

    # ── OAuth – Airtable ──────────────────────────────────────────────
    AIRTABLE_CLIENT_ID: str = ""
    AIRTABLE_CLIENT_SECRET: str = ""

    # ── WhatsApp (Meta Cloud API – operator registers app once) ───────
    WHATSAPP_APP_ID: str = ""
    WHATSAPP_APP_SECRET: str = ""
    WHATSAPP_VERIFY_TOKEN: str = "autoflow_whatsapp_verify"

    # ── Telegram (bot token – operator creates bot via @BotFather) ────
    TELEGRAM_BOT_TOKEN: str = ""

    # ── SMTP fallback ─────────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""

    # ── Monitoring ────────────────────────────────────────────────────
    PROMETHEUS_ENABLED: bool = True
    LOG_LEVEL: str = "INFO"

    # ── Derived helpers ───────────────────────────────────────────────
    @property
    def oauth_redirect_base(self) -> str:
        return f"{self.APP_BASE_URL}/oauth/callback"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
