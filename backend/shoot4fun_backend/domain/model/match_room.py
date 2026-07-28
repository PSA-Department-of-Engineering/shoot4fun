"""Match room aggregate.

The room is the unit of state: it owns its players, the match state,
the kill counter, the timer, the selected map. All mutations go through
the methods here; the application services wrap them with concurrency
control (asyncio.Lock) and persistence.

Capacity is 4 (`NET-001`); the 5th joiner is rejected with `RoomFullError`.
State transitions go through `MatchStateMachine`; `set_ready` is a no-op
outside the lobby; `apply_input` is a no-op outside the playing state
(`INT-011` HP-only-in-playing invariant).
"""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field

from shoot4fun_backend.domain.exceptions.entity_not_found_error import EntityNotFoundError
from shoot4fun_backend.domain.exceptions.room_full_error import RoomFullError
from shoot4fun_backend.domain.model.arena import DEFAULT_ARENAS, Arena
from shoot4fun_backend.domain.model.kill_counter import KillCounter
from shoot4fun_backend.domain.model.match_state import MatchState
from shoot4fun_backend.domain.model.match_state_machine import MatchStateMachine
from shoot4fun_backend.domain.model.player import Player
from shoot4fun_backend.domain.model.vec3 import Vec3

__all__ = [
    "MATCH_DURATION_SECONDS",
    "ROOM_CAPACITY",
    "TICK_RATE_HZ",
    "MatchRoom",
]


MATCH_DURATION_SECONDS: float = 480.0
ROOM_CAPACITY: int = 4
TICK_RATE_HZ: int = 20


@dataclass(slots=True)
class MatchRoom:
    id: str
    arena: Arena
    state: MatchState = MatchState.LOBBY
    players: dict[str, Player] = field(default_factory=dict)
    kills: KillCounter = field(default_factory=KillCounter)
    host_id: str = ""
    started_at: float | None = None
    ends_at: float | None = None

    @staticmethod
    def new(arena_id: str = "sandbox", room_id: str | None = None) -> MatchRoom:
        arena = DEFAULT_ARENAS.get(arena_id, DEFAULT_ARENAS["sandbox"])
        return MatchRoom(
            id=room_id or MatchRoom._generate_room_id(),
            arena=arena,
        )

    @staticmethod
    def _generate_room_id() -> str:
        return uuid.uuid4().hex[:6].upper()

    def add_player(self, name: str) -> Player:
        if len(self.players) >= ROOM_CAPACITY:
            raise RoomFullError(self.id, ROOM_CAPACITY)
        spawn = self.arena.spawn_points[len(self.players) % len(self.arena.spawn_points)]
        team = 1 if len(self.players) % 2 == 0 else 2
        player = Player.new(name=name, position=spawn, team=team)
        if not self.host_id:
            self.host_id = player.id
        self.players[player.id] = player
        return player

    def remove_player(self, player_id: str) -> None:
        self.players.pop(player_id, None)
        if self.host_id == player_id and self.players:
            self.host_id = next(iter(self.players))

    def get_player(self, player_id: str) -> Player:
        player = self.players.get(player_id)
        if player is None:
            raise EntityNotFoundError("Player", player_id)
        return player

    def set_ready(self, player_id: str, ready: bool) -> None:
        if self.state is not MatchState.LOBBY:
            return
        self.get_player(player_id).is_ready = ready

    def all_ready(self) -> bool:
        if not self.players:
            return False
        return all(p.is_ready for p in self.players.values())

    def start(self) -> None:
        MatchStateMachine.assert_transition(self.state, MatchState.PLAYING)
        if not self.all_ready():
            return
        self.state = MatchState.PLAYING
        now = time.monotonic()
        self.started_at = now
        self.ends_at = now + MATCH_DURATION_SECONDS
        for p in self.players.values():
            p.is_ready = False

    def end(self) -> None:
        MatchStateMachine.assert_transition(self.state, MatchState.RESULTS)
        self.state = MatchState.RESULTS

    def reset(self) -> None:
        MatchStateMachine.assert_transition(self.state, MatchState.LOBBY)
        self.state = MatchState.LOBBY
        self.started_at = None
        self.ends_at = None
        self.kills = KillCounter()
        for p in self.players.values():
            p.kills = 0
            p.deaths = 0
            p.is_ready = False
            p.health.respawn()
            spawn = self.arena.spawn_points[
                list(self.players).index(p.id) % len(self.arena.spawn_points)
            ]
            p.position = spawn
            p.yaw = 0.0
            p.pitch = 0.0

    def apply_input(
        self,
        player_id: str,
        move: Vec3,
        look: tuple[float, float],
    ) -> None:
        if self.state is not MatchState.PLAYING:
            return
        player = self.get_player(player_id)
        if not player.health.is_alive:
            return
        player.position = player.position.add(move)
        player.yaw = look[0]
        player.pitch = look[1]

    def record_kill(self, killer_id: str) -> None:
        if self.state is not MatchState.PLAYING:
            return
        self.kills.record_kill(killer_id)
        self.get_player(killer_id).kills += 1

    def record_death(self, victim_id: str) -> None:
        if self.state is not MatchState.PLAYING:
            return
        self.get_player(victim_id).deaths += 1

    def advance(self, dt: float) -> None:
        for p in self.players.values():
            p.health.advance(dt)
        if (
            self.state is MatchState.PLAYING
            and self.ends_at is not None
            and time.monotonic() >= self.ends_at
        ):
            self.end()

    def snapshot(self) -> dict:
        return {
            "id": self.id,
            "arena": self.arena.to_dict(),
            "state": self.state.value,
            "host_id": self.host_id,
            "players": [p.to_dict() for p in self.players.values()],
            "kills": self.kills.totals,
            "winner": self.kills.winner(),
            "time_remaining": (
                max(0.0, self.ends_at - time.monotonic())
                if self.state is MatchState.PLAYING and self.ends_at is not None
                else None
            ),
        }
