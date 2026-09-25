from decimal import Decimal
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, StatementError
from sqlalchemy.schema import CreateTable, CreateIndex
from sqlalchemy.dialects import postgresql
from app.db.base import Base
from app.db.models import Company, Service, PricingRule
from app.db.types import ScaledDecimal


def test_exact_money_storage(session):
    company = Company(name="Demo", slug="demo")
    session.add(company)
    session.flush()
    service = Service(company_id=company.id, name="Installation", base_price=Decimal("123.45"))
    session.add(service)
    session.commit()
    session.refresh(service)
    assert service.base_price == Decimal("123.45")
    assert session.execute(text("select base_price from services")).scalar_one() == 12345


@pytest.mark.parametrize("value", ["1.001", "NaN", "Infinity", "92233720368547758.08", 1.2, True])
def test_invalid_money(value):
    with pytest.raises(ValueError):
        ScaledDecimal(2).process_bind_param(value, None)


def test_negative_price_rejected(session):
    company = Company(name="Demo", slug="demo")
    session.add(company)
    session.flush()
    session.add(Service(company_id=company.id, name="Bad", base_price=Decimal("-1")))
    with pytest.raises(IntegrityError):
        session.flush()


def test_one_active_default_rule(session):
    company = Company(name="Demo", slug="demo")
    session.add(company)
    session.flush()
    for name in ("one", "two"):
        session.add(PricingRule(company_id=company.id, name=name, strategy_key="manual", is_default=True))
    with pytest.raises(IntegrityError):
        session.flush()


def test_postgresql_ddl_compiles():
    for table in Base.metadata.sorted_tables:
        assert str(CreateTable(table).compile(dialect=postgresql.dialect()))
        for index in table.indexes:
            assert str(CreateIndex(index).compile(dialect=postgresql.dialect()))


def test_sale_snapshot_survives_catalog_edit_and_blocks_delete(session):
    from app.db.models import User, Sale, SaleLine
    company = Company(name="Demo", slug="demo")
    session.add(company)
    session.flush()
    user = User(company_id=company.id, username="admin", name="Admin", email="admin@example.com", phone="", password_hash="hash", role="admin")
    service = Service(company_id=company.id, name="Original", base_price=Decimal("10"))
    session.add_all([user, service])
    session.flush()
    sale = Sale(company_id=company.id, created_by_id=user.id, description="Sale", final_total=Decimal("10"))
    session.add(sale)
    session.flush()
    line = SaleLine(company_id=company.id, sale_id=sale.id, kind="service", service_id=service.id, quantity=Decimal("1"), description_snapshot="Original", unit_price_snapshot=Decimal("10"))
    session.add(line)
    session.commit()
    service.name, service.base_price = "Changed", Decimal("20")
    session.commit()
    session.refresh(line)
    assert line.description_snapshot == "Original"
    assert line.unit_price_snapshot == Decimal("10")
    session.delete(service)
    with pytest.raises(IntegrityError):
        session.flush()
