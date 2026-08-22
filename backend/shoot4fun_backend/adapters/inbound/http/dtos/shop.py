"""Request DTOs for the shop surface."""
from __future__ import annotations

from pydantic import BaseModel, Field

__all__ = ["AcquireRequest", "EquipRequest"]


class AcquireRequest(BaseModel):
    item_id: str = Field(..., min_length=1)


class EquipRequest(BaseModel):
    item_id: str = Field(..., min_length=1)
