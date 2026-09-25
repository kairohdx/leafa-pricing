from uuid import UUID
from sqlalchemy import String, Integer, BigInteger, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class UnitDimension(TimestampMixin, Base):
    __tablename__ = "unit_dimensions"
    __table_args__ = (CheckConstraint("storage_scale >= 0 AND storage_scale <= 6"),)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    storage_scale: Mapped[int] = mapped_column(Integer, default=6)

class UnitOfMeasure(TimestampMixin, Base):
    __tablename__ = "units_of_measure"
    __table_args__ = (CheckConstraint("factor_numerator > 0"), CheckConstraint("factor_denominator > 0"))
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    symbol: Mapped[str] = mapped_column(String(20))
    dimension_id: Mapped[UUID] = mapped_column(ForeignKey("unit_dimensions.id", ondelete="RESTRICT"), index=True)
    factor_numerator: Mapped[int] = mapped_column(BigInteger, default=1)
    factor_denominator: Mapped[int] = mapped_column(BigInteger, default=1)
    dimension: Mapped[UnitDimension] = relationship()
