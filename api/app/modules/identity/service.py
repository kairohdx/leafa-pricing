from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import Settings
from app.core.dependencies import AuthContext, unauthorized
from app.core.security import new_token, token_digest, verify_password
from app.db.types import utc_now
from app.modules.identity.models import AuthSession, User
from app.modules.identity.schemas import LoginRequest, TokenResponse


def login(db: Session, data: LoginRequest, settings: Settings) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == str(data.email)).options(joinedload(User.company)))
    valid = verify_password(data.password.get_secret_value(), user.password_hash if user else None)
    if not valid or user is None or not user.is_active or not user.company.is_active:
        raise unauthorized()
    token = new_token()
    expires = utc_now() + timedelta(hours=settings.session_hours)
    db.add(AuthSession(user_id=user.id, token_hash=token_digest(token), expires_at=expires))
    db.commit()
    return TokenResponse(access_token=token, expires_at=expires)


def logout(db: Session, auth: AuthContext):
    auth.session.revoked_at = utc_now()
    db.commit()
