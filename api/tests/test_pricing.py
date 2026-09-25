from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuditEvent
from tests.test_companies import client, login, payload


def create(client, headers, **extra):
    return client.post("/pricing-rules", headers=headers, json={"name": "Regra", "strategy_key": "cost_multiplier", "parameters": {"multiplier": "1.25"}, **extra})


def test_pricing_version_updates_and_audit(client):
    client.post("/companies", json=payload())
    admin = login(client)
    response = create(client, admin)
    assert response.status_code == 201
    rule_id = response.json()["id"]
    assert response.json()["version"] == 1
    assert create(client, admin, version=99).status_code == 422
    path = f"/pricing-rules/{rule_id}"
    assert client.patch(path, headers=admin, json={"name": "No version"}).status_code == 422
    updated = client.patch(path, headers=admin, json={"expected_version": 1, "parameters": {"multiplier": "2.00"}})
    assert updated.status_code == 200 and updated.json()["version"] == 2
    assert client.patch(path, headers=admin, json={"expected_version": 1, "name": "Stale"}).status_code == 409
    assert client.patch(path, headers=admin, json={"expected_version": 2}).json()["version"] == 2
    with Session(client.app.state.engine) as db:
        events = list(db.scalars(select(AuditEvent).where(AuditEvent.entity_id == UUID(rule_id)).order_by(AuditEvent.occurred_at)))
        assert len(events) == 2
        assert events[-1].changes["parameters"] == {"before": {"multiplier": "1.25"}, "after": {"multiplier": "2.00"}}


def test_default_replacement_archive_and_restore(client):
    client.post("/companies", json=payload())
    admin = login(client)
    first = create(client, admin, is_default=True).json()
    second = create(client, admin, is_default=True).json()
    first_path = f"/pricing-rules/{first['id']}"
    second_path = f"/pricing-rules/{second['id']}"
    previous = client.get(first_path, headers=admin).json()
    assert not previous["is_default"] and previous["version"] == 2
    assert client.patch(first_path, headers=admin, json={"expected_version": 2, "is_default": True}).json()["version"] == 3
    assert not client.get(second_path, headers=admin).json()["is_default"]
    archived = client.post(first_path + "/archive", headers=admin).json()
    assert not archived["is_default"] and archived["version"] == 4
    assert client.post(first_path + "/archive", headers=admin).json()["version"] == 4
    assert client.patch(first_path, headers=admin, json={"expected_version": 4, "name": "No"}).status_code == 409
    client.patch(second_path, headers=admin, json={"expected_version": 2, "is_default": True})
    restored = client.post(first_path + "/restore", headers=admin).json()
    assert not restored["is_default"] and restored["version"] == 5
    assert client.get(second_path, headers=admin).json()["is_default"]
    assert client.patch(second_path, headers=admin, json={"expected_version": 3, "is_default": False}).status_code == 200


def test_rule_permissions_and_filtered_pages(client):
    client.post("/companies", json=payload())
    client.post("/companies", json=payload("other"))
    admin, other = login(client), login(client, "other")
    rule_id = create(client, admin).json()["id"]
    create(client, other, is_default=True)
    assert client.get("/pricing-rules?page_size=1&search=Regra", headers=admin).json()["total"] == 1
    assert client.get(f"/pricing-rules/{rule_id}", headers=other).status_code == 404
    assert client.patch(f"/pricing-rules/{rule_id}", headers=other, json={"expected_version": 1, "is_default": True}).status_code == 404
    client.post(f"/pricing-rules/{rule_id}/archive", headers=admin)
    assert client.get("/pricing-rules", headers=admin).json()["total"] == 0
    assert client.get("/pricing-rules?archived=true", headers=admin).json()["total"] == 1
    client.post("/users", headers=admin, json={"username": "operator", "name": "Operator", "email": "operator@example.com", "password": "test-password"})
    operator = login(client, "operator")
    assert client.get("/pricing-rules", headers=operator).status_code == 200
    assert create(client, operator).status_code == 403
    assert client.post(f"/pricing-rules/{rule_id}/restore", headers=operator).status_code == 403
    assert client.get("/pricing-rules").status_code == 401
