from typing import Annotated
from pydantic import Field
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import AfterValidator
from app.schemas import Schema, Patch, Read, Name, Currency

def validate_timezone(value):
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError("Unknown IANA timezone") from exc
    return value

Timezone = Annotated[str, Field(min_length=1, max_length=64), AfterValidator(validate_timezone)]

class CompanyCreate(Schema):
    name: Name
    slug: Annotated[str, Field(min_length=1, max_length=60, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    currency: Currency = "BRL"
    timezone: Timezone = "America/Sao_Paulo"
    is_active: bool = True

class CompanyUpdate(Patch):
    name: Name | None = None
    slug: Annotated[str, Field(min_length=1, max_length=60, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")] | None = None
    currency: Currency | None = None
    timezone: Timezone | None = None
    is_active: bool | None = None

class CompanyRead(CompanyCreate, Read):
    pass
