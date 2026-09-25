from decimal import Decimal
import pytest
from sqlalchemy.exc import IntegrityError
from app.db.models import Company, User, Service, Sale, SaleLine, AuditEvent, Product, Material, ProductMaterial, UnitDimension, UnitOfMeasure, MaterialPackage, PricingRule
from app.modules.identity.models import UserRole


@pytest.mark.parametrize("relation", ["author", "line", "audit", "composition", "package", "rule"])
def test_cross_company_reference_rejected(session, relation):
    first, second = Company(name="First", slug="first"), Company(name="Second", slug="second")
    session.add_all([first, second]); session.flush()
    user = User(company_id=first.id, username="admin", name="Admin", email="admin@example.com", phone="", password_hash="hash", role=UserRole.ADMIN)
    service = Service(company_id=second.id, name="Other", base_price=Decimal("10"))
    dimension = UnitDimension(code="count", name="Count")
    session.add_all([user, service, dimension]); session.flush()
    session.add(UnitOfMeasure(code="un", name="Unit", symbol="un", dimension_id=dimension.id)); session.flush()
    material = Material(company_id=second.id, name="Other", purchase_unit_code="un", purchase_quantity=Decimal("1"), purchase_cost=Decimal("10"))
    product = Product(company_id=first.id, name="Product")
    rule = PricingRule(company_id=second.id, name="Other", strategy_key="manual")
    session.add_all([material, product, rule]); session.flush()
    sale = Sale(company_id=first.id, created_by_id=user.id, description="Sale", final_total=Decimal("10"))
    session.add(sale); session.flush()
    if relation == "author":
        sale.company_id = second.id
    elif relation == "line":
        session.add(SaleLine(company_id=first.id, sale_id=sale.id, kind="service", service_id=service.id, quantity=Decimal("1"), description_snapshot="Other"))
    elif relation == "audit":
        session.add(AuditEvent(company_id=second.id, actor_user_id=user.id, action="create", entity_type="sale", entity_id=sale.id))
    elif relation == "composition":
        session.add(ProductMaterial(company_id=first.id, product_id=product.id, material_id=material.id, quantity=Decimal("1"), unit_code="un"))
    elif relation == "package":
        session.add(MaterialPackage(company_id=first.id, material_id=material.id, name="Box", quantity=Decimal("1"), unit_code="un"))
    else:
        sale.pricing_rule_id, sale.rule_version = rule.id, 1
    with pytest.raises(IntegrityError):
        session.flush()
