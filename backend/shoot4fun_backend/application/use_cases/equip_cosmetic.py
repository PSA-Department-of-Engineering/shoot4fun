"""Equip an owned cosmetic (ACQ-003, COS-001).

Entitlement is the point: only an owned item can become the equipped
cosmetic. The write lands in the caller's Arsenal envelope as
`data.loadout.cosmetic` - inside `data`, never beside it (ADR-0008).
"""
from __future__ import annotations

from shoot4fun_backend.application.ports.outbound.account_repository import (
    AccountRepository,
)
from shoot4fun_backend.domain.exceptions.entity_not_found_error import (
    EntityNotFoundError,
)
from shoot4fun_backend.domain.model.arsenal import ArsenalEnvelope
from shoot4fun_backend.domain.model.shop import (
    Catalog,
    owns_item,
    set_equipped_cosmetic,
)

__all__ = ["EquipCosmetic"]


class NotOwnedError(Exception):
    """The caller tried to equip an item they do not own."""


class EquipCosmetic:
    def __init__(self, accounts: AccountRepository, catalog: Catalog) -> None:
        self._accounts = accounts
        self._catalog = catalog

    async def execute(self, user_id: str, item_id: str) -> str:
        if self._catalog.get(item_id) is None:
            raise EntityNotFoundError("catalog item", item_id)

        stored = await self._accounts.get_arsenal(user_id)
        envelope = (
            ArsenalEnvelope.parse(stored)
            if stored is not None
            else ArsenalEnvelope(version=1, data={"model": "robot", "inventory": []})
        )
        if not owns_item(envelope.data.get("inventory"), item_id):
            raise NotOwnedError(f"item not owned: {item_id}")

        data = set_equipped_cosmetic(envelope.data, item_id)
        await self._accounts.save_arsenal(
            user_id, dict(envelope.to_dict(), data=data)
        )
        return item_id
