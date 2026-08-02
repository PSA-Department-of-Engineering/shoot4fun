import type { ConnectionState } from "@/ui/viewmodels/session";

import { StatusDot } from "../atoms/StatusDot";

interface ConnectionBadgeProps {
    connection: ConnectionState;
    label: string;
    latencyMs: number;
}

/* The honest answer to "is anything happening". A game that cannot reach
 * its server looks exactly like a game waiting for players unless this
 * says otherwise, so it is on screen from the first frame. */
export const ConnectionBadge = ({
    connection,
    label,
    latencyMs,
}: ConnectionBadgeProps) => (
    <span className="conn" data-connection={connection} role="status">
        <StatusDot connection={connection} />
        <span className="conn__label">{label}</span>
        {connection === "open" && latencyMs > 0 ? (
            <span className="conn__latency">{Math.round(latencyMs)} ms</span>
        ) : null}
    </span>
);
