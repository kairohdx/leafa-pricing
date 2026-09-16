from datetime import datetime, timedelta, timezone, time
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import Date, String, cast, func, select

from app.modules.analytics.schemas import DashboardSummary, SalesSeries, SalesSeriesPoint
from app.modules.sales.models import Sale, SaleStatus


class ExactSum:
    """SQLite aggregate: arbitrary-size integer cents, no float/64-bit overflow."""
    def __init__(self):
        self.total = None

    def step(self, value):
        if value is not None:
            self.total = (self.total or 0) + value

    def finalize(self):
        return str(self.total) if self.total is not None else None


def local_day(value, zone):
    if value is None:
        return None
    instant = datetime.fromisoformat(value)
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    return instant.astimezone(ZoneInfo(zone)).date().isoformat()


def aggregate_functions(db):
    if db.bind.dialect.name == "sqlite":
        connection = db.connection().connection.driver_connection
        connection.create_aggregate("leafa_sum_cents", 1, ExactSum)
        connection.create_function("leafa_local_day", 2, local_day, deterministic=True)
        return lambda column: cast(func.leafa_sum_cents(column), String)
    return lambda column: cast(func.sum(column), String)


def amount(cents):
    return Decimal(f"{cents or 0}e-2")


def filters(auth, period, currency):
    return (Sale.company_id == auth.company_id, Sale.status == SaleStatus.COMPLETED,
            Sale.currency == currency, Sale.occurred_at >= period.start, Sale.occurred_at < period.end)


def summary(db, auth, period, currency):
    total = aggregate_functions(db)
    count, revenue, cost, coverage = db.execute(select(func.count(Sale.id), total(Sale.final_total),
        total(Sale.cost_total), func.count(Sale.cost_total)).where(*filters(auth, period, currency))).one()
    return DashboardSummary(period=period, currency=currency, sales_count=count, final_total=amount(revenue),
                            cost_total=amount(cost) if coverage else None, cost_coverage=coverage)


def series(db, auth, period, currency):
    total = aggregate_functions(db)
    zone_name = auth.user.company.timezone
    zone = ZoneInfo(zone_name)
    if db.bind.dialect.name == "sqlite":
        day = func.leafa_local_day(Sale.occurred_at, zone_name)
    else:
        day = cast(cast(func.timezone(zone_name, Sale.occurred_at), Date), String)
    rows = db.execute(select(day, func.count(Sale.id), total(Sale.final_total)).where(
        *filters(auth, period, currency)).group_by(day)).all()
    by_day = {str(date): (count, revenue) for date, count, revenue in rows}
    current = period.start.astimezone(zone).date()
    final = (period.end.astimezone(timezone.utc) - timedelta(microseconds=1)).astimezone(zone).date()
    points = []
    while current <= final:
        count, revenue = by_day.get(current.isoformat(), (0, None))
        # Normalize historical zones whose daylight-saving change skipped midnight.
        midnight = datetime.combine(current, time.min, tzinfo=zone).astimezone(timezone.utc).astimezone(zone)
        points.append(SalesSeriesPoint(start=midnight, sales_count=count, final_total=amount(revenue)))
        current += timedelta(days=1)
    return SalesSeries(period=period, currency=currency, timezone=zone_name, points=points)
