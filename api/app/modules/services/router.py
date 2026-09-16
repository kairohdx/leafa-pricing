from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.core.dependencies import CurrentAuth, AdminAuth, Database, get_tenant_record
from app.modules.services import service
from app.modules.services.models import Service
from app.modules.services.schemas import ServiceCreate, ServiceUpdate, ServiceRead
from app.pagination import Page, PaginationParams

router = APIRouter(prefix="/services", tags=["Services"])
Pagination = Annotated[PaginationParams, Depends()]


@router.get("", response_model=Page[ServiceRead])
def list_services(db: Database, auth: CurrentAuth, params: Pagination,
                  search: Annotated[str | None, Query(max_length=180)] = None, archived: bool = False):
    return service.list_services(db, auth, params, search, archived)


@router.post("", response_model=ServiceRead, status_code=201)
def create(data: ServiceCreate, request: Request, db: Database, auth: AdminAuth):
    return service.create_service(db, auth, data, request.state.request_id)


@router.get("/{service_id}", response_model=ServiceRead)
def read(service_id: UUID, db: Database, auth: CurrentAuth):
    return get_tenant_record(db, Service, service_id, auth)


@router.patch("/{service_id}", response_model=ServiceRead)
def edit(service_id: UUID, data: ServiceUpdate, request: Request, db: Database, auth: AdminAuth):
    return service.edit_service(db, auth, service_id, data, request.state.request_id)


@router.post("/{service_id}/archive", response_model=ServiceRead)
def archive(service_id: UUID, request: Request, db: Database, auth: AdminAuth):
    return service.archive_service(db, auth, service_id, True, request.state.request_id)


@router.post("/{service_id}/restore", response_model=ServiceRead)
def restore(service_id: UUID, request: Request, db: Database, auth: AdminAuth):
    return service.archive_service(db, auth, service_id, False, request.state.request_id)
