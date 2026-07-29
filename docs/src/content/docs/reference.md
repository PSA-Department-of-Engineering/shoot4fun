---
title: Architecture Reference
description: Component architecture and data flow
type: Reference
---

## Components

| Component | Tech | Owns |
|-----------|------|------|
| WebSocket Server | Python (FastAPI) + uvicorn | Translates wire protocol to service calls |
| Authoritative Tick Loop | Python asyncio | 20Hz room-advance loop |
| Match State Machine | Python (in-memory) | `lobby -> playing -> results` transitions |
| Kill Counter | Python (per-room) | Per-room kill counts |
| Leaderboard | asyncpg against `pg-app-shoot4fun` | Per-arena best-score upsert |
| Frontend Scene | Three.js | WebGL surface |
| HUD Overlay | DOM (CSS via brand tokens) | Crosshair, health, ammo, score, respawn |
| Lobby / Results / Settings | DOM | Match state-machine surfaces |

## Data Flow

```text
[Browser] WebSocket    [Backend (FastAPI)]
   |  ws://.../ws/match/R  |
   |  input (move, look)   |
   |  fire (target)        |
   |  state (room snapshot) |
```

## Concurrency

- `MatchService` runs a single `asyncio.create_task` tick loop at 20Hz
- Each WS handler awaits a per-room `asyncio.Lock` before mutation
- `Broadcaster` is the boundary between in-process state and network edge

## State Machine

```text
[lobby] -> [playing] -> [results] -> [lobby] (rematch)
```
