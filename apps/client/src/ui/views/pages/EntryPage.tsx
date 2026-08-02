import { Wordmark } from "../atoms/Wordmark";
import { JoinPanel } from "../organisms/JoinPanel";
import { MenuTemplate } from "../templates/MenuTemplate";

/* The first screen. It asks for a name and a room, and nothing else. */
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
    </MenuTemplate>
);

export default EntryPage;
