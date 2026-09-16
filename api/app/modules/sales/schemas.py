from typing import Annotated
from uuid import UUID
from pydantic import Field, AwareDatetime, JsonValue, model_validator
from app.schemas import Schema, Patch, TenantRead, Money, Quantity, UnitCost, Code, Currency
from app.modules.sales.models import SaleStatus, SaleLineKind

class SaleLineCreate(Schema):
    kind: SaleLineKind
    service_id: UUID | None = None
    product_id: UUID | None = None
    material_id: UUID | None = None
    quantity: Quantity
    unit_code: Code | None = None

    @model_validator(mode="after")
    def matching_reference(self):
        refs = {"service": self.service_id, "product": self.product_id, "material": self.material_id}
        if refs[self.kind.value] is None or sum(v is not None for v in refs.values()) != 1:
            raise ValueError("Exactly one reference matching kind is required.")
        return self

class SaleLineRead(SaleLineCreate, TenantRead):
    sale_id: UUID
    description_snapshot: str
    unit_cost_snapshot: UnitCost | None
    unit_price_snapshot: UnitCost | None
    line_total: Money | None

class SaleCreate(Schema):
    description: Annotated[str, Field(min_length=1)]
    occurred_at: AwareDatetime
    pricing_rule_id: UUID | None = None
    final_total: Money
    lines: list[SaleLineCreate] = Field(default_factory=list)

class SaleUpdate(Patch):
    description: Annotated[str, Field(min_length=1)] | None = None
    occurred_at: AwareDatetime | None = None
    pricing_rule_id: UUID | None = Field(default=None, json_schema_extra={"nullable": True})
    final_total: Money | None = None
    lines: list[SaleLineCreate] | None = None

class SaleSummary(TenantRead):
    description: str
    occurred_at: AwareDatetime
    status: SaleStatus
    created_by_id: UUID
    pricing_rule_id: UUID | None
    rule_version: int | None
    suggested_total: Money | None
    final_total: Money
    cost_total: Money | None
    pricing_snapshot: dict[str, JsonValue] | None
    currency: Currency


class SaleRead(SaleSummary):
    lines: list[SaleLineRead] = Field(default_factory=list)
