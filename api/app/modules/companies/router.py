from fastapi import APIRouter, Request

from app.core.dependencies import AdminAuth, CurrentAuth, Database
from app.modules.companies import service
from app.modules.companies.schemas import CompanyRead, CompanyRegistration, CompanyUpdate

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.post("", response_model=CompanyRead, status_code=201)
def register(data: CompanyRegistration, request: Request, db: Database):
    return service.register(db, data, request.state.request_id)


@router.get("/me", response_model=CompanyRead)
def read_company(auth: CurrentAuth):
    return auth.user.company


@router.patch("/me", response_model=CompanyRead)
def update_company(data: CompanyUpdate, request: Request, db: Database, auth: AdminAuth):
    return service.update_company(db, auth, data, request.state.request_id)
