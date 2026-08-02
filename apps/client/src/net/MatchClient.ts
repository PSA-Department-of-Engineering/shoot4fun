/* WebSocket match client.
 *
 * Opens /ws/match/{roomId}, sends intent, and dispatches parsed server
 * messages to subscribers. It holds no game state of its own: the scene
 * owns prediction, the buffer owns interpolation, and this owns the
 * socket.
 */

import type { ClientMessage, InputWire, ServerMessage } from "./protocol";

type Handler = (msg: ServerMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;

export type ConnectionStatus = "connecting" | "open" | "closed";

export class MatchClient {
    private ws: WebSocket | null = null;
    private handlers = new Set<Handler>();
    private statusHandlers = new Set<StatusHandler>();
    private connected: Promise<void> | null = null;
    private closedByUs = false;
    private latencyMs = 0;

    constructor(
        private readonly roomId: string,
        private readonly playerName: string,
    ) {}

    on(handler: Handler): () => void {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    onStatus(handler: StatusHandler): () => void {
        this.statusHandlers.add(handler);
        return () => this.statusHandlers.delete(handler);
    }

    /** Round-trip time in milliseconds, from the last ping answered. */
    latency(): number {
        return this.latencyMs;
    }

    async connect(): Promise<void> {
        if (this.connected) return this.connected;
        this.connected = new Promise<void>((resolve, reject) => {
            const proto = window.location.protocol === "https:" ? "wss" : "ws";
            const url = `${proto}://${window.location.host}/ws/match/${this.roomId}`;
            let settled = false;
            const ws = new WebSocket(url);
            this.ws = ws;
            this.emitStatus("connecting");

            ws.onopen = () => {
                settled = true;
                this.send({ type: "hello", name: this.playerName });
                this.emitStatus("open");
                resolve();
            };
            ws.onmessage = (event) => {
                let data: ServerMessage;
                try {
                    data = JSON.parse(event.data) as ServerMessage;
                } catch {
                    return;
                }
                if (data.type === "pong") {
                    this.latencyMs = Math.max(0, performance.now() - data.t);
                    return;
                }
                for (const handler of this.handlers) handler(data);
            };
            ws.onerror = () => {
                if (settled) return;
                settled = true;
                reject(new Error("could not reach the match server"));
            };
            ws.onclose = (event) => {
                this.emitStatus("closed");
                if (this.closedByUs || settled) return;
                settled = true;
                reject(new Error(`connection closed: ${event.code} ${event.reason}`));
            };
        });
        return this.connected;
    }

    private emitStatus(status: ConnectionStatus): void {
        for (const handler of this.statusHandlers) handler(status);
    }

    private send(msg: ClientMessage): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify(msg));
    }

    sendInput(frame: Omit<InputWire, "type">): void {
        this.send({ type: "input", ...frame });
    }

    setReady(ready: boolean): void {
        this.send({ type: "set_ready", ready });
    }

    selectMap(arena: string): void {
        this.send({ type: "select_map", arena });
    }

    startMatch(): void {
        this.send({ type: "start_match" });
    }

    rematch(): void {
        this.send({ type: "rematch" });
    }

    switchWeapon(weapon: string): void {
        this.send({ type: "switch_weapon", weapon });
    }

    reload(): void {
        this.send({ type: "reload" });
    }

    ping(): void {
        this.send({ type: "ping", t: performance.now() });
    }

    close(): void {
        this.closedByUs = true;
        this.ws?.close();
        this.ws = null;
        this.connected = null;
    }
}
