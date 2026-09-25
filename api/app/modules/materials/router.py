from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.core.dependencies import CurrentAuth, AdminAuth, Database, get_tenant_record
from app.modules.materials import service
from app.modules.materials.models import Material, MaterialPackage
from app.modules.materials.schemas import MaterialCreate, MaterialUpdate, MaterialRead, MaterialPackageCreate, MaterialPackageUpdate, MaterialPackageRead
from app.pagination import Page, PaginationParams

router = APIRouter(tags=["Materials"])
Pagination = Annotated[PaginationParams, Depends()]


@router.get("/materials", response_model=Page[MaterialRead])
def list_materials(db: Database, auth: CurrentAuth, params: Pagination,
                   search: Annotated[str | None, Query(max_length=180)] = None, archived: bool = False):
    return service.list_materials(db, auth, params, search, archived)


@router.post("/materials", response_model=MaterialRead, status_code=201)
def create_material(data: MaterialCreate, request: Request, db: Database, auth: AdminAuth):
    return service.create_material(db, auth, data, request.state.request_id)


@router.get("/materials/{material_id}", response_model=MaterialRead)
def read_material(material_id: UUID, db: Database, auth: CurrentAuth):
    return get_tenant_record(db, Material, material_id, auth)


@router.patch("/materials/{material_id}", response_model=MaterialRead)
def edit_material(material_id: UUID, data: MaterialUpdate, request: Request, db: Database, auth: AdminAuth):
    return service.edit_material(db, auth, material_id, data, request.state.request_id)


@router.post("/materials/{material_id}/archive", response_model=MaterialRead)
def archive_material(material_id: UUID, request: Request, db: Database, auth: AdminAuth):
    return service.archive(db, auth, Material, material_id, True, request.state.request_id)


@router.post("/materials/{material_id}/restore", response_model=MaterialRead)
def restore_material(material_id: UUID, request: Request, db: Database, auth: AdminAuth):
    return service.archive(db, auth, Material, material_id, False, request.state.request_id)


@router.get("/materials/{material_id}/packages", response_model=Page[MaterialPackageRead])
def list_packages(material_id: UUID, db: Database, auth: CurrentAuth, params: Pagination, archived: bool = False):
    return service.list_packages(db, auth, material_id, params, archived)


@router.post("/material-packages", response_model=MaterialPackageRead, status_code=201)
def create_package(data: MaterialPackageCreate, request: Request, db: Database, auth: AdminAuth):
    return service.create_package(db, auth, data, request.state.request_id)


@router.get("/material-packages/{package_id}", response_model=MaterialPackageRead)
def read_package(package_id: UUID, db: Database, auth: CurrentAuth):
    return get_tenant_record(db, MaterialPackage, package_id, auth)


@router.patch("/material-packages/{package_id}", response_model=MaterialPackageRead)
def edit_package(package_id: UUID, data: MaterialPackageUpdate, request: Request, db: Database, auth: AdminAuth):
    return service.edit_package(db, auth, package_id, data, request.state.request_id)


@router.post("/material-packages/{package_id}/archive", response_model=MaterialPackageRead)
def archive_package(package_id: UUID, request: Request, db: Database, auth: AdminAuth):
    return service.archive(db, auth, MaterialPackage, package_id, True, request.state.request_id)


@router.post("/material-packages/{package_id}/restore", response_model=MaterialPackageRead)
def restore_package(package_id: UUID, request: Request, db: Database, auth: AdminAuth):
    return service.archive(db, auth, MaterialPackage, package_id, False, request.state.request_id)
