"""Domain model barrel."""
from __future__ import annotations

from shoot4fun_backend.domain.constants import (
    MAX_PLAYER_HP,
    PLAYER_EYE_HEIGHT,
    PLAYER_HEIGHT,
    PLAYER_RADIUS,
)
from shoot4fun_backend.domain.model.arena import (
    ARENA_ATRIUM,
    ARENA_SANDBOX,
    DEFAULT_ARENAS,
    Arena,
    CoverBox,
)
from shoot4fun_backend.domain.model.hitscan import (
    BULLET_RANGE,
    HEADSHOT_MULTIPLIER,
    HitResult,
)
from shoot4fun_backend.domain.model.input_frame import InputFrame
from shoot4fun_backend.domain.model.kill_counter import KillCounter
from shoot4fun_backend.domain.model.leaderboard_entry import LeaderboardEntry
from shoot4fun_backend.domain.model.match_room import (
    MATCH_DURATION_SECONDS,
    MAX_REWIND_TICKS,
    ROOM_CAPACITY,
    SIM_TICK_HZ,
    SNAPSHOT_HZ,
    FireOutcome,
    MatchRoom,
)
from shoot4fun_backend.domain.model.match_state import MatchState
from shoot4fun_backend.domain.model.match_state_machine import (
    ALLOWED_TRANSITIONS,
    MatchStateMachine,
)
from shoot4fun_backend.domain.model.movement import (
    MAX_FRAME_DT,
    MOVE_SPEED,
    PITCH_LIMIT,
)
from shoot4fun_backend.domain.model.player import MAX_SIM_BUDGET_SECONDS, Player
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
    "BULLET_RANGE",
    "DEFAULT_ARENAS",
    "DEFAULT_WEAPONS",
    "HEADSHOT_MULTIPLIER",
    "MATCH_DURATION_SECONDS",
    "MAX_FRAME_DT",
    "MAX_PLAYER_HP",
    "MAX_REWIND_TICKS",
    "MAX_SIM_BUDGET_SECONDS",
    "MOVE_SPEED",
    "PITCH_LIMIT",
    "PLAYER_EYE_HEIGHT",
    "PLAYER_HEIGHT",
    "PLAYER_RADIUS",
    "RESPAWN_SECONDS",
    "ROOM_CAPACITY",
    "SIM_TICK_HZ",
    "SNAPSHOT_HZ",
    "WEAPON_RIFLE",
    "WEAPON_SMG",
    "Arena",
    "CoverBox",
    "FireOutcome",
    "HitResult",
    "InputFrame",
    "KillCounter",
    "LeaderboardEntry",
    "MatchRoom",
    "MatchState",
    "MatchStateMachine",
    "Player",
    "PlayerHealth",
    "Vec3",
    "Weapon",
]
