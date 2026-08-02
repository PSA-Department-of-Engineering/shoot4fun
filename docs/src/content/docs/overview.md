---
title: Shoot4Fun
description: A simple multiplayer Three.js shooter
type: Overview
---

Shoot4Fun is a **simple multiplayer Three.js shooter**. The verbatim ask was one line: *"simple multiplayer threejs shooter"*.

Two to four players share a room over one WebSocket. The server runs the match as a real simulation: it integrates every player's movement, resolves every shot by raycast, and broadcasts the world. The client renders that world in first person, predicts its own player so the controls answer instantly, and sends nothing but intent.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.13, FastAPI, uvicorn, asyncpg, hexagonal architecture |
| Client | TypeScript, Vite, Three.js, Web Audio API |
| Transport | JSON over WebSocket: intent frames up, room snapshots down |
| Rates | 60Hz simulation tick, 20Hz snapshot broadcast |
| Deployment | Two containers (server, client) pushed to GHCR, hosted on the PSA Foundry |

## How a frame works

1. The client reads held keys and mouse deltas, and turns the camera at once. Mouse-look needs pointer lock, taken by clicking the gate overlay.
2. It predicts its own next position with the same movement routine the server runs, then sends the frame as intent: which buttons were down, where the player was looking, how long the frame covered, and which server tick it had drawn.
3. The server spends that player's simulation budget, integrates the movement, keeps them inside the arena and out of cover, separates them from other players, and resolves a shot against the world rewound to the tick the shooter had drawn.
4. Twenty times a second the server broadcasts the room. The client snaps its own player to the authoritative position and replays the frames the server has not yet consumed; everyone else is drawn from a buffer, 100ms in the past, so 20 updates a second read as continuous motion.

## Controls

| Input | Action |
|-------|--------|
| W A S D or arrows | Move |
| Mouse | Look (pointer lock required) |
| Left mouse | Fire |
| 1 / 2 | Rifle / SMG |
| R | Reload |
| Escape | Release the mouse |

## Where the detail lives

| Source | What it carries |
|--------|-----------------|
| [Reference](../reference/) | Components, the wire protocol, the HTTP surface, the rates |
| `docs/architecture.md` | The architecture in diagrams, module by module |
| `docs/adr/` | The decisions: first-person perspective, the authoritative simulation and the intent protocol, client prediction and the shared movement trace |
| `intent.yaml` | One correctness claim per requirement, each one active with a test naming it, or draft with the gap written down |
