from decimal import Decimal
from sqlalchemy import String, Text, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin
from app.db.mixins import TenantMixin, ArchiveMixin, tenant_key
from app.db.types import ScaledDecimal


class Service(TenantMixin, ArchiveMixin, TimestampMixin, Base):
    __tablename__ = "services"
    __table_args__ = (tenant_key("services"), CheckConstraint("base_price >= 0"), Index("ix_services_company_name", "company_id", "name"))
    name: Mapped[str] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(Text)
    base_price: Mapped[Decimal] = mapped_column(ScaledDecimal(2))
