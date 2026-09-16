from typing import Annotated
import json
from pydantic import Field, AwareDatetime, JsonValue, AfterValidator
from app.schemas import Schema, Patch, TenantRead, Name


def finite_json(value):
    json.dumps(value, allow_nan=False)
    return value


Parameters = Annotated[dict[str, JsonValue], AfterValidator(finite_json)]

class PricingRuleCreate(Schema):
    name: Name
    description: str | None = None
    strategy_key: Annotated[str, Field(min_length=1, max_length=60)]
    parameters: Parameters = Field(default_factory=dict)
    is_default: bool = False

class PricingRuleUpdate(Patch):
    expected_version: Annotated[int, Field(strict=True, gt=0)]
    name: Name | None = None
    description: str | None = Field(default=None, json_schema_extra={"nullable": True})
    strategy_key: Annotated[str, Field(min_length=1, max_length=60)] | None = None
    parameters: Parameters | None = None
    is_default: bool | None = None

class PricingRuleRead(PricingRuleCreate, TenantRead):
    version: int
    archived_at: AwareDatetime | None = None
