"""Explicit, transactional demo seed. Existing accounts are never overwritten."""

import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db import models
from app.db.session import build_engine


def main():
    settings = get_settings()
    password = os.environ.get("DEMO_PASSWORD", "")
    if not settings.demo_mode or len(password) < 12:
        raise RuntimeError("Seed requires DEMO_MODE=true and DEMO_PASSWORD with at least 12 characters.")
    engine = build_engine(settings.database_url)
    try:
        with Session(engine) as db, db.begin():
            for slug, name, email in [("oficina-demo", "Oficina Demo", "alex@example.com"), ("atelie-demo", "Ateliê Demo", "sam@example.com")]:
                company = db.scalar(select(models.Company).where(models.Company.slug == slug))
                if company is None:
                    company = models.Company(name=name, slug=slug)
                    db.add(company)
                    db.flush()
                user = db.scalar(select(models.User).where(models.User.email == email))
                if user is not None:
                    if user.company_id != company.id:
                        raise RuntimeError("Demo email already belongs to a different company.")
                    continue
                db.add(models.User(company_id=company.id, username=email.split("@")[0], name=name,
                                   email=email, phone="", role="admin", password_hash=hash_password(password)))
        print("Demo accounts ready: alex@example.com and sam@example.com. Existing passwords preserved.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
