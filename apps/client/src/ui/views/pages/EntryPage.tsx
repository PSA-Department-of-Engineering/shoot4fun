import { Wordmark } from "../atoms/Wordmark";
import { AccountPanel } from "../organisms/AccountPanel";
import { JoinPanel } from "../organisms/JoinPanel";
import { MenuTemplate } from "../templates/MenuTemplate";

/* The first screen. It asks for a name and a room, and nothing else.
 *
 * The account panel sits under the join form rather than above it: signing in
 * is an option beside playing, never a step before it. */
const EntryPage = () => (
    <MenuTemplate
        header={
            <>
                <Wordmark>SHOOT4FUN</Wordmark>
                <p className="menu__lead">
                    A browser arena shooter. Open a room, send the link, play.
                </p>
            </>
        }
    >
        <JoinPanel />
        <AccountPanel />
    </MenuTemplate>
);

export default EntryPage;
