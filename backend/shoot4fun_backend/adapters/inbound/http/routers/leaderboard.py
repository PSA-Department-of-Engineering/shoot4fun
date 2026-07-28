"""The leaderboard HTTP read API (`LDR-002`).

Two endpoints:

* `GET /api/leaderboard/{arena}` - return the best score for the arena
  (404 if no record).
* `POST /api/leaderboard/{arena}/score` - record a match score
  (upsert-if-higher). The body is `{ "holder_name": "...", "score": N }`.

Both endpoints go through the `MatchService` (the application service),
which is the only inbound port. The leaderboard write path is the
HTTP API rather than a WebSocket message because the score is recorded
at match end, after the WebSocket has closed; a client posting the
score is the natural shape.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from shoot4fun_backend.container import Container


class ScoreSubmission(BaseModel):
    holder_name: str = Field(..., min_length=1, max_length=32)
    score: int = Field(..., ge=0)


def build_router(container: Container) -> APIRouter:
    router = APIRouter()

    @router.get("/leaderboard/{arena}")
    async def get_leaderboard(arena: str) -> dict:
        service = container.match_service()
        result = await service.get_leaderboard(arena)
        if result is None:
            raise HTTPException(status_code=404, detail="no score for arena")
        return result

    @router.post("/leaderboard/{arena}/score", status_code=200)
    async def post_score(arena: str, body: ScoreSubmission) -> dict:
        service = container.match_service()
        return await service.record_match_score(
            arena, body.holder_name, body.score
        )

    return router
