from uuid import UUID
from pydantic import AwareDatetime, JsonValue
from app.schemas import Schema

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
