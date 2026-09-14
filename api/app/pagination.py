"""Shared contracts for numbered list pages."""

from typing import Generic, TypeVar

from pydantic import Field, computed_field

from app.schemas import Schema

ItemT = TypeVar("ItemT")


class PaginationParams(Schema):
    page: int = Field(default=1, ge=1, le=2_147_483_647)
    page_size: int = Field(default=20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class Page(PaginationParams, Generic[ItemT]):
    items: list[ItemT]
    total: int = Field(ge=0)

    @computed_field
    @property
    def total_pages(self) -> int:
        return (self.total + self.page_size - 1) // self.page_size

    @computed_field
    @property
    def has_next(self) -> bool:
        return self.page < self.total_pages

    @computed_field
    @property
    def has_previous(self) -> bool:
        return self.page > 1 and self.total > 0
