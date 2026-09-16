from typing import Annotated
from uuid import UUID
from pydantic import Field, AwareDatetime
from app.schemas import Schema, Patch, TenantRead, Money, Quantity, Name, Code

class MaterialCreate(Schema):
    name: Name
    sku: Annotated[str, Field(min_length=1, max_length=60)] | None = None
    purchase_unit_code: Code
    purchase_quantity: Quantity
    purchase_cost: Money
    notes: str | None = None

class MaterialUpdate(Patch):
    name: Name | None = None
    sku: Annotated[str, Field(min_length=1, max_length=60)] | None = Field(default=None, json_schema_extra={"nullable": True})
    purchase_unit_code: Code | None = None
    purchase_quantity: Quantity | None = None
    purchase_cost: Money | None = None
    notes: str | None = Field(default=None, json_schema_extra={"nullable": True})

class MaterialRead(MaterialCreate, TenantRead):
    archived_at: AwareDatetime | None = None



class MaterialPackageCreate(Schema):
    material_id: UUID
    name: Name
    quantity: Quantity
    unit_code: Code

class MaterialPackageUpdate(Patch):
    name: Name | None = None
    quantity: Quantity | None = None
    unit_code: Code | None = None

class MaterialPackageRead(MaterialPackageCreate, TenantRead):
    archived_at: AwareDatetime | None = None
