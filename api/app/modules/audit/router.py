from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import AwareDatetime

from app.core.dependencies import AdminAuth, Database, get_tenant_record
from app.modules.audit import service
from app.modules.audit.models import AuditEvent
from app.modules.audit.schemas import AuditEventRead
from app.pagination import Page, PaginationParams

router = APIRouter(prefix="/audit-events", tags=["Audit"])
Pagination = Annotated[PaginationParams, Depends()]


@router.get("", response_model=Page[AuditEventRead])
def list_events(db: Database, auth: AdminAuth, params: Pagination,
                start: AwareDatetime | None = None, end: AwareDatetime | None = None,
                actor_user_id: UUID | None = None, entity_id: UUID | None = None,
                entity_type: Annotated[str | None, Query(min_length=1, max_length=60)] = None,
                action: Annotated[str | None, Query(min_length=1, max_length=60)] = None,
                request_id: Annotated[str | None, Query(min_length=1, max_length=100)] = None):
    return service.list_events(db, auth, params, start, end, actor_user_id, entity_type, entity_id, action, request_id)


@router.get("/{event_id}", response_model=AuditEventRead)
def read(event_id: UUID, db: Database, auth: AdminAuth):
    return get_tenant_record(db, AuditEvent, event_id, auth)
