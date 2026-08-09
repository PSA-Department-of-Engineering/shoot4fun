"""Match room aggregate: the unit of simulated state.

The room owns its players, the arena, the match state, the kill
counter, the timer, and the tick. Every mutation goes through the
methods here; the application service wraps them with concurrency
control and carries the results to the network edge.

The room is where the three pieces of `ADR-0003` meet:

* `apply_input` turns one frame of intent into a committed position,
  spending the player's simulation budget and running the shared
  `movement` routine, then separating players the routine cannot see.
* `fire` resolves a shot against the world the shooter was actually
  looking at, rewound from the tick history to the tick they had drawn.
* `advance` runs the clock: reloads finish, respawn timers run down and
  place the dead back on a spawn point, and the match ends on time.

Capacity is 4 (`NET-001`); the 5th joiner is rejected with
`RoomFullError`. State transitions go through `MatchStateMachine`;
`set_ready` is a no-op outside the lobby, and input is a no-op outside
the playing state.
"""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field, replace

from shoot4fun_backend.domain.constants import PLAYER_RADIUS
from shoot4fun_backend.domain.exceptions.entity_not_found_error import (
    EntityNotFoundError,
)
from shoot4fun_backend.domain.exceptions.room_full_error import RoomFullError
from shoot4fun_backend.domain.model.arena import DEFAULT_ARENAS, Arena
from shoot4fun_backend.domain.model.hitscan import (
    HEADSHOT_MULTIPLIER,
    TargetGeom,
    eye_of,
    look_direction,
    resolve,
)
from shoot4fun_backend.domain.model.input_frame import InputFrame
from shoot4fun_backend.domain.model.kill_counter import KillCounter
from shoot4fun_backend.domain.model.match_state import MatchState
from shoot4fun_backend.domain.model.match_state_machine import MatchStateMachine
from shoot4fun_backend.domain.model.movement import GROUND_Y, PITCH_LIMIT, MoveState, step
from shoot4fun_backend.domain.model.player import Player
from shoot4fun_backend.domain.model.vec3 import Vec3

__all__ = [
    "MATCH_DURATION_SECONDS",
    "MAX_REWIND_TICKS",
    "ROOM_CAPACITY",
    "SIM_TICK_HZ",
    "SNAPSHOT_HZ",
    "FireOutcome",
    "MatchRoom",
]


MATCH_DURATION_SECONDS: float = 480.0
ROOM_CAPACITY: int = 4

SIM_TICK_HZ: int = 60
"""Simulation rate. Governs correctness: collision resolution and hit
timing are only as fine as this."""

SNAPSHOT_HZ: int = 20
"""Broadcast rate. Governs bandwidth. Deliberately independent of
`SIM_TICK_HZ`, so neither is hostage to the other (`ADR-0003`)."""

HISTORY_TICKS: int = SIM_TICK_HZ
"""One second of position history, the window lag compensation reads."""

MAX_REWIND_TICKS: int = SIM_TICK_HZ // 2
"""Furthest back a shot may be resolved. A client claiming to have been
viewing an older world than this is clamped to the limit, which bounds
what a forged `ack_tick` can buy."""


