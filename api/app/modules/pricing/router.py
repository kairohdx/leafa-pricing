from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.core.dependencies import CurrentAuth, AdminAuth, Database, get_tenant_record
from app.modules.pricing import service
from app.modules.pricing.models import PricingRule
from app.modules.pricing.schemas import PricingRuleCreate, PricingRuleUpdate, PricingRuleRead
from app.pagination import Page, PaginationParams

router = APIRouter(prefix="/pricing-rules", tags=["Pricing rules"])
Pagination = Annotated[PaginationParams, Depends()]


@router.get("", response_model=Page[PricingRuleRead])
def list_rules(db: Database, auth: CurrentAuth, params: Pagination,
               search: Annotated[str | None, Query(max_length=180)] = None, archived: bool = False):
    return service.list_rules(db, auth, params, search, archived)


@router.post("", response_model=PricingRuleRead, status_code=201)
def create(data: PricingRuleCreate, request: Request, db: Database, auth: AdminAuth):
    return service.create(db, auth, data, request.state.request_id)


@router.get("/{rule_id}", response_model=PricingRuleRead)
def read(rule_id: UUID, db: Database, auth: CurrentAuth):
    return get_tenant_record(db, PricingRule, rule_id, auth)


@router.patch("/{rule_id}", response_model=PricingRuleRead)
def edit(rule_id: UUID, data: PricingRuleUpdate, request: Request, db: Database, auth: AdminAuth):
    return service.edit(db, auth, rule_id, data, request.state.request_id)


@router.post("/{rule_id}/archive", response_model=PricingRuleRead)
def archive(rule_id: UUID, request: Request, db: Database, auth: AdminAuth):
    return service.archive(db, auth, rule_id, True, request.state.request_id)


@router.post("/{rule_id}/restore", response_model=PricingRuleRead)
def restore(rule_id: UUID, request: Request, db: Database, auth: AdminAuth):
    return service.archive(db, auth, rule_id, False, request.state.request_id)
