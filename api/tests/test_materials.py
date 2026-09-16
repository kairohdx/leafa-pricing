import pytest
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.models import AuditEvent
from app.modules.units.service import seed_catalog
from tests.test_companies import client, login, payload


@pytest.fixture
def catalog(client):
    client.post("/companies", json=payload())
    client.post("/companies", json=payload("other"))
    with Session(client.app.state.engine) as db, db.begin():
        seed_catalog(db)
    return client, login(client), login(client, "other")


def material(client, headers, **changes):
    return client.post("/materials", headers=headers, json={"name": "Resina", "sku": "RES", "purchase_unit_code": "kg", "purchase_quantity": "1", "purchase_cost": "70.00", **changes})


def package(client, headers, material_id, **changes):
    return client.post("/material-packages", headers=headers, json={"material_id": material_id, "name": "Pacote", "quantity": "500", "unit_code": "g", **changes})


def test_material_crud_pagination_archive_and_audit(catalog):
    client, admin, other = catalog
    response = material(client, admin)
    assert response.status_code == 201
    record_id = response.json()["id"]
    assert response.json()["purchase_cost"] == "70.00"
    assert material(client, admin).status_code == 409
    assert material(client, other).status_code == 201
    assert client.get("/materials?page_size=1&search=RES", headers=admin).json()["total"] == 1
    assert client.get("/materials?search=%25", headers=admin).json()["total"] == 0
    assert client.get(f"/materials/{record_id}", headers=other).status_code == 404
    assert client.patch(f"/materials/{record_id}", headers=admin, json={"notes": "note", "purchase_cost": "80.10"}).status_code == 200
    assert client.patch(f"/materials/{record_id}", headers=admin, json={"notes": None}).json()["notes"] is None
    assert client.post(f"/materials/{record_id}/archive", headers=admin).status_code == 200
    assert client.get("/materials", headers=admin).json()["total"] == 0
    assert client.get("/materials?archived=true", headers=admin).json()["total"] == 1
    assert client.patch(f"/materials/{record_id}", headers=admin, json={"name": "No"}).status_code == 409
    assert client.post(f"/materials/{record_id}/restore", headers=admin).status_code == 200
    with Session(client.app.state.engine) as db:
        events = list(db.scalars(select(AuditEvent).where(AuditEvent.entity_type == "material", AuditEvent.entity_id == UUID(record_id)).order_by(AuditEvent.occurred_at)))
        assert len(events) == 5
        assert events[1].changes["purchase_cost"] == {"before": "70.00", "after": "80.10"}
    assert client.delete(f"/materials/{record_id}", headers=admin).status_code == 405


def test_package_crud_dimension_parent_and_tenant(catalog):
    client, admin, other = catalog
    record_id = material(client, admin).json()["id"]
    assert package(client, other, record_id).status_code == 404
    assert package(client, admin, record_id, unit_code="m").status_code == 422
    created = package(client, admin, record_id)
    assert created.status_code == 201
    package_id = created.json()["id"]
    assert package(client, admin, record_id).status_code == 409
    assert client.get(f"/materials/{record_id}/packages", headers=admin).json()["total"] == 1
    assert client.get(f"/materials/{record_id}/packages", headers=other).status_code == 404
    assert client.get(f"/material-packages/{package_id}", headers=other).status_code == 404
    assert client.patch(f"/material-packages/{package_id}", headers=admin, json={"material_id": record_id}).status_code == 422
    assert client.patch(f"/material-packages/{package_id}", headers=admin, json={"quantity": "250"}).status_code == 200
    assert client.post(f"/material-packages/{package_id}/archive", headers=admin).status_code == 200
    assert client.get(f"/materials/{record_id}/packages", headers=admin).json()["total"] == 0
    assert client.get(f"/materials/{record_id}/packages?archived=true", headers=admin).json()["total"] == 1
    client.post(f"/materials/{record_id}/archive", headers=admin)
    assert client.post(f"/material-packages/{package_id}/restore", headers=admin).status_code == 409
    assert package(client, admin, record_id, name="New").status_code == 409
    client.post(f"/materials/{record_id}/restore", headers=admin)
    assert client.post(f"/material-packages/{package_id}/restore", headers=admin).status_code == 200


def test_validation_permissions_and_idempotency(catalog):
    client, admin, other = catalog
    assert material(client, admin, purchase_unit_code="unknown").status_code == 422
    assert material(client, admin, purchase_quantity="0").status_code == 422
    assert material(client, admin, purchase_cost="1.001").status_code == 422
    record_id = material(client, admin).json()["id"]
    assert client.patch(f"/materials/{record_id}", headers=admin, json={"purchase_unit_code": "m"}).status_code == 422
    assert client.patch(f"/materials/{record_id}", headers=admin, json={"purchase_unit_code": "g", "purchase_quantity": "1000"}).status_code == 200
    assert client.post(f"/materials/{record_id}/archive", headers=other).status_code == 404
    for _ in range(2):
        assert client.post(f"/materials/{record_id}/archive", headers=admin).status_code == 200
    with Session(client.app.state.engine) as db:
        assert db.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.action == "archive")) == 1
    client.post("/users", headers=admin, json={"username": "operator", "name": "Operator", "email": "operator@example.com", "password": "test-password"})
    operator = login(client, "operator")
    assert client.get(f"/materials/{record_id}", headers=operator).status_code == 200
    assert material(client, operator).status_code == 403
    assert client.patch(f"/materials/{record_id}", headers=operator, json={"name": "No"}).status_code == 403
