"""The profile HTTP API (issue #12).

Three endpoints:

* `POST /api/users` - adopt a username and create its profile (409 if
  the username is already taken).
* `GET /api/users/{username}` - read a profile (404 if unknown).
* `PATCH /api/users/{username}` - patch profile fields, all optional
  (404 if unknown).

Everything goes through the `ProfileService` (the application service),
which is the only inbound port. There is deliberately no authentication
here: the username is an adopted handle until the login work (a separate
issue) lands, and guests never touch these endpoints.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from shoot4fun_backend.application.services.profile_service import ProfileService

if TYPE_CHECKING:
    from shoot4fun_backend.container import Container

USERNAME_MAX_LENGTH = 32
DISPLAY_NAME_MAX_LENGTH = 32
SENSITIVITY_MIN = 0.0005
SENSITIVITY_MAX = 0.005


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=USERNAME_MAX_LENGTH)
    display_name: str | None = Field(None, min_length=1, max_length=DISPLAY_NAME_MAX_LENGTH)
    sensitivity: float | None = Field(None, ge=SENSITIVITY_MIN, le=SENSITIVITY_MAX)
    master_volume: float | None = Field(None, ge=0, le=1)
    sfx_volume: float | None = Field(None, ge=0, le=1)


class ProfilePatch(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=DISPLAY_NAME_MAX_LENGTH)
    sensitivity: float | None = Field(None, ge=SENSITIVITY_MIN, le=SENSITIVITY_MAX)
    master_volume: float | None = Field(None, ge=0, le=1)
    sfx_volume: float | None = Field(None, ge=0, le=1)


def _profile_to_dict(profile: object) -> dict:
    return {
        "id": profile.id,  # type: ignore[attr-defined]
        "username": profile.username,  # type: ignore[attr-defined]
        "display_name": profile.display_name,  # type: ignore[attr-defined]
        "sensitivity": profile.sensitivity,  # type: ignore[attr-defined]
        "master_volume": profile.master_volume,  # type: ignore[attr-defined]
        "sfx_volume": profile.sfx_volume,  # type: ignore[attr-defined]
        "created_at": profile.created_at,  # type: ignore[attr-defined]
    }


def build_router(container: Container) -> APIRouter:
    router = APIRouter()

    def service() -> ProfileService:
        return container.profile_service()

    @router.post("/users", status_code=201)
    async def create_user(body: UserCreate) -> dict:
        return _profile_to_dict(
            await service().create_profile(
                body.username.strip(),
                display_name=body.display_name,
                sensitivity=body.sensitivity,
                master_volume=body.master_volume,
                sfx_volume=body.sfx_volume,
            )
        )

    @router.get("/users/{username}")
    async def get_user(username: str) -> dict:
        profile = await service().get_profile(username)
        if profile is None:
            raise HTTPException(status_code=404, detail="no profile for username")
        return _profile_to_dict(profile)

    @router.patch("/users/{username}")
    async def patch_user(username: str, body: ProfilePatch) -> dict:
        profile = await service().update_profile(
            username,
            display_name=body.display_name,
            sensitivity=body.sensitivity,
            master_volume=body.master_volume,
            sfx_volume=body.sfx_volume,
        )
        if profile is None:
            raise HTTPException(status_code=404, detail="no profile for username")
        return _profile_to_dict(profile)

    return router
