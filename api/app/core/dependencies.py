from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.security import token_digest
from app.db.session import get_session
from app.db.types import utc_now
from app.modules.identity.models import AuthSession, User, UserRole

Database = Annotated[Session, Depends(get_session)]
bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthContext:
    user: User
    session: AuthSession

    @property
    def company_id(self) -> UUID:
        return self.user.company_id


def unauthorized():
    return HTTPException(401, "Invalid or expired credentials.", headers={"WWW-Authenticate": "Bearer"})


def get_auth_context(db: Database, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> AuthContext:
    if credentials is None:
        raise unauthorized()
    auth = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_digest(credentials.credentials)).options(joinedload(AuthSession.user).joinedload(User.company)))
    if auth is None or auth.revoked_at is not None or auth.expires_at <= utc_now():
        raise unauthorized()
    if not auth.user.is_active or not auth.user.company.is_active:
        raise unauthorized()
    return AuthContext(auth.user, auth)


CurrentAuth = Annotated[AuthContext, Depends(get_auth_context)]


def require_roles(*roles: UserRole):
    def check(auth: CurrentAuth) -> AuthContext:
        if auth.user.role not in roles:
            raise HTTPException(403, "Insufficient permissions.")
        return auth
    return check


AdminAuth = Annotated[AuthContext, Depends(require_roles(UserRole.ADMIN))]


def tenant_statement(model, auth: AuthContext):
    """Use on every tenant-owned list/read/update/delete query."""
    return select(model).where(model.company_id == auth.company_id)


def get_tenant_record(db: Session, model, record_id: UUID, auth: AuthContext):
    record = db.scalar(tenant_statement(model, auth).where(model.id == record_id))
    if record is None:
        raise HTTPException(404, "Record not found.")
    return record
