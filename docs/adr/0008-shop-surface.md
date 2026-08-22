# ADR 0008: The shop surface is a static authored catalog over the Arsenal envelope (SHOP/CAT/ACQ/COS/PLAT)

- **Status:** Accepted
- **Date:** 2026-08-22
- **Decision drivers:** `SHOP-001..002`, `CAT-001`, `ACQ-001..003`, `COS-001`,
  `PLAT-001..002`; attested by `INT-030..INT-038`. Authored by the build
  before any shop code, per `.delivery/handoff.md` §3.

## Context

The delivered line ships login, profile, and an Arsenal view bound to a
forward-compatible envelope (`ADR-0007`): `{ version: 1, data: { model:
"robot", inventory: [] } }`, stored verbatim as JSONB behind
`GET`/`PUT /api/account/arsenal`. The shop line adds browsing cosmetics,
acquiring them (a free unlock — monetization is explicitly out of scope),
and applying them to the player model. It must not regress the shipped
claims (`INT-001..INT-029`), must not need a schema migration, and must not
open a second authentication path.

## Decision

### The catalog is a static authored file in the repo

`backend/catalog/cosmetics.json`, hand-authored and code-reviewed like any
other source file. No CMS, no runtime mutation, no separate database
(assumptions `CAT-001`/`DATA-001`). The loader validates at load time —
unique item ids, required fields (name, description, preview spec, skin
spec, rarity), and rarity inside the five locked tiers of the brand legend
(`docs/brand.md`) — and a violation refuses startup rather than serving a
malformed item: validation participates in execution, so bad content fails
the suite, never the player's screen (`INT-032`).

### Two endpoints, both session-gated through the existing choke point

| Route | Purpose |
| --- | --- |
| `GET /api/shop/catalog` | The validated catalog. Public read: it prices nothing and leaks nothing. |
| `POST /api/shop/acquire` | Body `{ "item_id" }`. Writes the ownership record into the caller's Arsenal envelope and auto-equips on first acquisition. 401 without a session, before any state change. |
| `POST /api/shop/equip` | Body `{ "item_id" }`. Sets the equipped cosmetic; refused for an unowned item. 401 without a session. |

Both writes resolve the caller through `AccountService.resolve_session` —
the one session-resolution choke point (`ADR-0006`, `INT-020`). The shop
introduces no second authenticator (`INT-037`).

### Ownership and equipment are conventions inside `data`, not new tables

Per the handoff's pinned key conventions (additive growth under `ADR-0007`):

- **Ownership record** = an entry appended to `data.inventory`:
  `{ "id": "<catalog-item-id>", "acquired_at": "<ISO-8601>" }`. Presence in
  the collection IS ownership — no second source of truth. Legacy
  plain-string entries (none exist today) pass through untouched and never
  crash the join with catalog metadata.
- **Equipped cosmetic** = `data.loadout.cosmetic`: the owned item id,
  absent = none. It lives *inside* `data`; a top-level `loadout` sibling
  would fall outside the envelope's preservation contract.
- **`version` never changes**, and the shop writes no other key.

Every shop write reads the stored envelope through `ArsenalEnvelope.parse`,
mutates a copy of `data`, and stores it back — so unknown keys inside
`data` survive byte-for-byte after acquisitions and equip writes
(`INT-038`), exactly as `INT-029` guarantees for foreign writers.

### Acquisition order is part of the contract

Acquire checks ownership **before** any mutation: a re-acquire succeeds
while leaving both the ownership records and the equipped loadout unchanged,
so the first acquisition's auto-equip fires at most once per item
(`ACQ-003`, `INT-035`). Only an owned item can be equipped.

### Cosmetics are material skins over the existing rig

A catalog item carries a skin spec naming a material region and brand
tokens (never raw colours), applied by one shared routine,
`apps/client/src/scene/cosmetics.ts::applyCosmetic`, consumed by every
surface that renders the player model this phase — the `RigView` molecule
in the Arsenal view and the Acquired screen, which reuses the same molecule.
No new binary assets (operator decision 2026-08-22, `RENDER-001`);
previews render as token-styled swatches/gradients from the same spec. The
routine sets `data-equipped-skin` on the rig host element, which is what
the test surface observes (`COS-001`, `INT-036`).

### Hexagonal placement mirrors the account line

Domain model in `domain/model/shop.py` (catalog items, rarity, ownership
records); use cases in `application/use_cases/` over the existing
`AccountRepository` port; inbound HTTP adapter in
`adapters/inbound/http/routers/shop.py`; composition in `Container`. The
envelope writer rides the account repository because that is where the
Arsenal already lives — a separate shop store would be a second source of
truth.

## Consequences

- **No migration.** Growth lands inside the opaque `data` object; older
  readers carry the new keys untouched.
- **Monetization later is additive.** A currency/pricing phase plugs into
  the same acquire choke point without reshaping ownership.
- **The catalog scales by editing a JSON file.** If authoring ever stops
  scaling, tooling can be added around the same validated loader.
- **The client trusts the validated catalog's ids.** An acquire request for
  an unknown id is refused server-side; the client renders only what
  `/api/shop/catalog` serves.

## Alternatives considered

- **A shop microservice/database.** Rejected: violates `DATA-001`/`CAT-001`
  and forks identity and deployment for a static list and two writes.
- **A fixed-field `PlayerProfile`-style struct for loadout.** Rejected: it
  is the closed-shape mistake `ADR-0007` exists to avoid.
- **Server-side equip state keyed per session.** Rejected: equipment is
  account data that must survive sign-out/sign-in on any client, which the
  envelope already provides.
- **Raw colour values in the catalog.** Rejected: colours are the brand;
  the catalog names tokens and the client resolves them, so a restyle
  stays live.
