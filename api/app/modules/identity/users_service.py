from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.dependencies import AuthContext, get_tenant_record, tenant_statement
from app.core.security import hash_password, verify_password
from app.db.pagination import paginate
from app.db.types import utc_now
from app.modules.audit.models import AuditEvent
from app.modules.identity.models import User, UserRole, AuthSession
from app.modules.identity.schemas import UserCreate, UserRead, UserUpdate, ProfileUpdate, PasswordChange, AuthSessionRead
from app.pagination import PaginationParams


def audit(db, auth, user, action, changes, request_id):
    db.add(AuditEvent(company_id=auth.company_id, actor_user_id=auth.user.id,
                      entity_type="user", entity_id=user.id, action=action,
                      changes=changes, request_id=request_id))


def revoke_sessions(db, user_id):
    db.execute(update(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None)).values(revoked_at=utc_now()))


def create_user(db: Session, auth: AuthContext, data: UserCreate, request_id: str):
    user = User(**data.model_dump(exclude={"password"}), company_id=auth.company_id,
                password_hash=hash_password(data.password.get_secret_value()), is_active=True)
    db.add(user)
    db.flush()
    audit(db, auth, user, "create", {"username": user.username, "role": user.role.value}, request_id)
    db.commit()
    db.refresh(user)
    return user


def list_users(db, auth, params, search=None, active=None):
    statement = tenant_statement(User, auth)
    if search:
        statement = statement.where(User.name.icontains(search, autoescape=True) | User.username.icontains(search, autoescape=True) | User.email.icontains(search, autoescape=True))
    if active is not None:
        statement = statement.where(User.is_active == active)
    return paginate(db, statement, params, UserRead, order_by=(User.name.asc(), User.id.asc()))


def edit_user(db: Session, auth: AuthContext, user_id: UUID, data: UserUpdate | ProfileUpdate, request_id: str):
    user = get_tenant_record(db, User, user_id, auth)
    values = data.model_dump(exclude_unset=True, exclude={"password"})
    # Administrative self-lockout is disallowed; another admin manages this account.
    if user.id == auth.user.id and (values.get("is_active") is False or ("role" in values and values["role"] != user.role)):
        raise HTTPException(409, "Cannot deactivate yourself or change your own role.")
    changes = {}
    for field, value in values.items():
        before = getattr(user, field)
        if before != value:
            changes[field] = {"before": before, "after": value}
            setattr(user, field, value)
    password = getattr(data, "password", None)
    if password is not None:
        user.password_hash = hash_password(password.get_secret_value())
        changes["password_changed"] = True
    if changes:
        if password is not None or "is_active" in changes or "role" in changes:
            revoke_sessions(db, user.id)
        audit(db, auth, user, "update", changes, request_id)
        db.commit()
        db.refresh(user)
    return user


def change_password(db, auth, data: PasswordChange, request_id):
    if not verify_password(data.current_password.get_secret_value(), auth.user.password_hash):
        raise HTTPException(403, "Current password is incorrect.")
    auth.user.password_hash = hash_password(data.new_password.get_secret_value())
    revoke_sessions(db, auth.user.id)
    audit(db, auth, auth.user, "password_change", {"password_changed": True}, request_id)
    db.commit()


def list_sessions(db, auth, params: PaginationParams):
    statement = select(AuthSession).where(AuthSession.user_id == auth.user.id)
    return paginate(db, statement, params, AuthSessionRead, order_by=(AuthSession.created_at.desc(), AuthSession.id.desc()))


def revoke_session(db, auth, session_id, request_id):
    session = db.scalar(select(AuthSession).where(AuthSession.id == session_id, AuthSession.user_id == auth.user.id))
    if session is None:
        raise HTTPException(404, "Session not found.")
    if session.revoked_at is None:
        session.revoked_at = utc_now()
        audit(db, auth, auth.user, "session_revoke", {"session_id": str(session.id)}, request_id)
        db.commit()
