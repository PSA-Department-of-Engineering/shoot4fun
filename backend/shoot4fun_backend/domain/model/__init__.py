"""Domain model barrel."""
from __future__ import annotations

from shoot4fun_backend.domain.model.arena import (
    ARENA_ATRIUM,
    ARENA_SANDBOX,
    DEFAULT_ARENAS,
    Arena,
    CoverBox,
)
from shoot4fun_backend.domain.model.kill_counter import KillCounter
from shoot4fun_backend.domain.model.leaderboard_entry import LeaderboardEntry
from shoot4fun_backend.domain.model.match_room import (
    MATCH_DURATION_SECONDS,
    ROOM_CAPACITY,
    TICK_RATE_HZ,
    MatchRoom,
)
from shoot4fun_backend.domain.model.match_state import MatchState
from shoot4fun_backend.domain.model.match_state_machine import (
    ALLOWED_TRANSITIONS,
    MatchStateMachine,
)
from shoot4fun_backend.domain.model.player import MAX_PLAYER_HP, PLAYER_RADIUS, Player
from shoot4fun_backend.domain.model.player_health import RESPAWN_SECONDS, PlayerHealth
from shoot4fun_backend.domain.model.vec3 import Vec3
from shoot4fun_backend.domain.model.weapon import (
    DEFAULT_WEAPONS,
    WEAPON_RIFLE,
    WEAPON_SMG,
    Weapon,
)

__all__ = [
    "ALLOWED_TRANSITIONS",
    "ARENA_ATRIUM",
    "ARENA_SANDBOX",
    "DEFAULT_ARENAS",
    "DEFAULT_WEAPONS",
    "Arena",
    "CoverBox",
    "KillCounter",
    "LeaderboardEntry",
    "MATCH_DURATION_SECONDS",
    "MAX_PLAYER_HP",
    "MatchRoom",
    "MatchState",
    "MatchStateMachine",
    "PLAYER_RADIUS",
    "Player",
    "PlayerHealth",
    "RESPAWN_SECONDS",
    "ROOM_CAPACITY",
    "TICK_RATE_HZ",
    "Vec3",
    "WEAPON_RIFLE",
    "WEAPON_SMG",
    "Weapon",
]
