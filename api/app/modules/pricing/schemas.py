from typing import Annotated
from pydantic import Field, AwareDatetime, JsonValue
from app.schemas import Schema, Patch, TenantRead, Name

class PricingRuleCreate(Schema):
    name: Name
    description: str | None = None
    strategy_key: Annotated[str, Field(min_length=1, max_length=60)]
    parameters: dict[str, JsonValue] = Field(default_factory=dict)
    version: Annotated[int, Field(strict=True, gt=0)] = 1
    is_default: bool = False

class PricingRuleUpdate(Patch):
    name: Name | None = None
    description: str | None = Field(default=None, json_schema_extra={"nullable": True})
    strategy_key: Annotated[str, Field(min_length=1, max_length=60)] | None = None
    parameters: dict[str, JsonValue] | None = None
    version: Annotated[int, Field(strict=True, gt=0)] | None = None
    is_default: bool | None = None

class PricingRuleRead(PricingRuleCreate, TenantRead):
    archived_at: AwareDatetime | None = None
