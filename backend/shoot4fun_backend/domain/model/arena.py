"""Arena layout.

A bounded flat ground plane populated with simple cover objects. Three
arenas ship, `sandbox` (`MAP-001`) and `atrium` (`MAP2-002`) for the
multiplayer match, and `aimlabs` (`MAP3-003`), a bare practice range for
the solo aim-training mode (issue #15). The host picks between them from
the lobby, and the solo mode enters `aimlabs` on the client. The server carries the
*server-side* layout (bounds + cover positions) for collision and
respawn; the visual scene is the client's, built from the layout that
arrives over the wire, so the two cannot disagree about the map.

`cover` is a list of axis-aligned boxes (centre + half-extents). The
collision check is `AABB-vs-AABB`; the player-to-player check is a
sphere-vs-sphere at the player's `position` with a fixed `radius`.

Height is the layout's main lever, because `movement` reads a box flat
and `hitscan` reads the same box in full 3D:

* **Waist-high** (`half_y` 0.5 to 0.6, top around 1.1m) shapes routes
  and denies a shot at the legs. It hides nothing standing.
* **Shoulder-high** (`half_y` 0.75, top 1.5m) sits just under the 1.6m
  eye: two players close on either side of it see each other's heads
  and nothing else, so trading over it is a headshot duel.
* **Full** (`half_y` 1.5 and up) breaks the sightline outright. These
  are the walls that make lanes, and everything else is decoration
  hanging off them.

Boxes rest on the ground, so a box's `center.y` equals its `half_y`.
Spawn points stand clear of cover by more than `PLAYER_RADIUS`: a spawn
inside a box would be ejected by the collision resolver on the player's
first frame.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from shoot4fun_backend.domain.model.vec3 import Vec3

__all__ = [
    "Arena",
    "ARENA_SANDBOX",
    "ARENA_ATRIUM",
    "ARENA_AIMLABS",
    "DEFAULT_ARENAS",
]


@dataclass(frozen=True, slots=True)
class CoverBox:
    center: Vec3
    half_x: float
    half_y: float
    half_z: float

    def to_dict(self) -> dict:
        return {
            "center": self.center.to_dict(),
            "half_x": self.half_x,
            "half_y": self.half_y,
            "half_z": self.half_z,
        }


@dataclass(frozen=True, slots=True)
class Arena:
    id: str
    name: str
    bounds_min: Vec3
    bounds_max: Vec3
    cover: tuple[CoverBox, ...] = field(default_factory=tuple)
    spawn_points: tuple[Vec3, ...] = field(default_factory=tuple)
    #: How the map plays, in one line, for the lobby's picker. It sits
    #: here beside the layout it describes so that adding an arena is one
    #: edit: a second list of names and copy on the client would be a
    #: second place to forget.
    blurb: str = ""

    def to_dict(self) -> dict:
        """The layout, as it travels in every room snapshot.

        The blurb is not in it: a snapshot goes out at 20Hz to every
        player, and the lobby's copy is read once from the catalogue.
        """
        return {
            "id": self.id,
            "name": self.name,
            "bounds_min": self.bounds_min.to_dict(),
            "bounds_max": self.bounds_max.to_dict(),
            "cover": [c.to_dict() for c in self.cover],
            "spawn_points": [p.to_dict() for p in self.spawn_points],
        }

    def to_catalogue_entry(self) -> dict:
        """The arena as the lobby's picker offers it."""
        return {"id": self.id, "name": self.name, "blurb": self.blurb}


