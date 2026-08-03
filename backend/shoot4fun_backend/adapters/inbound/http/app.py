"""The FastAPI app factory.

Wires the composition root, the inbound HTTP + WebSocket adapters, the
exception handler, and the static-file fallback for the production
deployment (the Nginx/Caddy in the cluster is the public edge; this
fallback is the dev path). The leaderboard HTTP read API and the
WebSocket match endpoint live alongside `/healthz`.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket

from shoot4fun_backend import __version__
from shoot4fun_backend.adapters.inbound.http.exception_handlers import (
    register_exception_handler,
)
from shoot4fun_backend.adapters.inbound.http.routers import arenas, leaderboard, profiles, system
from shoot4fun_backend.container import Container
from shoot4fun_backend.logging import configure_logging, get_logger

__all__ = ["create_app"]


_log = get_logger("app")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    configure_logging()
    container = Container()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await container.start()
        yield
        await container.stop()

    app = FastAPI(
        title="shoot4fun API",
        version=__version__,
        lifespan=lifespan,
    )
    register_exception_handler(app)
    app.include_router(system.router, prefix="/api", tags=["system"])
    app.include_router(arenas.router, prefix="/api", tags=["arenas"])
    app.include_router(
        leaderboard.build_router(container),
        prefix="/api",
        tags=["leaderboard"],
    )
    app.include_router(
        profiles.build_router(container),
        prefix="/api",
        tags=["profiles"],
    )

    @app.websocket("/ws/match/{room_id}")
    async def match_socket(websocket: WebSocket, room_id: str) -> None:
        await container.handle_match(websocket, room_id)

    return app
