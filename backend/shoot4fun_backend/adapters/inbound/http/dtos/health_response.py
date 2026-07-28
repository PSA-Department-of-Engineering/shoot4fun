"""Response DTO for the health check."""

from __future__ import annotations

from pydantic import BaseModel

__all__ = ["HealthResponse"]


class HealthResponse(BaseModel):
    """Service liveness and version."""

    status: str
    version: str
