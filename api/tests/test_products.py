from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuditEvent
from tests.test_companies import client, login
from tests.test_materials import catalog, material


def product(client, headers, **extra):
    return client.post("/products", headers=headers, json={"name": "Peça", "sku": "P1", **extra})


def test_product_crud_and_composition(catalog):
    client, admin, other = catalog
    material_id = material(client, admin).json()["id"]
    response = product(client, admin)
    assert response.status_code == 201
    product_id = response.json()["id"]
    assert response.json()["materials"] == []
    assert product(client, admin).status_code == 409
    assert product(client, other).status_code == 201
    body = {"material_id": material_id, "quantity": "120", "unit_code": "g"}
    created = client.post(f"/products/{product_id}/materials", headers=admin, json=body)
    assert created.status_code == 201
    component_id = created.json()["id"]
    assert client.post(f"/products/{product_id}/materials", headers=admin, json=body).status_code == 409
    assert len(client.get(f"/products/{product_id}", headers=admin).json()["materials"]) == 1
    assert client.patch(f"/products/{product_id}/materials/{component_id}", headers=admin, json={"quantity": "150"}).status_code == 200
    assert client.patch(f"/products/{product_id}", headers=admin, json={"description": "Description"}).status_code == 200
    assert client.patch(f"/products/{product_id}", headers=admin, json={"description": None}).json()["description"] is None
    listing = client.get("/products?search=P1&page_size=1", headers=admin).json()
    assert listing["total"] == 1 and "materials" not in listing["items"][0]
    assert client.delete(f"/products/{product_id}/materials/{component_id}", headers=admin).status_code == 204
    assert client.get(f"/products/{product_id}/materials", headers=admin).json() == []
    with Session(client.app.state.engine) as db:
        events = list(db.scalars(select(AuditEvent).where(AuditEvent.entity_id == UUID(product_id))))
        assert len(events) == 6
        assert {e.action for e in events} >= {"create", "component_add", "component_update", "component_remove"}


def test_references_units_and_archival(catalog):
    client, admin, other = catalog
    own_material = material(client, admin).json()["id"]
    foreign_material = material(client, other).json()["id"]
    product_id = product(client, admin).json()["id"]
    second_id = product(client, admin, sku="P2").json()["id"]
    path = f"/products/{product_id}/materials"
    body = {"material_id": own_material, "quantity": "1", "unit_code": "kg"}
    assert client.post(path, headers=admin, json=body | {"material_id": foreign_material}).status_code == 404
    assert client.post(path, headers=admin, json=body | {"unit_code": "m"}).status_code == 422
    assert client.post(path, headers=admin, json=body | {"quantity": "0"}).status_code == 422
    component_id = client.post(path, headers=admin, json=body).json()["id"]
    assert client.patch(f"{path}/{component_id}", headers=admin, json={"material_id": foreign_material}).status_code == 422
    assert client.patch(f"{path}/{component_id}", headers=admin, json={"unit_code": "m"}).status_code == 422
    assert client.delete(f"/products/{second_id}/materials/{component_id}", headers=admin).status_code == 404
    assert client.get(f"/products/{product_id}", headers=other).status_code == 404
    assert client.delete(f"{path}/{component_id}", headers=other).status_code == 404
    client.post(f"/products/{product_id}/archive", headers=admin)
    assert client.get("/products", headers=admin).json()["total"] == 1
    assert client.get("/products?archived=true", headers=admin).json()["total"] == 1
    assert client.delete(f"{path}/{component_id}", headers=admin).status_code == 409
    assert client.patch(f"/products/{product_id}", headers=admin, json={"name": "No"}).status_code == 409
    client.post(f"/products/{product_id}/restore", headers=admin)
    client.post(f"/materials/{own_material}/archive", headers=admin)
    assert client.patch(f"{path}/{component_id}", headers=admin, json={"quantity": "2"}).status_code == 409
    assert client.delete(f"{path}/{component_id}", headers=admin).status_code == 204
    assert client.post(path, headers=admin, json=body).status_code == 409


def test_permissions_and_idempotency(catalog):
    client, admin, _ = catalog
    product_id = product(client, admin).json()["id"]
    client.post("/users", headers=admin, json={"username": "operator", "name": "Operator", "email": "operator@example.com", "password": "test-password"})
    operator = login(client, "operator")
    assert client.get("/products", headers=operator).status_code == 200
    assert product(client, operator).status_code == 403
    assert client.post(f"/products/{product_id}/archive", headers=operator).status_code == 403
    assert client.get("/products").status_code == 401
    assert client.get("/products?page_size=101", headers=admin).status_code == 422
    client.patch(f"/products/{product_id}", headers=admin, json={})
    for action in ("archive", "archive", "restore", "restore"):
        assert client.post(f"/products/{product_id}/{action}", headers=admin).status_code == 200
    with Session(client.app.state.engine) as db:
        events = list(db.scalars(select(AuditEvent).where(AuditEvent.entity_id == UUID(product_id))))
        assert len(events) == 3
