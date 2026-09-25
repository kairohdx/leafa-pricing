from alembic import context

from app.core.config import get_settings
from app.db.base import Base
from app.db import models  # noqa: F401
from app.db.session import build_engine

config = context.config
database_url = config.attributes.get("database_url") or get_settings().database_url

if context.is_offline_mode():
    context.configure(url=database_url, target_metadata=Base.metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = build_engine(database_url)
    try:
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True, render_as_batch=engine.dialect.name == "sqlite")
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()
