"""Register global exception handlers on the FastAPI app."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from shoot4fun_backend.adapters.inbound.http.mappers.exception_mapper import (
    DEFAULT_STATUS,
    STATUS_MAP,
)
from shoot4fun_backend.domain.exceptions.app_error import AppError
from shoot4fun_backend.logging import get_logger

__all__ = ["register_exception_handler"]

_log = get_logger("http_errors")


def register_exception_handler(app: FastAPI) -> None:
    """Install the domain-error handler and a safety net for the rest.

    The AppError handler maps known domain errors to their statuses. The
    Exception handler catches everything an adapter let escape (an asyncpg
    error, say): it logs the full traceback server-side and answers with a
    JSON body naming the EXCEPTION CLASS - never its message or values - so
    a failure on the far side of the edge is diagnosable from the edge
    without leaking SQL text or data. An empty-bodied 500 is how faults go
    undiagnosed for releases.
    """

    @app.exception_handler(AppError)
    async def _handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        status = STATUS_MAP.get(type(exc), DEFAULT_STATUS)
        return JSONResponse(
            status_code=status,
            content={"error": type(exc).__name__, "detail": str(exc)},
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        _log.exception(
            "unhandled error on %s %s", request.method, request.url.path
        )
        return JSONResponse(
            status_code=500,
            content={"error": type(exc).__name__, "detail": "internal error"},
        )
