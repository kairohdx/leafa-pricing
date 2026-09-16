from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = f"sqlite:///{(ROOT / 'data' / 'leafa.db').as_posix()}"
    demo_mode: bool = False
    cors_origins: list[str] = Field(default_factory=list)
    session_hours: int = Field(default=24, ge=1, le=720)

    @model_validator(mode="after")
    def validate_database(self):
        url = make_url(self.database_url)
        if url.get_backend_name() not in ("sqlite", "postgresql"):
            raise ValueError("Only SQLite and PostgreSQL are supported.")
        if self.app_env == "production" and url.get_backend_name() == "sqlite" and not self.demo_mode:
            raise ValueError("Production SQLite requires explicit DEMO_MODE=true.")
        if "*" in self.cors_origins:
            raise ValueError("Configure explicit CORS origins.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
