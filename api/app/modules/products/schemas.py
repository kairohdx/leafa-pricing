from typing import Annotated
from uuid import UUID
from pydantic import Field, AwareDatetime
from app.schemas import Schema, Patch, TenantRead, Quantity, Name, Code

class ProductMaterialCreate(Schema):
    material_id: UUID
    quantity: Quantity
    unit_code: Code

class ProductMaterialUpdate(Patch):
    material_id: UUID | None = None
    quantity: Quantity | None = None
    unit_code: Code | None = None

class ProductMaterialRead(ProductMaterialCreate, TenantRead):
    pass
    product_id: UUID



class ProductCreate(Schema):
    name: Name
    sku: Annotated[str, Field(min_length=1, max_length=60)] | None = None
    description: str | None = None

class ProductUpdate(Patch):
    name: Name | None = None
    sku: Annotated[str, Field(min_length=1, max_length=60)] | None = Field(default=None, json_schema_extra={"nullable": True})
    description: str | None = Field(default=None, json_schema_extra={"nullable": True})

class ProductRead(ProductCreate, TenantRead):
    archived_at: AwareDatetime | None = None
    materials: list[ProductMaterialRead] = Field(default_factory=list)
