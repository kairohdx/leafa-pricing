import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException


def error_response(request, status, code, message, field_errors=None, headers=None):
    return JSONResponse(
        status_code=status,
        content={"code": code, "message": message, "field_errors": field_errors,
                 "request_id": getattr(request.state, "request_id", None)},
        headers=headers,
    )


def register_errors(app: FastAPI):
    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        codes = {401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict", 503: "unavailable"}
        return error_response(request, exc.status_code, codes.get(exc.status_code, "http_error"), str(exc.detail), headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        # Do not echo input, passwords, tokens or validator context.
        fields = [{"field": ".".join(map(str, e["loc"])), "code": e["type"]} for e in exc.errors()]
        return error_response(request, 422, "validation_error", "Invalid request data.", fields)

    @app.exception_handler(IntegrityError)
    async def conflict(request: Request, exc: IntegrityError):
        return error_response(request, 409, "conflict", "Operation conflicts with existing data.")

    @app.exception_handler(Exception)
    async def unexpected(request: Request, exc: Exception):
        logging.getLogger("app.errors").error("Unhandled %s request_id=%s", type(exc).__name__, getattr(request.state, "request_id", None))
        return error_response(request, 500, "internal_error", "Internal server error.")
