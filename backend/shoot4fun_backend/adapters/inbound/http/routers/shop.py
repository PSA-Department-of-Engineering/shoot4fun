"""The shop HTTP surface.

`GET /api/shop/catalog` is a public read over the validated static catalog.
Both writes present the session in `X-S4F-Session` (or a bearer token) and
resolve the caller through the one choke point in `AccountService` - the
shop opens no second authentication path (ADR-0008, INT-037). Acquisition
is a free unlock: there is no price check to fail, and monetization is out
of scope this phase.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, HTTPException, Request

from shoot4fun_backend.adapters.inbound.http.dtos.shop import (
    AcquireRequest,
    EquipRequest,
)
from shoot4fun_backend.application.use_cases.acquire_item import AcquireItem
from shoot4fun_backend.application.use_cases.browse_catalog import BrowseCatalog
from shoot4fun_backend.application.use_cases.equip_cosmetic import (
    EquipCosmetic,
    NotOwnedError,
)
from shoot4fun_backend.domain.exceptions.entity_not_found_error import (
    EntityNotFoundError,
)

if TYPE_CHECKING:
    from shoot4fun_backend.container import Container

__all__ = ["build_router"]


def build_router(container: Container) -> APIRouter:
    router = APIRouter()

    async def _require_user(request: Request) -> str:
        service = container.account_service()
        from shoot4fun_backend.adapters.inbound.http.routers.accounts import (
            session_token_of,
        )

        user_id = await service.resolve_session(session_token_of(request))
        if user_id is None:
            raise HTTPException(status_code=401, detail="not signed in")
        return user_id

    @router.get("/shop/catalog")
    async def catalog() -> dict:
        items = await BrowseCatalog(container.catalog()).execute()
        return {"items": items}

    @router.post("/shop/acquire")
    async def acquire(request: Request, body: AcquireRequest) -> dict:
        """Free-unlock one catalog item into the caller's Arsenal envelope,
        auto-equipping on first acquisition. 401 before any state change
        without a session; idempotent on an already-owned item."""
        user_id = await _require_user(request)
        use_case: AcquireItem = container.acquire_item()
        try:
            result = await use_case.execute(user_id, body.item_id)
        except EntityNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return {
            "item_id": result.item_id,
            "already_owned": result.already_owned,
            "equipped": result.equipped,
        }

    @router.post("/shop/equip")
    async def equip(request: Request, body: EquipRequest) -> dict:
        """Set the equipped cosmetic. Only an owned item equips."""
        user_id = await _require_user(request)
        use_case: EquipCosmetic = container.equip_cosmetic()
        try:
            item_id = await use_case.execute(user_id, body.item_id)
        except EntityNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except NotOwnedError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        return {"item_id": item_id}

    return router
