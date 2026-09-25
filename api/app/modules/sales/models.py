from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID
from sqlalchemy import String, Text, Integer, JSON, ForeignKey, CheckConstraint, Index, Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin
from app.db.mixins import TenantMixin, tenant_key, tenant_fk
from app.db.types import UTCDateTime, ScaledDecimal, utc_now


class SaleStatus(str, Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class SaleLineKind(str, Enum):
    SERVICE = "service"
    PRODUCT = "product"
    MATERIAL = "material"

def enum_type(enum):
    return SqlEnum(enum, native_enum=False, create_constraint=True, validate_strings=True, values_callable=lambda items: [item.value for item in items])

class Sale(TenantMixin, TimestampMixin, Base):
    __tablename__ = "sales"
    __table_args__ = (tenant_key("sales"), tenant_fk("created_by_id", "users"), tenant_fk("pricing_rule_id", "pricing_rules"), CheckConstraint("final_total >= 0"), CheckConstraint("suggested_total >= 0"), CheckConstraint("cost_total >= 0"), CheckConstraint("(pricing_rule_id IS NULL AND rule_version IS NULL) OR (pricing_rule_id IS NOT NULL AND rule_version IS NOT NULL AND rule_version > 0)"), Index("ix_sales_company_created_id", "company_id", "created_at", "id"))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[SaleStatus] = mapped_column(enum_type(SaleStatus), default=SaleStatus.DRAFT)
    occurred_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now)
    created_by_id: Mapped[UUID] = mapped_column(index=True)
    pricing_rule_id: Mapped[UUID | None] = mapped_column(index=True)
    rule_version: Mapped[int | None] = mapped_column(Integer)
    suggested_total: Mapped[Decimal | None] = mapped_column(ScaledDecimal(2))
    final_total: Mapped[Decimal] = mapped_column(ScaledDecimal(2))
    cost_total: Mapped[Decimal | None] = mapped_column(ScaledDecimal(2))
    pricing_snapshot: Mapped[dict | None] = mapped_column(JSON)
    currency: Mapped[str] = mapped_column(String(3), default="BRL")
    lines: Mapped[list["SaleLine"]] = relationship(back_populates="sale", passive_deletes="all")

class SaleLine(TenantMixin, TimestampMixin, Base):
    __tablename__ = "sale_lines"
    __table_args__ = (tenant_key("sale_lines"), tenant_fk("sale_id", "sales"), tenant_fk("service_id", "services"), tenant_fk("product_id", "products"), tenant_fk("material_id", "materials"), CheckConstraint("quantity > 0"), CheckConstraint("unit_cost_snapshot >= 0"), CheckConstraint("unit_price_snapshot >= 0"), CheckConstraint("line_total >= 0"), CheckConstraint("(kind = 'service' AND service_id IS NOT NULL AND product_id IS NULL AND material_id IS NULL) OR (kind = 'product' AND product_id IS NOT NULL AND service_id IS NULL AND material_id IS NULL) OR (kind = 'material' AND material_id IS NOT NULL AND service_id IS NULL AND product_id IS NULL)"))
    sale_id: Mapped[UUID] = mapped_column(index=True)
    kind: Mapped[SaleLineKind] = mapped_column(enum_type(SaleLineKind))
    service_id: Mapped[UUID | None] = mapped_column(index=True)
    product_id: Mapped[UUID | None] = mapped_column(index=True)
    material_id: Mapped[UUID | None] = mapped_column(index=True)
    quantity: Mapped[Decimal] = mapped_column(ScaledDecimal(6))
    unit_code: Mapped[str | None] = mapped_column(ForeignKey("units_of_measure.code", ondelete="RESTRICT"))
    description_snapshot: Mapped[str] = mapped_column(Text)
    unit_cost_snapshot: Mapped[Decimal | None] = mapped_column(ScaledDecimal(6))
    unit_price_snapshot: Mapped[Decimal | None] = mapped_column(ScaledDecimal(6))
    line_total: Mapped[Decimal | None] = mapped_column(ScaledDecimal(2))
    sale: Mapped[Sale] = relationship(back_populates="lines")
