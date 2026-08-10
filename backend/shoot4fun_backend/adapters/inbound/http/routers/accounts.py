"""The account HTTP surface.

`POST /api/account/guest` is the entry path and needs no credential: it mints an
account and a session. Everything else here presents the session in
`X-S4F-Session` (or a bearer `Authorization`), and resolves it through the one
choke point in `AccountService`. No handler reads an identity from anywhere else.

`POST /api/account/sign-in` and `POST /api/account/rotate` accept a secret, so
both carry the guess budget. The budget is keyed on the account under attack and
cleared by a correct credential.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, HTTPException, Request

from shoot4fun_backend.adapters.inbound.http.dtos.account import (
    AccountView,
    MintedView,
    ProfileView,
    RegisterRequest,
    RotateRequest,
    SessionView,
    SignInRequest,
)
from shoot4fun_backend.application.services.account_service import (
    AccountService,
    normalize_display_name,
)
from shoot4fun_backend.domain.exceptions.authentication_failed_error import (
    AuthenticationFailedError,
)
from shoot4fun_backend.domain.exceptions.display_name_taken_error import (
    DisplayNameTakenError,
)
from shoot4fun_backend.domain.model.account import Account
from shoot4fun_backend.domain.model.player_profile import PlayerProfile

if TYPE_CHECKING:
    from shoot4fun_backend.container import Container

__all__ = ["build_router", "session_token_of"]

SESSION_HEADER = "X-S4F-Session"
_TOO_MANY = "too many attempts, try again shortly"


def session_token_of(request: Request) -> str | None:
    """The presented session token, from either accepted carrier."""
    header = request.headers.get(SESSION_HEADER)
    if header:
        return header.strip()
    authorization = request.headers.get("Authorization", "")
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


def _view(account: Account) -> AccountView:
    return AccountView(
        user_id=account.user_id,
        display_name=account.display_name,
        registered=account.registered,
    )


def _profile_view(profile: PlayerProfile) -> ProfileView:
    return ProfileView(
        sensitivity=profile.sensitivity,
        touch_sensitivity=profile.touch_sensitivity,
        master_volume=profile.master_volume,
        sfx_volume=profile.sfx_volume,
        haptics_enabled=profile.haptics_enabled,
    )


def _budget_key(display_name: str) -> str:
    """Derived through the lookup's own normalisation, so a respelling cannot
    buy a fresh bucket. Total: this runs before any validation."""
    try:
        return f"name:{normalize_display_name(display_name).casefold()}"
    except ValueError:
        return f"raw:{str(display_name or '')[:64].strip().casefold()}"


def build_router(container: Container) -> APIRouter:
    router = APIRouter()

    async def _require_user(request: Request) -> str:
        service: AccountService = container.account_service()
        user_id = await service.resolve_session(session_token_of(request))
        if user_id is None:
            raise HTTPException(status_code=401, detail="not signed in")
        return user_id

    @router.post("/account/guest", status_code=201)
    async def start_guest() -> SessionView:
        """Entry. A guest is an account, minted server-side with its session."""
        service: AccountService = container.account_service()
        created = await service.start_guest()
        return SessionView(**_view(created.account).model_dump(), token=created.token)

    @router.get("/account/me")
    async def me(request: Request) -> AccountView:
        service: AccountService = container.account_service()
        account = await service.get(await _require_user(request))
        if account is None:
            raise HTTPException(status_code=401, detail="not signed in")
        return _view(account)

    @router.post("/account/register")
    async def register(request: Request, body: RegisterRequest) -> MintedView:
        """Name this account and hand over its recovery code, once.

        Registering an account that already holds a code renames it and returns
        no code: the reply carries an empty string rather than a fresh secret.
        """
        service: AccountService = container.account_service()
        user_id = await _require_user(request)
        try:
            minted = await service.register(user_id, body.display_name)
        except DisplayNameTakenError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return MintedView(
            **_view(minted.account).model_dump(),
            token=session_token_of(request) or "",
            recovery_code=minted.recovery_code,
        )

    @router.post("/account/sign-in")
    async def sign_in(body: SignInRequest) -> SessionView:
        service: AccountService = container.account_service()
        budget = container.guess_budget()
        key = _budget_key(body.display_name)
        if not budget.check(key):
            raise HTTPException(status_code=429, detail=_TOO_MANY)
        try:
            session = await service.sign_in(body.display_name, body.recovery_code)
        except AuthenticationFailedError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        budget.clear(key)
        return SessionView(**_view(session.account).model_dump(), token=session.token)

    @router.post("/account/rotate")
    async def rotate(request: Request, body: RotateRequest) -> MintedView:
        """Mint a replacement recovery code on proof of the current one. Every
        existing session dies, so the caller gets a fresh one to stay signed in
        on this device."""
        service: AccountService = container.account_service()
        user_id = await _require_user(request)
        budget = container.guess_budget()
        key = f"rotate:{user_id}"
        if not budget.check(key):
            raise HTTPException(status_code=429, detail=_TOO_MANY)
        try:
            minted = await service.rotate_recovery_code(user_id, body.current_code)
        except AuthenticationFailedError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        budget.clear(key)
        return MintedView(
            **_view(minted.account).model_dump(),
            token=minted.token,
            recovery_code=minted.recovery_code,
        )

    @router.post("/account/sign-out", status_code=204)
    async def sign_out(request: Request) -> None:
        """Revoke this session server-side. Discarding the token client-side
        leaves the row valid until it is deleted, which is not a sign-out."""
        service: AccountService = container.account_service()
        token = session_token_of(request)
        if token:
            await service.sign_out(token)

    @router.get("/account/profile")
    async def get_profile(request: Request) -> ProfileView:
        service: AccountService = container.account_service()
        return _profile_view(await service.get_profile(await _require_user(request)))

    @router.put("/account/profile")
    async def put_profile(request: Request, body: ProfileView) -> ProfileView:
        service: AccountService = container.account_service()
        user_id = await _require_user(request)
        saved = await service.save_profile(
            user_id,
            PlayerProfile(
                sensitivity=body.sensitivity,
                touch_sensitivity=body.touch_sensitivity,
                master_volume=body.master_volume,
                sfx_volume=body.sfx_volume,
                haptics_enabled=body.haptics_enabled,
            ),
        )
        return _profile_view(saved)

    return router
