/* WebSocket match client.
 * Talks to /ws/match/{roomId}; emits parsed ServerMessage events. The
 * connection is opened by `connect(roomId, playerName)`, the input
 * loop is driven by `sendInput(...)`, and the lifecycle events (hello,
 * state, results) are dispatched to the registered handlers.
 */

import type { ClientMessage, ServerMessage } from "./protocol";

type Handler = (msg: ServerMessage) => void;

export class MatchClient {
    private ws: WebSocket | null = null;
    private handlers: Set<Handler> = new Set();
    private connected: Promise<void> | null = null;
    private rejectConnected: ((err: Error) => void) | null = null;
    private closed = false;

    constructor(private readonly roomId: string, private readonly playerName: string) {}

    on(h: Handler): () => void {
        this.handlers.add(h);
        return () => this.handlers.delete(h);
    }

    async connect(): Promise<void> {
        if (this.connected) return this.connected;
        this.connected = new Promise<void>((resolve, reject) => {
            this.rejectConnected = reject;
            const proto = window.location.protocol === "https:" ? "wss" : "ws";
            const host = window.location.host;
            const url = `${proto}://${host}/ws/match/${this.roomId}`;
            const ws = new WebSocket(url);
            this.ws = ws;
            ws.onopen = () => {
                this.send({ type: "hello", name: this.playerName });
                resolve();
            };
            ws.onmessage = (ev) => {
                try {
                    const data = JSON.parse(ev.data) as ServerMessage;
                    for (const h of this.handlers) h(data);
                } catch {
                    /* ignore malformed */
                }
            };
            ws.onerror = () => {
                if (this.rejectConnected) this.rejectConnected(new Error("ws error"));
            };
            ws.onclose = (ev) => {
                if (this.closed) return;
                if (this.rejectConnected) {
                    this.rejectConnected(new Error(`ws closed: ${ev.code} ${ev.reason}`));
                }
            };
        });
        return this.connected;
    }

    private send(msg: ClientMessage): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify(msg));
    }

    setReady(ready: boolean): void {
        this.send({ type: "set_ready", ready });
    }

    startMatch(): void {
        this.send({ type: "start_match" });
    }

    sendInput(move: [number, number, number], look: [number, number]): void {
        this.send({ type: "input", move, look });
    }

    fire(target?: string, weapon?: string): void {
        this.send({ type: "fire", target, weapon });
    }

    switchWeapon(weapon: string): void {
        this.send({ type: "switch_weapon", weapon });
    }

    rematch(): void {
        this.send({ type: "rematch" });
    }

    close(): void {
        this.closed = true;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = null;
    }
}
