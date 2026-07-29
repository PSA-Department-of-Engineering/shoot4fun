---
title: Shoot4Fun
description: A simple multiplayer Three.js shooter
type: Overview
---

Shoot4Fun is a **simple multiplayer Three.js shooter**. The verbatim ask was one line: *"simple multiplayer threejs shooter"*. 

The implementation priced 17 Req IDs across Phase 1 (MVP) and Phase 2 (polish). The visual identity is locked, the architecture is documented in ADRs, and the intent spec is audited.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.11+, FastAPI, uvicorn, asyncpg, hexagonal architecture |
| Client | TypeScript, Vite, Three.js, Web Audio API |
| WebSocket | JSON, server-authoritative at 20Hz |
| Deployment | Containerised (server + client), pushed to GHCR, hosted on the PSA Foundry |
