<img src="docs/logo.png" alt="Shoot4Fun" width="600">

# Shoot4Fun

A simple multiplayer Three.js shooter. The verbatim ask was one line:
*"simple multiplayer threejs shooter"*. The implementation is the
[`shoot4fun-2026-07-28` delivery](../.delivery/handoff.md), which
priced 17 Req IDs across Phase 1 (MVP) and Phase 2 (polish).

The visual identity is locked at [`docs/brand.md`](docs/brand.md) and
the architecture at [`docs/architecture.md`](docs/architecture.md),
with the per-decision ADRs in [`docs/adr/`](docs/adr/). The intent
spec (the 17 claims) is at [`intent.yaml`](intent.yaml) and is
audited by `python -m csd_intent.cli .`.

## Stack

| Layer | Tech |
| --- | --- |
| Backend | Python 3.11+, FastAPI, uvicorn, asyncpg, hexagonal architecture |
| Client | TypeScript, Vite, Three.js, Web Audio API |
| WebSocket protocol | JSON, server-authoritative at 20Hz (per `docs/adr/0001-websocket-server-authoritative.md`) |
| Deployment | Containerised (server + client), pushed to GHCR, hosted on the PSA Foundry |

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -e ".[dev]"
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\python.exe -m shoot4fun_backend.adapters.inbound.http.run
```

The server binds to `127.0.0.1:8000`. Without `DATABASE_URL` the
leaderboard is in-memory; with `DATABASE_URL` set it backs the
`leaderboard` table against the platform-minted `pg-app-shoot4fun`
role (see `docs/architecture.md`).

### Client

```bash
cd apps/client
npm install
npm run dev
```

The Vite dev server binds to `localhost:5173` and proxies `/api` and
`/ws` to the backend on port 8000. Visit `http://localhost:5173/#/ABC123`
to join a room.

### E2E

```bash
cd apps/client
npm run e2e
```

The Playwright run starts the backend (via `e2e/run-with-backend.cmd`)
and the Vite preview, then runs the per-claim specs under `e2e/`.

## Layout

```
├── backend/                # Python/FastAPI hexagonal backend
│   ├── shoot4fun_backend/  # Domain + application + adapters
│   └── tests/              # Pytest per-claim tests
├── apps/
│   └── client/             # Vite + TypeScript + Three.js frontend
│       ├── e2e/            # Playwright per-claim e2e tests
│       ├── src/            # Scene, HUD, UI, audio, networking
│       └── public/         # Rasterised icons
├── devops/                 # Docker compose and platform config
├── docs/                   # Brand, architecture, ADRs, Starlight site
├── k8s/                    # Helm chart
└── .delivery/              # Delivery scratch (ephemeral)
```

## Run with Docker

```bash
docker compose -f devops/docker-compose.yml build
docker compose -f devops/docker-compose.yml up
```

## Develop without Docker

See [Quick start](#quick-start) above.

## Live

The deployment is at `https://shoot4fun.chaos-architect.dev` once
the platform-studio onboarding PR merges. The deployment evidence
chain is captured in [`.delivery/build.md`](.delivery/build.md) (this
file is created when the build run finishes).
