---
title: Shoot4Fun
description: A simple multiplayer Three.js shooter
---

Shoot4Fun is a simple multiplayer Three.js shooter: the server simulates the
match and the client sends intent, renders the arena from the first person, and
predicts its own motion so the controls answer instantly.

This site is served at `/apps/shoot4fun` from the Foundry's docs portal, and the
game itself runs at [shoot4fun.chaos-architect.dev](https://shoot4fun.chaos-architect.dev).

## Pages

| Page | What it covers |
|------|----------------|
| [Overview](./overview/) | The ask, the stack, and how the pieces fit |
| [Reference](./reference/) | The WebSocket protocol and the HTTP surface |

Architecture decisions live in `docs/adr/`: the first person as the camera
(`ADR-0002`), the server simulating from client intent (`ADR-0003`), and the
prediction that hides the round trip (`ADR-0004`).
