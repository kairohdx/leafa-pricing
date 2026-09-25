from decimal import Decimal
from uuid import UUID
from sqlalchemy import String, Text, ForeignKey, CheckConstraint, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin
from app.db.mixins import TenantMixin, ArchiveMixin, tenant_key, tenant_fk
from app.db.types import ScaledDecimal


class Product(TenantMixin, ArchiveMixin, TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (tenant_key("products"), UniqueConstraint("company_id", "sku"), Index("ix_products_company_name", "company_id", "name"))
    name: Mapped[str] = mapped_column(String(180))
    sku: Mapped[str | None] = mapped_column(String(60))
    description: Mapped[str | None] = mapped_column(Text)
    materials: Mapped[list["ProductMaterial"]] = relationship(back_populates="product", cascade="all, delete-orphan")

class ProductMaterial(TenantMixin, TimestampMixin, Base):
    __tablename__ = "product_materials"
    __table_args__ = (tenant_key("product_materials"), tenant_fk("product_id", "products"), tenant_fk("material_id", "materials"), UniqueConstraint("company_id", "product_id", "material_id"), CheckConstraint("quantity > 0"))
    product_id: Mapped[UUID] = mapped_column(index=True)
    material_id: Mapped[UUID] = mapped_column(index=True)
    quantity: Mapped[Decimal] = mapped_column(ScaledDecimal(6))
    unit_code: Mapped[str] = mapped_column(ForeignKey("units_of_measure.code", ondelete="RESTRICT"))
    product: Mapped[Product] = relationship(back_populates="materials")
