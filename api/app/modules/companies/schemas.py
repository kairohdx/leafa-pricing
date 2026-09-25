from typing import Annotated
from pydantic import Field, EmailStr, SecretStr
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

class CompanyUpdate(Patch):
    name: Name | None = None
    slug: Annotated[str, Field(min_length=1, max_length=60, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")] | None = None
    currency: Currency | None = None
    timezone: Timezone | None = None

class CompanyRead(CompanyCreate, Read):
    is_active: bool


class InitialAdmin(Schema):
    username: Annotated[str, Field(min_length=1, max_length=60)]
    name: Annotated[str, Field(min_length=1, max_length=255)]
    email: Annotated[EmailStr, Field(max_length=255)]
    phone: Annotated[str, Field(max_length=20)] = ""
    password: Annotated[SecretStr, Field(min_length=8, max_length=128)]


class CompanyRegistration(Schema):
    company: CompanyCreate
    admin: InitialAdmin
