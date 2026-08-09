import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";

import { getGameRuntime } from "@/app/GameRuntime";
import type { TouchInput } from "@/input/InputController";

/* The mobile shooting layout (issue #17).
 *
 * A phone has no pointer lock and no keyboard, so it plays the match
 * through an on-screen layout instead: a thumbstick that walks, a look
 * pad that aims, and buttons that fire, jump, crouch, reload and swap the
 * weapon. Every one of them feeds the same `InputController` intent the
 * mouse and keyboard feed (`TouchInput`), so nothing downstream - the
 * predictor, the wire, the server - learns a finger produced it.
 *
 * Each control owns its own pointer: it captures the `pointerId` it began
 * with and ignores every other, so a thumb on the stick, a thumb on the
 * look pad and a thumb on fire are three independent touches that do not
 * fight over one handler. Capture also means a finger that slides off the
 * control keeps driving it until it lifts, rather than stranding a held
 * button down.
 *
 * The layout renders only on touch devices (`MatchPage`), so it never
 * covers the desktop pointer-lock gate or the CI browser's canvas.
 */

/** The stick's throw in pixels: how far the knob travels from centre at
 * full tilt. Mirrors `--touch-stick-throw` in the stylesheet. */
const STICK_THROW = 56;

export const TouchControls = () => {
    const touch = useMemo<TouchInput>(() => getGameRuntime().touchInput(), []);

    // Leaving the match must not strand a held direction or the trigger.
    useEffect(() => {
        return () => {
            touch.move(0, 0);
            touch.fire(false);
            touch.jump(false);
            touch.crouch(false);
        };
    }, [touch]);

    return (
        <div className="touch-controls" data-touch-controls>
            <LookPad touch={touch} />
            <Stick touch={touch} />
            <div className="touch-controls__actions">
                <HoldButton
                    className="touch-btn touch-btn--jump"
                    label="JUMP"
                    onChange={touch.jump}
                />
                <HoldButton
                    className="touch-btn touch-btn--crouch"
                    label="CROUCH"
                    onChange={touch.crouch}
                />
                <HoldButton
                    className="touch-btn touch-btn--fire"
                    label="FIRE"
                    onChange={touch.fire}
                    data-touch-fire
                />
            </div>
            <div className="touch-controls__weapons">
                <TapButton
                    className="touch-btn touch-btn--reload"
                    label="RELOAD"
                    onTap={touch.reload}
                />
                <TapButton
                    className="touch-btn touch-btn--weapon"
                    label="1"
                    onTap={() => touch.switchWeapon("rifle")}
                />
                <TapButton
                    className="touch-btn touch-btn--weapon"
                    label="2"
                    onTap={() => touch.switchWeapon("smg")}
                />
            </div>
        </div>
    );
};

/* The first gesture of the match starts audio, the way the pointer-lock
 * click does on desktop; a browser will not start a context otherwise. */
function beginGesture(): void {
    getGameRuntime().resumeAudio();
}

const Stick = ({ touch }: { touch: TouchInput }) => {
    const baseRef = useRef<HTMLDivElement>(null);
    const knobRef = useRef<HTMLDivElement>(null);
    const pointer = useRef<number | null>(null);
    const origin = useRef({ x: 0, y: 0 });

    const drive = (clientX: number, clientY: number): void => {
        let dx = clientX - origin.current.x;
        let dy = clientY - origin.current.y;
        const distance = Math.hypot(dx, dy);
        if (distance > STICK_THROW) {
            dx = (dx / distance) * STICK_THROW;
            dy = (dy / distance) * STICK_THROW;
        }
        if (knobRef.current) {
            knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
        }
        // Screen y grows downward, so pushing the thumb up (negative dy) is
        // forward. x is already right-positive.
        touch.move(dx / STICK_THROW, -dy / STICK_THROW);
    };

    const onDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
        event.preventDefault();
        beginGesture();
        const base = baseRef.current;
        if (!base) return;
        const rect = base.getBoundingClientRect();
        origin.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
        pointer.current = event.pointerId;
        base.setPointerCapture(event.pointerId);
        drive(event.clientX, event.clientY);
    };

    const onMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
        if (pointer.current !== event.pointerId) return;
        event.preventDefault();
        drive(event.clientX, event.clientY);
    };

    const onEnd = (event: ReactPointerEvent<HTMLDivElement>): void => {
        if (pointer.current !== event.pointerId) return;
        event.preventDefault();
        pointer.current = null;
        touch.move(0, 0);
        if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
    };

    return (
        <div
            ref={baseRef}
            className="touch-stick"
            data-touch-stick
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onEnd}
            onPointerCancel={onEnd}
        >
            <div ref={knobRef} className="touch-stick__knob" />
        </div>
    );
};

const LookPad = ({ touch }: { touch: TouchInput }) => {
    const pointer = useRef<number | null>(null);
    const last = useRef({ x: 0, y: 0 });

    const onDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
        event.preventDefault();
        beginGesture();
        pointer.current = event.pointerId;
        last.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
        if (pointer.current !== event.pointerId) return;
        event.preventDefault();
        const dx = event.clientX - last.current.x;
        const dy = event.clientY - last.current.y;
        last.current = { x: event.clientX, y: event.clientY };
        touch.look(dx, dy);
    };

    const onEnd = (event: ReactPointerEvent<HTMLDivElement>): void => {
        if (pointer.current !== event.pointerId) return;
        pointer.current = null;
    };

    return (
        <div
            className="touch-look"
            data-touch-look
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onEnd}
            onPointerCancel={onEnd}
        />
    );
};

interface HoldButtonProps {
    className: string;
    label: string;
    onChange: (down: boolean) => void;
    "data-touch-fire"?: boolean;
}

const HoldButton = ({ className, label, onChange, ...rest }: HoldButtonProps) => {
    const pointer = useRef<number | null>(null);

    const onDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
        event.preventDefault();
        beginGesture();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        onChange(true);
    };

    const onEnd = (event: ReactPointerEvent<HTMLButtonElement>): void => {
        if (pointer.current !== event.pointerId) return;
        event.preventDefault();
        pointer.current = null;
        onChange(false);
    };

    return (
        <button
            type="button"
            className={className}
            onPointerDown={onDown}
            onPointerUp={onEnd}
            onPointerCancel={onEnd}
            {...rest}
        >
            {label}
        </button>
    );
};

const TapButton = ({
    className,
    label,
    onTap,
}: {
    className: string;
    label: string;
    onTap: () => void;
}) => {
    const onDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
        event.preventDefault();
        beginGesture();
        onTap();
    };

    return (
        <button type="button" className={className} onPointerDown={onDown}>
            {label}
        </button>
    );
};
