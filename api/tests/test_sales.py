from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.models import Sale, SaleLine, AuditEvent
from tests.test_companies import client, login
from tests.test_materials import catalog, material


def service(client, headers):
    return client.post("/services", headers=headers, json={"name": "Instalação", "base_price": "50.00"}).json()["id"]


def sale(client, headers, lines=None, **extra):
    return client.post("/sales", headers=headers, json={"description": "Venda", "occurred_at": "2026-09-15T12:00:00-03:00", "final_total": "45.00", "lines": lines or [], **extra})


def test_sale_snapshots_manual_total_and_states(catalog):
    client, admin, _ = catalog
    service_id = service(client, admin)
    rule = client.post("/pricing-rules", headers=admin, json={"name": "Rule", "strategy_key": "future", "parameters": {"value": "1"}}).json()
    response = sale(client, admin, [{"kind": "service", "service_id": service_id, "quantity": "1"}], pricing_rule_id=rule["id"])
    assert response.status_code == 201, response.text
    data = response.json()
    path = f"/sales/{data['id']}"
    assert data["status"] == "draft" and data["final_total"] == "45.00"
    assert data["cost_total"] is None and data["suggested_total"] is None
    assert data["lines"][0]["unit_price_snapshot"] == "50.000000"
    assert data["lines"][0]["line_total"] is None
    client.patch(f"/services/{service_id}", headers=admin, json={"name": "New", "base_price": "60.00"})
    client.patch(f"/pricing-rules/{rule['id']}", headers=admin, json={"expected_version": 1, "parameters": {"value": "2"}})
    updated = client.patch(path, headers=admin, json={"description": "Edited"}).json()
    assert updated["lines"][0]["description_snapshot"] == "Instalação"
    assert updated["pricing_snapshot"]["rule"]["parameters"] == {"value": "1"}
    assert updated["rule_version"] == 1
    assert client.post(path + "/complete", headers=admin).json()["status"] == "completed"
    assert client.post(path + "/complete", headers=admin).status_code == 200
    assert client.patch(path, headers=admin, json={"final_total": "1"}).status_code == 409
    assert client.post(path + "/cancel", headers=admin).json()["status"] == "cancelled"
    assert client.post(path + "/complete", headers=admin).status_code == 409
    assert client.delete(path, headers=admin).status_code == 405


def test_sale_line_replacement_and_rollback(catalog):
    client, admin, other = catalog
    own = material(client, admin).json()["id"]
    foreign = material(client, other).json()["id"]
    line = {"kind": "material", "material_id": own, "quantity": "100", "unit_code": "g"}
    response = sale(client, admin, [line])
    assert response.status_code == 201
    path = f"/sales/{response.json()['id']}"
    old_id = response.json()["lines"][0]["id"]
    assert client.patch(path, headers=admin, json={"lines": [line | {"material_id": foreign}], "final_total": "99"}).status_code == 404
    unchanged = client.get(path, headers=admin).json()
    assert unchanged["final_total"] == "45.00" and unchanged["lines"][0]["id"] == old_id
    assert client.patch(path, headers=admin, json={"lines": [line | {"unit_code": "m"}]}).status_code == 422
    replaced = client.patch(path, headers=admin, json={"lines": [line | {"quantity": "200"}]}).json()
    assert len(replaced["lines"]) == 1 and replaced["lines"][0]["id"] != old_id
    assert client.patch(path, headers=admin, json={"lines": []}).json()["lines"] == []
    assert client.post(path + "/complete", headers=admin).status_code == 409
    client.post(f"/materials/{own}/archive", headers=admin)
    assert sale(client, admin, [line]).status_code == 409
    with Session(client.app.state.engine) as db:
        assert db.scalar(select(func.count()).select_from(Sale)) == 1
        assert db.scalar(select(func.count()).select_from(SaleLine)) == 0


def test_sale_filters_permissions_tenant_and_rule_removal(catalog):
    client, admin, other = catalog
    service_id = service(client, admin)
    rule = client.post("/pricing-rules", headers=admin, json={"name": "Rule", "strategy_key": "future"}).json()
    client.post("/users", headers=admin, json={"username": "operator", "name": "Operator", "email": "operator@example.com", "password": "test-password"})
    operator = login(client, "operator")
    created = sale(client, operator, [{"kind": "service", "service_id": service_id, "quantity": "1"}], pricing_rule_id=rule["id"])
    assert created.status_code == 201
    path = f"/sales/{created.json()['id']}"
    cleared = client.patch(path, headers=operator, json={"pricing_rule_id": None}).json()
    assert cleared["pricing_snapshot"] is None and cleared["rule_version"] is None
    assert client.get(path, headers=other).status_code == 404
    assert client.patch(path, headers=other, json={"description": "No"}).status_code == 404
    assert client.get("/sales", headers=other).json()["total"] == 0
    assert client.post(path + "/cancel", headers=operator).status_code == 403
    assert client.post(path + "/complete", headers=operator).status_code == 200
    assert client.get("/sales?status=completed&page_size=1", headers=admin).json()["total"] == 1
    assert client.get("/sales?end=2026-09-15T15:00:00Z", headers=admin).json()["total"] == 0
    assert client.get("/sales?start=2026-09-16T00:00:00Z&end=2026-09-15T00:00:00Z", headers=admin).status_code == 422
    assert client.get("/sales?start=2026-09-15T00:00:00", headers=admin).status_code == 422
    assert client.get("/sales").status_code == 401


def test_product_lines_and_cross_company_rule(catalog):
    client, admin, other = catalog
    product_id = client.post("/products", headers=admin, json={"name": "Product"}).json()["id"]
    line = {"kind": "product", "product_id": product_id, "quantity": "1", "unit_code": "un"}
    assert sale(client, admin, [line]).status_code == 201
    assert sale(client, admin, [line | {"unit_code": "kg"}]).status_code == 422
    rule_id = client.post("/pricing-rules", headers=other, json={"name": "Other", "strategy_key": "future"}).json()["id"]
    assert sale(client, admin, [line], pricing_rule_id=rule_id).status_code == 404
    with Session(client.app.state.engine) as db:
        assert db.scalar(select(func.count()).select_from(Sale)) == 1
        assert db.scalar(select(func.count()).select_from(AuditEvent).where(AuditEvent.entity_type == "sale")) == 1
