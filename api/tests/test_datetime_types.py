from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, insert, select, text
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.types import UTCDateTime, utc_now
from app.modules.companies.models import Company
from app.modules.identity.models import AuthSession, User, UserRole


def test_sqlite_roundtrip_and_timestamps():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    local_expiry = datetime(2026, 9, 14, 9, 30, tzinfo=timezone(timedelta(hours=-3)))
    with Session(engine) as session:
        company = Company(name="Demo", slug="demo")
        session.add(company)
        session.flush()
        user = User(company_id=company.id, username="demo", name="Demo",
                    email="demo@example.com", phone="", password_hash="test",
                    role=UserRole.ADMIN)
        session.add(user)
        session.flush()
        auth = AuthSession(user_id=user.id, token_hash="a" * 64, expires_at=local_expiry)
        session.add(auth)
        session.commit()
        session.refresh(auth)
        assert auth.expires_at == local_expiry.astimezone(timezone.utc)
        assert auth.expires_at.tzinfo == timezone.utc
        assert auth.revoked_at is None
        assert auth.created_at.tzinfo == timezone.utc
        created_at = auth.created_at
        # Ensure the next UPDATE replaces this old value via onupdate.
        session.execute(text("UPDATE auth_sessions SET updated_at='2000-01-01 00:00:00'"))
        session.expire_all()
        before_update = utc_now()
        auth.revoked_at = before_update
        session.commit()
        session.refresh(auth)
        assert auth.created_at == created_at
        assert before_update <= auth.updated_at <= utc_now()
        assert auth.revoked_at == before_update
        raw = session.execute(text("SELECT expires_at FROM auth_sessions")).scalar_one()
        assert raw == "2026-09-14 12:30:00.000000"
    engine.dispose()


@pytest.mark.parametrize("dialect", [sqlite.dialect(), postgresql.dialect()])
def test_rejects_naive_input(dialect):
    with pytest.raises(ValueError, match="timezone"):
        UTCDateTime().process_bind_param(datetime(2026, 1, 1), dialect)


def test_postgresql_uses_timezone_and_normalizes_values():
    dialect = postgresql.dialect()
    column_type = UTCDateTime()
    assert column_type.compile(dialect=dialect) == "TIMESTAMP WITH TIME ZONE"
    value = datetime(2026, 9, 14, 9, tzinfo=timezone(timedelta(hours=5)))
    expected = datetime(2026, 9, 14, 4, tzinfo=timezone.utc)
    assert column_type.process_bind_param(value, dialect) == expected
    assert column_type.process_result_value(value, dialect) == expected
    assert column_type.process_bind_param(None, dialect) is None
    assert column_type.process_result_value(None, dialect) is None


def test_defaults_are_evaluated_for_each_insert():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(insert(Company).values(name="First", slug="first"))
        before_second = utc_now()
        conn.execute(insert(Company).values(name="Second", slug="second"))
        second_created = conn.execute(
            select(Company.created_at).where(Company.slug == "second")
        ).scalar_one()
        assert before_second <= second_created <= utc_now()
    engine.dispose()
