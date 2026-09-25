from decimal import Decimal as D
from types import SimpleNamespace
from uuid import UUID
import pytest
from sqlalchemy.orm import Session
from app.modules.pricing.engine import PricingEngine, validate
from app.modules.pricing.costs import CostEngine
from app.modules.units.conversion import convert
from app.modules.pricing.models import PricingRule
from tests.test_companies import client  # noqa: F401
from tests.test_materials import catalog, material, package  # noqa: F401
from tests.test_sales import sale


@pytest.mark.parametrize("strategy,params,cost,expected", [
    ("markup_percent", {"percentage": "30"}, "100", "130.00"),
    ("target_margin", {"margin": "30"}, "100", "142.86"),
    ("margin_fees", {"margin": "20", "fees": "10", "fixed_cost": "0"}, "100", "142.86"),
    ("margin_fees", {"margin": "20", "fees": "15", "fixed_cost": "10"}, "120", "200.00"),
    ("cost_multiplier", {"multiplier": "2.5"}, "40", "100.00"),
    ("fixed_addition", {"addition": "50"}, "80", "130.00"),
    ("markup_percent", {"percentage": "12.5"}, "0.08", "0.09"),
    ("markup_percent", {"percentage": "30"}, "0", "0.00"),
    ("target_margin", {"margin": "30"}, "0", "0.00"),
    ("margin_fees", {"margin": "20", "fees": "10", "fixed_cost": "0"}, "0", "0.00"),
    ("cost_multiplier", {"multiplier": "2.5"}, "0", "0.00"),
    ("fixed_addition", {"addition": "0"}, "0", "0.00"),
])
def test_strategies(strategy, params, cost, expected):
    result = PricingEngine.calculate(D(cost), strategy, params)
    assert result["suggested_price"] == expected
    assert result["status"] == "available"
    assert D(result["suggested_price"]) >= D(result["price_before_adjustment"])


@pytest.mark.parametrize("strategy,params", [
    ("unknown", {}), ("markup_percent", {}), ("markup_percent", {"percentage": "1", "extra": "1"}),
    ("target_margin", {"margin": "100"}), ("target_margin", {"margin": "101"}),
    ("target_margin", {"margin": "-1"}),
    ("margin_fees", {"margin": "80", "fees": "20", "fixed_cost": "0"}),
    ("margin_fees", {"margin": "20", "fees": "10", "fixed_cost": "-1"}),
    ("cost_multiplier", {"multiplier": "0"}), ("cost_multiplier", {"multiplier": "-1"}),
    ("fixed_addition", {"addition": "-1"}), ("fixed_addition", {"addition": True}),
    ("fixed_addition", {"addition": 0.5}), ("fixed_addition", {"addition": "NaN"}),
    ("fixed_addition", {"addition": "Infinity"}), ("fixed_addition", {"addition": "no"}),
    ("fixed_addition", {"addition": "0", "rounding": "unknown"}),
    ("fixed_addition", {"addition": "0", "rounding": []}),
])
def test_invalid_parameters(strategy, params):
    with pytest.raises(ValueError):
        validate(strategy, params)


@pytest.mark.parametrize("cost,policy,expected", [
    ("47.32", "none", "47.32"), ("47.321", "none", "47.33"),
    ("47.32", "integer", "48.00"), ("48", "integer", "48.00"),
    ("47.32", "ending_90", "47.90"), ("47.95", "ending_90", "48.90"),
    ("47.90", "ending_90", "47.90"), ("47.32", "ending_99", "47.99"),
    ("47.991", "ending_99", "48.99"), ("47.99", "ending_99", "47.99"),
])
def test_rounding(cost, policy, expected):
    result = PricingEngine.calculate(D(cost), "fixed_addition", {"addition": "0", "rounding": policy})
    assert result["price_before_adjustment"] == cost
    assert result["suggested_price"] == expected


def test_unavailable_and_overflow():
    for cost in (None, D("92233720368547758.07")):
        result = PricingEngine.calculate(cost, "cost_multiplier", {"multiplier": "2"})
        assert result["status"] == "unavailable" and result["suggested_price"] is None


