import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuditEvent
from tests.test_companies import client, login, payload


def create_user(client, headers, username="operator", **extra):
    return client.post("/users", headers=headers, json={"username": username, "name": username,
        "email": f"{username}@example.com", "password": "test-password", **extra})


def test_users_crud_pagination_and_tenants(client):
    client.post("/companies", json=payload())
    client.post("/companies", json=payload("second"))
    admin, other = login(client), login(client, "second")
    created = create_user(client, admin)
    assert created.status_code == 201
    user_id = created.json()["id"]
    assert created.json()["role"] == "operator"
    page = client.get("/users?page_size=1", headers=admin).json()
    assert page["total"] == 2 and len(page["items"]) == 1
    assert client.get("/users", headers=other).json()["total"] == 1
    assert client.get("/users?search=operator&active=true", headers=admin).json()["total"] == 1
    assert client.get("/users?search=%25", headers=admin).json()["total"] == 0
    assert client.get("/users?page_size=101", headers=admin).status_code == 422
    assert client.get(f"/users/{user_id}", headers=other).status_code == 404
    assert client.patch(f"/users/{user_id}", headers=other, json={"name": "No"}).status_code == 404
    assert client.patch(f"/users/{user_id}", headers=admin, json={"name": "Changed"}).json()["name"] == "Changed"
    assert "password_hash" not in created.json()
    assert client.delete(f"/users/{user_id}", headers=admin).status_code == 405


def test_profile_cannot_elevate_or_administer(client):
    client.post("/companies", json=payload())
    admin = login(client)
    create_user(client, admin)
    operator = login(client, "operator")
    assert client.get("/users", headers=operator).status_code == 403
    assert create_user(client, operator, "unauthorized").status_code == 403
    assert client.patch("/users/me", headers=operator, json={"role": "admin"}).status_code == 422
    assert client.patch("/users/me", headers=operator, json={"company_id": "invalid"}).status_code == 422
    assert client.patch("/users/me", headers=operator, json={"name": "My profile"}).status_code == 200
    own_id = client.get("/users/me", headers=admin).json()["id"]
    for change in ({"role": "operator"}, {"is_active": False}):
        assert client.patch(f"/users/{own_id}", headers=admin, json=change).status_code == 409


def test_conflicts_and_audit_rollback(client):
    client.post("/companies", json=payload())
    admin = login(client)
    first = create_user(client, admin).json()
    assert create_user(client, admin, "operator", email="different@example.com").status_code == 409
    assert create_user(client, admin, "different", email="operator@example.com").status_code == 409
    assert client.patch(f"/users/{first['id']}", headers=admin, json={"email": "first@example.com", "name": "Should roll back"}).status_code == 409
    assert client.get(f"/users/{first['id']}", headers=admin).json()["name"] == "operator"
    with Session(client.app.state.engine) as db:
        events = list(db.scalars(select(AuditEvent).where(AuditEvent.entity_type == "user")))
        assert len(events) == 1


def test_password_change_and_admin_reset_revoke_sessions(client):
    client.post("/companies", json=payload())
    admin = login(client)
    user_id = create_user(client, admin).json()["id"]
    operator = login(client, "operator")
    assert client.post("/users/me/password", headers=operator, json={"current_password": "wrong", "new_password": "new-password"}).status_code == 403
    assert client.post("/users/me/password", headers=operator, json={"current_password": "test-password", "new_password": "new-password"}).status_code == 204
    assert client.get("/users/me", headers=operator).status_code == 401
    response = client.post("/auth/login", json={"email": "operator@example.com", "password": "new-password"})
    assert response.status_code == 200
    new_headers = {"Authorization": "Bearer " + response.json()["access_token"]}
    assert client.patch(f"/users/{user_id}", headers=admin, json={"password": "admin-reset-password"}).status_code == 200
    assert client.get("/users/me", headers=new_headers).status_code == 401
    with Session(client.app.state.engine) as db:
        changes = json.dumps([e.changes for e in db.scalars(select(AuditEvent))])
        assert "new-password" not in changes and "admin-reset-password" not in changes


def test_roles_activation_and_session_ownership(client):
    client.post("/companies", json=payload())
    admin = login(client)
    user_id = create_user(client, admin).json()["id"]
    operator = login(client, "operator")
    sessions = client.get("/users/me/sessions", headers=operator).json()
    assert sessions["total"] == 1
    session_id = sessions["items"][0]["id"]
    assert "token_hash" not in sessions["items"][0]
    assert client.delete(f"/users/me/sessions/{session_id}", headers=admin).status_code == 404
    assert client.delete(f"/users/me/sessions/{session_id}", headers=operator).status_code == 204
    assert client.get("/users/me", headers=operator).status_code == 401
    operator = login(client, "operator")
    assert client.patch(f"/users/{user_id}", headers=admin, json={"role": "admin"}).status_code == 200
    assert client.get("/users/me", headers=operator).status_code == 401
    promoted = login(client, "operator")
    assert client.get("/users", headers=promoted).status_code == 200
    assert client.patch(f"/users/{user_id}", headers=admin, json={"is_active": False}).status_code == 200
    assert client.get("/users/me", headers=promoted).status_code == 401
    assert client.patch(f"/users/{user_id}", headers=admin, json={"is_active": True}).status_code == 200
    assert client.get("/users/me", headers=promoted).status_code == 401
