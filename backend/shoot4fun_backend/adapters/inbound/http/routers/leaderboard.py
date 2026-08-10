"""The leaderboard HTTP read API (`LDR-002`).

Two endpoints:

* `GET /api/leaderboard/{arena}` - return the best score for the arena
  (404 if no record). Public: this is the deliberately unscoped read path, and
  it resolves no session.
* `POST /api/leaderboard/{arena}/score` - record a match score
  (upsert-if-higher). The body is `{ "holder_name": "...", "score": N }`.

Both endpoints go through the `MatchService` (the application service),
which is the only inbound port. The leaderboard write path is the
HTTP API rather than a WebSocket message because the score is recorded
at match end, after the WebSocket has closed; a client posting the
score is the natural shape.

**Attribution comes from the account, never from the body.** A score posted
from an authenticated session is recorded under that account's display name and
the body's `holder_name` is ignored. Trusting the body would make this an
attribution-forgery surface the moment accounts existed: anyone could post a
score under anyone's name. Guests keep posting a name with their score, because
a guest has no account to attribute to and unowned scores are the point.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from shoot4fun_backend.adapters.inbound.http.routers.accounts import session_token_of

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
    async def post_score(arena: str, request: Request, body: ScoreSubmission) -> dict:
        accounts = container.account_service()
        user_id = await accounts.resolve_session(session_token_of(request))
        holder_name = body.holder_name
        if user_id is not None:
            account = await accounts.get(user_id)
            if account is not None:
                holder_name = account.display_name
        service = container.match_service()
        return await service.record_match_score(arena, holder_name, body.score)

    return router
