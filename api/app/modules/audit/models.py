from datetime import datetime
from uuid import UUID
from sqlalchemy import String, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, validates
from app.db.base import Base
from app.db.mixins import TenantMixin, tenant_key, tenant_fk
from app.db.types import UTCDateTime, utc_now
from app.modules.audit.redaction import redact


class AuditEvent(TenantMixin, Base):
    __tablename__ = "audit_events"
    __table_args__ = (tenant_key("audit_events"), tenant_fk("actor_user_id", "users"), Index("ix_audit_company_occurred_id", "company_id", "occurred_at", "id"))
    actor_user_id: Mapped[UUID | None] = mapped_column(index=True)
    action: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[UUID] = mapped_column(index=True)
    changes: Mapped[dict] = mapped_column(JSON, default=dict)
    request_id: Mapped[str | None] = mapped_column(String(100))
    occurred_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utc_now)

    @validates("changes")
    def redact_changes(self, key, value):
        return redact(value)
