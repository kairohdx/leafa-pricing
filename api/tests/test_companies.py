import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.base import Base
from app.db.models import AuditEvent, Company, User
from app.main import create_app
from app.modules.companies.service import set_company_active


@pytest.fixture
def client():
    app = create_app(Settings(_env_file=None, app_env="test", database_url="sqlite://"))
    with TestClient(app) as client:
        Base.metadata.create_all(app.state.engine)
        yield client


def payload(slug="first"):
    return {"company": {"name": slug, "slug": slug}, "admin": {"username": "admin", "name": "Admin", "email": f"{slug}@example.com", "password": "test-password"}}


def login(client, slug="first"):
    response = client.post("/auth/login", json={"email": f"{slug}@example.com", "password": "test-password"})
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def test_register_read_update_audit_and_isolation(client):
    first = client.post("/companies", json=payload())
    second = client.post("/companies", json=payload("second"))
    assert first.status_code == second.status_code == 201
    headers, other = login(client), login(client, "second")
    assert client.get("/companies/me", headers=headers).json()["id"] == first.json()["id"]
    response = client.patch("/companies/me", headers=headers, json={"name": "Updated", "timezone": "UTC"})
    assert response.status_code == 200
    assert response.json()["name"] == "Updated"
    assert client.get("/companies/me", headers=other).json()["name"] == "second"
    assert client.get(f"/companies/{first.json()['id']}", headers=other).status_code == 404
    assert client.get("/companies/me").status_code == 401
    assert client.get("/companies").status_code == 405
    assert client.delete("/companies/me", headers=headers).status_code == 405
    with Session(client.app.state.engine) as db:
        events = list(db.scalars(select(AuditEvent)))
        assert len(events) == 3
        assert "password" not in json.dumps([event.changes for event in events])
        assert events[-1].request_id == response.headers["x-request-id"]
    assert client.patch("/companies/me", headers=headers, json={}).status_code == 200
    with Session(client.app.state.engine) as db:
        assert db.scalar(select(func.count()).select_from(AuditEvent)) == 3


@pytest.mark.parametrize("conflict", ["slug", "email"])
def test_registration_conflict_rolls_back_everything(client, conflict):
    assert client.post("/companies", json=payload()).status_code == 201
    data = payload("second")
    if conflict == "slug":
        data["company"]["slug"] = "first"
    else:
        data["admin"]["email"] = "first@example.com"
    assert client.post("/companies", json=data).status_code == 409
    with Session(client.app.state.engine) as db:
        for model in (Company, User, AuditEvent):
            assert db.scalar(select(func.count()).select_from(model)) == 1


def test_operator_and_injected_fields_rejected(client):
    data = payload()
    data["admin"]["role"] = "operator"
    assert client.post("/companies", json=data).status_code == 422
    client.post("/companies", json=payload())
    headers = login(client)
    for change in ({"company_id": "invalid"}, {"is_active": False}, {"name": None}, {"timezone": "Invalid/Zone"}):
        assert client.patch("/companies/me", headers=headers, json=change).status_code == 422
    with Session(client.app.state.engine) as db:
        db.scalar(select(User)).role = "operator"
        db.commit()
    assert client.get("/companies/me", headers=headers).status_code == 200
    assert client.patch("/companies/me", headers=headers, json={"name": "No"}).status_code == 403


def test_deactivation_revokes_sessions_and_reactivation_requires_login(client):
    client.post("/companies", json=payload())
    headers = login(client)
    with Session(client.app.state.engine) as db:
        company = db.scalar(select(Company))
        set_company_active(db, company.id, False)
    assert client.get("/companies/me", headers=headers).status_code == 401
    assert client.post("/auth/login", json={"email": "first@example.com", "password": "test-password"}).status_code == 401
    with Session(client.app.state.engine) as db:
        company = db.scalar(select(Company))
        set_company_active(db, company.id, True)
        set_company_active(db, company.id, True)
        assert db.scalar(select(func.count()).select_from(AuditEvent)) == 3
    assert client.get("/companies/me", headers=headers).status_code == 401
    assert client.get("/companies/me", headers=login(client)).status_code == 200
