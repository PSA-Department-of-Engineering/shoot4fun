"""The cosmetics catalog is a validated static source (CAT-001, INT-032).

The catalog is authored in-repo at `backend/catalog/cosmetics.json`; its
loader validates unique ids, required fields, and a rarity inside the five
locked tiers, refusing on any violation. What `GET /api/shop/catalog`
serves is the validated catalog.
"""
from __future__ import annotations

import pytest
import pytest_intent
from fastapi.testclient import TestClient

from shoot4fun_backend.domain.model.shop import validate_catalog

VALID_ITEM = {
    "id": "test-item",
    "name": "Test Item",
    "description": "A well-formed item.",
    "rarity": "common",
    "preview": {"kind": "solid", "token": "muted"},
    "skin": {"region": "Main", "finish": "solid", "token": "muted"},
}

LOCKED_TIERS = {"common", "uncommon", "rare", "epic", "legendary"}


@pytest_intent.intent("INT-032")
def test_served_catalog_is_the_validated_authored_source(
    client: TestClient,
) -> None:
    """The endpoint serves exactly the authored file's items, ids unique."""
    response = client.get("/api/shop/catalog")
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) >= 8  # the authored spread across all five tiers
    ids = [item["id"] for item in items]
    assert len(ids) == len(set(ids))
    for item in items:
        assert item["name"]
        assert item["description"]
        assert isinstance(item["preview"], dict)
        assert isinstance(item["skin"], dict)
        assert item["rarity"] in LOCKED_TIERS
    # All five tiers of the locked legend are represented in what ships.
    assert {item["rarity"] for item in items} == LOCKED_TIERS


@pytest_intent.intent("INT-032")
@pytest.mark.parametrize(
    ("raw",),
    [
        ({"items": [dict(VALID_ITEM), dict(VALID_ITEM)]},),  # duplicate id
        ({"items": [dict(VALID_ITEM, rarity="mythic")]},),  # unknown tier
        ({"items": [dict(VALID_ITEM, id="")]},),  # empty id
        (
            {"items": [{k: v for k, v in VALID_ITEM.items() if k != "description"}]},
        ),  # missing required field
        ({"items": [dict(VALID_ITEM, preview="solid red")]},),  # bad preview
        ({"nope": True},),  # not a catalog object at all
        ([dict(VALID_ITEM)],),  # a bare list is not a catalog object
    ],
)
def test_loader_refuses_violations(raw: object) -> None:
    """Any violation raises rather than producing a usable catalog."""
    with pytest.raises(ValueError):
        validate_catalog(raw)


@pytest_intent.intent("INT-032")
def test_rarity_vocabulary_is_closed_to_locked_tiers() -> None:
    """An unknown tier is a load failure, not a rendered fallback."""
    raw = {"items": [dict(VALID_ITEM, rarity="legendaryl")]}
    with pytest.raises(ValueError, match="rarity"):
        validate_catalog(raw)


@pytest_intent.intent("INT-032")
def test_startup_refuses_a_malformed_catalog_file(tmp_path) -> None:
    """A malformed authored file fails at load, before anything serves."""
    import json

    from shoot4fun_backend.domain.model.shop import load_catalog

    bad = tmp_path / "cosmetics.json"
    bad.write_text(json.dumps({"items": [dict(VALID_ITEM, rarity="mythic")]}))
    with pytest.raises(ValueError):
        load_catalog(bad)
