from decimal import Decimal
from uuid import UUID
from sqlalchemy import String, Text, ForeignKey, CheckConstraint, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin
from app.db.mixins import TenantMixin, ArchiveMixin, tenant_key, tenant_fk
from app.db.types import ScaledDecimal


class Material(TenantMixin, ArchiveMixin, TimestampMixin, Base):
    __tablename__ = "materials"
    __table_args__ = (tenant_key("materials"), UniqueConstraint("company_id", "sku"), CheckConstraint("purchase_quantity > 0"), CheckConstraint("purchase_cost >= 0"), Index("ix_materials_company_name", "company_id", "name"))
    name: Mapped[str] = mapped_column(String(180))
    sku: Mapped[str | None] = mapped_column(String(60))
    purchase_unit_code: Mapped[str] = mapped_column(ForeignKey("units_of_measure.code", ondelete="RESTRICT"))
    purchase_quantity: Mapped[Decimal] = mapped_column(ScaledDecimal(6))
    purchase_cost: Mapped[Decimal] = mapped_column(ScaledDecimal(2))
    notes: Mapped[str | None] = mapped_column(Text)

class MaterialPackage(TenantMixin, ArchiveMixin, TimestampMixin, Base):
    __tablename__ = "material_packages"
    __table_args__ = (tenant_key("material_packages"), tenant_fk("material_id", "materials"), UniqueConstraint("company_id", "material_id", "name"), CheckConstraint("quantity > 0"))
    material_id: Mapped[UUID] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String(180))
    quantity: Mapped[Decimal] = mapped_column(ScaledDecimal(6))
    unit_code: Mapped[str] = mapped_column(ForeignKey("units_of_measure.code", ondelete="RESTRICT"))
    material: Mapped[Material] = relationship()
