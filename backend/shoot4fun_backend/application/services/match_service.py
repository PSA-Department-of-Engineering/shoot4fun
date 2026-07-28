"""The match orchestrator.

Owns the rooms, the per-room `asyncio.Lock` (concurrent access from the
WebSocket router and the tick loop), the broadcaster, and the
leaderboard. Every method is the entry point the inbound adapters call.

Concurrency model:

* The `tick_all` task runs on a `asyncio.create_task` background loop.
* Each WebSocket message handler awaits the room's `asyncio.Lock` before
  mutating room state, then drops the lock before awaiting any I/O.
* The `Broadcaster` is the boundary that carries the locked-snapshot
  state to the network edge.

State machine guards are enforced at the use case layer (the
`MatchStateMachine` in the domain is the declarative table; this layer
is the chokepoint).
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
from shoot4fun_backend.domain.model.match_room import (
    TICK_RATE_HZ,
    MatchRoom,
)
from shoot4fun_backend.domain.model.match_state import MatchState
from shoot4fun_backend.domain.model.vec3 import Vec3
from shoot4fun_backend.logging import get_logger

__all__ = ["MatchService"]


_log = get_logger("match_service")


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

    async def connect(
        self, room_id: str, player_name: str
    ) -> tuple[str, dict]:
        lock = self._lock_for(room_id)
        async with lock:
            room = self.rooms.get(room_id)
            if room is None:
                room = MatchRoom.new(room_id=room_id)
                self.rooms.save(room)
            player = room.add_player(player_name)
            snapshot = room.snapshot()
        await self.broadcaster.send_to_room(
            room.id,
            {
                "type": "player_joined",
                "player": player.to_dict(),
            },
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
        async with lock:
            room = self.rooms.get(room_id)
            if room is None:
                return
            room.remove_player(player_id)
            if not room.players:
                self.rooms.delete(room.id)
        await self.broadcaster.send_to_room(
            room_id,
            {"type": "player_left", "player_id": player_id},
        )
        self.broadcaster.unbind(player_id)
        _log.info("player_disconnected room=%s player=%s", room_id, player_id)

    async def handle_message(
        self, room_id: str, player_id: str, msg: dict
    ) -> None:
        msg_type = msg.get("type")
        lock = self._lock_for(room_id)
        if msg_type == "set_ready":
            async with lock:
                room = self.rooms.get(room_id)
                if room is None:
                    return
                room.set_ready(player_id, bool(msg.get("ready", False)))
                snapshot = room.snapshot()
            await self.broadcaster.send_to_room(
                room.id, {"type": "lobby_state", "room": snapshot}
            )
        elif msg_type == "start_match":
            async with lock:
                room = self.rooms.get(room_id)
                if room is None or room.host_id != player_id:
                    return
                if room.state is not MatchState.LOBBY or not room.all_ready():
                    return
                room.start()
                snapshot = room.snapshot()
            await self.broadcaster.send_to_room(
                room.id, {"type": "match_started", "room": snapshot}
            )
        elif msg_type == "rematch":
            async with lock:
                room = self.rooms.get(room_id)
                if room is None or room.host_id != player_id:
                    return
                if room.state is MatchState.RESULTS:
                    room.reset()
                    snapshot = room.snapshot()
                else:
                    return
            await self.broadcaster.send_to_room(
                room.id, {"type": "lobby_state", "room": snapshot}
            )
        elif msg_type == "input":
            move = msg.get("move") or [0.0, 0.0, 0.0]
            look = msg.get("look") or [0.0, 0.0]
            move_vec = Vec3(float(move[0]), float(move[1]), float(move[2]))
            async with lock:
                room = self.rooms.get(room_id)
                if room is None:
                    return
                room.apply_input(
                    player_id, move_vec, (float(look[0]), float(look[1]))
                )
        elif msg_type == "fire":
            await self._handle_fire(room_id, player_id, msg, lock)
        elif msg_type == "switch_weapon":
            async with lock:
                room = self.rooms.get(room_id)
                if room is None:
                    return
                player = room.players.get(player_id)
                if player is None:
                    return
                player.equipped_weapon = str(msg.get("weapon", player.equipped_weapon))
        elif msg_type == "ping":
            await self.broadcaster.send_to(
                player_id, {"type": "pong", "t": time.time()}
            )

    async def _handle_fire(
        self, room_id: str, player_id: str, msg: dict, lock: asyncio.Lock
    ) -> None:
        async with lock:
            room = self.rooms.get(room_id)
            if room is None:
                return
            if room.state is not MatchState.PLAYING:
                return
            # For the MVP a fire is a 1-damage hit; the client supplies
            # the target via a `target` field. Damage is constant here
            # (the real game would resolve a raycast and check cover).
            target_id = msg.get("target")
            if not target_id:
                return
            target = room.players.get(target_id)
            if target is None or not target.health.is_alive:
                return
            target.health.damage(100)
            room.record_death(target.id)
            room.record_kill(player_id)
            if target.health.is_alive is False and target.health.respawn_remaining > 0:
                await self.broadcaster.send_to_room(
                    room.id,
                    {
                        "type": "kill",
                        "killer": player_id,
                        "victim": target.id,
                    },
                )
            if self._is_only_one_alive(room):
                room.end()
                await self.broadcaster.send_to_room(
                    room.id,
                    {"type": "results", "room": room.snapshot()},
                )

    def _is_only_one_alive(self, room: MatchRoom) -> bool:
        alive = [p for p in room.players.values() if p.health.is_alive]
        return len(alive) <= 1 and len(room.players) >= 2

    async def tick_all(self) -> None:
        if self._stopped:
            return
        now = time.monotonic()
        dt = now - self._last_tick if self._last_tick else 1.0 / TICK_RATE_HZ
        self._last_tick = now
        for room in self.rooms.list_all():
            lock = self._lock_for(room.id)
            async with lock:
                room.advance(dt)
                if room.state is MatchState.PLAYING:
                    snapshot = room.snapshot()
                elif room.state is MatchState.RESULTS:
                    snapshot = room.snapshot()
                    await self.broadcaster.send_to_room(
                        room.id, {"type": "results", "room": snapshot}
                    )
                else:
                    continue
            if room.state in (MatchState.PLAYING, MatchState.RESULTS):
                await self.broadcaster.send_to_room(
                    room.id, {"type": "state", "room": snapshot}
                )

    def start_tick(self) -> None:
        if self._tick_task is not None:
            return
        self._last_tick = time.monotonic()
        self._tick_task = asyncio.create_task(self._run_tick())

    async def _run_tick(self) -> None:
        interval = 1.0 / TICK_RATE_HZ
        while not self._stopped:
            try:
                await self.tick_all()
            except Exception:
                _log.exception("tick_all failed")
            await asyncio.sleep(interval)

    async def stop_tick(self) -> None:
        self._stopped = True
        if self._tick_task is not None:
            self._tick_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._tick_task
            self._tick_task = None

    async def get_leaderboard(self, arena: str) -> dict | None:
        entry = await self.leaderboard.get_best(arena)
        if entry is None:
            return None
        return {
            "arena": entry.arena,
            "best_score": entry.best_score,
            "holder_name": entry.holder_name,
            "updated_at": entry.updated_at,
        }

    async def record_match_score(
        self, arena: str, holder_name: str, score: int
    ) -> dict:
        entry = await self.leaderboard.upsert_if_higher(arena, holder_name, score)
        return {
            "arena": entry.arena,
            "best_score": entry.best_score,
            "holder_name": entry.holder_name,
            "updated_at": entry.updated_at,
        }
