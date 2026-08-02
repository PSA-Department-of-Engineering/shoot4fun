import { ReadyPill } from "../atoms/ReadyPill";
import { TeamDot } from "../atoms/TeamDot";
import { cx } from "../cx";

interface PlayerRowProps {
    name: string;
    team: number;
    isHost: boolean;
    isReady: boolean;
    isYou: boolean;
}

/* One player in the lobby roster: their colour, their name, and whether
 * the room is waiting on them. */
export const PlayerRow = ({ name, team, isHost, isReady, isYou }: PlayerRowProps) => (
    <li className={cx("player-row", isYou && "player-row--you")}>
        <TeamDot team={team} />
        <span className="player-row__name">{name}</span>
        {isYou ? <span className="player-row__tag">you</span> : null}
        {isHost ? <span className="player-row__tag">host</span> : null}
        <ReadyPill isReady={isReady} className="player-row__state" />
    </li>
);
