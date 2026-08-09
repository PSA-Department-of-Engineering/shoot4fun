import { useEffect, useState, type MouseEvent } from "react";

import { getGameRuntime } from "@/app/GameRuntime";
import type { SessionStats } from "@/training/session";
import { selectPointerLocked, useRoom } from "@/ui/viewmodels/room";
import { useSession } from "@/ui/viewmodels/session";

import { Button } from "../atoms/Button";
import { Wordmark } from "../atoms/Wordmark";

/* The solo aim-training range's chrome (issue #15).
 *
 * The range itself is the scene and the imperative HUD, both outside
 * React and both fed straight off the runtime. What is left for a
 * component is the once-per-round furniture: the click that takes the
 * mouse into the range, and the card that shows the tally when the round
 * is over. The live counters do not pass through here — routing sixty
 * frames a second of score through React state is the very thing the HUD
 * exists to avoid — so this subscribes only to the end-of-round flag.
 */
const SoloPage = () => {
    const pointerLocked = useRoom(selectPointerLocked);
    const capturePointer = useRoom((s) => s.capturePointer);
    const exitSolo = useSession((s) => s.exitSolo);
    const enterSolo = useSession((s) => s.enterSolo);
    const [result, setResult] = useState<SessionStats | null>(null);

    useEffect(() => {
        // The range emits every drawn frame; only the first ended frame
        // matters here. Capturing it once frees the mouse so the card's
        // buttons are clickable.
        let ended = false;
        return getGameRuntime().onTraining((update) => {
            if (update.ended && !ended) {
                ended = true;
                setResult(update.stats);
                getGameRuntime().releaseLock();
            }
        });
    }, []);

    const capture = (): void => {
        void capturePointer();
    };

    const leave = (): void => {
        exitSolo();
    };

    const again = (): void => {
        setResult(null);
        enterSolo();
    };

    const stop = (event: MouseEvent<HTMLButtonElement>): void => {
        // The card sits on a click-to-capture surface; a button on it must
        // not also grab the mouse.
        event.stopPropagation();
    };

    if (result) {
        const accuracy = Math.round(result.accuracy * 100);
        return (
            <div className="gate" data-gate="solo-results">
                <div className="gate__card">
                    <Wordmark>AIM LAB</Wordmark>
                    <p className="gate__hint">Round over</p>
                    <div className="solo-tally">
                        <div className="solo-tally__metric">
                            <span className="solo-tally__label">SCORE</span>
                            <span className="solo-tally__value" data-solo-final-score>
                                {result.score}
                            </span>
                        </div>
                        <div className="solo-tally__metric">
                            <span className="solo-tally__label">HITS</span>
                            <span className="solo-tally__value">{result.hits}</span>
                        </div>
                        <div className="solo-tally__metric">
                            <span className="solo-tally__label">MISSES</span>
                            <span className="solo-tally__value">{result.misses}</span>
                        </div>
                        <div className="solo-tally__metric">
                            <span className="solo-tally__label">ACCURACY</span>
                            <span className="solo-tally__value">{accuracy}%</span>
                        </div>
                        <div className="solo-tally__metric">
                            <span className="solo-tally__label">BEST STREAK</span>
                            <span className="solo-tally__value">{result.bestStreak}</span>
                        </div>
                    </div>
                    <Button variant="primary" onClick={again} data-solo-again>
                        Play again
                    </Button>
                    <Button variant="ghost" onClick={leave} data-solo-leave>
                        Leave
                    </Button>
                </div>
            </div>
        );
    }

    // In the range with the mouse captured, the scene and HUD own the
    // screen; nothing to draw.
    if (pointerLocked) return null;

    return (
        <div className="gate" data-gate="solo-lock" onClick={capture}>
            <div className="gate__card">
                <Wordmark>AIM LAB</Wordmark>
                <p className="gate__hint">
                    Solo target practice. Shoot the spawning targets before the clock
                    runs out.
                </p>
                <Button
                    variant="primary"
                    onClick={(event) => {
                        stop(event);
                        capture();
                    }}
                    data-solo-capture
                >
                    Click to aim
                </Button>
                <p className="gate__hint">mouse look &middot; click fire &middot; Esc release</p>
                <Button
                    variant="ghost"
                    onClick={(event) => {
                        stop(event);
                        leave();
                    }}
                    data-solo-leave
                >
                    Leave
                </Button>
            </div>
        </div>
    );
};

export default SoloPage;
