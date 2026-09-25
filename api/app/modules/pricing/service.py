from fastapi import HTTPException
from sqlalchemy import select, update

from app.core.dependencies import get_tenant_record, tenant_statement
from app.db.pagination import paginate
from app.db.types import utc_now
from app.modules.audit.models import AuditEvent
from app.modules.companies.models import Company
from app.modules.pricing.models import PricingRule
from app.modules.pricing.schemas import PricingRuleRead
from app.modules.pricing.engine import validate


def validate_rule(strategy, parameters):
    try:
        validate(strategy, parameters)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error


def lock_company(db, auth):
    # Serialize rule writes per company on SQLite and PostgreSQL, without changing timestamps.
    db.execute(update(Company).where(Company.id == auth.company_id).values(updated_at=Company.updated_at))
    db.expire_all()


def audit(db, auth, rule, action, changes, request_id):
    db.add(AuditEvent(company_id=auth.company_id, actor_user_id=auth.user.id,
                      entity_type="pricing_rule", entity_id=rule.id, action=action,
                      changes=changes, request_id=request_id))


def clear_other_default(db, auth, rule, request_id):
    previous = db.scalar(tenant_statement(PricingRule, auth).where(PricingRule.is_default.is_(True),
        PricingRule.archived_at.is_(None), PricingRule.id != rule.id))
    if previous is not None:
        previous.is_default = False
        previous.version += 1
        audit(db, auth, previous, "update", {"is_default": {"before": True, "after": False}, "version": previous.version}, request_id)
        db.flush()  # Release unique slot before assigning it to the new rule.


def list_rules(db, auth, params, search=None, archived=False):
    statement = tenant_statement(PricingRule, auth).where(PricingRule.archived_at.is_not(None) if archived else PricingRule.archived_at.is_(None))
    if search:
        statement = statement.where(PricingRule.name.icontains(search, autoescape=True))
    return paginate(db, statement, params, PricingRuleRead, order_by=(PricingRule.name.asc(), PricingRule.id.asc()))


def create(db, auth, data, request_id):
    validate_rule(data.strategy_key, data.parameters)
    lock_company(db, auth)
    rule = PricingRule(**data.model_dump(exclude={"is_default"}), company_id=auth.company_id, version=1, is_default=False)
    db.add(rule)
    db.flush()
    if data.is_default:
        clear_other_default(db, auth, rule, request_id)
        rule.is_default = True
    audit(db, auth, rule, "create", data.model_dump(mode="json") | {"version": 1}, request_id)
    db.commit()
    db.refresh(rule)
    return rule


def edit(db, auth, rule_id, data, request_id):
    lock_company(db, auth)
    rule = get_tenant_record(db, PricingRule, rule_id, auth)
    if rule.archived_at is not None:
        raise HTTPException(409, "Restore this rule before editing it.")
    if data.expected_version != rule.version:
        raise HTTPException(409, "Rule changed; reload it before editing.")
    values = data.model_dump(exclude_unset=True, exclude={"expected_version"})
    if "strategy_key" in values or "parameters" in values:
        validate_rule(values.get("strategy_key", rule.strategy_key), values.get("parameters", rule.parameters))
    if values.get("is_default") is True and not rule.is_default:
        clear_other_default(db, auth, rule, request_id)
    changes = {}
    for field, value in values.items():
        before = getattr(rule, field)
        if before != value:
            changes[field] = {"before": before, "after": value}
            setattr(rule, field, value)
    if changes:
        rule.version += 1
        audit(db, auth, rule, "update", changes | {"version": rule.version}, request_id)
        db.commit()
        db.refresh(rule)
    return rule


def archive(db, auth, rule_id, archived, request_id):
    lock_company(db, auth)
    rule = get_tenant_record(db, PricingRule, rule_id, auth)
    if (rule.archived_at is not None) == archived:
        return rule
    rule.archived_at = utc_now() if archived else None
    # Restoring never silently replaces the current default.
    rule.is_default = False
    rule.version += 1
    audit(db, auth, rule, "archive" if archived else "restore",
          {"archived": archived, "is_default": False, "version": rule.version}, request_id)
    db.commit()
    db.refresh(rule)
    return rule
