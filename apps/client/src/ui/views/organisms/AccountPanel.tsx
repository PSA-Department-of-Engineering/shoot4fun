import { useState, type FormEvent } from "react";

import {
    ACCOUNT_NAME_MAX,
    isDisplayNameValid,
    selectAccountBusy,
    selectAccountError,
    selectDialog,
    selectDisplayName,
    selectHasAccount,
    selectRegistered,
    selectRevealedCode,
    useAccount,
} from "@/ui/viewmodels/account";

import { Button } from "../atoms/Button";
import { TextField } from "../atoms/TextField";
import { FormField } from "../molecules/FormField";

/* Who you are playing as, on the way in.
 *
 * A guest already has an account and a name, so this panel never gates a
 * match: it reports the name and offers two optional acts beside it. Keeping
 * a name across devices is the only thing registering buys. */
export const AccountPanel = () => {
    const hasAccount = useAccount(selectHasAccount);
    const displayName = useAccount(selectDisplayName);
    const registered = useAccount(selectRegistered);
    const dialog = useAccount(selectDialog);
    const revealedCode = useAccount(selectRevealedCode);
    const error = useAccount(selectAccountError);
    const busy = useAccount(selectAccountBusy);
    const openDialog = useAccount((s) => s.openDialog);
    const closeDialog = useAccount((s) => s.closeDialog);
    const dismissCode = useAccount((s) => s.dismissCode);
    const register = useAccount((s) => s.register);
    const signIn = useAccount((s) => s.signIn);
    const signOut = useAccount((s) => s.signOut);

    const [nameDraft, setNameDraft] = useState("");
    const [signInName, setSignInName] = useState("");
    const [signInCode, setSignInCode] = useState("");

    if (!hasAccount) return null;

    if (revealedCode) {
        return (
            <section className="account account--reveal" data-account-reveal>
                <h2 className="account__title">Save your recovery code</h2>
                <p className="account__lead">
                    This is the only time it is shown. With your name it signs you in on any
                    device.
                </p>
                <output className="account__code" data-recovery-code>
                    {revealedCode}
                </output>
                <Button variant="primary" block onClick={dismissCode}>
                    I saved it
                </Button>
            </section>
        );
    }

    if (dialog === "register") {
        const submit = (event: FormEvent) => {
            event.preventDefault();
            if (isDisplayNameValid(nameDraft)) void register(nameDraft);
        };
        return (
            <form className="account" onSubmit={submit}>
                <h2 className="account__title">Keep this name</h2>
                <FormField htmlFor="account-name" label="Display name">
                    <TextField
                        id="account-name"
                        value={nameDraft}
                        maxLength={ACCOUNT_NAME_MAX}
                        placeholder={displayName ?? "Name"}
                        autoFocus
                        onChange={(event) => setNameDraft(event.target.value)}
                    />
                </FormField>
                {error && <p className="account__error">{error}</p>}
                <div className="account__row">
                    <Button variant="ghost" onClick={closeDialog}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        disabled={busy || !isDisplayNameValid(nameDraft)}
                        type="submit"
                    >
                        {busy ? "Saving" : "Save"}
                    </Button>
                </div>
            </form>
        );
    }

    if (dialog === "signIn") {
        const submit = (event: FormEvent) => {
            event.preventDefault();
            if (signInName.trim() && signInCode.trim()) void signIn(signInName, signInCode);
        };
        return (
            <form className="account" onSubmit={submit}>
                <h2 className="account__title">Sign in</h2>
                <FormField htmlFor="signin-name" label="Display name">
                    <TextField
                        id="signin-name"
                        value={signInName}
                        maxLength={ACCOUNT_NAME_MAX}
                        autoFocus
                        onChange={(event) => setSignInName(event.target.value)}
                    />
                </FormField>
                <FormField htmlFor="signin-code" label="Recovery code">
                    <TextField
                        id="signin-code"
                        value={signInCode}
                        onChange={(event) => setSignInCode(event.target.value)}
                    />
                </FormField>
                {error && <p className="account__error">{error}</p>}
                <div className="account__row">
                    <Button variant="ghost" onClick={closeDialog}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        disabled={busy || !signInName.trim() || !signInCode.trim()}
                        type="submit"
                    >
                        {busy ? "Checking" : "Sign in"}
                    </Button>
                </div>
            </form>
        );
    }

    return (
        <section className="account" data-account-panel>
            <p className="account__who">
                Playing as <strong data-account-name>{displayName}</strong>
                {!registered && <span className="account__tag">guest</span>}
            </p>
            <div className="account__row">
                {registered ? (
                    <Button variant="ghost" onClick={() => void signOut()} disabled={busy}>
                        Sign out
                    </Button>
                ) : (
                    <>
                        <Button variant="ghost" onClick={() => openDialog("register")}>
                            Keep this name
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
