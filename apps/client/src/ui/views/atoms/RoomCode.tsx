import { cx } from "../cx";

interface RoomCodeProps {
    code: string;
    className?: string;
}

/* The room, as the six characters a player reads out to a friend. Spaced
 * and monospaced because it is transcribed, not skimmed. */
export const RoomCode = ({ code, className }: RoomCodeProps) => (
    <span className={cx("room-code", className)}>{code}</span>
);
