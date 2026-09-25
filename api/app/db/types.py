from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator
from sqlalchemy import BigInteger
from decimal import Decimal


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ScaledDecimal(TypeDecorator[Decimal]):
    """Exact decimal stored as a signed 64-bit integer; never rounds input."""

    impl = BigInteger
    cache_ok = True

    def __init__(self, scale: int = 6):
        super().__init__()
        self.scale = scale

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, (float, bool)):
            raise ValueError("Use Decimal, integer or decimal string.")
        number = Decimal(value)
        if not number.is_finite():
            raise ValueError("Decimal must be finite.")
        numerator, denominator = number.as_integer_ratio()
        scaled, remainder = divmod(numerator * 10 ** self.scale, denominator)
        if remainder or abs(scaled) > 2**63 - 1:
            raise ValueError("Decimal exceeds storage precision or range.")
        return scaled

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return Decimal(f"{value}e-{self.scale}")


class UTCDateTime(TypeDecorator[datetime]):
    """Accept aware datetimes and return UTC; SQLite stores naive UTC."""

    impl = DateTime
    cache_ok = True

    def load_dialect_impl(self, dialect: Dialect):
        return dialect.type_descriptor(
            DateTime(timezone=dialect.name != "sqlite")
        )

    def process_bind_param(self, value: datetime | None, dialect: Dialect):
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Datetime must include timezone information.")
        value = value.astimezone(timezone.utc)
        return value.replace(tzinfo=None) if dialect.name == "sqlite" else value

    def process_result_value(self, value: datetime | None, dialect: Dialect):
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            if dialect.name != "sqlite":
                raise ValueError("Database returned a datetime without timezone information.")
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
