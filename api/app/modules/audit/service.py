from fastapi import HTTPException

from app.core.dependencies import tenant_statement
from app.db.pagination import paginate
from app.modules.audit.models import AuditEvent
from app.modules.audit.schemas import AuditEventRead


def list_events(db, auth, params, start=None, end=None, actor_user_id=None, entity_type=None, entity_id=None, action=None, request_id=None):
    if start is not None and end is not None and start >= end:
        raise HTTPException(422, "start must precede end.")
    statement = tenant_statement(AuditEvent, auth)
    if start is not None:
        statement = statement.where(AuditEvent.occurred_at >= start)
    if end is not None:
        statement = statement.where(AuditEvent.occurred_at < end)
    for column, value in ((AuditEvent.actor_user_id, actor_user_id), (AuditEvent.entity_type, entity_type),
                          (AuditEvent.entity_id, entity_id), (AuditEvent.action, action), (AuditEvent.request_id, request_id)):
        if value is not None:
            statement = statement.where(column == value)
    return paginate(db, statement, params, AuditEventRead, order_by=(AuditEvent.occurred_at.desc(), AuditEvent.id.desc()))
