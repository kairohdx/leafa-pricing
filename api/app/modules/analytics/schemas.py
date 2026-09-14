from typing import Annotated
from pydantic import Field, AwareDatetime, model_validator
from app.schemas import Schema, Money, Currency

class AnalyticsPeriod(Schema):
    start: AwareDatetime
    end: AwareDatetime

    @model_validator(mode="after")
    def ordered_period(self):
        if self.end <= self.start:
            raise ValueError("end must be after start (exclusive upper bound).")
        return self

class DashboardSummary(Schema):
    period: AnalyticsPeriod
    currency: Currency
    sales_count: Annotated[int, Field(ge=0)]
    final_total: Money
    cost_total: Money | None = None
    cost_coverage: Annotated[int, Field(ge=0)] = 0

class SalesSeriesPoint(Schema):
    start: AwareDatetime
    sales_count: Annotated[int, Field(ge=0)]
    final_total: Money

class SalesSeries(Schema):
    period: AnalyticsPeriod
    currency: Currency
    timezone: str
    points: list[SalesSeriesPoint] = Field(default_factory=list)
