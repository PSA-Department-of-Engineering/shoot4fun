import { selectHasSnapshot, selectRoomId, useRoom } from "@/ui/viewmodels/room";
import { selectInviteCopied, selectRoomCode, useSession } from "@/ui/viewmodels/session";

import { InviteRow } from "../molecules/InviteRow";
import { ArenaPanel } from "../organisms/ArenaPanel";
import { LobbyControls } from "../organisms/LobbyControls";
import { RosterPanel } from "../organisms/RosterPanel";
import { MenuTemplate } from "../templates/MenuTemplate";

/* The room before the match: who is in it, where it will be played, and
 * the code that brings anyone else in. */
const LobbyPage = () => {
    const hasSnapshot = useRoom(selectHasSnapshot);
    const roomId = useRoom(selectRoomId);
    const roomCode = useSession(selectRoomCode);
    const inviteCopied = useSession(selectInviteCopied);
    const copyInvite = useSession((s) => s.copyInvite);

    return (
        <MenuTemplate
            width="wide"
            header={
                <>
                    <h1 className="menu__title">Lobby</h1>
                    <InviteRow
                        code={roomId || roomCode}
                        copied={inviteCopied}
                        onCopy={() => void copyInvite()}
                    />
                </>
            }
            footer={hasSnapshot ? <LobbyControls /> : null}
        >
            {hasSnapshot ? (
                <div className="menu__columns">
                    <RosterPanel />
                    <ArenaPanel />
                </div>
            ) : (
                <p className="panel__empty">Waiting for the room</p>
            )}
        </MenuTemplate>
    );
};

export default LobbyPage;
