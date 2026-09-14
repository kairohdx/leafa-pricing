from datetime import datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, BeforeValidator, AwareDatetime, model_validator

def exact(value):
    if isinstance(value, (float, bool)):
        raise ValueError("Use a decimal string or integer, never float or boolean.")
    return value

Money = Annotated[Decimal, BeforeValidator(exact), Field(ge=0, decimal_places=2, le=Decimal('92233720368547758.07'), allow_inf_nan=False)]
Quantity = Annotated[Decimal, BeforeValidator(exact), Field(gt=0, decimal_places=6, le=Decimal('9223372036854.775807'), allow_inf_nan=False)]
UnitCost = Annotated[Decimal, BeforeValidator(exact), Field(ge=0, decimal_places=6, le=Decimal('9223372036854.775807'), allow_inf_nan=False)]
Name = Annotated[str, Field(min_length=1, max_length=180)]
Code = Annotated[str, Field(min_length=1, max_length=20)]
Currency = Annotated[str, Field(pattern=r'^[A-Z]{3}$')]

class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid", str_strip_whitespace=True)

class Patch(Schema):
    @model_validator(mode="after")
    def reject_null_required(self):
        for name in self.model_fields_set:
            field = type(self).model_fields[name]
            if getattr(self, name) is None and not (field.json_schema_extra or {}).get("nullable", False):
                raise ValueError(f"{name} cannot be null; omit it to preserve its value.")
        return self

class Read(Schema):
    id: UUID
    created_at: AwareDatetime
    updated_at: AwareDatetime

class TenantRead(Read):
    company_id: UUID
