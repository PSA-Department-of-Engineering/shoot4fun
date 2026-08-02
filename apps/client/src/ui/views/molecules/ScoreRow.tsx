import { TeamDot } from "../atoms/TeamDot";
import { cx } from "../cx";

interface ScoreRowProps {
    place: number;
    name: string;
    team: number;
    kills: number;
    deaths: number;
    isYou: boolean;
}

/* One line of the final scoreboard. First place is marked by its own
 * treatment; the rest read down the column. */
export const ScoreRow = ({ place, name, team, kills, deaths, isYou }: ScoreRowProps) => (
    <li className={cx("score-row", place === 1 && "score-row--first")}>
        <span className="score-row__place">{place}</span>
        <TeamDot team={team} />
        <span className="score-row__name">{name}</span>
        {isYou ? <span className="player-row__tag">you</span> : null}
        <span className="score-row__stats">
            <span className="score-row__stat">
                <strong>{kills}</strong> {kills === 1 ? "kill" : "kills"}
            </span>
            <span className="score-row__stat score-row__stat--muted">
                <strong>{deaths}</strong> {deaths === 1 ? "death" : "deaths"}
            </span>
        </span>
    </li>
);
