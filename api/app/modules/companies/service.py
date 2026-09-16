from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.dependencies import AuthContext
from app.core.security import hash_password
from app.db.types import utc_now
from app.modules.audit.models import AuditEvent
from app.modules.companies.models import Company
from app.modules.companies.schemas import CompanyRegistration, CompanyUpdate
from app.modules.identity.models import AuthSession, User, UserRole


def register(db: Session, data: CompanyRegistration, request_id: str) -> Company:
    company = Company(**data.company.model_dump(), is_active=True)
    db.add(company)
    db.flush()
    user = User(**data.admin.model_dump(exclude={"password"}), company_id=company.id,
                password_hash=hash_password(data.admin.password.get_secret_value()),
                role=UserRole.ADMIN, is_active=True)
    db.add(user)
    db.flush()
    db.add(AuditEvent(company_id=company.id, actor_user_id=user.id, action="create",
                      entity_type="company", entity_id=company.id,
                      changes={"name": company.name, "slug": company.slug}, request_id=request_id))
    db.commit()
    db.refresh(company)
    return company


def update_company(db: Session, auth: AuthContext, data: CompanyUpdate, request_id: str) -> Company:
    company = auth.user.company
    changes = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        before = getattr(company, field)
        if before != value:
            changes[field] = {"before": before, "after": value}
            setattr(company, field, value)
    if changes:
        db.add(AuditEvent(company_id=company.id, actor_user_id=auth.user.id, action="update",
                          entity_type="company", entity_id=company.id,
                          changes=changes, request_id=request_id))
        db.commit()
        db.refresh(company)
    return company


def set_company_active(db: Session, company_id: UUID, active: bool) -> None:
    """Host-admin operation; never expose through tenant-admin credentials."""
    company = db.scalar(select(Company).where(Company.id == company_id).with_for_update())
    if company is None:
        raise HTTPException(404, "Company not found.")
    if company.is_active == active:
        return
    before = company.is_active
    company.is_active = active
    if not active:
        users = select(User.id).where(User.company_id == company.id)
        db.execute(update(AuthSession).where(AuthSession.user_id.in_(users), AuthSession.revoked_at.is_(None)).values(revoked_at=utc_now()))
    db.add(AuditEvent(company_id=company.id, actor_user_id=None, action="activate" if active else "deactivate",
                      entity_type="company", entity_id=company.id,
                      changes={"is_active": {"before": before, "after": active}, "source": "host_cli"}))
    db.commit()
