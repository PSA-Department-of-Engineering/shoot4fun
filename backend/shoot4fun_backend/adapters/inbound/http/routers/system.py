"""System routes: health and version."""

from __future__ import annotations

from fastapi import APIRouter

from shoot4fun_backend import __version__
from shoot4fun_backend.adapters.inbound.http.dtos.health_response import HealthResponse

__all__ = ["router"]

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Report service liveness and version."""
    return HealthResponse(status="ok", version=__version__)
