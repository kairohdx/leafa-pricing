from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.core.dependencies import CurrentAuth, Database
from app.modules.units import service
from app.modules.units.models import UnitDimension, UnitOfMeasure
from app.modules.units.schemas import UnitDimensionRead, UnitOfMeasureRead
from app.pagination import Page, PaginationParams

router = APIRouter(tags=["Units"])
Pagination = Annotated[PaginationParams, Depends()]


@router.get("/unit-dimensions", response_model=Page[UnitDimensionRead])
def dimensions(db: Database, auth: CurrentAuth, params: Pagination):
    return service.list_dimensions(db, params)


@router.get("/unit-dimensions/{dimension_id}", response_model=UnitDimensionRead)
def dimension(dimension_id: UUID, db: Database, auth: CurrentAuth):
    return service.get_record(db, UnitDimension, dimension_id)


@router.get("/units", response_model=Page[UnitOfMeasureRead])
def units(db: Database, auth: CurrentAuth, params: Pagination, dimension_id: UUID | None = None):
    return service.list_units(db, params, dimension_id)


@router.get("/units/code/{code}", response_model=UnitOfMeasureRead)
def unit_by_code(code: str, db: Database, auth: CurrentAuth):
    unit = db.scalar(select(UnitOfMeasure).where(UnitOfMeasure.code == code))
    if unit is None:
        raise HTTPException(404, "Unit not found.")
    return unit


@router.get("/units/{unit_id}", response_model=UnitOfMeasureRead)
def unit(unit_id: UUID, db: Database, auth: CurrentAuth):
    return service.get_record(db, UnitOfMeasure, unit_id)
