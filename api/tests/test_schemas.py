import importlib
from uuid import uuid4
import pytest
from pydantic import ValidationError
from app.schemas import Schema
from app.modules.services.schemas import ServiceCreate, ServiceUpdate
from app.modules.materials.schemas import MaterialUpdate
from app.modules.sales.schemas import SaleLineCreate, SaleCreate
from app.modules.companies.schemas import CompanyCreate, CompanyUpdate
from app.modules.identity.schemas import UserRead, AuthSessionRead


def test_all_contracts_generate_json_schema():
    for module in ('companies', 'identity', 'units', 'materials', 'products', 'services', 'pricing', 'sales', 'audit', 'analytics'):
        imported = importlib.import_module(f'app.modules.{module}.schemas')
        for value in vars(imported).values():
            if isinstance(value, type) and issubclass(value, Schema):
                value.model_json_schema()


def test_money_json_and_patch():
    assert ServiceCreate(name=" Test ", base_price="12.30").model_dump(mode="json")["base_price"] == "12.30"
    assert ServiceUpdate().model_dump(exclude_unset=True) == {}
    assert MaterialUpdate(notes=None).model_dump(exclude_unset=True) == {"notes": None}
    with pytest.raises(ValidationError):
        ServiceUpdate(base_price=None)


@pytest.mark.parametrize('data', [dict(base_price=1.2), dict(base_price="-1"), dict(base_price="1.001"), dict(base_price="1", company_id=str(uuid4())), dict(base_price="1", name=" ")])
def test_invalid_service_input(data):
    with pytest.raises(ValidationError):
        ServiceCreate(**(dict(name="Test") | data))


def test_line_reference_and_dates():
    SaleLineCreate(kind="product", product_id=uuid4(), quantity="1")
    with pytest.raises(ValidationError):
        SaleLineCreate(kind="product", material_id=uuid4(), quantity="1")
    with pytest.raises(ValidationError):
        SaleLineCreate(kind="product", product_id=uuid4(), material_id=uuid4(), quantity="1")
    with pytest.raises(ValidationError):
        SaleCreate(description="Sale", occurred_at="2026-01-01T00:00:00", final_total="1")


def test_timezone_and_secret_contracts():
    CompanyCreate(name="Demo", slug="demo")
    with pytest.raises(ValidationError):
        CompanyUpdate(timezone="Invalid/Zone")
    assert "password_hash" not in UserRead.model_fields
    assert "password" not in UserRead.model_fields
    assert "token_hash" not in AuthSessionRead.model_fields
