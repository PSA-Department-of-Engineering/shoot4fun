"""The match orchestrator.

Owns the rooms, the per-room `asyncio.Lock` (the tick loop and the
WebSocket handlers both mutate room state), the broadcaster, and the
leaderboard. Every method here is an entry point an inbound adapter
calls.

Concurrency model:

* `start_tick` runs the simulation on one background task.
* Every handler takes the room's lock before mutating, and releases it
  before awaiting network I/O, so a slow client never stalls the tick.
* The `Broadcaster` is the only route from locked state to the wire.

Rate model (`ADR-0003`): the simulation advances at `SIM_TICK_HZ` and
the world is broadcast at `SNAPSHOT_HZ`. The two are deliberately
independent, so raising fidelity does not raise bandwidth and lowering
bandwidth does not coarsen collision.
"""
from __future__ import annotations

import asyncio
import contextlib
import time
from dataclasses import dataclass, field

from shoot4fun_backend.application.ports.inbound.match_service_port import (
    MatchServicePort,
)
from shoot4fun_backend.application.ports.outbound.broadcaster import Broadcaster
from shoot4fun_backend.application.ports.outbound.leaderboard_repository import (
    LeaderboardRepository,
)
from shoot4fun_backend.application.ports.outbound.room_repository import RoomRepository
from shoot4fun_backend.domain.model.input_frame import InputFrame
from shoot4fun_backend.domain.model.match_room import (
    SIM_TICK_HZ,
    SNAPSHOT_HZ,
    FireOutcome,
    MatchRoom,
)
from shoot4fun_backend.domain.model.match_state import MatchState
from shoot4fun_backend.logging import get_logger

__all__ = ["MatchService"]


_log = get_logger("match_service")

