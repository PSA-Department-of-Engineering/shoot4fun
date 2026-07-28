/* WebSocket protocol types. The wire shape is shared with the backend's
 * `MatchService` (see backend/shoot4fun_backend/adapters/inbound/websocket/match_socket.py).
 * Keeping this in one place keeps the two sides in sync.
 */

export interface Vec3Wire {
    x: number;
    y: number;
    z: number;
}

export interface PlayerWire {
    id: string;
    name: string;
    position: Vec3Wire;
    yaw: number;
    pitch: number;
    hp: number;
    max_hp: number;
    is_alive: boolean;
    kills: number;
    deaths: number;
    is_ready: boolean;
    team: number;
    equipped_weapon: string;
}

export interface CoverBoxWire {
    center: Vec3Wire;
    half_x: number;
    half_y: number;
    half_z: number;
}

export interface ArenaWire {
    id: string;
    name: string;
    bounds_min: Vec3Wire;
    bounds_max: Vec3Wire;
    cover: CoverBoxWire[];
    spawn_points: Vec3Wire[];
}

export interface RoomSnapshot {
    id: string;
    arena: ArenaWire;
    state: "lobby" | "playing" | "results";
    host_id: string;
    players: PlayerWire[];
    kills: Record<string, number>;
    winner: string | null;
    time_remaining: number | null;
}

export type ClientMessage =
    | { type: "hello"; name: string }
    | { type: "set_ready"; ready: boolean }
    | { type: "start_match" }
    | { type: "rematch" }
    | { type: "input"; move: [number, number, number]; look: [number, number] }
    | { type: "fire"; weapon?: string; target?: string }
    | { type: "switch_weapon"; weapon: string }
    | { type: "ping" };

export type ServerMessage =
    | { type: "hello"; player_id: string; room?: RoomSnapshot }
    | { type: "player_joined"; player: PlayerWire }
    | { type: "player_left"; player_id: string }
    | { type: "lobby_state"; room: RoomSnapshot }
    | { type: "match_started"; room: RoomSnapshot }
    | { type: "state"; room: RoomSnapshot }
    | { type: "kill"; killer: string; victim: string }
    | { type: "results"; room: RoomSnapshot }
    | { type: "error"; code: string; detail?: string }
    | { type: "pong"; t: number };
