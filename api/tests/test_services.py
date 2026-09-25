from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuditEvent
from tests.test_companies import client, login, payload


@pytest.fixture
def accounts(client):
    client.post("/companies", json=payload())
    client.post("/companies", json=payload("other"))
    return client, login(client), login(client, "other")


def create(client, headers, **changes):
    return client.post("/services", headers=headers, json={"name": "Instalação", "base_price": "50.00", **changes})


def test_service_crud_and_audit(accounts):
    client, admin, _ = accounts
    created = create(client, admin)
    assert created.status_code == 201
    record_id = created.json()["id"]
    assert created.json()["base_price"] == "50.00"
    assert client.get(f"/services/{record_id}", headers=admin).status_code == 200
    updated = client.patch(f"/services/{record_id}", headers=admin, json={"base_price": "60.25", "description": "Detail"})
    assert updated.status_code == 200
    assert client.patch(f"/services/{record_id}", headers=admin, json={"description": None}).json()["description"] is None
    assert client.patch(f"/services/{record_id}", headers=admin, json={}).status_code == 200
    for _ in range(2):
        assert client.post(f"/services/{record_id}/archive", headers=admin).status_code == 200
    assert client.get("/services", headers=admin).json()["total"] == 0
    assert client.get("/services?archived=true", headers=admin).json()["total"] == 1
    assert client.patch(f"/services/{record_id}", headers=admin, json={"name": "No"}).status_code == 409
    for _ in range(2):
        assert client.post(f"/services/{record_id}/restore", headers=admin).status_code == 200
    with Session(client.app.state.engine) as db:
        events = list(db.scalars(select(AuditEvent).where(AuditEvent.entity_id == UUID(record_id)).order_by(AuditEvent.occurred_at)))
        assert [e.action for e in events] == ["create", "update", "update", "archive", "restore"]
        assert events[1].changes["base_price"] == {"before": "50.00", "after": "60.25"}
        assert events[1].request_id == updated.headers["x-request-id"]
    assert client.delete(f"/services/{record_id}", headers=admin).status_code == 405


def test_search_pagination_isolation_permissions(accounts):
    client, admin, other = accounts
    ids = {create(client, admin, name="Same").json()["id"] for _ in range(3)}
    create(client, other, name="Same")
    pages = [client.get(f"/services?search=same&page_size=2&page={page}", headers=admin).json() for page in (1, 2)]
    assert all(page["total"] == 3 for page in pages)
    assert {item["id"] for page in pages for item in page["items"]} == ids
    assert client.get("/services?search=%25", headers=admin).json()["total"] == 0
    record_id = next(iter(ids))
    assert client.get(f"/services/{record_id}", headers=other).status_code == 404
    assert client.patch(f"/services/{record_id}", headers=other, json={"name": "No"}).status_code == 404
    assert client.post(f"/services/{record_id}/archive", headers=other).status_code == 404
    client.post("/users", headers=admin, json={"username": "operator", "name": "Operator", "email": "operator@example.com", "password": "test-password"})
    operator = login(client, "operator")
    assert client.get("/services", headers=operator).status_code == 200
    assert create(client, operator).status_code == 403
    assert client.post(f"/services/{record_id}/restore", headers=operator).status_code == 403
    assert client.get("/services").status_code == 401


@pytest.mark.parametrize("changes", [{"base_price": "-1"}, {"base_price": "1.001"}, {"base_price": 1.2}, {"name": " "}, {"company_id": "invalid"}])
def test_invalid_service_rejected(accounts, changes):
    client, admin, _ = accounts
    assert create(client, admin, **changes).status_code == 422
    assert client.get("/services", headers=admin).json()["total"] == 0
