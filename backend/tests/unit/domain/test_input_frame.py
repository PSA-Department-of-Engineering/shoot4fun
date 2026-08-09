"""`InputFrame.from_wire` parsing, including the jump and crouch intent.

The jump and crouch buttons are carried on the wire and parsed here, but
no movement routine reads them yet: motion stays flat (`INT-003`) and the
vertical simulation they will drive is delivery-scale work (issue #10).
These tests pin the contract the client and the server already speak, so
the field cannot silently drop before that work lands.
"""
from __future__ import annotations

from shoot4fun_backend.domain.model.input_frame import InputFrame


def test_jump_and_crouch_parse_from_the_buttons_map() -> None:
    frame = InputFrame.from_wire(
        {"seq": 3, "dt": 0.016, "buttons": {"jump": True, "crouch": True}}
    )
    assert frame.jump is True
    assert frame.crouch is True


def test_jump_and_crouch_default_off_when_absent() -> None:
    frame = InputFrame.from_wire({"seq": 1, "dt": 0.016, "buttons": {"forward": True}})
    assert frame.jump is False
    assert frame.crouch is False


def test_jump_and_crouch_default_off_on_a_malformed_frame() -> None:
    # A missing or non-dict buttons map degrades to a neutral frame
    # rather than raising, the same as every other button.
    assert InputFrame.from_wire({}).jump is False
    assert InputFrame.from_wire({"buttons": None}).crouch is False


def test_the_default_frame_carries_no_stance() -> None:
    frame = InputFrame(seq=0, dt=0.0)
    assert frame.jump is False
    assert frame.crouch is False
