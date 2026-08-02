import type { ConnectionState } from "@/ui/viewmodels/session";

import { cx } from "../cx";

interface StatusDotProps {
    connection: ConnectionState;
    className?: string;
}

/* The socket, as a light. It never carries the meaning alone: the badge
 * around it spells the state out. */
export const StatusDot = ({ connection, className }: StatusDotProps) => (
    <span
        className={cx("status-dot", className)}
        data-connection={connection}
        aria-hidden="true"
    />
);
