import { useSession } from "@/ui/viewmodels/session";

import { Button } from "../atoms/Button";
import { Wordmark } from "../atoms/Wordmark";
import { MenuTemplate } from "../templates/MenuTemplate";

/* The first thing the game shows (issue #42). Two ways in — guest or
 * login — both land on the same main menu. Login's own flow (account,
 * profile) is issue #41; until then a logged-in player simply reaches
 * the identical menu a guest does. */
const LaunchScreen = () => {
    const chooseGuest = useSession((s) => s.chooseGuest);
    const chooseLogin = useSession((s) => s.chooseLogin);

    return (
        <MenuTemplate
            width="narrow"
            header={
                <>
                    <Wordmark>SHOOT4FUN</Wordmark>
                    <p className="menu__lead">
                        A browser arena shooter. Open a room, send the link, play.
                    </p>
                </>
            }
        >
            <div className="launch">
                <Button
                    variant="primary"
                    block
                    onClick={chooseGuest}
                    data-launch="guest"
                >
                    Play as Guest
                </Button>
                <Button
                    variant="secondary"
                    block
                    onClick={chooseLogin}
                    data-launch="login"
                >
                    Log in
                </Button>
            </div>
        </MenuTemplate>
    );
};

export default LaunchScreen;
