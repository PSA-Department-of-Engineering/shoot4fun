# ADR 0001: WebSocket server-authoritative match (ARCH-001)

- **Status:** Accepted
- **Date:** 2026-07-28
- **Decision drivers:** `ARCH-001` (the cheat-resistance decision
  the proposal priced; high confidence, medium impact, maps to
  `SYNC-001`, `MAT-001`, `SCO-001`).

## Context

A multiplayer shooter has to make a fundamental decision: do clients
trust each other (peer-to-peer, low cost, no cheat resistance) or
is one side authoritative (the server, the source of truth)?

The proposal's `ARCH-001` recorded this as a HIGH-confidence
decision: server-authoritative. The price line in the BRD
(`PERF-001`) sized the server to handle 2–4 players per room at
20Hz. Anything less strict (e.g. client-prediction with eventual
consistency) is a regression to peer-to-peer trust and was not
priced.

## Decision

The server is the single source of truth for player position,
rotation, HP, and the match state. Clients send `input` messages
(move vectors, look angles, fire events); the server processes
them under a per-room `asyncio.Lock`, advances the world at a
fixed 20Hz tick, and broadcasts the resulting state to all
players in the room.

The client never sends a `position` or a `velocity` directly —
there is no `position_set` or `teleport` message in the wire
protocol. Any client message that claims to mutate state outside
the `input` handler is silently ignored by the server (asserted by
`INT-009` in `test_authoritative_tick.py`).

## Consequences

- **Cheat resistance.** Clients cannot teleport or self-heal; the
  server validates every state change against the tick's input.
- **Network cost.** The server is on the critical path of every
  visible state change. The 20Hz broadcast is sized by `PERF-001`
  (single FastAPI instance, asyncio, in-process state).
- **Latency budget.** A client with high ping sees their position
  "snap" to the server's snapshot. Client-side prediction +
  reconciliation (`ARCH-002`) is a follow-on; the MVP does not
  implement it.
- **Test surface.** The contract is enforceable at the integration
  level: `INT-009`'s test asserts that no client message can
  mutate position outside the `input` handler.

## Alternatives considered

- **Peer-to-peer.** Rejected: not priced; cheat resistance was a
  priced decision.
- **Client-prediction with server reconciliation.** P2 polish;
  not in the priced scope.
- **Authoritative but tick-on-input.** Rejected: tick rate drives
  the feel of the game (the prop `/timer`); a tick-on-input model
  makes the rate a function of player behaviour, which `PERF-001`
  did not price.
