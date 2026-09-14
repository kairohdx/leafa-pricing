from sqlalchemy import String, Text, Boolean, Integer, JSON, CheckConstraint, Index, text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin
from app.db.mixins import TenantMixin, ArchiveMixin, tenant_key


class PricingRule(TenantMixin, ArchiveMixin, TimestampMixin, Base):
    __tablename__ = "pricing_rules"
    __table_args__ = (tenant_key("pricing_rules"), CheckConstraint("version > 0"), Index("uq_pricing_active_default", "company_id", unique=True, sqlite_where=text("is_default = 1 AND archived_at IS NULL"), postgresql_where=text("is_default = true AND archived_at IS NULL")))
    name: Mapped[str] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(Text)
    strategy_key: Mapped[str] = mapped_column(String(60))
    parameters: Mapped[dict] = mapped_column(JSON, default=dict)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
