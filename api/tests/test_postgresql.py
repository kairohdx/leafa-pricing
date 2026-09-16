"""Run only against a disposable PostgreSQL database provided by CI."""
import os
from decimal import Decimal
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import ROOT
from app.db.models import Company, Service, User, Sale
from app.db.session import build_engine


@pytest.mark.skipif(not os.environ.get("TEST_POSTGRES_URL"), reason="Requires disposable PostgreSQL database")
def test_postgresql_migration_money_and_tenant_constraints():
    url = os.environ["TEST_POSTGRES_URL"]
    config = Config(str(ROOT / "api/alembic.ini"))
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
    command.check(config)
    engine = build_engine(url)
    try:
        with Session(engine) as db:
            first = Company(name="First", slug=str(uuid4()))
            second = Company(name="Second", slug=str(uuid4()))
            db.add_all([first, second])
            db.flush()
            service = Service(company_id=first.id, name="Service", base_price=Decimal("12.34"))
            user = User(company_id=first.id, username="test", name="Test", email=f"{uuid4()}@example.com", phone="", password_hash="test", role="admin")
            db.add_all([service, user])
            db.flush()
            db.refresh(service)
            assert service.base_price == Decimal("12.34")
            assert service.created_at.utcoffset().total_seconds() == 0
            assert db.scalar(text("SELECT base_price FROM services WHERE id=:id"), {"id": service.id}) == 1234
            db.add(Sale(company_id=second.id, created_by_id=user.id, description="Cross tenant", final_total=Decimal("1")))
            with pytest.raises(IntegrityError):
                db.flush()
            db.rollback()
    finally:
        engine.dispose()
    command.downgrade(config, "base")
