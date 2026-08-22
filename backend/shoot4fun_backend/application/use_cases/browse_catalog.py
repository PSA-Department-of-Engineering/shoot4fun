"""Browse the cosmetics catalog (SHOP-001).

A read over the validated static catalog: no session, no state, no mutation.
"""
from __future__ import annotations

from shoot4fun_backend.domain.model.shop import Catalog

__all__ = ["BrowseCatalog"]


class BrowseCatalog:
    def __init__(self, catalog: Catalog) -> None:
        self._catalog = catalog

    async def execute(self) -> list[dict]:
        return [item.to_dict() for item in self._catalog.all()]
