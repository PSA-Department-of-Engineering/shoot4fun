import { useEffect, useState, type FormEvent, type MouseEvent } from "react";

import {
    ACCOUNT_NAME_MAX,
    isDisplayNameValid,
    selectAccountBusy,
    selectAccountError,
    selectDialog,
    useAccount,
} from "@/ui/viewmodels/account";

import { Button } from "../atoms/Button";
import { TextField } from "../atoms/TextField";
import { FormField } from "../molecules/FormField";

/* The account dialogs (create / sign in / change password) as a modal that
 * floats over whichever screen is showing - the launch screen as well as the
 * main menu - so `openDialog("signIn")` from the launch screen reaches the
 * player. The dialog state lives in the account store; this component only
 * renders whichever one is open. */

export const AccountDialog = () => {
    const dialog = useAccount(selectDialog);
    const error = useAccount(selectAccountError);
    const busy = useAccount(selectAccountBusy);
    const openDialog = useAccount((s) => s.openDialog);
    const closeDialog = useAccount((s) => s.closeDialog);
    const createAccount = useAccount((s) => s.createAccount);
    const signIn = useAccount((s) => s.signIn);
    const changePassword = useAccount((s) => s.changePassword);

    const [nameDraft, setNameDraft] = useState("");
    const [createPassword, setCreatePassword] = useState("");
    const [signInName, setSignInName] = useState("");
    const [signInPassword, setSignInPassword] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    useEffect(() => {
        if (!dialog) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeDialog();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [dialog, closeDialog]);

    if (!dialog) return null;

    const onScrimClick = (event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) closeDialog();
    };

    if (dialog === "create") {
        const submit = (event: FormEvent) => {
            event.preventDefault();
            if (isDisplayNameValid(nameDraft) && createPassword)
                void createAccount(nameDraft, createPassword);
        };
        return (
            <div className="modal" onMouseDown={onScrimClick} data-account-dialog>
                <form
                    className="modal__panel account"
                    onSubmit={submit}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="account-create-title"
                >
                    <h2 className="account__title" id="account-create-title">
                        Create account
                    </h2>
                    <FormField htmlFor="account-name" label="Display name">
                        <TextField
                            id="account-name"
                            value={nameDraft}
                            maxLength={ACCOUNT_NAME_MAX}
                            placeholder="Name"
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
            </div>
        );
    }

    if (dialog === "signIn") {
        const submit = (event: FormEvent) => {
            event.preventDefault();
            if (signInName.trim() && signInPassword)
                void signIn(signInName, signInPassword);
        };
        return (
            <div className="modal" onMouseDown={onScrimClick} data-account-dialog>
                <form
                    className="modal__panel account"
                    onSubmit={submit}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="account-signin-title"
                >
                    <h2 className="account__title" id="account-signin-title">
                        Sign in
                    </h2>
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
                    <Button
                        variant="ghost"
                        className="account__switch"
                        onClick={() => openDialog("create")}
                    >
                        Create account
                    </Button>
                </form>
            </div>
        );
    }

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (currentPassword && newPassword)
            void changePassword(currentPassword, newPassword);
    };
    return (
        <div className="modal" onMouseDown={onScrimClick} data-account-dialog>
            <form
                className="modal__panel account"
                onSubmit={submit}
                role="dialog"
                aria-modal="true"
                aria-labelledby="account-change-title"
            >
                <h2 className="account__title" id="account-change-title">
                    Change password
                </h2>
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
        </div>
    );
};
