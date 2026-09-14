"""Paginate a filtered, single-entity SQLAlchemy select."""

from typing import TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.pagination import Page, PaginationParams
from app.schemas import Schema

ModelT = TypeVar("ModelT")
ReadT = TypeVar("ReadT", bound=Schema)


def paginate(
    session: Session,
    statement: Select[tuple[ModelT]],
    params: PaginationParams,
    schema: type[ReadT],
    *,
    order_by: tuple[ColumnElement, ...],
) -> Page[ReadT]:
    """Caller supplies authorization filters and ordering with a unique tie-breaker.

    The statement must return one row per entity. Use EXISTS for collection
    filters and selectinload for collections, rather than multiplying rows.
    """
    if not order_by:
        raise ValueError("Pagination requires explicit, deterministic ordering.")
    unpaged = statement.order_by(None).limit(None).offset(None)
    total = session.scalar(select(func.count()).select_from(unpaged.subquery()))
    rows = session.scalars(
        unpaged.order_by(*order_by).offset(params.offset).limit(params.page_size)
    ).all()
    return Page[ReadT](
        items=[schema.model_validate(row) for row in rows],
        total=total or 0,
        page=params.page,
        page_size=params.page_size,
    )
