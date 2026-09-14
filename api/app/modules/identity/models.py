from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Enum as SqlEnum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.db.mixins import TenantMixin, tenant_key
from app.db.types import UTCDateTime

if TYPE_CHECKING:
    from app.modules.companies.models import Company


class UserRole(str, Enum):
    ADMIN = "admin"
    OPERATOR = "operator"


class User(TenantMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        tenant_key("users"),
        UniqueConstraint("company_id", "username"),
    )

    username: Mapped[str] = mapped_column(String(60))
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(
            UserRole,
            name="user_role",
            native_enum=False,
            create_constraint=True,
            validate_strings=True,
            values_callable=lambda enum: [item.value for item in enum],
        )
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")

    company: Mapped["Company"] = relationship("Company", back_populates="users")
    sessions: Mapped[list["AuthSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )


class AuthSession(TimestampMixin, Base):
    __tablename__ = "auth_sessions"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    user: Mapped[User] = relationship(back_populates="sessions")
