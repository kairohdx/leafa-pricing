from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from pydantic import ValidationError
from sqlalchemy import inspect

from app.core.config import ROOT, Settings
from app.db.base import Base
from app.db.session import build_engine


def test_settings():
    assert (ROOT / "api").is_dir()
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env="production", database_url="sqlite://", demo_mode=False)
    assert Settings(_env_file=None, app_env="production", database_url="sqlite://", demo_mode=True)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, session_hours=0)


def test_migration_upgrade_check_downgrade(tmp_path):
    url = f"sqlite:///{(tmp_path / 'migration.db').as_posix()}"
    config = Config(str(ROOT / "api/alembic.ini"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    command.check(config)
    engine = build_engine(url)
    assert set(Base.metadata.tables) <= set(inspect(engine).get_table_names())
    engine.dispose()
    command.downgrade(config, "base")
    engine = build_engine(url)
    assert inspect(engine).get_table_names() == ["alembic_version"]
    engine.dispose()
