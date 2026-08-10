# ADR 0006: A guest is an account, and registration upgrades it (IDN-001)

- **Status:** Accepted
- **Date:** 2026-08-10
- **Decision drivers:** `IDN-001`, attested by `INT-019`, `INT-020` and
  `INT-021`; routed by `REF-Identity` sections 1, 2, 4 and 5. Supersedes
  the descoping recorded in `k8s/values.yaml`.

## Context

The game shipped with no identity at all, and `POST /api/leaderboard/{arena}/score`
accepted `holder_name` and `score` from any caller. That is coherent while
nothing is attributable: an anonymous board holds anonymous scores.

The obvious next step was a profile store with a `user_id` on that same
endpoint, on the reasoning that profile plumbing is harmless until a login
exists. It is not. Attaching identity to an unauthenticated write surface
converts an anonymous one into an **attribution-forgery** one: anyone can post
a score under anyone's account. The authenticator is not a follow-up to the
profile store; it is what makes the profile store safe to exist.

Two in-house implementations had already reached the same territory and left
defects behind. One made identity for play the *claimed* user id, which meant
there was no authentication at all: the id was also the join key its public
leaderboard published, so the board was a credential dump. The other stored a
user-chosen login code in plaintext, which is a password with none of a
password's protections. Both are the same mistake in two places, and the rule
they violate is one line: **what authenticates a request must be something the
server minted and never published.**

## Decision

**Guest-with-recovery-code**, selected against `REF-Identity` section 2 rather
than asserted. The routing question that section puts first is not stakes but
recovery, and it decides this case immediately.

- **The recovery rung comes first.** There is no email address and no operator
  here, which closes the conforming recovery set (`REF-Identity` section 1) to
  a single member: a saved recovery code. That is the whole recovery story,
  and its cost is stated below rather than patched later.
- **Stakes then confirm the login rung.** What is lost if an account is taken
  is a leaderboard rank. There is no PII, no money, and nothing belonging to
  another person.
- **Accounts are an obstacle to this product, not the product.** A signup wall
  costs players a browser shooter cannot afford to lose.

Concretely:

| Thing | What it is | What it does |
| ----- | ---------- | ------------ |
| `user_id` | opaque `usr_<random>`, never derived from the name | identifies; it never authorises |
| session token | 256 bits from the CSPRNG, stored as a digest | the **sole** authenticator of every private read and write |
| recovery code | 160 bits from the CSPRNG, stored as a digest | buys a session at sign-in, and nothing else |

- **A guest is an account.** The server mints one on first entry with a
  generated display name. There is no separate guest code path to keep
  working, which is what makes "guests stay first-class" structural rather
  than a promise.
- **Registration upgrades that account in place**, so a player who registers
  keeps the scores they set as a guest. The code is returned exactly once.
  Registering an account that already holds a code renames it and mints
  nothing: minting on a rename would let a session alone retire the owner's
  written-down code without ever presenting it.
- **Rotation requires the current code** and kills every existing session.
- **One session-resolution choke point.** Every private surface resolves the
  caller through `AccountService.resolve_session`; the public leaderboard read
  goes through a separate, deliberately unscoped path.
- **Attribution comes from the account.** A score posted from a session is
  recorded under that account's display name and the body's `holder_name` is
  ignored. Guest scores keep working, unowned.

### Why a fast digest, and not a memory-hard one

`REF-Identity` section 4 splits credential storage by entropy rather than by
the credential's name: above the 112-bit line an approved digest with no salt
and no memory-hard scheme is conforming, because the KDF exists to buy back
entropy a human-chosen secret lacks. Both secrets here are drawn from the
CSPRNG far above that line, so SHA-256 is correct and argon2 or scrypt would
buy only latency and a denial-of-service surface on endpoints anyone can reach.

The corollary is a design constraint worth stating: because the digest is fast,
these values may never be shortened into something a player types from memory.
A human-typeable code drops below the line and inverts the rule.

### Federation, decided now and deliberately not built

Three schema decisions are free at creation and a live migration with a
security window afterwards, and each is a published requirement rather than a
preference (`REF-Identity` section 5):

1. An opaque, non-derived `user_id`. A PII-bearing or sequential id cannot be
   reused as a WebAuthn user handle, so adopting passkeys later would force a
   second id and re-registering every credential.
2. A nullable `external_issuer` + `external_subject`, unique together and empty
   for every standalone player. A federated subject is unique only within its
   issuer, so storing one without the other is ambiguous by specification, and
   keying accounts on an email address instead lets a second issuer asserting
   that address take the account over.
3. The single session-resolution choke point above, which a federated session
   plugs into without touching a router.

Explicitly **not** in scope and not to be anticipated in code: a shared user
table, a cross-game identity protocol, or a hub. The game runs standalone with
no hub in existence, and nothing here may make the standalone experience worse
to serve one that does not exist.

## Consequences

- **Entry still costs nothing.** Play-as-guest is the default path and no
  screen blocks a match. A server that cannot be reached leaves the game
  entirely playable; the account resolves after the first render or not at all.
- **A code nobody chose is a code nobody memorises.** There is no reset path
  and deliberately nothing to reset against. Losing the code with no live
  session ends the account's reachability. That is the cost of the model and it
  is the right cost here, where an account holds a setlist of scores rather
  than anything a stranger profits from. The one-time reveal is therefore a
  real step in the flow, not a toast.
- **The leaderboard write is no longer forgeable for signed-in players**, and
  is unchanged for guests.
- **Preferences follow a signed-in player** across browsers and machines.
  Guests keep the same dials in browser storage, exactly as before.
- **The rate limit is per process.** At one replica that is exact; a shared
  counter belongs in Postgres and is worth building when the deployment runs
  wide enough for the difference to matter.

## Alternatives considered

- **Username and password.** Rejected on `REF-Identity` section 3: a
  conformant password rung is 15 characters minimum as a single factor, zero
  composition rules, no expiry, and a live breached-password blocklist, plus a
  reset desk that never closes. That is a heavier UX and a permanent operating
  cost for an account whose contents are a rank.
- **OIDC against the platform's per-app realm** (`foundry-onboard-keycloak`).
  The platform answers this rung well, and it is the right answer the day the
  game crosses an administrative boundary. It does not today, and a browser
  shooter that redirects a first-time player to an identity provider before
  they can shoot anything has traded its only advantage away.
- **Magic link.** Rejected twice over: it maps to no permitted authenticator
  under the assurance rules, and it needs an email address, which this game has
  no reason to hold and no wish to become responsible for.
- **Keep it anonymous and add a profile store later.** This is the option the
  superseded plan chose, and it is the one that creates the forgery surface.
  The authenticator is what makes the profile safe, so they land together.
