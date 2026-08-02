import { selectPointerLocked, useRoom } from "@/ui/viewmodels/room";

import { PointerLockGate } from "../organisms/PointerLockGate";

/* A running match. The screen belongs to the scene and the HUD, both of
 * which live outside React; the only thing left to render is the gate,
 * and only while the game does not hold the mouse.
 */
const MatchPage = () => {
    const pointerLocked = useRoom(selectPointerLocked);
    return pointerLocked ? null : <PointerLockGate />;
};

export default MatchPage;
