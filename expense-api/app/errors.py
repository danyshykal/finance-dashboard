"""Every error leaves the API in one shape:

    {"error": {"code": "...", "message": "...", "details": [...]}}
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

STATUS_CODES = {
    400: "bad_request",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
}


def error_response(status: int, message: str, details: list | None = None) -> JSONResponse:
    body = {"code": STATUS_CODES.get(status, "error"), "message": message}
    if details:
        body["details"] = details
    return JSONResponse(status_code=status, content={"error": body})


def _format_validation_error(err: dict) -> dict:
    # loc looks like ("body", "amount") or ("query", "limit"); a model-level
    # validator has no field name, so it reports just the source.
    field = ".".join(str(part) for part in err["loc"])
    message = err["msg"].removeprefix("Value error, ")
    return {"field": field, "message": message}


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return error_response(exc.status_code, str(exc.detail))


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = [_format_validation_error(err) for err in exc.errors()]
    return error_response(422, "Request validation failed", details)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return error_response(500, "Internal server error")


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
