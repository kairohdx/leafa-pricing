from typing import Annotated
from uuid import UUID
from pydantic import Field, AwareDatetime, EmailStr, SecretStr
from app.schemas import Schema, Patch, Read, TenantRead
from app.modules.identity.models import UserRole

class UserCreate(Schema):
    username: Annotated[str, Field(min_length=1, max_length=60)]
    name: Annotated[str, Field(min_length=1, max_length=255)]
    email: Annotated[EmailStr, Field(max_length=255)]
    phone: Annotated[str, Field(max_length=20)] = ""
    password: Annotated[SecretStr, Field(min_length=8, max_length=128)]
    role: UserRole = UserRole.OPERATOR

class UserUpdate(Patch):
    username: Annotated[str, Field(min_length=1, max_length=60)] | None = None
    name: Annotated[str, Field(min_length=1, max_length=255)] | None = None
    email: Annotated[EmailStr, Field(max_length=255)] | None = None
    phone: Annotated[str, Field(max_length=20)] | None = None
    password: Annotated[SecretStr, Field(min_length=8, max_length=128)] | None = None
    role: UserRole | None = None
    is_active: bool | None = None

class UserRead(TenantRead):
    username: str
    name: str
    email: EmailStr
    phone: str
    role: UserRole
    is_active: bool

class LoginRequest(Schema):
    email: EmailStr
    password: SecretStr

class AuthSessionRead(Read):
    user_id: UUID
    expires_at: AwareDatetime
    revoked_at: AwareDatetime | None

class TokenResponse(Schema):
    access_token: str
    token_type: str = "bearer"
    expires_at: AwareDatetime
