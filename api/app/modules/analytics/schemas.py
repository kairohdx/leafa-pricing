from typing import Annotated
from datetime import timedelta
from decimal import Decimal
from pydantic import Field, AwareDatetime, model_validator
from app.schemas import Schema, Money, Currency

AggregateMoney = Annotated[Decimal, Field(ge=0, decimal_places=2, allow_inf_nan=False)]

class AnalyticsPeriod(Schema):
    start: AwareDatetime
    end: AwareDatetime

    @model_validator(mode="after")
    def ordered_period(self):
        if self.end <= self.start:
            raise ValueError("end must be after start (exclusive upper bound).")
        if self.end - self.start > timedelta(days=366):
            raise ValueError("Period must not exceed 366 days.")
        return self

class DashboardSummary(Schema):
    period: AnalyticsPeriod
    currency: Currency
    sales_count: Annotated[int, Field(ge=0)]
    final_total: AggregateMoney
    cost_total: AggregateMoney | None = None
    cost_coverage: Annotated[int, Field(ge=0)] = 0

class SalesSeriesPoint(Schema):
    start: AwareDatetime
    sales_count: Annotated[int, Field(ge=0)]
    final_total: AggregateMoney

class SalesSeries(Schema):
    period: AnalyticsPeriod
    currency: Currency
    timezone: str
    points: list[SalesSeriesPoint] = Field(default_factory=list)
