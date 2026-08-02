import { useState, type MouseEvent } from "react";

import { useRoom } from "@/ui/viewmodels/room";
import { useSettings } from "@/ui/viewmodels/settings";

import { Button } from "../atoms/Button";
import { Wordmark } from "../atoms/Wordmark";

/* The gesture surface for pointer lock.
 *
 * A browser grants relative mouse deltas only under pointer lock, only
 * from inside a real user gesture, and the player drops it with Escape at
 * any time. So this is not decoration: it is the click the lock is taken
 * during. It stands over a running match whenever the game does not hold
 * the mouse, and taking the lock is what dismisses it.
 *
 * The whole surface is clickable because that is the fastest way back
 * into a match, and the button inside it is what a keyboard reaches.
 */
export const PointerLockGate = () => {
    const capturePointer = useRoom((s) => s.capturePointer);
    const openSettings = useSettings((s) => s.open);
    const [refused, setRefused] = useState(false);

    const capture = (): void => {
        void capturePointer().then((locked) => setRefused(!locked));
    };

    const onSettings = (event: MouseEvent<HTMLButtonElement>): void => {
        // Settings is a menu, so this click must not also grab the mouse.
        event.stopPropagation();
        openSettings();
    };

    return (
        <div className="gate" data-gate="pointer-lock" onClick={capture}>
            <div className="gate__card">
                <Wordmark>SHOOT4FUN</Wordmark>
                <Button
                    variant="primary"
                    onClick={(event) => {
                        event.stopPropagation();
                        capture();
                    }}
                    data-gate-capture
                >
                    {refused ? "Click again to capture the mouse" : "Click to play"}
                </Button>
                <p className="gate__hint">
                    WASD move &middot; mouse look &middot; click fire &middot; 1 / 2 weapon
                    &middot; R reload &middot; Esc release
                </p>
                <Button variant="ghost" onClick={onSettings} data-settings>
                    Settings
                </Button>
            </div>
        </div>
    );
};
