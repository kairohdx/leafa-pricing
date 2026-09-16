from datetime import timedelta
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.dependencies import AdminAuth, CurrentAuth, Database, get_tenant_record
from app.core.security import hash_password, token_digest
from app.db.base import Base
from app.db.types import utc_now
from app.main import create_app
from app.modules.companies.models import Company
from app.modules.identity.models import AuthSession, User
from app.modules.identity.schemas import UserRead


@pytest.fixture
def api_client():
    app = create_app(Settings(_env_file=None, app_env="test", database_url="sqlite://"))

    # Test-only routes exercise the same dependencies future CRUDs will use.
    @app.get("/test/admin")
    def admin(auth: AdminAuth):
        return {"company_id": str(auth.company_id)}

    @app.get("/test/users/{record_id}", response_model=UserRead)
    def user(record_id: UUID, db: Database, auth: CurrentAuth):
        return get_tenant_record(db, User, record_id, auth)

    @app.post("/test/conflict")
    def conflict(db: Database, auth: AdminAuth):
        db.add(Company(name="Duplicate", slug="first"))
        db.commit()

    with TestClient(app) as client:
        Base.metadata.create_all(app.state.engine)
        with Session(app.state.engine) as db:
            first, second = Company(name="First", slug="first"), Company(name="Second", slug="second")
            db.add_all([first, second])
            db.flush()
            password = hash_password("test-password")
            for email, company, role in [("admin@example.com", first, "admin"), ("operator@example.com", first, "operator"), ("other@example.com", second, "admin")]:
                db.add(User(company_id=company.id, username=email.split("@")[0], name="Test", email=email, phone="", password_hash=password, role=role))
            db.commit()
        yield client


def login(client, email="admin@example.com"):
    response = client.post("/auth/login", json={"email": email, "password": "test-password"})
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_login_me_permissions_and_logout(api_client):
    headers = login(api_client)
    me = api_client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert "password_hash" not in me.json()
    assert api_client.get("/test/admin", headers=headers).status_code == 200
    with Session(api_client.app.state.engine) as db:
        auth = db.scalar(select(AuthSession))
        assert auth.token_hash == token_digest(headers["Authorization"].split()[1])
    operator = login(api_client, "operator@example.com")
    assert api_client.get("/auth/me", headers=operator).status_code == 200
    assert api_client.get("/test/admin", headers=operator).status_code == 403
    assert api_client.post("/auth/logout", headers=headers).status_code == 204
    assert api_client.get("/auth/me", headers=headers).status_code == 401


def test_tenant_reads_and_errors(api_client):
    first, second = login(api_client), login(api_client, "other@example.com")
    own = api_client.get("/auth/me", headers=first).json()["id"]
    assert api_client.get(f"/test/users/{own}", headers=first).status_code == 200
    forbidden = api_client.get(f"/test/users/{own}", headers=second)
    missing = api_client.get(f"/test/users/{uuid4()}", headers=second)
    assert forbidden.status_code == missing.status_code == 404
    assert forbidden.json()["message"] == missing.json()["message"]
    conflict = api_client.post("/test/conflict", headers=first)
    assert conflict.status_code == 409
    assert "INSERT" not in conflict.text
    assert conflict.json()["request_id"] == conflict.headers["x-request-id"]
    assert api_client.get("/auth/me", headers=first).status_code == 200


@pytest.mark.parametrize("state", ["expired", "revoked", "user_disabled", "company_disabled"])
def test_disabled_credentials(api_client, state):
    headers = login(api_client)
    with Session(api_client.app.state.engine) as db:
        auth = db.scalar(select(AuthSession))
        if state == "expired":
            auth.expires_at = utc_now() - timedelta(seconds=1)
        elif state == "revoked":
            auth.revoked_at = utc_now()
        elif state == "user_disabled":
            auth.user.is_active = False
        else:
            auth.user.company.is_active = False
        db.commit()
    assert api_client.get("/auth/me", headers=headers).status_code == 401
    if state.endswith("disabled"):
        assert api_client.post("/auth/login", json={"email": "admin@example.com", "password": "test-password"}).status_code == 401


def test_invalid_credentials_validation_health_and_openapi(api_client):
    for email in ("admin@example.com", "missing@example.com"):
        response = api_client.post("/auth/login", json={"email": email, "password": "wrong"})
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"
    assert api_client.get("/auth/me").status_code == 401
    assert api_client.get("/auth/me", headers={"Authorization": "Bearer invalid"}).status_code == 401
    response = api_client.post("/auth/login", json={"email": "bad", "password": "secret-value"})
    assert response.status_code == 422
    assert "secret-value" not in response.text
    assert response.json()["field_errors"]
    assert api_client.get("/health").json() == {"status": "ok"}
    assert "/auth/login" in api_client.get("/openapi.json").json()["paths"]
    with api_client.app.state.engine.connect() as connection:
        assert connection.scalar(text("PRAGMA foreign_keys")) == 1
