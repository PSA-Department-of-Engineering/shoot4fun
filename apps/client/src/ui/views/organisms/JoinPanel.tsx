import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import {
    selectIsAdopted,
    selectProfileError,
    selectProfileStatus,
    selectUsername,
    isUsernameValid,
    useProfile,
    USERNAME_MAX_LENGTH,
} from "@/ui/viewmodels/profile";
import {
    NAME_MAX_LENGTH,
    ROOM_CODE_LENGTH,
    selectCanCreateRoom,
    selectCanJoinRoom,
    selectError,
    selectPhase,
    selectPlayerName,
    selectRoomCode,
    useSession,
} from "@/ui/viewmodels/session";

import { Button } from "../atoms/Button";
import { TextField } from "../atoms/TextField";
import { FormField } from "../molecules/FormField";

/* The way in. Two questions, and the two things a player can do with the
 * answers: open a room of their own, or walk into one they were given. */
export const JoinPanel = () => {
    const playerName = useSession(selectPlayerName);
    const roomCode = useSession(selectRoomCode);
    const phase = useSession(selectPhase);
    const error = useSession(selectError);
    const canCreate = useSession(selectCanCreateRoom);
    const canJoin = useSession(selectCanJoinRoom);
    const setPlayerName = useSession((s) => s.setPlayerName);
    const setRoomCode = useSession((s) => s.setRoomCode);
    const createRoom = useSession((s) => s.createRoom);
    const joinRoom = useSession((s) => s.joinRoom);

    const username = useProfile(selectUsername);
    const profileStatus = useProfile(selectProfileStatus);
    const profileError = useProfile(selectProfileError);
    const isAdopted = useProfile(selectIsAdopted);
    const adopt = useProfile((s) => s.adopt);
    const forget = useProfile((s) => s.forget);

    const [profileDraft, setProfileDraft] = useState("");

    /* The field shows the adopted username once a profile is live. */
    useEffect(() => {
        if (username) setProfileDraft(username);
    }, [username]);

    const busy = phase === "joining";

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (canJoin) void joinRoom();
    };

    return (
        <form className="join" onSubmit={submit}>
            <FormField htmlFor="player-name" label="Your name">
                <TextField
                    id="player-name"
                    value={playerName}
                    maxLength={NAME_MAX_LENGTH}
                    placeholder="Name"
                    autoFocus
                    onChange={(event) => setPlayerName(event.target.value)}
                />
            </FormField>

            <FormField
                htmlFor="profile-username"
                label="Profile username (optional)"
                hint="Adopt a username to save your name and settings to your profile and bring them back on any machine."
            >
                {isAdopted ? (
                    <p className="join__profile" data-profile-adopted>
                        Synced to profile <strong>{username}</strong>{" "}
                        <Button
                            variant="ghost"
                            onClick={() => {
                                forget();
                                setProfileDraft("");
                            }}
                            data-profile-forget
                        >
                            Forget
                        </Button>
                    </p>
                ) : (
                    <div className="join__profile-row">
                        <TextField
                            id="profile-username"
                            value={profileDraft}
                            maxLength={USERNAME_MAX_LENGTH}
                            placeholder="Username"
                            onChange={(event) => setProfileDraft(event.target.value)}
                        />
                        <Button
                            disabled={
                                !isUsernameValid(profileDraft) ||
                                profileStatus === "loading"
                            }
                            onClick={() => void adopt(profileDraft)}
                            data-profile-adopt
                        >
                            {profileStatus === "loading" ? "Adopting..." : "Adopt"}
                        </Button>
                    </div>
                )}
                {profileStatus === "error" && profileError ? (
                    <p className="join__error" role="alert">
                        {profileError}
                    </p>
                ) : null}
            </FormField>

            <Button
                variant="primary"
                block
                disabled={!canCreate}
                onClick={() => void createRoom()}
                data-create-room
            >
                {busy ? "Opening..." : "Create a room"}
            </Button>

            <div className="join__divider">
                <span>or join with a code</span>
            </div>

            <FormField
                htmlFor="room-code"
                label="Room code"
                hint={`${ROOM_CODE_LENGTH} characters, from the player who made the room`}
            >
                <TextField
                    id="room-code"
                    code
                    value={roomCode}
                    maxLength={ROOM_CODE_LENGTH}
                    placeholder="ABC123"
                    aria-describedby="room-code-hint"
                    onChange={(event) => setRoomCode(event.target.value)}
                />
            </FormField>

            <Button type="submit" block disabled={!canJoin} data-join-room>
                Join room
            </Button>

            {error ? (
                <p className="join__error" role="alert">
                    {error}
                </p>
            ) : null}
        </form>
    );
};
