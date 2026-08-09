"""3-component float vector (the geometry primitive on the server).

Players move on the (x, z) ground plane; the (y) component is their feet
height, `0.0` on the ground and lifted while a jump is in the air (issue
#10). A 3-tuple is the smallest value object that carries the data and
stays JSON-serializable.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

__all__ = ["Vec3"]


@dataclass(frozen=True, slots=True)
class Vec3:
    x: float
    y: float
    z: float

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "z": self.z}

    def length(self) -> float:
        return math.sqrt(self.x * self.x + self.y * self.y + self.z * self.z)

    def add(self, other: Vec3) -> Vec3:
        return Vec3(self.x + other.x, self.y + other.y, self.z + other.z)

    def scale(self, k: float) -> Vec3:
        return Vec3(self.x * k, self.y * k, self.z * k)

    @staticmethod
    def zero() -> Vec3:
        return Vec3(0.0, 0.0, 0.0)
