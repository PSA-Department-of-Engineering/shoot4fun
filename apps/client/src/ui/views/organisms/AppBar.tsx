import {
    selectConnection,
    selectConnectionLabel,
    selectLatencyMs,
    useSession,
} from "@/ui/viewmodels/session";
import { useSettings } from "@/ui/viewmodels/settings";

import { Button } from "../atoms/Button";
import { ConnectionBadge } from "../molecules/ConnectionBadge";

/* The bar above every menu: who you are talking to, and the way into
 * settings. Settings has no other door, so this one is always on screen. */
export const AppBar = () => {
    const connection = useSession(selectConnection);
    const connectionLabel = useSession(selectConnectionLabel);
    const latencyMs = useSession(selectLatencyMs);
    const openSettings = useSettings((s) => s.open);

    return (
        <header className="appbar">
            <span className="appbar__brand">SHOOT4FUN</span>
            <ConnectionBadge
                connection={connection}
                label={connectionLabel}
                latencyMs={latencyMs}
            />
            <Button variant="ghost" onClick={openSettings} data-settings>
                Settings
            </Button>
        </header>
    );
};
