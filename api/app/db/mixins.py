from datetime import datetime
from uuid import UUID
from sqlalchemy import ForeignKey, ForeignKeyConstraint, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.types import UTCDateTime

class TenantMixin:
    company_id: Mapped[UUID] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), index=True)

class ArchiveMixin:
    archived_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

def tenant_key(table):
    return UniqueConstraint("company_id", "id", name=f"uq_{table}_company_id")

def tenant_fk(column, target):
    return ForeignKeyConstraint(["company_id", column], [f"{target}.company_id", f"{target}.id"], ondelete="RESTRICT")
