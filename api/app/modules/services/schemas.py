from pydantic import Field, AwareDatetime
from app.schemas import Schema, Patch, TenantRead, Money, Name

class ServiceCreate(Schema):
    name: Name
    description: str | None = None
    base_price: Money

class ServiceUpdate(Patch):
    name: Name | None = None
    description: str | None = Field(default=None, json_schema_extra={"nullable": True})
    base_price: Money | None = None

class ServiceRead(ServiceCreate, TenantRead):
    archived_at: AwareDatetime | None = None
