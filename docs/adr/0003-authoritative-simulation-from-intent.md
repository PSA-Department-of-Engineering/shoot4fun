# ADR 0003: The server simulates; the client sends intent (ARCH-001)

- **Status:** Accepted
- **Date:** 2026-08-02
- **Supersedes:** `ADR-0001`
- **Decision drivers:** `ARCH-001` (cheat resistance), `INT-009`.

## Context

"Server-authoritative" names where state lives. It does not, on its
own, say what the client is allowed to send, and that second question
is the one that decides whether the property holds.

A protocol can put every byte of state on the server and still be
fully client-trusting if the client's message is a *displacement*. A
message that says "add this vector to my position" is a teleport
primitive wearing an input message's name: the server has nothing to
validate it against, because the vector is the answer rather than the
question. Cheat resistance survives only if the client sends the
*cause* of motion and the server computes the *effect*.

The same split decides hit resolution. A client that names its victim
has chosen the outcome; the server can only ratify it. A client that
sends its aim angles has described a cause the server can test against
its own world, including the cover between shooter and target.

## Decision

The client sends intent. The server simulates.

An input frame carries only what a human did:

```
input { seq, dt, buttons { fwd, back, left, right, fire }, yaw, pitch }
```

- **No displacement, no position, no velocity, no victim.** There is no
  wire representation for any of them, in any message.
- **The server integrates.** Movement is `direction(yaw, buttons) *
  SPEED * dt` computed server-side, where `SPEED` is a server constant
  the client cannot influence and `dt` is clamped to a per-frame budget
  so a client cannot buy distance by claiming a long frame.
- **The server resolves fire** by raycasting from the shooter's eye
  along their reported look angles, against player capsules and cover,
  applying the equipped weapon's damage and enforcing its rate of fire.
  Cover blocks shots. The nearest hit wins.
- **The world constrains motion** before it is committed: arena bounds,
  sphere-versus-AABB collision against cover, and player separation at
  `PLAYER_RADIUS`.
- **Look angles are the exception that proves the rule.** Yaw and pitch
  are authored entirely by the client and adopted by the server without
  arbitration, because a player's aim is not a contested quantity: it
  costs the shooter nothing to lie about where they are looking, since
  the server still decides what that look hits.

The simulation runs on a fixed 60Hz accumulator tick, decoupled from
the 20Hz state broadcast. Tick rate governs correctness and broadcast
rate governs bandwidth; binding them together makes one hostage to the
other.

## Consequences

- **Cheat resistance is now a property of the protocol**, not a claim
  about it. A malicious client's worst move is to send implausible look
  angles or to spam inputs, both of which the server bounds.
- **The server owns a real simulation.** Collision, hit resolution and
  respawn placement become server code with server tests, rather than
  constants the client decorates itself with.
- **Latency becomes visible**, and must be answered. A client that
  waits for the server before moving feels broken at any ping. That is
  what `ADR-0004` is for; this ADR is not implementable on its own
  without it.
- **`dt` is attacker-controlled input.** It is clamped, and the clamp
  is a tested boundary rather than a comment.

## Alternatives considered

- **Client-computed displacement, server-stored** (the shape this
  supersedes). Rejected: it names the client as the simulation and the
  server as a database, so every gameplay rule is advisory.
- **Client-declared hits.** Rejected on the same ground. It is cheaper
  to build and it makes the aimbot the reference implementation.
- **Tick on input arrival.** Rejected: it makes the simulation rate a
  function of player behaviour and of network jitter, so the same
  inputs produce different worlds.
