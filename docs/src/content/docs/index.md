---
title: Shoot4Fun
description: A simple multiplayer Three.js shooter
---

Shoot4Fun is a simple multiplayer Three.js shooter: a server-authoritative match
loop over WebSocket, with a Three.js client rendering the arena.

This site is served at `/apps/shoot4fun` from the Foundry's docs portal, and the
game itself runs at [shoot4fun.chaos-architect.dev](https://shoot4fun.chaos-architect.dev).

## Pages

| Page | What it covers |
|------|----------------|
| [Overview](./overview/) | The ask, the stack, and how the pieces fit |
| [Reference](./reference/) | The WebSocket protocol and the HTTP surface |

Architecture decisions live in `docs/adr/`, starting with the choice to make the
WebSocket server authoritative for match state.
