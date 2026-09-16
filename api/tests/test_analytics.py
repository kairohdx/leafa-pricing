from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Sale, User, Company
from tests.test_companies import client, login, payload


def insert_sales(client, rows, email="first@example.com"):
    with Session(client.app.state.engine) as db:
        user = db.scalar(select(User).where(User.email == email))
        for date, total, cost, status, currency in rows:
            db.add(Sale(company_id=user.company_id, created_by_id=user.id, description="Sale", occurred_at=datetime.fromisoformat(date),
                        final_total=Decimal(total), cost_total=Decimal(cost) if cost is not None else None, status=status, currency=currency))
        db.commit()


def test_summary_status_currency_tenant_and_cost_coverage(client):
    client.post("/companies", json=payload())
    client.post("/companies", json=payload("other"))
    admin = login(client)
    date = "2026-09-15T15:00:00+00:00"
    insert_sales(client, [(date, "10.10", "3.20", "completed", "BRL"), (date, "20.20", None, "completed", "BRL"),
                         (date, "999", None, "draft", "BRL"), (date, "999", None, "cancelled", "BRL"),
                         (date, "99", None, "completed", "USD")])
    insert_sales(client, [(date, "500", None, "completed", "BRL")], "other@example.com")
    params = {"start": "2026-09-15T00:00:00Z", "end": "2026-09-16T00:00:00Z"}
    response = client.get("/analytics/summary", headers=admin, params=params)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["sales_count"] == 2 and data["final_total"] == "30.30"
    assert data["cost_total"] == "3.20" and data["cost_coverage"] == 1
    usd = client.get("/analytics/summary", headers=admin, params=params | {"currency": "USD"}).json()
    assert usd["sales_count"] == 1 and usd["cost_total"] is None
    assert client.get("/analytics/summary", headers=login(client, "other"), params=params).json()["final_total"] == "500.00"


def test_local_days_dst_empty_days_and_boundaries(client):
    client.post("/companies", json=payload())
    admin = login(client)
    client.patch("/companies/me", headers=admin, json={"timezone": "America/New_York"})
    insert_sales(client, [("2024-03-10T04:59:59+00:00", "10", None, "completed", "BRL"),
                         ("2024-03-10T05:00:00+00:00", "20", None, "completed", "BRL"),
                         ("2024-03-11T04:00:00+00:00", "30", None, "completed", "BRL"),
                         ("2024-03-13T04:00:00+00:00", "999", None, "completed", "BRL")])
    params = {"start": "2024-03-09T00:00:00-05:00", "end": "2024-03-13T00:00:00-04:00"}
    result = client.get("/analytics/sales-series", headers=admin, params=params)
    assert result.status_code == 200, result.text
    points = result.json()["points"]
    assert [point["sales_count"] for point in points] == [1, 1, 1, 0]
    assert points[1]["start"].endswith("-05:00") and points[2]["start"].endswith("-04:00")
    summary = client.get("/analytics/summary", headers=admin, params=params).json()
    assert summary["final_total"] == "60.00"


def test_aggregate_exceeds_single_row_storage_without_overflow(client):
    client.post("/companies", json=payload())
    admin = login(client)
    row = ("2026-09-15T00:00:00Z", "92233720368547758.07", None, "completed", "BRL")
    insert_sales(client, [row, row])
    params = {"start": "2026-09-14T00:00:00Z", "end": "2026-09-16T00:00:00Z"}
    result = client.get("/analytics/summary", headers=admin, params=params)
    assert result.status_code == 200, result.text
    assert result.json()["final_total"] == "184467440737095516.14"


def test_validation_empty_and_operator_access(client):
    client.post("/companies", json=payload())
    admin = login(client)
    client.post("/users", headers=admin, json={"username": "operator", "name": "Operator", "email": "operator@example.com", "password": "test-password"})
    operator = login(client, "operator")
    params = {"start": "2026-09-01T00:00:00Z", "end": "2026-09-02T00:00:00Z"}
    data = client.get("/analytics/summary", headers=operator, params=params).json()
    assert data["sales_count"] == data["cost_coverage"] == 0
    assert data["cost_total"] is None and data["final_total"] == "0.00"
    assert client.get("/analytics/summary", params=params).status_code == 401
    for invalid in ({"end": params["start"]}, {"end": "2028-09-02T00:00:00Z"}, {"start": "2026-09-01T00:00:00"}, {"currency": "invalid"}):
        assert client.get("/analytics/summary", headers=admin, params=params | invalid).status_code == 422
