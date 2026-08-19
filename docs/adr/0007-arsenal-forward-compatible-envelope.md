# ADR 0007: The Arsenal data shape is a forward-compatible envelope (ARS-004)

- **Status:** Accepted
- **Date:** 2026-08-19
- **Decision drivers:** `ARS-004`, attested by `INT-029`; the P1 delivery
  line (issue #41: Login, Profile & Arsenal). Builds on the account model
  established in `ADR-0006`.

## Context

The Arsenal view (issue #41) shows the player's model and an
inventory/loadout. The shop surface, weapon unlocks, outfits, and a 3D
character viewer are explicitly deferred to later lines — but the data the
Arsenal view reads and writes must not need a migration when they land.

The naive shape is a frozen struct, exactly like the shipped `PlayerProfile`
(a fixed-field dataclass). `PlayerProfile` is fine for five preferences that
are settled; it is wrong for anything that will grow, because a frozen struct
loses unknown fields. The deferred shop/unlock work adds keys to the Arsenal
shape; a loader that drops them would silently throw away a player's
purchases the moment an older client rewrites the record.

This is the same failure class `ADR-0006` names for identity: a shape that
cannot absorb the next feature forces a breaking change at the worst moment.
The Arsenal shape is born knowing it will grow, so it is built to grow.

## Decision

**A versioned envelope that preserves unknown fields.** The Arsenal record
is carried as a JSON object with a `version` (the envelope version, not the
game's), the known keys `model` (the player-model id) and `loadout` (the
current inventory/loadout bag), and every other key carried through
verbatim in an `extras` bag. The domain type round-trips `extras` on both
reads and writes, so a future field the current build does not name survives
a store/load cycle untouched.

Concretely:

| Thing | What it is | What it does |
| ----- | ---------- | ------------ |
| `version` | integer envelope version | lets a future loader branch on shape |
| `model` | player-model id (`"robot"`) | what the Arsenal view renders |
| `loadout` | `slot -> item` bag | the current inventory/loadout |
| `extras` | every unrecognised key | preserved, never dropped |

- **The server stores the envelope as given.** `PUT /api/account/arsenal`
  accepts the known keys plus any forward-shaped field and persists the
  whole object (including unknown keys) as JSONB. `GET` returns it back
  identically. The domain `PlayerArsenal.from_dict`/`to_dict` are the only
  place the envelope is parsed, and both preserve `extras`.
- **The client reads what it knows and renders the rest as future-proof.**
  The Arsenal view binds to `model` and `loadout` today; a later line adds
  editors for `weapon_unlocks`, `outfits`, and `stats` without touching the
  storage contract.
- **No migration when it grows.** Adding a key is a write-time change, not a
  schema change: the `account_arsenal` table holds one JSONB column, and the
  forward-shaped fields live inside it.

### Why a single JSONB column and not a normalised table

The shape is deliberately unstable for its first releases (the deferred
shop/unlock/outfit work is still being scoped). A normalised schema would
migrate on every one of those releases; a JSONB envelope migrates never, and
the `extras`-preserving loader means even a client that predates a new key
cannot corrupt the record by round-tripping it. When the shape settles,
promoting a frequently-queried key to a column is a local change behind the
repository port, invisible to the service and the API.

## Consequences

- **A future Arsenal feature lands without a breaking change.** Weapon
  unlocks, outfits, and stats drop into the envelope as new keys; existing
  players' data is untouched (INT-029 proves this).
- **The current build cannot lose data it does not understand.** A write
  from an older client preserves newer keys a newer client wrote.
- **The envelope version is the seam for a genuine format break**, should
  one ever be needed; today there is exactly one version.
- **Querying an individual Arsenal field server-side is not possible** until
  a key is promoted out of the JSONB. None of the deferred features need
  that; the Arsenal record is read and written whole, per account.

## Alternatives considered

- **Frozen struct (like `PlayerProfile`).** Rejected: it drops unknown
  fields, so an older client would erase a player's unlocks the moment it
  saves. The exact failure this ADR exists to prevent.
- **Normalised tables per Arsenal entity.** Rejected for now: the shape is
  still changing, so each release would migrate. JSONB is the right home
  until the shape settles (consequence above states the promotion path).
- **Separate micro-service for inventory.** Rejected: the Arsenal is one
  account-scoped record behind the existing account service; a second
  service is operational weight with no payoff for a single-player's
  loadout.
