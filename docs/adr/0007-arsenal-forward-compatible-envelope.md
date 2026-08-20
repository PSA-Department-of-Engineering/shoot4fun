# ADR 0007: The Arsenal shape is a versioned envelope that preserves unknown fields (ARS-004)

- **Status:** Accepted
- **Date:** 2026-08-20
- **Decision drivers:** `ARS-004`, attested by `INT-029`; routed by the
  P1 delivery line (issue #41: Login, Profile & Arsenal). Authored by the
  build before the Arsenal data module was coded, per `.delivery/handoff.md`
  §3.

## Context

The Arsenal view this line ships needs a persisted shape for a player's
inventory and loadout. It ships empty-first (`ARS-003`): the player holds
nothing yet, and the deferred scope - weapon unlocks, outfits, stats, a shop
surface - will grow the shape. The only analogous persisted struct in the
codebase, `PlayerProfile` (ADR-0006's account model), is a fixed-field frozen
dataclass: it drops unknown fields on parse and needs a migration to grow.
That is the wrong template for a shape whose whole reason to exist is to
absorb the deferred work without breaking players who adopted it.

The requirement is a **growth-tolerance** property, not a feature: a future
that adds fields must not lose a player's existing Arsenal data. The shape is
therefore chosen so that an over-shaped (future) payload round-trips through
the current loader without loss and without a breaking change.

## Decision

**A versioned envelope wrapping an opaque `data` object**, stored verbatim.

| Field | Type | Contract |
| ----- | ---- | -------- |
| `version` | positive integer (`ARSENAL_VERSION = 1`) | Identifies the writing shape. A newer version is still readable; only an absent, non-integer, or older version is refused. |
| `data` | object | Opaque payload. Keys a future shape added are preserved byte-for-byte on the way out; nothing inside it is interpreted or pruned. |

- **`parse` validates the envelope, never the payload.** It refuses anything
  that is not a versioned object with a `data` object (and a `version` that is
  an integer not below `ARSENAL_VERSION`), then keeps `data` verbatim. Unknown
  keys inside `data` are not errors and are never dropped.
- **`to_dict` emits exactly what was stored**: `version` plus the untouched
  `data` payload. The storage round-trip (the repository's JSONB column) is
  lossless for unknown fields by construction.
- **The current schema owns nothing inside `data`.** Client and server agree
  on the envelope's *readability*, not on a closed field list, so a future
  shape addition is an additive change: it writes a new key into `data` and
  older reads carry it through untouched until they choose to interpret it.

### Why the server stays a dumb store for the payload

`GET`/`PUT /api/account/arsenal` follows the existing account-repository
pattern (ADR-0006): the service validates the envelope and the repository
persists it. The server does not model loadouts, own a schema for them, or
reject unknown fields - doing so would be exactly the closed-shape mistake
`PlayerProfile` makes. The contract test (`INT-029`) proves the property the
ADR exists to guarantee: an over-shaped payload round-trips without data loss.

## Consequences

- **The deferred work drops into a structure already present.** A weapon
  unlock or outfit writes a key into `data`; nothing in this line's code needs
  to be replaced to accept it.
- **Older clients never corrupt newer data.** A client on `ARSENAL_VERSION`
  reading a payload written by a future version keeps every key it does not
  know, because preservation is the envelope's contract, not a coincidence of
  field names.
- **A backward-incompatible change is still possible, and now explicit.**
  Raising `ARSENAL_VERSION` is the only way a future can refuse to read old
  data, and it is a deliberate act with a migration attached - the default
  path is additive and needs neither.
- **The empty-state view binds to the shape, not to a field list** (INT-028),
  so it stays valid as the shape grows.

## Alternatives considered

- **A fixed-field dataclass like `PlayerProfile`.** Rejected: it is the
  anti-pattern this ADR exists to avoid. Unknown fields are dropped on parse,
  so a future shape addition is a data-loss migration, not an additive one.
- **A raw JSON blob with no version.** Rejected: without a `version` there is
  no way to distinguish "the shape changed" from "the payload is corrupt",
  and no seam for the future to refuse to read old data when it must.
- **Per-field server schema with validation.** Rejected: it makes the server
  the owner of a shape that is defined by the deferred product work, and it
  re-creates the closed-shape coupling the envelope exists to remove.