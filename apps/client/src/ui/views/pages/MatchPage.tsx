import { isTouchDevice } from "@/input/touch";
import { selectPointerLocked, useRoom } from "@/ui/viewmodels/room";

import { PointerLockGate } from "../organisms/PointerLockGate";
import { TouchControls } from "../organisms/TouchControls";

/* A running match. The screen belongs to the scene and the HUD, both of
 * which live outside React.
 *
 * What is left to render is the input surface, and it forks by device. A
 * mouse-and-keyboard machine plays under pointer lock, so all that shows
 * is the gate, and only while the game does not hold the mouse. A touch
 * device has no lock to take and no keys to walk with, so it plays the
 * on-screen layout instead (issue #17), which stands over the match for
 * its whole length rather than being dismissed by a capture.
 */
const MatchPage = () => {
    const pointerLocked = useRoom(selectPointerLocked);
    if (isTouchDevice()) return <TouchControls />;
    return pointerLocked ? null : <PointerLockGate />;
};

export default MatchPage;