def unit(dimension, numerator, denominator=1):
    return SimpleNamespace(dimension_id=dimension, factor_numerator=numerator, factor_denominator=denominator)


@pytest.mark.parametrize("source,target,quantity,expected", [
    (unit("mass", 1), unit("mass", 1, 1000), "1", "1000"),
    (unit("mass", 1, 1000), unit("mass", 1), "500", "0.5"),
    (unit("volume", 1), unit("volume", 1, 1000), "2.5", "2500"),
    (unit("volume", 1, 1000), unit("volume", 1), "50", "0.05"),
    (unit("length", 1), unit("length", 1, 100), "2", "200"),
    (unit("length", 1, 100), unit("length", 1, 1000), "2", "20"),
    (unit("length", 1, 1000), unit("length", 1), "5", "0.005"),
])
def test_conversion(source, target, quantity, expected):
    assert convert(D(quantity), source, target) == D(expected)


def test_component_cost_and_empty_composition():
    quantity, cost = CostEngine.component(D("70"), D("1"), D("125"), unit("mass", 1), unit("mass", 1, 1000))
    assert quantity == D("0.125") and cost == D("8.75")
    assert CostEngine.total([]) is None
    assert CostEngine.total([D(0)]) == 0
    with pytest.raises(ValueError):
        convert(D(1), unit("mass", 1), unit("length", 1))
    with pytest.raises(ValueError):
        CostEngine.component(D(1), D(0), D(1), unit("mass", 1), unit("mass", 1))


def setup_product(client, admin):
    mat = material(client, admin).json()
    pack = package(client, admin, mat["id"]).json()
    product = client.post("/products", headers=admin, json={"name": "Peça"}).json()
    component = client.post(f"/products/{product['id']}/materials", headers=admin,
        json={"material_id": mat["id"], "quantity": "500", "unit_code": "g"})
    assert component.status_code == 201
    rule = client.post("/pricing-rules", headers=admin, json={"name": "30%", "strategy_key": "markup_percent", "parameters": {"percentage": "30"}}).json()
    return mat, pack, product, rule


def test_endpoints_preview_costs_and_historical_snapshots(catalog):
    client, admin, other = catalog
    mat, pack, product, rule = setup_product(client, admin)
    cost_path = f"/products/{product['id']}/cost"
    cost = client.get(cost_path, headers=admin).json()
    assert D(cost["base_cost"]) == 35
    assert cost["components"][0]["packages"][0]["id"] == pack["id"]
    assert D(cost["components"][0]["packages"][0]["cost"]) == 35
    assert client.get(cost_path, headers=other).status_code == 404
    assert client.get(cost_path).status_code == 401
    line = {"kind": "product", "product_id": product["id"], "quantity": "2"}
    body = {"lines": [line], "pricing_rule_id": rule["id"]}
    preview = client.post("/sales/preview", headers=admin, json=body).json()
    assert preview["cost_total"] == "70.00" and preview["suggested_total"] == "91.00"
    assert client.get("/sales", headers=admin).json()["total"] == 0
    assert client.post("/sales/preview", headers=other, json=body).status_code == 404
    response = sale(client, admin, [line], pricing_rule_id=rule["id"], final_total="80.00")
    assert response.status_code == 201, response.text
    created = response.json()
    path = f"/sales/{created['id']}"
    assert created["suggested_total"] == "91.00" and created["final_total"] == "80.00"
    assert created["lines"][0]["unit_cost_snapshot"] == "35.000000"
    client.patch(f"/materials/{mat['id']}", headers=admin, json={"purchase_cost": "100"})
    client.patch(f"/pricing-rules/{rule['id']}", headers=admin, json={"expected_version": 1, "parameters": {"percentage": "50"}})
    client.patch(path, headers=admin, json={"description": "Nova descrição"})
    historical = client.post("/sales/preview", headers=admin, json={"sale_id": created["id"], "pricing_rule_id": rule["id"]}).json()
    assert historical["suggested_total"] == "91.00"
    assert client.post("/sales/preview", headers=other, json={"sale_id": created["id"]}).status_code == 404
    completed = client.post(path + "/complete", headers=admin).json()
    assert completed["pricing_snapshot"] == created["pricing_snapshot"]
    assert completed["lines"] == created["lines"]
    assert client.patch(path, headers=admin, json={"lines": [line]}).status_code == 409


