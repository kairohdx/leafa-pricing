from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import AwareDatetime

from app.core.dependencies import CurrentAuth, AdminAuth, Database
from app.modules.sales import service
from app.modules.sales.models import SaleStatus
from app.modules.sales.schemas import SaleCreate, SaleUpdate, SaleRead, SaleSummary
from app.pagination import Page, PaginationParams

router = APIRouter(prefix="/sales", tags=["Sales"])
Pagination = Annotated[PaginationParams, Depends()]


@router.get("", response_model=Page[SaleSummary])
def list_sales(db: Database, auth: CurrentAuth, params: Pagination, status: SaleStatus | None = None,
               start: AwareDatetime | None = None, end: AwareDatetime | None = None):
    return service.list_sales(db, auth, params, status, start, end)


@router.post("", response_model=SaleRead, status_code=201)
def create(data: SaleCreate, request: Request, db: Database, auth: CurrentAuth):
    return service.create(db, auth, data, request.state.request_id)


@router.get("/{sale_id}", response_model=SaleRead)
def read(sale_id: UUID, db: Database, auth: CurrentAuth):
    return service.detail(db, auth, sale_id)


@router.patch("/{sale_id}", response_model=SaleRead)
def edit(sale_id: UUID, data: SaleUpdate, request: Request, db: Database, auth: CurrentAuth):
    return service.edit(db, auth, sale_id, data, request.state.request_id)


@router.post("/{sale_id}/complete", response_model=SaleRead)
def complete(sale_id: UUID, request: Request, db: Database, auth: CurrentAuth):
    return service.transition(db, auth, sale_id, SaleStatus.COMPLETED, request.state.request_id)


@router.post("/{sale_id}/cancel", response_model=SaleRead)
def cancel(sale_id: UUID, request: Request, db: Database, auth: AdminAuth):
    return service.transition(db, auth, sale_id, SaleStatus.CANCELLED, request.state.request_id)
