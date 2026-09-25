import json
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.models import AuditEvent
from tests.test_companies import client, login, payload


def test_audit_filters_isolation_and_read_only(client):
    client.post("/companies", json=payload())
    client.post("/companies", json=payload("other"))
    admin, other = login(client), login(client, "other")
    response = client.post("/services", headers=admin, json={"name": "Service", "base_price": "10"})
    page = client.get("/audit-events?page_size=1&entity_type=service&action=create", headers=admin).json()
    assert page["total"] == 1
    event = page["items"][0]
    assert event["request_id"] == response.headers["x-request-id"]
    event_id = event["id"]
    assert client.get(f"/audit-events/{event_id}", headers=admin).json() == event
    assert client.get(f"/audit-events/{event_id}", headers=other).status_code == 404
    for key in ("actor_user_id", "entity_id", "request_id"):
        assert client.get("/audit-events", headers=admin, params={key: event[key], "entity_type": "service"}).json()["total"] == 1
    assert client.get("/audit-events", headers=other, params={"entity_id": event["entity_id"]}).json()["total"] == 0
    assert client.get("/audit-events", headers=admin, params={"end": event["occurred_at"], "entity_type": "service"}).json()["total"] == 0
    assert client.get("/audit-events", headers=admin, params={"start": event["occurred_at"], "entity_type": "service"}).json()["total"] == 1
    assert client.get("/audit-events?start=2026-01-01T00:00:00", headers=admin).status_code == 422
    assert client.get("/audit-events?start=2026-02-01T00:00:00Z&end=2026-01-01T00:00:00Z", headers=admin).status_code == 422
    for method, path in (("post", "/audit-events"), ("patch", f"/audit-events/{event_id}"), ("delete", f"/audit-events/{event_id}")):
        assert getattr(client, method)(path, headers=admin).status_code == 405
    client.post("/users", headers=admin, json={"username": "operator", "name": "Operator", "email": "operator@example.com", "password": "test-password"})
    assert client.get("/audit-events", headers=login(client, "operator")).status_code == 403
    assert client.get("/audit-events").status_code == 401


def test_redaction_on_persistence_and_legacy_reads(client):
    client.post("/companies", json=payload())
    admin = login(client)
    raw = {"password": {"before": "old", "after": "new"}, "parameters": [{"api_key": "private", "accessToken": "token-value"}], "password_changed": True}
    with Session(client.app.state.engine) as db:
        event = db.scalar(select(AuditEvent))
        event.changes = raw
        db.commit()
        db.refresh(event)
        assert "private" not in json.dumps(event.changes)
        assert event.changes["password_changed"] is True
        event_id = event.id
        # Simulate old data written by direct SQL, bypassing ORM validation.
        db.execute(update(AuditEvent).where(AuditEvent.id == event_id).values(changes=raw))
        db.commit()
    response = client.get(f"/audit-events/{event_id}", headers=admin)
    assert response.status_code == 200
    assert response.json()["changes"]["password"] == "[REDACTED]"
    assert "private" not in response.text and "token-value" not in response.text
