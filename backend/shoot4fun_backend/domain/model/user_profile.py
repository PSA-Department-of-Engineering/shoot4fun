"""A player's durable identity and per-user preferences (issue #12).

A profile exists independent of any authentication: the username is the
adopted handle, and the three preferences are the values that otherwise
live only in `localStorage` (mouse sensitivity, master and SFX volume).
The display name is what the profile carries into the match lobby, so a
name and the settings it belonged to travel together across browsers
and machines.
"""
from __future__ import annotations

from dataclasses import dataclass

__all__ = ["UserProfile"]


@dataclass(frozen=True, slots=True)
class UserProfile:
    id: str
    username: str
    display_name: str
    sensitivity: float
    master_volume: float
    sfx_volume: float
    created_at: str
