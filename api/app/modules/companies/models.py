from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.identity.models import User


class Company(TimestampMixin, Base):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(180))
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    currency: Mapped[str] = mapped_column(String(5), default="BRL")
    timezone: Mapped[str] = mapped_column(String(64), default="America/Sao_Paulo")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")

    users: Mapped[list["User"]] = relationship(
        "User", back_populates="company", passive_deletes="all"
    )
