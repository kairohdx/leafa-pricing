from copy import deepcopy
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import delete, update
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_tenant_record, tenant_statement
from app.db.pagination import paginate
from app.db.types import utc_now
from app.modules.audit.models import AuditEvent
from app.modules.companies.models import Company
from app.modules.materials.models import Material
from app.modules.materials.service import editable, compatible, unit
from app.modules.pricing.models import PricingRule
from app.modules.products.models import Product
from app.modules.sales.models import Sale, SaleLine, SaleStatus, SaleLineKind
from app.modules.sales.schemas import SaleRead, SaleSummary
from app.modules.services.models import Service


def lock_company(db, auth):
    db.execute(update(Company).where(Company.id == auth.company_id).values(updated_at=Company.updated_at))
    db.expire_all()


def detail(db, auth, sale_id):
    sale = db.scalar(tenant_statement(Sale, auth).where(Sale.id == sale_id).options(selectinload(Sale.lines)).execution_options(populate_existing=True))
    if sale is None:
        raise HTTPException(404, "Sale not found.")
    return sale


def list_sales(db, auth, params, status=None, start=None, end=None):
    if start is not None and end is not None and start >= end:
        raise HTTPException(422, "start must precede end.")
    statement = tenant_statement(Sale, auth)
    if status is not None:
        statement = statement.where(Sale.status == status)
    if start is not None:
        statement = statement.where(Sale.occurred_at >= start)
    if end is not None:
        statement = statement.where(Sale.occurred_at < end)
    return paginate(db, statement, params, SaleSummary, order_by=(Sale.occurred_at.desc(), Sale.id.desc()))


def rule_snapshot(db, auth, rule_id):
    if rule_id is None:
        return None, None
    rule = get_tenant_record(db, PricingRule, rule_id, auth)
    editable(rule)
    return rule.version, {"rule": {"id": str(rule.id), "name": rule.name, "version": rule.version,
                                   "strategy_key": rule.strategy_key, "parameters": deepcopy(rule.parameters)},
                          "calculation_status": "unavailable"}


def build_lines(db, auth, sale_id, inputs):
    result = []
    models = {SaleLineKind.SERVICE: Service, SaleLineKind.PRODUCT: Product, SaleLineKind.MATERIAL: Material}
    for data in inputs:
        reference = getattr(data, f"{data.kind.value}_id")
        record = get_tenant_record(db, models[data.kind], reference, auth)
        editable(record)
        code = data.unit_code
        price = None
        if data.kind == SaleLineKind.MATERIAL:
            code = code or record.purchase_unit_code
            compatible(db, record.purchase_unit_code, code)
        elif code is not None:
            selected = unit(db, code)
            if selected.dimension.code != "count" or selected.factor_numerator != selected.factor_denominator:
                raise HTTPException(422, "Products and services accept only a single-count unit or no unit.")
        if data.kind == SaleLineKind.SERVICE:
            if record.base_price > Decimal("9223372036854.775807"):
                raise HTTPException(422, "Service price exceeds unit snapshot storage range.")
            price = record.base_price
        result.append(SaleLine(**data.model_dump(exclude={"unit_code"}), unit_code=code,
            company_id=auth.company_id, sale_id=sale_id, description_snapshot=record.name,
            unit_price_snapshot=price, unit_cost_snapshot=None, line_total=None))
    return result


def audit(db, auth, sale, action, changes, request_id):
    db.add(AuditEvent(company_id=auth.company_id, actor_user_id=auth.user.id, entity_type="sale",
                      entity_id=sale.id, action=action, changes=changes, request_id=request_id))


def create(db, auth, data, request_id):
    lock_company(db, auth)
    version, snapshot = rule_snapshot(db, auth, data.pricing_rule_id)
    sale = Sale(**data.model_dump(exclude={"lines"}), company_id=auth.company_id, created_by_id=auth.user.id,
                currency=auth.user.company.currency, status=SaleStatus.DRAFT, rule_version=version, pricing_snapshot=snapshot)
    db.add(sale)
    db.flush()
    db.add_all(build_lines(db, auth, sale.id, data.lines))
    db.flush()
    sale = detail(db, auth, sale.id)
    audit(db, auth, sale, "create", {"after": SaleRead.model_validate(sale).model_dump(mode="json")}, request_id)
    db.commit()
    return detail(db, auth, sale.id)


def edit(db, auth, sale_id, data, request_id):
    lock_company(db, auth)
    sale = detail(db, auth, sale_id)
    if sale.status != SaleStatus.DRAFT:
        raise HTTPException(409, "Only draft sales can be edited.")
    before = SaleRead.model_validate(sale).model_dump(mode="json")
    if "lines" in data.model_fields_set:
        lines = build_lines(db, auth, sale.id, data.lines)
        db.execute(delete(SaleLine).where(SaleLine.company_id == auth.company_id, SaleLine.sale_id == sale.id))
        db.add_all(lines)
        sale.updated_at = utc_now()
    if "pricing_rule_id" in data.model_fields_set and data.pricing_rule_id != sale.pricing_rule_id:
        sale.rule_version, sale.pricing_snapshot = rule_snapshot(db, auth, data.pricing_rule_id)
    for field, value in data.model_dump(exclude_unset=True, exclude={"lines"}).items():
        setattr(sale, field, value)
    db.flush()
    sale = detail(db, auth, sale.id)
    after = SaleRead.model_validate(sale).model_dump(mode="json")
    if before != after:
        audit(db, auth, sale, "update", {"before": before, "after": after}, request_id)
        db.commit()
    return detail(db, auth, sale.id)


def transition(db, auth, sale_id, target, request_id):
    lock_company(db, auth)
    sale = detail(db, auth, sale_id)
    if sale.status == target:
        return sale
    if sale.status == SaleStatus.CANCELLED or (target == SaleStatus.COMPLETED and sale.status != SaleStatus.DRAFT):
        raise HTTPException(409, "Invalid sale status transition.")
    if target == SaleStatus.COMPLETED and not sale.lines:
        raise HTTPException(409, "A sale must have at least one line before completion.")
    previous = sale.status
    sale.status = target
    audit(db, auth, sale, "status_change", {"before": previous.value, "after": target.value}, request_id)
    db.commit()
    return detail(db, auth, sale.id)
