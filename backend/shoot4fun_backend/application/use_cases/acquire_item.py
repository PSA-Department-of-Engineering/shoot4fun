"""Acquire a catalog item (ACQ-001..003).

A free unlock: there is no price to check, monetization is out of scope this
phase. The write lands in the caller's Arsenal envelope - an entry appended
to `data.inventory` IS the ownership record - through the existing account
repository, so no second store exists. Evaluation order is part of the
contract: ownership is checked BEFORE any mutation, so a re-acquire leaves
both records and loadout untouched and the first acquisition's auto-equip
fires at most once per item.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from shoot4fun_backend.application.ports.outbound.account_repository import (
    AccountRepository,
)
from shoot4fun_backend.domain.exceptions.entity_not_found_error import (
    EntityNotFoundError,
)
from shoot4fun_backend.domain.model.arsenal import ArsenalEnvelope
from shoot4fun_backend.domain.model.shop import (
    Catalog,
    append_ownership,
    equipped_cosmetic,
    owns_item,
    set_equipped_cosmetic,
)

__all__ = ["AcquireItem", "AcquireResult"]

DEFAULT_DATA = {"model": "robot", "inventory": []}


@dataclass(frozen=True, slots=True)
class AcquireResult:
    item_id: str
    already_owned: bool
    equipped: str | None


class AcquireItem:
    def __init__(self, accounts: AccountRepository, catalog: Catalog) -> None:
        self._accounts = accounts
        self._catalog = catalog

    async def execute(self, user_id: str, item_id: str) -> AcquireResult:
        if self._catalog.get(item_id) is None:
            raise EntityNotFoundError("catalog item", item_id)

        stored = await self._accounts.get_arsenal(user_id)
        envelope = (
            ArsenalEnvelope.parse(stored)
            if stored is not None
            else ArsenalEnvelope(version=1, data=dict(DEFAULT_DATA))
        )

        # The idempotence gate runs before anything mutates.
        if owns_item(envelope.data.get("inventory"), item_id):
            return AcquireResult(
                item_id=item_id,
                already_owned=True,
                equipped=equipped_cosmetic(envelope.data),
            )

        acquired_at = datetime.now(UTC).isoformat()
        data = {
            **envelope.data,
            "inventory": append_ownership(
                envelope.data.get("inventory"), item_id, acquired_at
            ),
        }
        # First acquisition auto-equips (the design's unlock-and-apply).
        data = set_equipped_cosmetic(data, item_id)
        await self._accounts.save_arsenal(
            user_id, dict(envelope.to_dict(), data=data)
        )
        return AcquireResult(
            item_id=item_id, already_owned=False, equipped=item_id
        )
