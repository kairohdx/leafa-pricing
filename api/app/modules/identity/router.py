from fastapi import APIRouter, Request, Response

from app.core.dependencies import CurrentAuth, Database
from app.modules.identity import service
from app.modules.identity.schemas import LoginRequest, TokenResponse, UserRead

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, response: Response, db: Database):
    response.headers["Cache-Control"] = "no-store"
    return service.login(db, data, request.app.state.settings)


@router.get("/me", response_model=UserRead)
def me(auth: CurrentAuth, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return auth.user


@router.post("/logout", status_code=204)
def logout(auth: CurrentAuth, db: Database):
    service.logout(db, auth)
    return Response(status_code=204)
