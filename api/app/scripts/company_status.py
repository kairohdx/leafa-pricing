"""Host administration: python -m app.scripts.company_status UUID activate|deactivate."""
import argparse
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import build_engine
from app.modules.companies.service import set_company_active


def main():
    parser = argparse.ArgumentParser(description="Host-only company activation; records audit and revokes sessions on deactivation.")
    parser.add_argument("company_id", type=UUID)
    parser.add_argument("action", choices=["activate", "deactivate"])
    args = parser.parse_args()
    engine = build_engine(get_settings().database_url)
    try:
        with Session(engine) as db:
            set_company_active(db, args.company_id, args.action == "activate")
        print("Company status applied.")
    except HTTPException as exc:
        parser.exit(1, f"{exc.detail}\n")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
