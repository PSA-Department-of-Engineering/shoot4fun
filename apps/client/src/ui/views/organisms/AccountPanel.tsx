import {
    selectDisplayName,
    selectHasAccount,
    selectRegistered,
    useAccount,
} from "@/ui/viewmodels/account";

import { Button } from "../atoms/Button";

/* Who you are playing as, on the way in.
 *
 * A guest already has an account and a name, so this panel never gates a
 * match: it reports the name and offers two optional acts beside it. Keeping
 * a name and a password across devices is the only thing creating an account
 * buys. The dialogs the buttons open live in `AccountDialog`, a modal that
 * floats over whichever screen is up. */
export const AccountPanel = () => {
    const hasAccount = useAccount(selectHasAccount);
    const displayName = useAccount(selectDisplayName);
    const registered = useAccount(selectRegistered);
    const openDialog = useAccount((s) => s.openDialog);
    const signOut = useAccount((s) => s.signOut);

    if (!hasAccount) return null;

    return (
        <section className="account" data-account-panel>
            <p className="account__who">
                Playing as <strong data-account-name>{displayName}</strong>
                {!registered && <span className="account__tag">guest</span>}
            </p>
            <div className="account__row">
                {registered ? (
                    <>
                        <Button variant="ghost" onClick={() => openDialog("changePassword")}>
                            Change password
                        </Button>
                        <Button variant="ghost" onClick={() => void signOut()}>
                            Sign out
                        </Button>
                    </>
                ) : (
                    <>
                        <Button variant="ghost" onClick={() => openDialog("create")}>
                            Create account
                        </Button>
                        <Button variant="ghost" onClick={() => openDialog("signIn")}>
                            Sign in
                        </Button>
                    </>
                )}
            </div>
        </section>
    );
};
