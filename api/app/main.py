from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings, get_settings
from app.core.errors import register_errors
from app.db import models  # noqa: F401 -- register all ORM mappings
from app.db.session import build_engine
from app.modules.identity.router import router as auth_router
from app.modules.companies.router import router as companies_router
from app.modules.identity.users_router import router as users_router
from app.modules.units.router import router as units_router
from app.modules.materials.router import router as materials_router
from app.modules.services.router import router as services_router
from app.modules.products.router import router as products_router
from app.modules.pricing.router import router as pricing_router
from app.modules.sales.router import router as sales_router
from app.modules.audit.router import router as audit_router
from app.modules.analytics.router import router as analytics_router


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app):
        app.state.engine = build_engine(settings.database_url)
        try:
            yield
        finally:
            app.state.engine.dispose()

    app = FastAPI(title="Leafa Pricing API", lifespan=lifespan)
    app.state.settings = settings
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                       allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                       allow_headers=["Authorization", "Content-Type"], expose_headers=["X-Request-ID"])

    @app.middleware("http")
    async def request_id(request, call_next):
        request.state.request_id = str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    register_errors(app)
    app.include_router(auth_router)
    app.include_router(companies_router)
    app.include_router(users_router)
    app.include_router(units_router)
    app.include_router(materials_router)
    app.include_router(services_router)
    app.include_router(products_router)
    app.include_router(pricing_router)
    app.include_router(sales_router)
    app.include_router(audit_router)
    app.include_router(analytics_router)

    @app.get("/health", tags=["Health"])
    def health():
        try:
            with app.state.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError:
            raise HTTPException(503, "Database unavailable.") from None
        return {"status": "ok"}

    return app


app = create_app()