# Sandbox plays long: a spine of full-height wall splits 60m of ground
# into two halves, crossed at four gaps, and most of a match is an
# argument about which gap. Two quarters of it are built, carrying the
# lanes and the corner pockets; the two on the other diagonal carry
# nothing above eye height, so the shot across the whole map is there
# for anyone willing to stand in the open to take it. The layout is
# symmetric under a half turn, so no corner of it is the good corner.
ARENA_SANDBOX = Arena(
    id="sandbox",
    name="Sandbox",
    blurb="60m of ground split by a spine wall. Long sightlines, four ways through.",
    bounds_min=Vec3(-30.0, 0.0, -30.0),
    bounds_max=Vec3(30.0, 0.0, 30.0),
    cover=(
        # The spine. Four ways through: a wide crossing round each end
        # and an inner gap either side of the narrow centre block.
        CoverBox(Vec3(-17.0, 1.5, 0.0), 5.0, 1.5, 0.7),
        CoverBox(Vec3(0.0, 1.5, 0.0), 1.5, 1.5, 0.7),
        CoverBox(Vec3(17.0, 1.5, 0.0), 5.0, 1.5, 0.7),
        # Two quarters of the map are built and two are open, on
        # opposite diagonals. These are the built ones: a lane wall
        # covering the inner gap, and an outer wall turning the far
        # corner into a pocket rather than the end of a 60m alley.
        CoverBox(Vec3(14.0, 1.5, -8.0), 0.7, 1.5, 6.0),
        CoverBox(Vec3(-14.0, 1.5, 8.0), 0.7, 1.5, 6.0),
        CoverBox(Vec3(22.0, 1.5, -19.0), 0.7, 1.5, 7.0),
        CoverBox(Vec3(-22.0, 1.5, 19.0), 0.7, 1.5, 7.0),
        # Pillars on the outer crossings, so the edge is a way round
        # and not a firing line down the whole side of the map.
        CoverBox(Vec3(27.0, 1.6, -6.0), 2.0, 1.6, 1.5),
        CoverBox(Vec3(-27.0, 1.6, 6.0), 2.0, 1.6, 1.5),
        # The open quarters carry nothing above the eye: crossing them
        # is crossing in view, and the cover in them is there to stop
        # the shot at your legs, not to hide you.
        CoverBox(Vec3(-16.0, 0.75, -13.0), 6.0, 0.75, 0.7),
        CoverBox(Vec3(16.0, 0.75, 13.0), 6.0, 0.75, 0.7),
        CoverBox(Vec3(-4.0, 0.55, -22.0), 3.0, 0.55, 1.5),
        CoverBox(Vec3(4.0, 0.55, 22.0), 3.0, 0.55, 1.5),
        # Blocks either side of the centre block, so the ground in
        # front of the middle is fought over from behind something.
        CoverBox(Vec3(0.0, 0.75, -8.0), 2.5, 0.75, 0.7),
        CoverBox(Vec3(0.0, 0.75, 8.0), 2.5, 0.75, 0.7),
        CoverBox(Vec3(8.0, 0.75, -19.0), 2.0, 0.75, 2.0),
        CoverBox(Vec3(-8.0, 0.75, 19.0), 2.0, 0.75, 2.0),
        # Waist-high inside each corner pocket, so holding one is
        # standing behind something rather than standing in a corner.
        CoverBox(Vec3(18.0, 0.55, -22.0), 1.5, 0.55, 1.5),
        CoverBox(Vec3(-18.0, 0.55, 22.0), 1.5, 0.55, 1.5),
    ),
    # The two deepest spawns look down the long diagonal at the centre
    # block, which is 3m of wall on a 60m line: the duel is there to be
    # had, and it opens the moment either of them steps off the spawn.
    spawn_points=(
        Vec3(-23.0, 0.0, -19.0),
        Vec3(2.0, 0.0, -25.0),
        Vec3(26.0, 0.0, -11.0),
        Vec3(23.0, 0.0, 19.0),
        Vec3(-2.0, 0.0, 25.0),
        Vec3(-26.0, 0.0, 11.0),
    ),
)


