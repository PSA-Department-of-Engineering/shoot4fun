import { cx } from "../cx";

interface TeamDotProps {
    /** The team number the server assigned, 1 or 2. */
    team: number;
    className?: string;
}

/* The colour a player wears in the arena, shown beside their name so the
 * lobby roster and the bodies in the match are the same two sides. */
export const TeamDot = ({ team, className }: TeamDotProps) => (
    <span
        className={cx("team-dot", `team-dot--${team === 2 ? 2 : 1}`, className)}
        aria-hidden="true"
    />
);
