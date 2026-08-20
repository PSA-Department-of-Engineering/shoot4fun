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
    useAccount,
} from "@/ui/viewmodels/account";

import { Button } from "../atoms/Button";
import { TextField } from "../atoms/TextField";
import { FormField } from "../molecules/FormField";

/* Who you are playing as, on the way in.
 *
 * A guest already has an account and a name, so this panel never gates a
 * match: it reports the name and offers two optional acts beside it. Keeping
 * a name and a password across devices is the only thing creating an account
 * buys. */
export const AccountPanel = () => {
    const hasAccount = useAccount(selectHasAccount);
    const displayName = useAccount(selectDisplayName);
    const registered = useAccount(selectRegistered);
    const dialog = useAccount(selectDialog);
    const error = useAccount(selectAccountError);
    const busy = useAccount(selectAccountBusy);
    const openDialog = useAccount((s) => s.openDialog);
    const closeDialog = useAccount((s) => s.closeDialog);
    const createAccount = useAccount((s) => s.createAccount);
    const signIn = useAccount((s) => s.signIn);
    const changePassword = useAccount((s) => s.changePassword);
    const signOut = useAccount((s) => s.signOut);

    const [nameDraft, setNameDraft] = useState("");
    const [createPassword, setCreatePassword] = useState("");
    const [signInName, setSignInName] = useState("");
    const [signInPassword, setSignInPassword] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    if (!hasAccount) return null;

    if (dialog === "create") {
        const submit = (event: FormEvent) => {
            event.preventDefault();
            if (isDisplayNameValid(nameDraft) && createPassword)
                void createAccount(nameDraft, createPassword);
        };
        return (
            <form className="account" onSubmit={submit}>
                <h2 className="account__title">Create account</h2>
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
                <FormField htmlFor="account-password" label="Password">
                    <TextField
                        id="account-password"
                        type="password"
                        value={createPassword}
                        autoFocus
                        onChange={(event) => setCreatePassword(event.target.value)}
                    />
                </FormField>
                {error && <p className="account__error">{error}</p>}
                <div className="account__row">
                    <Button variant="ghost" onClick={closeDialog}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        disabled={busy || !isDisplayNameValid(nameDraft) || !createPassword}
                        type="submit"
                    >
                        {busy ? "Creating" : "Create"}
                    </Button>
                </div>
            </form>
        );
    }

    if (dialog === "signIn") {
        const submit = (event: FormEvent) => {
            event.preventDefault();
            if (signInName.trim() && signInPassword)
                void signIn(signInName, signInPassword);
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
                <FormField htmlFor="signin-password" label="Password">
                    <TextField
                        id="signin-password"
                        type="password"
                        value={signInPassword}
                        onChange={(event) => setSignInPassword(event.target.value)}
                    />
                </FormField>
                {error && <p className="account__error">{error}</p>}
                <div className="account__row">
                    <Button variant="ghost" onClick={closeDialog}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        disabled={busy || !signInName.trim() || !signInPassword}
                        type="submit"
                    >
                        {busy ? "Checking" : "Sign in"}
                    </Button>
                </div>
            </form>
        );
    }

    if (dialog === "changePassword") {
        const submit = (event: FormEvent) => {
            event.preventDefault();
            if (currentPassword && newPassword)
                void changePassword(currentPassword, newPassword);
        };
        return (
            <form className="account" onSubmit={submit}>
                <h2 className="account__title">Change password</h2>
                <FormField htmlFor="change-current" label="Current password">
                    <TextField
                        id="change-current"
                        type="password"
                        autoFocus
                        onChange={(event) => setCurrentPassword(event.target.value)}
                    />
                </FormField>
                <FormField htmlFor="change-new" label="New password">
                    <TextField
                        id="change-new"
                        type="password"
                        onChange={(event) => setNewPassword(event.target.value)}
                    />
                </FormField>
                {error && <p className="account__error">{error}</p>}
                <div className="account__row">
                    <Button variant="ghost" onClick={closeDialog}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        disabled={busy || !currentPassword || !newPassword}
                        type="submit"
                    >
                        {busy ? "Updating" : "Update"}
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
                    <>
                        <Button variant="ghost" onClick={() => openDialog("changePassword")}>
                            Change password
                        </Button>
                        <Button variant="ghost" onClick={() => void signOut()} disabled={busy}>
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
