from uuid import UUID
from pydantic import AwareDatetime, JsonValue, field_validator
from app.schemas import Schema
from app.modules.audit.redaction import redact

class AuditEventRead(Schema):
    id: UUID
    company_id: UUID
    actor_user_id: UUID | None
    action: str
    entity_type: str
    entity_id: UUID
    changes: dict[str, JsonValue]
    request_id: str | None
    occurred_at: AwareDatetime

    @field_validator("changes", mode="before")
    @classmethod
    def redact_changes(cls, value):
        return redact(value)
