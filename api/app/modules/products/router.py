from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response

from app.core.dependencies import CurrentAuth, AdminAuth, Database
from app.modules.products import service
from app.modules.products.schemas import ProductCreate, ProductUpdate, ProductRead, ProductSummary, ProductMaterialCreate, ProductMaterialUpdate, ProductMaterialRead
from app.pagination import Page, PaginationParams

router = APIRouter(prefix="/products", tags=["Products"])
Pagination = Annotated[PaginationParams, Depends()]


@router.get("/{product_id}/cost")
def cost(product_id: UUID, db: Database, auth: CurrentAuth):
    from app.modules.pricing.costs import product_cost
    return product_cost(db, auth, product_id)


@router.get("", response_model=Page[ProductSummary])
def list_products(db: Database, auth: CurrentAuth, params: Pagination,
                  search: Annotated[str | None, Query(max_length=180)] = None, archived: bool = False):
    return service.list_products(db, auth, params, search, archived)


@router.post("", response_model=ProductRead, status_code=201)
def create(data: ProductCreate, request: Request, db: Database, auth: AdminAuth):
    return service.create(db, auth, data, request.state.request_id)


@router.get("/{product_id}", response_model=ProductRead)
def read(product_id: UUID, db: Database, auth: CurrentAuth):
    return service.detail(db, auth, product_id)


@router.patch("/{product_id}", response_model=ProductRead)
def edit(product_id: UUID, data: ProductUpdate, request: Request, db: Database, auth: AdminAuth):
    return service.edit(db, auth, product_id, data, request.state.request_id)


@router.post("/{product_id}/archive", response_model=ProductRead)
def archive(product_id: UUID, request: Request, db: Database, auth: AdminAuth):
    return service.archive(db, auth, product_id, True, request.state.request_id)


@router.post("/{product_id}/restore", response_model=ProductRead)
def restore(product_id: UUID, request: Request, db: Database, auth: AdminAuth):
    return service.archive(db, auth, product_id, False, request.state.request_id)


@router.get("/{product_id}/materials", response_model=list[ProductMaterialRead])
def materials(product_id: UUID, db: Database, auth: CurrentAuth):
    return service.detail(db, auth, product_id).materials


@router.post("/{product_id}/materials", response_model=ProductMaterialRead, status_code=201)
def add_material(product_id: UUID, data: ProductMaterialCreate, request: Request, db: Database, auth: AdminAuth):
    return service.add_material(db, auth, product_id, data, request.state.request_id)


@router.patch("/{product_id}/materials/{component_id}", response_model=ProductMaterialRead)
def edit_material(product_id: UUID, component_id: UUID, data: ProductMaterialUpdate, request: Request, db: Database, auth: AdminAuth):
    return service.edit_material(db, auth, product_id, component_id, data, request.state.request_id)


@router.delete("/{product_id}/materials/{component_id}", status_code=204)
def remove_material(product_id: UUID, component_id: UUID, request: Request, db: Database, auth: AdminAuth):
    service.remove_material(db, auth, product_id, component_id, request.state.request_id)
    return Response(status_code=204)
