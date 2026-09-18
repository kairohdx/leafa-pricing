from decimal import Decimal
import os
import subprocess
import sys
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.models import Company, Material, UnitDimension, UnitOfMeasure
from app.core.config import ROOT
from app.db.session import build_engine
from app.modules.units import service
from app.modules.units.schemas import UnitDimensionCreate, UnitDimensionUpdate, UnitOfMeasureCreate, UnitOfMeasureUpdate
from tests.test_companies import client, login, payload


def test_seed_cli_in_fresh_process(tmp_path):
    url = f"sqlite:///{(tmp_path / 'units.db').as_posix()}"
    env = os.environ | {"DATABASE_URL": url, "APP_ENV": "test", "PYTHONPATH": str(ROOT / "api")}
    subprocess.run([sys.executable, "-m", "alembic", "-c", str(ROOT / "api/alembic.ini"), "upgrade", "head"], cwd=ROOT, env=env, check=True, capture_output=True, text=True)
    engine = build_engine(url)
    try:
        previous_ids = None
        for _ in range(2):
            result = subprocess.run([sys.executable, "-m", "app.scripts.units_catalog", "seed"], cwd=ROOT, env=env, capture_output=True, text=True)
            assert result.returncode == 0, result.stderr
            assert "Catalog ready." in result.stdout
            with Session(engine) as db:
                ids = set(db.scalars(select(UnitOfMeasure.id)))
                assert len(ids) == 8
                assert db.scalar(select(func.count()).select_from(UnitDimension)) == 5
            if previous_ids is not None:
                assert ids == previous_ids
            previous_ids = ids
    finally:
        engine.dispose()


def test_catalog_read_pagination_and_no_public_writes(client):
    client.post("/companies", json=payload())
    client.post("/companies", json=payload("other"))
    headers = login(client)
    with Session(client.app.state.engine) as db, db.begin():
        service.seed_catalog(db)
    assert client.get("/units").status_code == 401
    page = client.get("/units?page_size=2", headers=headers).json()
    assert len(page["items"]) == 2 and page["total"] == 8
    assert client.get("/units", headers=login(client, "other")).json()["total"] == 8
    unit = client.get("/units/code/kg", headers=headers).json()
    assert client.get(f"/units/{unit['id']}", headers=headers).json() == unit
    assert client.get(f"/units?dimension_id={unit['dimension_id']}", headers=headers).json()["total"] == 2
    assert client.get("/unit-dimensions", headers=headers).json()["total"] == 5
    assert client.get(f"/unit-dimensions/{unit['dimension_id']}", headers=headers).status_code == 200
    assert client.get(f"/units/{uuid4()}", headers=headers).status_code == 404
    for path in ("/units", "/unit-dimensions"):
        assert client.post(path, headers=headers, json={}).status_code == 405
    assert client.patch(f"/units/{unit['id']}", headers=headers, json={"name": "No"}).status_code == 405
    assert client.get("/units?page_size=101", headers=headers).status_code == 422


def test_catalog_maintenance_and_protection(session):
    dimension = service.create_record(session, UnitDimension, UnitDimensionCreate(code="mass", name="Mass"))
    unit = service.create_record(session, UnitOfMeasure, UnitOfMeasureCreate(code="kg", name="Kilogram", symbol="kg", dimension_id=dimension.id))
    with pytest.raises(HTTPException) as error:
        service.edit_record(session, UnitDimension, dimension.id, UnitDimensionUpdate(storage_scale=3))
    assert error.value.status_code == 409
    service.edit_record(session, UnitDimension, dimension.id, UnitDimensionUpdate(name="Massa"))
    company = Company(name="Company", slug="company")
    session.add(company)
    session.flush()
    session.add(Material(company_id=company.id, name="Material", purchase_unit_code="kg", purchase_quantity=Decimal("1"), purchase_cost=Decimal("1")))
    session.flush()
    for changes in ({"code": "new"}, {"factor_numerator": 2}, {"factor_denominator": 2}):
        with pytest.raises(HTTPException) as error:
            service.edit_record(session, UnitOfMeasure, unit.id, UnitOfMeasureUpdate(**changes))
        assert error.value.status_code == 409
    service.edit_record(session, UnitOfMeasure, unit.id, UnitOfMeasureUpdate(name="Quilograma"))
    for model, record in ((UnitDimension, dimension), (UnitOfMeasure, unit)):
        with pytest.raises(HTTPException) as error:
            service.delete_record(session, model, record.id)
        assert error.value.status_code == 409


def test_unused_records_can_change_and_delete(session):
    dimension = service.create_record(session, UnitDimension, UnitDimensionCreate(code="test", name="Test"))
    service.edit_record(session, UnitDimension, dimension.id, UnitDimensionUpdate(storage_scale=0))
    unit = service.create_record(session, UnitOfMeasure, UnitOfMeasureCreate(code="test", name="Test", symbol="t", dimension_id=dimension.id))
    service.edit_record(session, UnitOfMeasure, unit.id, UnitOfMeasureUpdate(code="new", factor_numerator=3))
    service.delete_record(session, UnitOfMeasure, unit.id)
    service.delete_record(session, UnitDimension, dimension.id)
    assert session.scalar(select(func.count()).select_from(UnitDimension)) == 0


def test_seed_is_idempotent_and_refuses_semantic_conflicts(session):
    service.seed_catalog(session)
    session.commit()
    ids = set(session.scalars(select(UnitOfMeasure.id)))
    service.seed_catalog(session)
    assert set(session.scalars(select(UnitOfMeasure.id))) == ids
    gram = session.scalar(select(UnitOfMeasure).where(UnitOfMeasure.code == "g"))
    assert (gram.factor_numerator, gram.factor_denominator) == (1, 1000)
    gram.factor_denominator = 10
    session.flush()
    with pytest.raises(HTTPException) as error:
        service.seed_catalog(session)
    assert error.value.status_code == 409