def test_rule_validation_preview_and_legacy_compatibility(catalog):
    client, admin, _ = catalog
    body = {"strategy_key": "target_margin", "parameters": {"margin": "30"}, "base_cost": "100"}
    assert client.post("/pricing-rules/preview", json=body).status_code == 401
    assert client.post("/pricing-rules/preview", headers=admin, json=body).json()["suggested_price"] == "142.86"
    for cost in (True, 1.5, "-1", "NaN", "1e100"):
        assert client.post("/pricing-rules/preview", headers=admin, json=body | {"base_cost": cost}).status_code == 422
    for params in ({}, {"margin": "100"}, {"margin": 0.3}, {"margin": "30", "extra": 1}):
        assert client.post("/pricing-rules/preview", headers=admin, json=body | {"parameters": params}).status_code == 422
        assert client.post("/pricing-rules", headers=admin, json={"name": "Inválida", "strategy_key": "target_margin", "parameters": params}).status_code == 422
    mat, _, product, rule = setup_product(client, admin)
    rule_path = f"/pricing-rules/{rule['id']}"
    assert client.patch(rule_path, headers=admin, json={"expected_version": 1, "strategy_key": "target_margin"}).status_code == 422
    assert client.get(rule_path, headers=admin).json()["version"] == 1
    with Session(client.app.state.engine) as db, db.begin():
        legacy = db.get(PricingRule, UUID(rule["id"]))
        legacy.strategy_key = "old_unknown"
        legacy.parameters = {"old": "value"}
    assert client.get(rule_path, headers=admin).status_code == 200
    response = sale(client, admin, [{"kind": "product", "product_id": product["id"], "quantity": "1"}], pricing_rule_id=rule["id"])
    assert response.status_code == 201
    assert response.json()["suggested_total"] is None
    assert "desconhecida" in response.json()["pricing_snapshot"]["calculation"]["lines"][0]["pricing"]["reason"]


def test_rule_change_uses_captured_costs_and_line_replacement_refreshes(catalog):
    client, admin, _ = catalog
    mat, _, product, rule = setup_product(client, admin)
    line = {"kind": "product", "product_id": product["id"], "quantity": "1"}
    created = sale(client, admin, [line], pricing_rule_id=rule["id"]).json()
    path = f"/sales/{created['id']}"
    second = client.post("/pricing-rules", headers=admin, json={"name": "Double", "strategy_key": "cost_multiplier", "parameters": {"multiplier": "2"}}).json()
    client.patch(f"/materials/{mat['id']}", headers=admin, json={"purchase_cost": "100"})
    changed = client.patch(path, headers=admin, json={"pricing_rule_id": second["id"]}).json()
    assert changed["cost_total"] == "35.00" and changed["suggested_total"] == "70.00"
    assert changed["lines"][0]["id"] == created["lines"][0]["id"]
    assert changed["final_total"] == "45.00"
    cleared = client.patch(path, headers=admin, json={"pricing_rule_id": None}).json()
    assert cleared["cost_total"] == "35.00" and cleared["suggested_total"] is None
    assert "rule" not in cleared["pricing_snapshot"]
    refreshed = client.patch(path, headers=admin, json={"pricing_rule_id": second["id"], "lines": [line]}).json()
    assert refreshed["cost_total"] == "50.00" and refreshed["suggested_total"] == "100.00"


def test_empty_and_zero_cost_products(catalog):
    client, admin, _ = catalog
    empty = client.post("/products", headers=admin, json={"name": "Empty"}).json()
    assert client.get(f"/products/{empty['id']}/cost", headers=admin).json()["base_cost"] is None
    mat, _, product, rule = setup_product(client, admin)
    client.patch(f"/materials/{mat['id']}", headers=admin, json={"purchase_cost": "0"})
    result = sale(client, admin, [{"kind": "product", "product_id": product["id"], "quantity": "1"}], pricing_rule_id=rule["id"]).json()
    assert result["cost_total"] == "0.00" and result["suggested_total"] == "0.00"
