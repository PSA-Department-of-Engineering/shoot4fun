"""Player aggregate.

The player's server-side identity and every quantity a client is not
trusted to author: position, hit points, ammunition, and how much
simulated time the player is owed.

Position is computed by the server from the player's intent
(`ADR-0003`); the client's own message never carries one. Look angles
are the deliberate exception, adopted as sent, because a lie about
where you are looking costs the liar nothing: the server still decides
what that look hits (`hitscan`).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from shoot4fun_backend.domain.constants import MAX_PLAYER_HP
from shoot4fun_backend.domain.model.player_health import PlayerHealth
from shoot4fun_backend.domain.model.vec3 import Vec3
from shoot4fun_backend.domain.model.weapon import DEFAULT_WEAPONS, WEAPON_RIFLE, Weapon

__all__ = ["MAX_SIM_BUDGET_SECONDS", "Player"]


MAX_SIM_BUDGET_SECONDS: float = 0.25
"""Ceiling on banked simulation time.

A player accrues the right to simulate at real time and no faster. The
ceiling lets a client that stalled briefly catch up in one burst, and
stops it banking a stall into a sprint. Without this, per-frame `dt`
clamping alone is not a speed guard: a client can send legal short
frames as fast as it likes.
"""


@dataclass(slots=True)
class Player:
    id: str
    name: str
    position: Vec3
    yaw: float
    pitch: float
    health: PlayerHealth = field(
        default_factory=lambda: PlayerHealth(max=MAX_PLAYER_HP)
    )
    kills: int = 0
    deaths: int = 0
    is_ready: bool = False
    team: int = 1
    equipped_weapon: str = WEAPON_RIFLE.id
    ammo: int = WEAPON_RIFLE.magazine_size
    last_fire_at: float = 0.0
    reload_ends_at: float | None = None
    last_input_seq: int = 0
    sim_budget: float = 0.0

    @staticmethod
    def new(name: str, position: Vec3, team: int = 1) -> Player:
        return Player(
            id=str(uuid.uuid4()),
            name=name,
            position=position,
            yaw=0.0,
            pitch=0.0,
            team=team,
        )

    @property
    def weapon(self) -> Weapon:
        return DEFAULT_WEAPONS.get(self.equipped_weapon, WEAPON_RIFLE)

    @property
    def is_reloading(self) -> bool:
        return self.reload_ends_at is not None

    def credit_simulation_time(self, dt: float) -> None:
        """Accrue the right to simulate `dt` seconds, up to the ceiling."""
        self.sim_budget = min(MAX_SIM_BUDGET_SECONDS, self.sim_budget + dt)

    def grant_simulation_time(self, requested: float) -> float:
        """Spend budget for one input frame; returns what may be simulated."""
        if requested <= 0.0:
            return 0.0
        granted = min(requested, self.sim_budget)
        if granted <= 0.0:
            return 0.0
        self.sim_budget -= granted
        return granted

    def can_fire(self, now: float) -> bool:
        if not self.health.is_alive or self.is_reloading or self.ammo <= 0:
            return False
        return (now - self.last_fire_at) >= (1.0 / self.weapon.rate_of_fire)

    def consume_shot(self, now: float) -> None:
        """Spend a round; an emptied magazine starts reloading itself."""
        self.ammo -= 1
        self.last_fire_at = now
        if self.ammo <= 0:
            self.begin_reload(now)

    def begin_reload(self, now: float) -> None:
        if self.is_reloading or self.ammo >= self.weapon.magazine_size:
            return
        self.reload_ends_at = now + self.weapon.reload_time

    def advance_reload(self, now: float) -> None:
        if self.reload_ends_at is not None and now >= self.reload_ends_at:
            self.ammo = self.weapon.magazine_size
            self.reload_ends_at = None

    def equip(self, weapon_id: str, now: float) -> None:
        """Switch weapons, which cancels a reload and refills the magazine.

        One magazine counter serves whichever weapon is held rather than
        tracking ammunition per weapon: the match is short and the
        reload is the pacing mechanism, so per-weapon reserves would add
        state the game never reads.
        """
        if weapon_id not in DEFAULT_WEAPONS or weapon_id == self.equipped_weapon:
            return
        self.equipped_weapon = weapon_id
        self.ammo = self.weapon.magazine_size
        self.reload_ends_at = None
        self.last_fire_at = now

    def reset_for_spawn(self, position: Vec3) -> None:
        """Place the player at a spawn point with a full magazine."""
        self.position = position
        self.ammo = self.weapon.magazine_size
        self.reload_ends_at = None
        self.sim_budget = 0.0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "position": self.position.to_dict(),
            "yaw": self.yaw,
            "pitch": self.pitch,
            "hp": self.health.current,
            "max_hp": self.health.max,
            "is_alive": self.health.is_alive,
            "respawn_in": self.health.respawn_remaining,
            "kills": self.kills,
            "deaths": self.deaths,
            "is_ready": self.is_ready,
            "team": self.team,
            "equipped_weapon": self.equipped_weapon,
            "ammo": self.ammo,
            "magazine_size": self.weapon.magazine_size,
            "is_reloading": self.is_reloading,
            "last_input_seq": self.last_input_seq,
        }
