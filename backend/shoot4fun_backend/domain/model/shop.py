"""The shop domain: the authored catalog, rarity, and ownership records.

The catalog is a static file committed to the repo (CAT-001, ADR-0008); the
loader validates it at load time and a violation refuses startup, so bad
content fails the suite, never the player's screen. Ownership and equipment
are conventions inside the Arsenal envelope's opaque `data` object
(ADR-0007): an entry in `data.inventory` IS ownership, and
`data.loadout.cosmetic` is the equipped item id.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

__all__ = [
    "RARITY_TIERS",
    "CatalogItem",
    "Catalog",
    "load_catalog",
    "owns_item",
    "inventory_entry_ids",
    "append_ownership",
    "equipped_cosmetic",
    "set_equipped_cosmetic",
]

# The five tiers of the locked brand legend (docs/brand.md). Closed on
# purpose: an unknown tier in the authored file is a load failure, not a
# rendered fallback.
RARITY_TIERS = ("common", "uncommon", "rare", "epic", "legendary")

_REQUIRED_FIELDS = ("id", "name", "description", "rarity", "preview", "skin")


@dataclass(frozen=True, slots=True)
class CatalogItem:
    """One cosmetic as authored. `preview` and `skin` are token-backed
    specs: they name brand tokens, never raw colours."""

    id: str
    name: str
    description: str
    rarity: str
    preview: dict[str, Any]
    skin: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "rarity": self.rarity,
            "preview": self.preview,
            "skin": self.skin,
        }


class Catalog:
    """The validated catalog: every item checked at load."""

    def __init__(self, items: list[CatalogItem]) -> None:
        self._items = items
        self._by_id = {item.id: item for item in items}

    def all(self) -> list[CatalogItem]:
        return list(self._items)

    def get(self, item_id: str) -> CatalogItem | None:
        return self._by_id.get(item_id)


def validate_catalog(raw: object) -> list[CatalogItem]:
    """Validate the authored catalog, refusing the build on any violation."""
    if not isinstance(raw, dict) or not isinstance(raw.get("items"), list):
        raise ValueError("catalog must be an object with an items array")
    seen: set[str] = set()
    items: list[CatalogItem] = []
    for index, entry in enumerate(raw["items"]):
        where = f"catalog item #{index}"
        if not isinstance(entry, dict):
            raise ValueError(f"{where} must be an object")
        for field in _REQUIRED_FIELDS:
            value = entry.get(field)
            if field == "rarity":
                if value not in RARITY_TIERS:
                    raise ValueError(
                        f"{where}: rarity must be one of {RARITY_TIERS}, "
                        f"got {value!r}"
                    )
            elif field in ("preview", "skin"):
                if not isinstance(value, dict):
                    raise ValueError(f"{where}: {field} must be an object")
            elif not isinstance(value, str) or not value.strip():
                raise ValueError(f"{where}: {field} must be a non-empty string")
        item_id = entry["id"]
        if item_id in seen:
            raise ValueError(f"{where}: duplicate item id {item_id!r}")
        seen.add(item_id)
        items.append(
            CatalogItem(
                id=item_id,
                name=entry["name"],
                description=entry["description"],
                rarity=entry["rarity"],
                preview=dict(entry["preview"]),
                skin=dict(entry["skin"]),
            )
        )
    if not items:
        raise ValueError("catalog must carry at least one item")
    return items


def load_catalog(path: Path) -> Catalog:
    """Read and validate the authored catalog. Any violation raises, which
    refuses startup (INT-032)."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    return Catalog(validate_catalog(raw))


# ---- ownership and equipment over the envelope's data payload -------------
#
# These helpers never mutate in place: each returns the new collection, so a
# caller reads the stored envelope through ArsenalEnvelope.parse, applies the
# helper, and stores the result - keeping unknown keys inside `data`
# byte-for-byte (INT-038).


def owns_item(inventory: Any, item_id: str) -> bool:
    """Whether the inventory already carries the item. Legacy plain-string
    entries match by their string value and never crash the scan."""
    if not isinstance(inventory, list):
        return False
    for entry in inventory:
        if isinstance(entry, dict) and entry.get("id") == item_id:
            return True
        if isinstance(entry, str) and entry == item_id:
            return True
    return False


def inventory_entry_ids(inventory: Any) -> list[str]:
    """Every id the inventory names, structured entries and legacy strings
    alike, so the client can join catalog metadata without crashing."""
    if not isinstance(inventory, list):
        return []
    ids: list[str] = []
    for entry in inventory:
        if isinstance(entry, dict):
            entry_id = entry.get("id")
            if isinstance(entry_id, str):
                ids.append(entry_id)
        elif isinstance(entry, str):
            ids.append(entry)
    return ids


def append_ownership(
    inventory: Any, item_id: str, acquired_at: str
) -> list[dict[str, str]]:
    """A new inventory list carrying the ownership record appended."""
    base = list(inventory) if isinstance(inventory, list) else []
    return [*base, {"id": item_id, "acquired_at": acquired_at}]


def equipped_cosmetic(data: dict[str, Any]) -> str | None:
    """The equipped cosmetic's item id, or None. `loadout` lives inside
    `data`, never beside it (ADR-0008)."""
    loadout = data.get("loadout")
    if not isinstance(loadout, dict):
        return None
    cosmetic = loadout.get("cosmetic")
    return cosmetic if isinstance(cosmetic, str) else None


def set_equipped_cosmetic(data: dict[str, Any], item_id: str) -> dict[str, Any]:
    """A new data payload with `loadout.cosmetic` set, unknown keys kept."""
    loadout = dict(data.get("loadout")) if isinstance(data.get("loadout"), dict) else {}
    loadout["cosmetic"] = item_id
    return {**data, "loadout": loadout}
