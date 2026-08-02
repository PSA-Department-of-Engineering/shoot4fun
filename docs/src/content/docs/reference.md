---
title: Architecture Reference
description: Components, the intent protocol, and the HTTP surface
type: Reference
---

## Components

| Component | Tech | Owns |
|-----------|------|------|
| WebSocket endpoint | Python (FastAPI) | The hello handshake, the `ROOM_FULL` close, message dispatch |
| Match service | Python asyncio | The 60Hz simulation task, the per-room lock, the 20Hz broadcast |
| Match room | Python (in-memory) | Players, arena, kills, timer, tick history, respawn placement |
| Movement routine | Python, mirrored in TypeScript | Position and intent in, next position out. Bounds and cover |
| Hitscan | Python | Ray from the shooter's eye versus cover boxes and player capsules |
| Match state machine | Python | `lobby -> playing -> results` transitions |
| Leaderboard | asyncpg against `pg-app-shoot4fun`, or in-memory | Best score per arena, upsert-if-higher |
| Scene | Three.js | Renderer, camera rig, arena meshes, avatars, particles, frame loop |
| Prediction and interpolation | TypeScript | The local player replayed, everyone else sampled in the past |
| HUD and surfaces | DOM (brand tokens) | Crosshair, health, ammo, respawn, lobby, results, settings |

## The intent protocol

The client sends the cause of motion; the server computes the effect. There is no wire shape for a position, a velocity, a displacement or a victim, in any message.

```text
client -> server   input
{
  "type": "input",
  "seq": 412,                 client frame counter
  "dt": 0.0166,               seconds this frame covered
  "ack_tick": 9038,           the server tick the client had drawn
  "buttons": { "forward": true, "back": false,
               "left": false, "right": false, "fire": true },
  "yaw": -1.5708,             radians
  "pitch": 0.0
}

server -> client   state, 20 times a second
{
  "type": "state",
  "room": {
    "id": "AB12CD", "state": "playing", "host_id": "...", "tick": 9040,
    "arena": { "id": "sandbox", "bounds_min": {...}, "bounds_max": {...},
               "cover": [...], "spawn_points": [...] },
    "players": [ { "id": "...", "position": {...}, "yaw": 0.0, "pitch": 0.0,
                   "hp": 100, "ammo": 30, "last_input_seq": 409, ... } ],
    "kills": { "...": 2 }, "winner": null, "time_remaining": 231.4
  }
}
```

`dt` is attacker-controlled, so it is clamped per frame and bounded across frames against real elapsed time: neither one long frame nor a flood of short ones buys distance. `ack_tick` is what lets the server rewind the world to what the shooter was looking at.

## Messages

Client to server, over `/ws/match/{room_id}`:

| Message | Payload |
|---------|---------|
| `hello` | `name` |
| `input` | `seq`, `dt`, `ack_tick`, `buttons`, `yaw`, `pitch` |
| `set_ready` | `ready` |
| `select_map` | `arena` (host only, lobby only) |
| `start_match` | host only, all ready, two or more players |
| `rematch` | host only, results only |
| `switch_weapon` | `weapon` |
| `reload` | none |
| `ping` | `t` |

Server to client:

| Message | Payload |
|---------|---------|
| `hello` | `player_id`, `room` |
| `lobby_state`, `match_started`, `state`, `results` | `room` snapshot |
| `player_joined`, `player_left` | `player` / `player_id` |
| `respawn` | `player_id` |
| `hit_confirmed` | `victim`, `damage`, `headshot`, `killed` (shooter only) |
| `damage` | `victim`, `attacker`, `damage`, `point` |
| `kill` | `killer`, `victim`, `headshot` |
| `error` | `code` (`BAD_HELLO`, `BAD_JSON`, `ROOM_FULL`), `detail` |
| `pong` | `t` |

## Rates and bounds

| Quantity | Value |
|----------|-------|
| Simulation tick | 60Hz |
| Snapshot broadcast | 20Hz |
| Interpolation delay | 100ms |
| Longest claimed frame | 0.05s |
| Banked simulation time | 0.25s |
| Furthest rewind for a shot | 30 ticks |
| Walk speed | 6 m/s |
| Room capacity | 4 players |
| Match duration | 480s |
| Respawn delay | 3s |

## HTTP surface

| Route | Purpose |
|-------|---------|
| `GET /api/health` | Liveness and version |
| `GET /api/arenas` | The arenas a room can be set to, with the lobby's display copy |
| `GET /api/leaderboard/{arena}` | Best score for an arena, 404 when there is none |
| `POST /api/leaderboard/{arena}/score` | Upsert-if-higher, body `{holder_name, score}` |

`DATABASE_URL` selects the Postgres leaderboard; without it the in-memory one runs. `DISABLE_TICK_LOOP=1` starts the app without the simulation task.

## Match lifecycle

```text
[lobby] --host starts, all ready, 2+ players--> [playing]
[playing] --timer expires or fewer than two alive--> [results]
[results] --host calls a rematch--> [lobby]
```

Any other transition raises. Ready-up is accepted in the lobby only; input, hit points and the kill counter move in the playing state only.

## Concurrency

- One `asyncio` task advances every room at 60Hz, sleeping the remainder of each budget.
- Every handler and the tick take the room's `asyncio.Lock` before mutating state and release it before awaiting network I/O.
- The `Broadcaster` is the only route from locked state to the wire.

## The one duplicated routine

The movement routine exists in Python and in TypeScript so the client can predict what the server will compute. `shared/movement_trace.json` is generated from the Python routine and replayed by both suites, so the two cannot drift without both builds failing at the first differing step. Changing a movement rule or arena datum means regenerating it:

```sh
cd backend && python scripts/generate_movement_trace.py
```
