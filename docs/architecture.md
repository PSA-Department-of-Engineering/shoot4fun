# Shoot4Fun — Architecture

> The build-time architecture. The estimation's proposal pinned the
> technology choices (Python/FastAPI/uvicorn, asyncio tick, Three.js)
> and the WebSocket-server-authoritative model; this page is the
> maintained form, and the per-decision ADRs in `docs/adr/` capture
> the rationale.

## Components

Per the estimatekit's `P1-components.tsv` (the planning source the
delivery is the implementation of):

| Component | Tech | File | Owns |
| --- | --- | --- | --- |
| WebSocket Server | Python (FastAPI) + uvicorn | `backend/shoot4fun_backend/adapters/inbound/websocket/match_socket.py` | Translates wire protocol to service calls. |
| Authoritative Tick Loop | Python asyncio | `backend/shoot4fun_backend/application/services/match_service.py::MatchService._run_tick` | The 20Hz room-advance loop. |
| Match State Machine | Python (in-memory) | `backend/shoot4fun_backend/domain/model/match_state_machine.py` | `lobby -> playing -> results` transitions. |
| Kill Counter | Python (per-room) | `backend/shoot4fun_backend/domain/model/kill_counter.py` | Per-room kill counts. |
| Leaderboard | asyncpg against `pg-app-shoot4fun` | `backend/shoot4fun_backend/adapters/outbound/postgres/postgres_leaderboard_repository.py` | Per-arena best-score upsert (P2). |
| Frontend Scene | Three.js | `apps/client/src/scene/SceneApp.ts` | The WebGL surface (arena + players + lighting). |
| HUD Overlay | DOM (CSS via brand tokens) | `apps/client/src/ui/Hud.ts` | The player-facing UI (crosshair, health, ammo, score, respawn). |
| Lobby / Results / Settings | DOM | `apps/client/src/ui/Surface.ts` | The match state-machine DOM surfaces. |

## Data flow

```
[Browser]                      [Backend (FastAPI)]
   |                                  |
   |  WebSocket: ws://.../ws/match/R  |
   |--------------------------------->|
   |  { type: "hello", name }          |
   |                                  |  MatchService.connect
   |                                  |  -> MatchRoom.add_player
   |                                  |  -> Broadcaster.bind
   |  { type: "hello", player_id }     |  <- Broadcaster.send_to
   |  { type: "lobby_state", room }    |  <- Broadcaster.send_to_room
   |                                  |
   |  { type: "input", move, look }    |  -> MatchService.handle_message
   |  { type: "fire", target }         |  -> room.record_kill / damage
   |                                  |  -> Tick loop every 50ms
   |  { type: "state", room }          |  <- Tick broadcasts
   |                                  |
```

## Concurrency model

- The `MatchService` runs a single `asyncio.create_task` tick loop
  at 20Hz, advancing every room's state (respawn timers, match-end
  check) and broadcasting the snapshot.
- Each WebSocket message handler awaits a per-room `asyncio.Lock`
  before mutating state, then drops the lock before any I/O. The
  lock is acquired for the minimum scope; the broadcast is awaited
  after the lock is released.
- The `Broadcaster` is the boundary between the in-process room
  state and the network edge; it carries the locked-snapshot state
  to clients.

## State machine

```
            start
[lobby]  --------->  [playing]  --timer--> [results]
   ^                       |                   |
   |                       |                  rematch
   +-----------------------+                   |
   |                                           |
   +-------------------------------------------+
```

| Transition | Source | Trigger |
| --- | --- | --- |
| `lobby -> playing` | `start_match` from host when all ready | `MatchRoom.start()` |
| `playing -> results` | timer expiry OR all-but-one eliminated | `MatchRoom.end()` |
| `results -> lobby` | `rematch` from host | `MatchRoom.reset()` |

HP and the kill counter only change in the `playing` state. The
state machine is enforced at the use case layer; the domain
declarative table is in `match_state_machine.py`.

## Brand and tokens

Every UI element reads the brand tokens (`docs/brand.md`,
`apps/client/src/brand/theme.css`, `apps/client/src/brand/tokens.ts`).
A non-token colour anywhere in the build is a defect.

## Deployment

The PSA Foundry (`platform-studio` MCP) hosts the deployment. The
two-image shape (`server` + `client`) is the per-component binding
the platform's image-updater writes to the deploy branch on every
new image tag.

| Concern | Source |
| --- | --- |
| CI build + push | `.github/workflows/ci-caller.yml` |
| Backend Dockerfile | `backend/Dockerfile` |
| Client Dockerfile | `apps/client/Dockerfile` |
| Onboarding PR | `platform-studio onboard_app` (the platform's own CI merges per ADR-036) |
| Database grant | `platform-studio onboard_database` (mints `pg-app-shoot4fun`) |
