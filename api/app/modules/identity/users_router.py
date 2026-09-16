from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response

from app.core.dependencies import AdminAuth, CurrentAuth, Database, get_tenant_record
from app.modules.identity import users_service as service
from app.modules.identity.models import User
from app.modules.identity.schemas import UserCreate, UserUpdate, UserRead, ProfileUpdate, PasswordChange, AuthSessionRead
from app.pagination import Page, PaginationParams

router = APIRouter(prefix="/users", tags=["Users"])
Pagination = Annotated[PaginationParams, Depends()]


@router.post("", response_model=UserRead, status_code=201)
def create(data: UserCreate, request: Request, db: Database, auth: AdminAuth):
    return service.create_user(db, auth, data, request.state.request_id)


@router.get("", response_model=Page[UserRead])
def list_users(db: Database, auth: AdminAuth, params: Pagination,
               search: Annotated[str | None, Query(max_length=255)] = None, active: bool | None = None):
    return service.list_users(db, auth, params, search, active)


@router.get("/me", response_model=UserRead)
def profile(auth: CurrentAuth):
    return auth.user


@router.patch("/me", response_model=UserRead)
def edit_profile(data: ProfileUpdate, request: Request, db: Database, auth: CurrentAuth):
    return service.edit_user(db, auth, auth.user.id, data, request.state.request_id)


@router.post("/me/password", status_code=204)
def password(data: PasswordChange, request: Request, db: Database, auth: CurrentAuth):
    service.change_password(db, auth, data, request.state.request_id)
    return Response(status_code=204)


@router.get("/me/sessions", response_model=Page[AuthSessionRead])
def sessions(db: Database, auth: CurrentAuth, params: Pagination):
    return service.list_sessions(db, auth, params)


@router.delete("/me/sessions/{session_id}", status_code=204)
def revoke(session_id: UUID, request: Request, db: Database, auth: CurrentAuth):
    service.revoke_session(db, auth, session_id, request.state.request_id)
    return Response(status_code=204)


@router.get("/{user_id}", response_model=UserRead)
def read(user_id: UUID, db: Database, auth: AdminAuth):
    return get_tenant_record(db, User, user_id, auth)


@router.patch("/{user_id}", response_model=UserRead)
def edit(user_id: UUID, data: UserUpdate, request: Request, db: Database, auth: AdminAuth):
    return service.edit_user(db, auth, user_id, data, request.state.request_id)
