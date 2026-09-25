from decimal import Decimal

from fastapi import HTTPException

from app.core.dependencies import get_tenant_record, tenant_statement
from app.db.pagination import paginate
from app.db.types import utc_now
from app.modules.audit.models import AuditEvent
from app.modules.services.models import Service
from app.modules.services.schemas import ServiceRead


def finish(db, auth, record, action, changes, request_id):
    db.add(AuditEvent(company_id=auth.company_id, actor_user_id=auth.user.id,
                      entity_type="service", entity_id=record.id, action=action,
                      changes=changes, request_id=request_id))
    db.commit()
    db.refresh(record)
    return record


def list_services(db, auth, params, search=None, archived=False):
    statement = tenant_statement(Service, auth).where(
        Service.archived_at.is_not(None) if archived else Service.archived_at.is_(None))
    if search:
        statement = statement.where(Service.name.icontains(search, autoescape=True))
    return paginate(db, statement, params, ServiceRead,
                    order_by=(Service.name.asc(), Service.id.asc()))


def create_service(db, auth, data, request_id):
    record = Service(**data.model_dump(), company_id=auth.company_id)
    db.add(record)
    db.flush()
    return finish(db, auth, record, "create", data.model_dump(mode="json"), request_id)


def edit_service(db, auth, record_id, data, request_id):
    record = get_tenant_record(db, Service, record_id, auth)
    if record.archived_at is not None:
        raise HTTPException(409, "Restore this service before editing it.")
    changes = {}
    encoded = data.model_dump(mode="json", exclude_unset=True)
    for field, value in data.model_dump(exclude_unset=True).items():
        before = getattr(record, field)
        if before != value:
            changes[field] = {"before": str(before) if isinstance(before, Decimal) else before,
                              "after": encoded[field]}
            setattr(record, field, value)
    return finish(db, auth, record, "update", changes, request_id) if changes else record


def archive_service(db, auth, record_id, archived, request_id):
    record = get_tenant_record(db, Service, record_id, auth)
    if (record.archived_at is not None) == archived:
        return record
    record.archived_at = utc_now() if archived else None
    return finish(db, auth, record, "archive" if archived else "restore",
                  {"archived": archived}, request_id)
