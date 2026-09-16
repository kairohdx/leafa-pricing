from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import AwareDatetime, ValidationError

from app.core.dependencies import CurrentAuth, Database
from app.modules.analytics import queries
from app.modules.analytics.schemas import AnalyticsPeriod, DashboardSummary, SalesSeries
from app.schemas import Currency

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def period_params(start: AwareDatetime, end: AwareDatetime):
    try:
        return AnalyticsPeriod(start=start, end=end)
    except ValidationError:
        raise HTTPException(422, "Period must be ordered and no longer than 366 days.") from None


Period = Annotated[AnalyticsPeriod, Depends(period_params)]


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Database, auth: CurrentAuth, period: Period, currency: Currency | None = None):
    return queries.summary(db, auth, period, currency or auth.user.company.currency)


@router.get("/sales-series", response_model=SalesSeries)
def series(db: Database, auth: CurrentAuth, period: Period, currency: Currency | None = None):
    return queries.series(db, auth, period, currency or auth.user.company.currency)
