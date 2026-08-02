/* A damped spring, and the reason it is not three lines inline.
 *
 * Recoil is a spring: a shot throws a value off its rest position and
 * the return is what reads as a weapon rather than a jump cut. The
 * obvious integration, one Euler step per frame, is stable at the frame
 * rate it was tuned on and unstable below it. Once `damping * dt`
 * passes 2 the step overshoots further than it started, every frame
 * doubles the error, and within a second the camera is spinning: a
 * software renderer, a busy tab or a laptop on battery is enough.
 *
 * So the step size is fixed and the frame's time is spent in as many of
 * those as it takes. That makes the motion identical at 30, 60 and 144
 * frames a second, which is the same reason every other motion in this
 * directory is scaled by delta time, held to properly here because a
 * spring punishes the shortcut instead of merely looking wrong.
 */

/** The longest step the integration will take, in seconds. */
const MAX_STEP = 1 / 120;

export class Spring {
    private position = 0;
    private velocity = 0;

    constructor(
        private readonly stiffness: number,
        private readonly damping: number,
    ) {}

    /** Where the spring is now. */
    get value(): number {
        return this.position;
    }

    /** Throw it off rest. Impulses accumulate, so a burst stacks. */
    kick(impulse: number): void {
        this.velocity += impulse;
    }

    update(dt: number): void {
        if (dt <= 0) return;
        let remaining = dt;
        while (remaining > 0) {
            const step = remaining > MAX_STEP ? MAX_STEP : remaining;
            remaining -= step;
            // Semi-implicit Euler: velocity first, then position off the
            // velocity just computed.
            this.velocity +=
                (-this.stiffness * this.position - this.damping * this.velocity) * step;
            this.position += this.velocity * step;
        }
    }

    /** Back to rest immediately, with nothing left to unwind. */
    settle(): void {
        this.position = 0;
        this.velocity = 0;
    }
}
