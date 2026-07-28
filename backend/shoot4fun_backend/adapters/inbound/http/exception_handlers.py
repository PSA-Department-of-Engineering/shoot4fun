"""Register global exception handlers on the FastAPI app."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from shoot4fun_backend.adapters.inbound.http.mappers.exception_mapper import (
    DEFAULT_STATUS,
    STATUS_MAP,
)
from shoot4fun_backend.domain.exceptions.app_error import AppError

__all__ = ["register_exception_handler"]


def register_exception_handler(app: FastAPI) -> None:
    """Install a single handler mapping domain errors to HTTP responses."""

    @app.exception_handler(AppError)
    async def _handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        status = STATUS_MAP.get(type(exc), DEFAULT_STATUS)
        return JSONResponse(
            status_code=status,
            content={"error": type(exc).__name__, "detail": str(exc)},
        )
