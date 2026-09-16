"""Wait for DB, migrate once, optionally seed, then serve a single API process."""

import argparse
import os
import time

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
import uvicorn

from app.core.config import ROOT, get_settings
from app.db.session import build_engine


def prepare_database(timeout=60, seed=False):
    settings = get_settings()
    engine = build_engine(settings.database_url)
    try:
        deadline = time.monotonic() + timeout
        while True:
            try:
                with engine.connect() as connection:
                    connection.execute(text("SELECT 1"))
                break
            except OperationalError:
                if time.monotonic() >= deadline:
                    raise RuntimeError("Database was not ready before startup timeout.") from None
                time.sleep(1)
    finally:
        engine.dispose()
    config = Config(str(ROOT / "api/alembic.ini"))
    config.attributes["database_url"] = settings.database_url
    command.upgrade(config, "head")
    if seed:
        from app.scripts.seed_demo import main
        main()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8000")))
    parser.add_argument("--seed", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("port must be between 1 and 65535")
    prepare_database(seed=args.seed)
    uvicorn.run("app.main:app", host=args.host, port=args.port)


if __name__ == "__main__":
    main()
