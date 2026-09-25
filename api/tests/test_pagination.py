from decimal import Decimal

import pytest
from pydantic import ValidationError
from sqlalchemy import select

from app.db.models import Company, Service
from app.db.pagination import paginate
from app.modules.services.schemas import ServiceRead
from app.pagination import Page, PaginationParams


@pytest.mark.parametrize("values", [{"page": 0}, {"page": -1}, {"page_size": 0}, {"page_size": 101}, {"page": "abc"}, {"page": 1.5}])
def test_invalid_pagination(values):
    with pytest.raises(ValidationError):
        PaginationParams(**values)


def test_query_parameters_and_defaults():
    assert PaginationParams().model_dump() == {"page": 1, "page_size": 20}
    assert PaginationParams(page="3", page_size="10").offset == 20


def test_filtered_pages_and_serialization(session):
    company = Company(name="First", slug="first")
    other = Company(name="Other", slug="other")
    session.add_all([company, other])
    session.flush()
    services = [Service(company_id=company.id, name="Same name", base_price=Decimal("1.20")) for _ in range(5)]
    session.add_all(services + [Service(company_id=other.id, name="Other", base_price=Decimal("9"))])
    session.commit()
    statement = select(Service).where(Service.company_id == company.id)
    ordering = (Service.name.asc(), Service.id.asc())
    pages = [paginate(session, statement, PaginationParams(page=n, page_size=2), ServiceRead, order_by=ordering) for n in (1, 2, 3, 4)]
    assert [len(page.items) for page in pages] == [2, 2, 1, 0]
    assert all(page.total == 5 and page.total_pages == 3 for page in pages)
    ids = [item.id for page in pages for item in page.items]
    assert len(set(ids)) == 5
    assert set(ids) == {service.id for service in services}
    assert not pages[0].has_previous and pages[0].has_next
    assert pages[2].has_previous and not pages[2].has_next
    assert pages[3].has_previous and not pages[3].has_next
    assert pages[0].model_dump(mode="json")["items"][0]["base_price"] == "1.20"
    assert "has_next" in pages[0].model_dump()
    assert Page[ServiceRead].model_json_schema(mode="serialization")


def test_empty_results_and_order_required(session):
    statement = select(Service)
    page = paginate(session, statement, PaginationParams(), ServiceRead, order_by=(Service.id.asc(),))
    assert page.total == page.total_pages == 0
    assert page.items == []
    assert not page.has_next and not page.has_previous
    with pytest.raises(ValueError, match="ordering"):
        paginate(session, statement, PaginationParams(), ServiceRead, order_by=())