SNAPSHOT_EVERY: int = max(1, SIM_TICK_HZ // SNAPSHOT_HZ)
"""Simulation ticks between broadcasts."""


@dataclass
class MatchService(MatchServicePort):
    rooms: RoomRepository
    broadcaster: Broadcaster
    leaderboard: LeaderboardRepository
    _locks: dict[str, asyncio.Lock] = field(default_factory=dict)
    _tick_task: asyncio.Task | None = field(default=None, init=False)
    _last_tick: float = field(default=0.0, init=False)
    _stopped: bool = field(default=False, init=False)

    def _lock_for(self, room_id: str) -> asyncio.Lock:
        lock = self._locks.get(room_id)
        if lock is None:
            lock = asyncio.Lock()
            self._locks[room_id] = lock
        return lock

    async def connect(self, room_id: str, player_name: str) -> tuple[str, dict]:
        lock = self._lock_for(room_id)
        async with lock:
            room = self.rooms.get(room_id)
            if room is None:
                room = MatchRoom.new(room_id=room_id)
                self.rooms.save(room)
            player = room.add_player(player_name)
            snapshot = room.snapshot()
        await self.broadcaster.send_to_room(
            room.id, {"type": "player_joined", "player": player.to_dict()}
        )
        _log.info(
            "player_connected room=%s player=%s name=%s",
            room.id,
            player.id,
            player.name,
        )
        return player.id, snapshot

    async def disconnect(self, room_id: str, player_id: str) -> None:
        lock = self._lock_for(room_id)
        lobby_snapshot: dict | None = None
        async with lock:
            room = self.rooms.get(room_id)
            if room is None:
                return
            room.remove_player(player_id)
            if not room.players:
                self.rooms.delete(room.id)
                self._locks.pop(room.id, None)
            elif room.state is MatchState.LOBBY:
                lobby_snapshot = room.snapshot()
        await self.broadcaster.send_to_room(
            room_id, {"type": "player_left", "player_id": player_id}
        )
        # Clients track the room only from snapshot messages, so the
        # remaining lobby is refreshed: otherwise the departed player still
        # counts toward all_ready() on the host's screen and Start reads wrong.
        if lobby_snapshot is not None:
            await self.broadcaster.send_to_room(
                room_id, {"type": "lobby_state", "room": lobby_snapshot}
            )
        self.broadcaster.unbind(player_id)
        _log.info("player_disconnected room=%s player=%s", room_id, player_id)

    async def handle_message(
        self, room_id: str, player_id: str, msg: dict
    ) -> None:
        handler = _HANDLERS.get(msg.get("type"))
        if handler is None:
            return
        await handler(self, room_id, player_id, msg)

    # ------------------------------------------------------------- handlers

    async def _on_input(self, room_id: str, player_id: str, msg: dict) -> None:
        """The hot path: one frame of intent, and the shot it may carry."""
        frame = InputFrame.from_wire(msg)
        outcome: FireOutcome | None = None
        async with self._lock_for(room_id):
            room = self.rooms.get(room_id)
            if room is None:
                return
            room.apply_input(player_id, frame)
            if frame.fire:
                outcome = room.fire(player_id, frame)
        # Nothing in an input frame can end a match: a kill sends the
        # victim to a respawn timer, and the two conditions that do end
        # one (the clock, and the room emptying) are the tick's to spot.
        if outcome is not None:
            await self._announce(room_id, outcome)

    async def _announce(self, room_id: str, outcome: FireOutcome) -> None:
        """Tell the room what a shot did.

        The shooter always learns the result of their own shot, so the
        client can mark a hit without guessing; everyone learns about a
        kill, because the scoreboard and the kill feed are shared.
        """
        if not outcome.hit:
            return
        await self.broadcaster.send_to(
            outcome.shooter_id,
            {
                "type": "hit_confirmed",
                "victim": outcome.victim_id,
                "damage": outcome.damage,
                "headshot": outcome.is_headshot,
                "killed": outcome.killed,
            },
        )
        await self.broadcaster.send_to_room(
            room_id,
            {
                "type": "damage",
                "victim": outcome.victim_id,
                "attacker": outcome.shooter_id,
                "damage": outcome.damage,
                "point": outcome.point.to_dict() if outcome.point else None,
            },
        )
        if outcome.killed:
            await self.broadcaster.send_to_room(
                room_id,
                {
                    "type": "kill",
                    "killer": outcome.shooter_id,
                    "victim": outcome.victim_id,
                    "headshot": outcome.is_headshot,
                },
            )

    async def _on_set_ready(self, room_id: str, player_id: str, msg: dict) -> None:
        async with self._lock_for(room_id):
            room = self.rooms.get(room_id)
            if room is None:
                return
            room.set_ready(player_id, bool(msg.get("ready", False)))
            snapshot = room.snapshot()
        await self.broadcaster.send_to_room(
            room_id, {"type": "lobby_state", "room": snapshot}
        )

    async def _on_select_map(self, room_id: str, player_id: str, msg: dict) -> None:
        async with self._lock_for(room_id):
            room = self.rooms.get(room_id)
            if room is None or room.host_id != player_id:
                return
            if not room.select_arena(str(msg.get("arena", ""))):
                return
            snapshot = room.snapshot()
        await self.broadcaster.send_to_room(
            room_id, {"type": "lobby_state", "room": snapshot}
        )

    async def _on_start_match(self, room_id: str, player_id: str, msg: dict) -> None:
        async with self._lock_for(room_id):
            room = self.rooms.get(room_id)
            if room is None or room.host_id != player_id:
                return
            if room.state is not MatchState.LOBBY or not room.all_ready():
                return
            if len(room.players) < 2:
                return
            room.start()
            snapshot = room.snapshot()
        await self.broadcaster.send_to_room(
            room_id, {"type": "match_started", "room": snapshot}
        )

    async def _on_rematch(self, room_id: str, player_id: str, msg: dict) -> None:
        async with self._lock_for(room_id):
            room = self.rooms.get(room_id)
            if room is None or room.host_id != player_id:
                return
            if room.state is not MatchState.RESULTS:
                return
            room.reset()
            snapshot = room.snapshot()
        await self.broadcaster.send_to_room(
            room_id, {"type": "lobby_state", "room": snapshot}
        )

    async def _on_switch_weapon(
        self, room_id: str, player_id: str, msg: dict
    ) -> None:
        async with self._lock_for(room_id):
            room = self.rooms.get(room_id)
            if room is None:
                return
            player = room.players.get(player_id)
            if player is None:
                return
            player.equip(str(msg.get("weapon", "")), time.monotonic())

    async def _on_reload(self, room_id: str, player_id: str, msg: dict) -> None:
        async with self._lock_for(room_id):
            room = self.rooms.get(room_id)
            if room is None:
                return
            player = room.players.get(player_id)
            if player is None or not player.health.is_alive:
                return
            player.begin_reload(time.monotonic())

    async def _on_ping(self, room_id: str, player_id: str, msg: dict) -> None:
        await self.broadcaster.send_to(
            player_id, {"type": "pong", "t": msg.get("t", 0)}
        )

    # ----------------------------------------------------------------- tick

    async def tick_all(self) -> None:
        if self._stopped:
            return
        now = time.monotonic()
        dt = now - self._last_tick if self._last_tick else 1.0 / SIM_TICK_HZ
        self._last_tick = now

        for room in self.rooms.list_all():
            async with self._lock_for(room.id):
                if room.state is MatchState.LOBBY:
                    continue
                respawned = room.advance(dt, now)
                ended = self._settle_if_over(room)
                due = room.tick % SNAPSHOT_EVERY == 0
                snapshot = room.snapshot() if (due or ended) else None
                state = room.state
            for player_id in respawned:
                await self.broadcaster.send_to_room(
                    room.id, {"type": "respawn", "player_id": player_id}
                )
            if snapshot is None:
                continue
            kind = "results" if state is MatchState.RESULTS else "state"
            await self.broadcaster.send_to_room(
                room.id, {"type": kind, "room": snapshot}
            )

    def _settle_if_over(self, room: MatchRoom) -> bool:
        """End a playing match that no longer holds two players.

        Being dead is not being out. A player at zero hit points has a
        respawn timer running and is coming back on a spawn point
        (`INT-005`), so the question this asks is who remains in the
        room, not who happens to be standing this instant. The match
        ends when someone leaves, and on the clock (`MatchRoom.advance`);
        a kill ends a round of the fight, never the match (`ADR-0005`).
        """
        if room.state is not MatchState.PLAYING:
            return False
        if len(room.players) >= 2:
            return False
        room.end()
        return True

    def start_tick(self) -> None:
        if self._tick_task is not None:
            return
        self._last_tick = time.monotonic()
        self._tick_task = asyncio.create_task(self._run_tick())

    async def _run_tick(self) -> None:
        interval = 1.0 / SIM_TICK_HZ
        while not self._stopped:
            started = time.monotonic()
            try:
                await self.tick_all()
            except Exception:
                _log.exception("tick_all failed")
            # Sleep the remainder of the budget rather than a fixed
            # interval, so a slow tick does not compound into drift.
            elapsed = time.monotonic() - started
            await asyncio.sleep(max(0.0, interval - elapsed))

    async def stop_tick(self) -> None:
        self._stopped = True
        if self._tick_task is not None:
            self._tick_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._tick_task
            self._tick_task = None

    # ---------------------------------------------------------- leaderboard

    async def get_leaderboard(self, arena: str) -> dict | None:
        entry = await self.leaderboard.get_best(arena)
        if entry is None:
            return None
        return _entry_to_dict(entry)

    async def record_match_score(
        self,
        arena: str,
        holder_name: str,
        score: int,
        user_id: str | None = None,
    ) -> dict:
        entry = await self.leaderboard.upsert_if_higher(arena, holder_name, score, user_id)
        return _entry_to_dict(entry)


def _entry_to_dict(entry: object) -> dict:
    return {
        "arena": entry.arena,  # type: ignore[attr-defined]
        "best_score": entry.best_score,  # type: ignore[attr-defined]
        "holder_name": entry.holder_name,  # type: ignore[attr-defined]
        "user_id": entry.user_id,  # type: ignore[attr-defined]
        "updated_at": entry.updated_at,  # type: ignore[attr-defined]
    }


_HANDLERS = {
    "input": MatchService._on_input,
    "set_ready": MatchService._on_set_ready,
    "select_map": MatchService._on_select_map,
    "start_match": MatchService._on_start_match,
    "rematch": MatchService._on_rematch,
    "switch_weapon": MatchService._on_switch_weapon,
    "reload": MatchService._on_reload,
    "ping": MatchService._on_ping,
}
