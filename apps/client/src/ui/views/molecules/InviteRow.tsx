import { Button } from "../atoms/Button";
import { RoomCode } from "../atoms/RoomCode";

interface InviteRowProps {
    code: string;
    copied: boolean;
    onCopy: () => void;
}

/* How a second player gets here. The code is readable out loud and the
 * button puts the whole link on the clipboard. */
export const InviteRow = ({ code, copied, onCopy }: InviteRowProps) => (
    <div className="invite">
        <RoomCode code={code} />
        <Button variant="ghost" onClick={onCopy} aria-live="polite">
            {copied ? "Link copied" : "Copy invite link"}
        </Button>
    </div>
);