@dataclass(frozen=True, slots=True)
class FireOutcome:
    shooter_id: str
    victim_id: str | None
    damage: int
    is_headshot: bool
    killed: bool
    point: Vec3 | None

    @property
    def hit(self) -> bool:
        return self.victim_id is not None


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
    tick: int = 0
    _history: dict[int, dict[str, TargetGeom]] = field(default_factory=dict)

    @staticmethod
    def new(arena_id: str = "sandbox", room_id: str | None = None) -> MatchRoom:
        arena = DEFAULT_ARENAS.get(arena_id, DEFAULT_ARENAS["sandbox"])
        return MatchRoom(id=room_id or MatchRoom._generate_room_id(), arena=arena)

    @staticmethod
    def _generate_room_id() -> str:
        return uuid.uuid4().hex[:6].upper()

    # ---------------------------------------------------------------- lobby

    def add_player(self, name: str) -> Player:
        if len(self.players) >= ROOM_CAPACITY:
            raise RoomFullError(self.id, ROOM_CAPACITY)
        team = 1 if len(self.players) % 2 == 0 else 2
        player = Player.new(name=name, position=Vec3.zero(), team=team)
        player.reset_for_spawn(self._spawn_point_for(player.id))
        if not self.host_id:
            self.host_id = player.id
        self.players[player.id] = player
        return player

    def remove_player(self, player_id: str) -> None:
        self.players.pop(player_id, None)
        for positions in self._history.values():
            positions.pop(player_id, None)
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

    def select_arena(self, arena_id: str) -> bool:
        """Choose the map. Lobby only, and only a map that exists."""
        if self.state is not MatchState.LOBBY:
            return False
        arena = DEFAULT_ARENAS.get(arena_id)
        if arena is None or arena.id == self.arena.id:
            return False
        self.arena = arena
        for player in self.players.values():
            player.reset_for_spawn(self._spawn_point_for(player.id))
        return True

    # ------------------------------------------------------------ lifecycle

    def start(self) -> None:
        MatchStateMachine.assert_transition(self.state, MatchState.PLAYING)
        if not self.all_ready():
            return
        self.state = MatchState.PLAYING
        now = time.monotonic()
        self.started_at = now
        self.ends_at = now + MATCH_DURATION_SECONDS
        self.tick = 0
        self._history.clear()
        for player in self.players.values():
            player.is_ready = False
            player.health.respawn()
            player.reset_for_spawn(self._spawn_point_for(player.id))

    def end(self) -> None:
        MatchStateMachine.assert_transition(self.state, MatchState.RESULTS)
        self.state = MatchState.RESULTS

    def reset(self) -> None:
        MatchStateMachine.assert_transition(self.state, MatchState.LOBBY)
        self.state = MatchState.LOBBY
        self.started_at = None
        self.ends_at = None
        self.kills = KillCounter()
        self.tick = 0
        self._history.clear()
        for player in self.players.values():
            player.kills = 0
            player.deaths = 0
            player.is_ready = False
            player.health.respawn()
            player.yaw = 0.0
            player.pitch = 0.0
            player.reset_for_spawn(self._spawn_point_for(player.id))

    # ------------------------------------------------------------ simulation

    def apply_input(self, player_id: str, frame: InputFrame) -> None:
        """Commit one frame of intent to the world.

        Look angles are adopted as sent; position is computed. A frame
        the player has no budget for moves them no distance, which is
        what makes a flood of frames worthless.
        """
        if self.state is not MatchState.PLAYING:
            return
        player = self.players.get(player_id)
        if player is None:
            return

        player.last_input_seq = frame.seq
        player.yaw = frame.yaw
        player.pitch = _clamp_pitch(frame.pitch)
        if not player.health.is_alive:
            return

        granted = player.grant_simulation_time(frame.dt)
        if granted <= 0.0:
            return
        moved = step(
            MoveState(player.position, player.vy),
            replace(frame, dt=granted),
            self.arena,
        )
        player.vy = moved.vy
        # Crouch is the grounded stance the routine settled on: a player
        # in the air is never crouched, whatever the button says.
        grounded = moved.position.y <= GROUND_Y + 1e-9 and moved.vy <= 0.0
        player.crouching = bool(frame.crouch) and grounded
        player.position = self._separate(player_id, moved.position)

    def _separate(self, player_id: str, position: Vec3) -> Vec3:
        """Push a player out of any living player they overlap.

        Server-only: the client cannot predict this reliably and does
        not try (`ADR-0004`). Iteration order is the room's insertion
        order, so the result is deterministic.
        """
        minimum = PLAYER_RADIUS * 2.0
        x, z = position.x, position.z
        for other_id, other in self.players.items():
            if other_id == player_id or not other.health.is_alive:
                continue
            dx = x - other.position.x
            dz = z - other.position.z
            distance_squared = dx * dx + dz * dz
            if distance_squared >= minimum * minimum:
                continue
            if distance_squared < 1e-12:
                # Exactly coincident: pick a fixed axis rather than
                # dividing by zero, so the outcome stays deterministic.
                x = other.position.x + minimum
                continue
            distance = distance_squared**0.5
            push = (minimum - distance) / distance
            x += dx * push
            z += dz * push
        x, z = _clamp_inside(x, z, self.arena)
        return Vec3(x, position.y, z)

    def fire(self, player_id: str, frame: InputFrame) -> FireOutcome | None:
        """Resolve one shot, or None if the player could not shoot.

        The world is rewound to the tick the shooter had drawn, so a
        player who shot what they saw hits it even though the target has
        moved on by the time the frame arrives.
        """
        if self.state is not MatchState.PLAYING:
            return None
        shooter = self.players.get(player_id)
        if shooter is None:
            return None
        now = time.monotonic()
        if not shooter.can_fire(now):
            return None
        shooter.consume_shot(now)

        origin = eye_of(shooter.position, shooter.eye_height)
        direction = look_direction(shooter.yaw, _clamp_pitch(frame.pitch))
        targets = self._targets_at(frame.ack_tick, exclude=player_id)
        hit = resolve(origin, direction, targets, self.arena)
        if hit is None:
            return FireOutcome(player_id, None, 0, False, False, None)

        victim = self.players[hit.target_id]
        damage = shooter.weapon.damage
        if hit.is_headshot:
            damage = int(damage * HEADSHOT_MULTIPLIER)
        victim.health.damage(damage)

        killed = not victim.health.is_alive
        if killed:
            self.record_death(victim.id)
            self.record_kill(player_id)
        return FireOutcome(
            shooter_id=player_id,
            victim_id=victim.id,
            damage=damage,
            is_headshot=hit.is_headshot,
            killed=killed,
            point=hit.point,
        )

    def _targets_at(self, ack_tick: int, exclude: str) -> dict[str, TargetGeom]:
        """Living players' capsules as of the shooter's view tick.

        Each carries the feet and the capsule height the target had at
        that tick, so a player who was crouched when the shooter drew is
        rewound as the shorter body they saw (issue #10).
        """
        oldest = self.tick - MAX_REWIND_TICKS
        wanted = self.tick if ack_tick <= 0 else ack_tick
        if wanted > self.tick:
            wanted = self.tick
        if wanted < oldest:
            wanted = oldest
        past = self._history.get(wanted, {})
        return {
            pid: past.get(pid, TargetGeom(player.position, player.capsule_height))
            for pid, player in self.players.items()
            if pid != exclude and player.health.is_alive
        }

    def advance(self, dt: float, now: float | None = None) -> list[str]:
        """Run the clock one tick. Returns the ids that respawned."""
        moment = time.monotonic() if now is None else now
        self.tick += 1
        respawned: list[str] = []
        for player in self.players.values():
            player.credit_simulation_time(dt)
            player.advance_reload(moment)
            was_dead = not player.health.is_alive
            player.health.advance(dt)
            if was_dead and player.health.is_alive:
                player.reset_for_spawn(self._spawn_point_for(player.id))
                respawned.append(player.id)
        self._record_history()
        if (
            self.state is MatchState.PLAYING
            and self.ends_at is not None
            and moment >= self.ends_at
        ):
            self.end()
        return respawned

    def _record_history(self) -> None:
        self._history[self.tick] = {
            pid: TargetGeom(p.position, p.capsule_height)
            for pid, p in self.players.items()
        }
        stale = self.tick - HISTORY_TICKS
        self._history.pop(stale, None)

    def _spawn_point_for(self, player_id: str) -> Vec3:
        """The spawn point furthest from every living player.

        Respawning where you died feeds spawn camping, so placement is
        a decision rather than a default. Ties break on the arena's own
        ordering, so the choice is deterministic.
        """
        spawns = self.arena.spawn_points
        if not spawns:
            return Vec3.zero()
        occupied = [
            p.position
            for pid, p in self.players.items()
            if pid != player_id and p.health.is_alive
        ]
        if not occupied:
            index = len(self.players) % len(spawns)
            return spawns[index]

        best = spawns[0]
        best_distance = -1.0
        for spawn in spawns:
            nearest = min(
                (spawn.x - o.x) ** 2 + (spawn.z - o.z) ** 2 for o in occupied
            )
            if nearest > best_distance:
                best_distance = nearest
                best = spawn
        return best

    # -------------------------------------------------------------- scoring

    def record_kill(self, killer_id: str) -> None:
        if self.state is not MatchState.PLAYING:
            return
        self.kills.record_kill(killer_id)
        self.get_player(killer_id).kills += 1

    def record_death(self, victim_id: str) -> None:
        if self.state is not MatchState.PLAYING:
            return
        self.get_player(victim_id).deaths += 1

    def snapshot(self) -> dict:
        return {
            "id": self.id,
            "arena": self.arena.to_dict(),
            "state": self.state.value,
            "host_id": self.host_id,
            "tick": self.tick,
            "players": [p.to_dict() for p in self.players.values()],
            "kills": self.kills.totals,
            "winner": self.kills.winner(),
            "time_remaining": (
                max(0.0, self.ends_at - time.monotonic())
                if self.state is MatchState.PLAYING and self.ends_at is not None
                else None
            ),
        }


def _clamp_pitch(pitch: float) -> float:
    if pitch > PITCH_LIMIT:
        return PITCH_LIMIT
    if pitch < -PITCH_LIMIT:
        return -PITCH_LIMIT
    return pitch


def _clamp_inside(x: float, z: float, arena: Arena) -> tuple[float, float]:
    min_x = arena.bounds_min.x + PLAYER_RADIUS
    max_x = arena.bounds_max.x - PLAYER_RADIUS
    min_z = arena.bounds_min.z + PLAYER_RADIUS
    max_z = arena.bounds_max.z - PLAYER_RADIUS
    return (
        min(max(x, min_x), max_x),
        min(max(z, min_z), max_z),
    )
