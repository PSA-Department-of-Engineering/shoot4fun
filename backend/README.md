# backend

WebSocket-authoritative match server for the Shoot4Fun multiplayer shooter

A Python FastAPI service in hexagonal (ports and adapters) architecture, scaffolded
by the bootstrap-hexagonal-backend skill.

## Develop

Create a venv, install, lint, test (POSIX paths shown; on Windows use
`.venv\Scripts\python.exe`):

```bash
python -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
.venv/bin/python -m ruff check .
.venv/bin/python -m pytest -q
.venv/bin/python -m shoot4fun_backend.adapters.inbound.http.run
```

## Export the OpenAPI contract

```bash
.venv/bin/python scripts/export_openapi.py   # writes openapi.json
```

## Layout

- `shoot4fun_backend/domain` - entities, value objects, exceptions (no outward imports)
- `shoot4fun_backend/application` - inbound/outbound ports and use cases
- `shoot4fun_backend/adapters` - HTTP inbound adapter and outbound adapters
- `shoot4fun_backend/container.py` - composition root
