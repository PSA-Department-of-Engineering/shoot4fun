import { cx } from "../cx";

interface ReadyPillProps {
    isReady: boolean;
    className?: string;
}

/* Whether a player has readied up. The word carries it, not the colour:
 * the two states have to be told apart at a glance and without it. */
export const ReadyPill = ({ isReady, className }: ReadyPillProps) => (
    <span
        className={cx("pill", isReady ? "pill--ready" : "pill--waiting", className)}
    >
        {isReady ? "Ready" : "Waiting"}
    </span>
);