# Atrium plays close: 36m across, with a barrier stepped from one side
# of it to the other, so the two halves see each other through two doors
# and nowhere else. Range is short, an angle held is an angle the other
# player walks around, and a fight is decided by which door they came
# through. It is the same size fight as sandbox in a third of the
# ground, which is the whole difference between the two.
ARENA_ATRIUM = Arena(
    id="atrium",
    name="Atrium",
    blurb="Close quarters. A stepped barrier with two doors decides every fight.",
    bounds_min=Vec3(-18.0, 0.0, -18.0),
    bounds_max=Vec3(18.0, 0.0, 18.0),
    cover=(
        # The barrier: three walls stepped across the middle, wall to
        # wall, with a 3m door through it at each step. Everything in
        # the match is an argument about which door.
        CoverBox(Vec3(-13.75, 1.6, -3.0), 4.25, 1.6, 0.6),
        CoverBox(Vec3(0.0, 1.6, 0.0), 6.5, 1.6, 0.6),
        CoverBox(Vec3(13.75, 1.6, 3.0), 4.25, 1.6, 0.6),
        # A wall standing in each half, so neither half is one room and
        # the way to the far door runs behind something.
        CoverBox(Vec3(-2.0, 1.6, -10.5), 0.6, 1.6, 4.5),
        CoverBox(Vec3(2.0, 1.6, 10.5), 0.6, 1.6, 4.5),
        # Pillars out wide: the corner to hold, and the corner to take
        # it from.
        CoverBox(Vec3(11.0, 1.6, -10.0), 1.4, 1.6, 1.4),
        CoverBox(Vec3(-11.0, 1.6, 10.0), 1.4, 1.6, 1.4),
        # Shoulder-high beside each door, covering the mouth without
        # standing in it: the head of whoever comes through is the only
        # thing either of you can see.
        CoverBox(Vec3(-13.0, 0.75, 3.0), 2.5, 0.75, 0.7),
        CoverBox(Vec3(13.0, 0.75, -3.0), 2.5, 0.75, 0.7),
        # Waist-high crates in the corners and along the back wall,
        # where a flanker comes out with nothing else to stand behind.
        CoverBox(Vec3(-14.0, 0.55, -14.0), 2.5, 0.55, 2.0),
        CoverBox(Vec3(14.0, 0.55, 14.0), 2.5, 0.55, 2.0),
        CoverBox(Vec3(7.0, 0.55, -16.0), 3.0, 0.55, 1.0),
        CoverBox(Vec3(-7.0, 0.55, 16.0), 3.0, 0.55, 1.0),
    ),
    # Six spawns round the outside of a small map, every one of them
    # behind the barrier or a wall from every other one.
    spawn_points=(
        Vec3(-15.0, 0.0, -8.0),
        Vec3(1.0, 0.0, -15.0),
        Vec3(15.0, 0.0, -6.0),
        Vec3(15.0, 0.0, 8.0),
        Vec3(-1.0, 0.0, 15.0),
        Vec3(-15.0, 0.0, 6.0),
    ),
)


# Aimlabs is the practice range for the solo aim-training mode (issue
# #15): a bare, symmetric 24m room a single player enters alone to shoot
# spawnable targets, in the spirit of Aim Lab. It carries no gameplay
# cover, because the point is an unobstructed field the targets stand in;
# the four low blocks are there only so the eye has scale and the floor
# is not a featureless plane. The targets themselves are not part of the
# layout: they are spawned, moved and scored entirely on the client,
# which is why this arena needs no server-side match to be playable solo.
ARENA_AIMLABS = Arena(
    id="aimlabs",
    name="Aim Lab",
    blurb="A solo practice range. Enter alone and drill your aim on spawning targets.",
    bounds_min=Vec3(-12.0, 0.0, -12.0),
    bounds_max=Vec3(12.0, 0.0, 12.0),
    cover=(
        # Waist-high blocks in the corners: scale for the eye, never a
        # sightline broken. Nothing here stands taller than the 1.6m eye.
        CoverBox(Vec3(-8.0, 0.5, -8.0), 1.0, 0.5, 1.0),
        CoverBox(Vec3(8.0, 0.5, -8.0), 1.0, 0.5, 1.0),
        CoverBox(Vec3(-8.0, 0.5, 8.0), 1.0, 0.5, 1.0),
        CoverBox(Vec3(8.0, 0.5, 8.0), 1.0, 0.5, 1.0),
    ),
    # One place to stand: the range is entered alone, and the player
    # looks out across the room the targets appear in.
    spawn_points=(
        Vec3(0.0, 0.0, 9.0),
    ),
)


DEFAULT_ARENAS: dict[str, Arena] = {
    a.id: a for a in (ARENA_SANDBOX, ARENA_ATRIUM, ARENA_AIMLABS)
}
