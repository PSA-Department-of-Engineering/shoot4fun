/* The wire protocol.
 *
 * The client sends intent and the server sends the world (ADR-0003).
 * There is deliberately no client message carrying a position, a
 * velocity, a displacement or a victim: the server computes all four,
 * so no wire shape exists for a client to lie about them.
 *
 * The shapes here mirror the backend's `InputFrame.from_wire` and the
 * `to_dict` methods on the domain model. Any change is a change on both
 * sides.
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
    respawn_in: number;
    kills: number;
    deaths: number;
    is_ready: boolean;
    team: number;
    equipped_weapon: string;
    ammo: number;
    magazine_size: number;
    is_reloading: boolean;
    /** The last input frame the server consumed from this player. The
     * local player reads it to know what to replay (ADR-0004). */
    last_input_seq: number;
    /** Whether the player is crouched (issue #10). Authoritative server
     * state, like position: the client renders it, never authors it.
     * Feet height rides in `position.y`; only the stance is separate. */
    crouching?: boolean;
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
    /** The simulation tick this snapshot was taken at. The client echoes
     * it as `ack_tick` so the server can rewind to the world the shooter
     * was actually looking at. */
    tick: number;
    players: PlayerWire[];
    kills: Record<string, number>;
    winner: string | null;
    time_remaining: number | null;
}

/** What a human did during one client frame. The only motion message. */
export interface InputWire {
    type: "input";
    seq: number;
    dt: number;
    ack_tick: number;
    buttons: {
        forward: boolean;
        back: boolean;
        left: boolean;
        right: boolean;
        fire: boolean;
        /** Jump and crouch intent (issue #10). Buttons like any other:
         * the shared movement routine reads them to give the player an
         * upward velocity and a ducked stance. No height or velocity
         * crosses the wire — the server integrates the effect (INT-009). */
        jump: boolean;
        crouch: boolean;
    };
    yaw: number;
    pitch: number;
}

export type ClientMessage =
    | { type: "hello"; name: string }
    | InputWire
    | { type: "set_ready"; ready: boolean }
    | { type: "select_map"; arena: string }
    | { type: "start_match" }
    | { type: "rematch" }
    | { type: "switch_weapon"; weapon: string }
    | { type: "reload" }
    | { type: "ping"; t: number };

export type ServerMessage =
    | { type: "hello"; player_id: string; room?: RoomSnapshot }
    | { type: "player_joined"; player: PlayerWire }
    | { type: "player_left"; player_id: string }
    | { type: "lobby_state"; room: RoomSnapshot }
    | { type: "match_started"; room: RoomSnapshot }
    | { type: "state"; room: RoomSnapshot }
    | { type: "results"; room: RoomSnapshot }
    | { type: "respawn"; player_id: string }
    | {
          type: "hit_confirmed";
          victim: string;
          damage: number;
          headshot: boolean;
          killed: boolean;
      }
    | {
          type: "damage";
          victim: string;
          attacker: string;
          damage: number;
          point: Vec3Wire | null;
      }
    | { type: "kill"; killer: string; victim: string; headshot: boolean }
    | { type: "error"; code: string; detail?: string }
    | { type: "pong"; t: number };
