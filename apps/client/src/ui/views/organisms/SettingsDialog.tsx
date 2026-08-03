import { useEffect, type MouseEvent } from "react";

import {
    selectIsAdopted,
    selectUsername,
    useProfile,
} from "@/ui/viewmodels/profile";
import {
    formatSensitivity,
    formatVolume,
    SENSITIVITY_MAX,
    SENSITIVITY_MIN,
    SENSITIVITY_STEP,
    selectIsSettingsOpen,
    selectMasterVolume,
    selectSensitivity,
    selectSfxVolume,
    useSettings,
} from "@/ui/viewmodels/settings";

import { Button } from "../atoms/Button";
import { SettingSlider } from "../molecules/SettingSlider";

const KEYBINDS: readonly [string, string][] = [
    ["W A S D", "Move"],
    ["Mouse", "Look"],
    ["Click", "Fire"],
    ["1 / 2", "Rifle / SMG"],
    ["R", "Reload"],
    ["Esc", "Release the mouse"],
];

/* Settings, over whatever is behind it. Escape closes it, which is the
 * same key that hands the mouse back, so the two gestures agree. */
export const SettingsDialog = () => {
    const isOpen = useSettings(selectIsSettingsOpen);
    const sensitivity = useSettings(selectSensitivity);
    const masterVolume = useSettings(selectMasterVolume);
    const sfxVolume = useSettings(selectSfxVolume);
    const close = useSettings((s) => s.close);
    const setSensitivity = useSettings((s) => s.setSensitivity);
    const setMasterVolume = useSettings((s) => s.setMasterVolume);
    const setSfxVolume = useSettings((s) => s.setSfxVolume);
    const isAdopted = useProfile(selectIsAdopted);
    const username = useProfile(selectUsername);
    const syncSettings = useProfile((s) => s.syncSettings);

    /* A slider change is applied live and mirrored to the adopted
     * profile, so the value follows the player across machines. */
    const onChangeSensitivity = (value: number) => {
        setSensitivity(value);
        syncSettings(value, undefined, undefined);
    };
    const onChangeMasterVolume = (value: number) => {
        setMasterVolume(value);
        syncSettings(undefined, value, undefined);
    };
    const onChangeSfxVolume = (value: number) => {
        setSfxVolume(value);
        syncSettings(undefined, undefined, value);
    };

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") close();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, close]);

    if (!isOpen) return null;

    const onScrimClick = (event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) close();
    };

    return (
        <div className="modal" onMouseDown={onScrimClick} data-settings-dialog>
            <div
                className="modal__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
            >
                <h2 className="modal__title" id="settings-title">
                    Settings
                </h2>

                <SettingSlider
                    id="setting-sensitivity"
                    label="Mouse sensitivity"
                    display={formatSensitivity(sensitivity)}
                    value={sensitivity}
                    min={SENSITIVITY_MIN}
                    max={SENSITIVITY_MAX}
                    step={SENSITIVITY_STEP}
                    onChange={onChangeSensitivity}
                />
                <SettingSlider
                    id="setting-master"
                    label="Master volume"
                    display={formatVolume(masterVolume)}
                    value={masterVolume}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={onChangeMasterVolume}
                />
                <SettingSlider
                    id="setting-sfx"
                    label="Effects volume"
                    display={formatVolume(sfxVolume)}
                    value={sfxVolume}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={onChangeSfxVolume}
                />

                {isAdopted && username ? (
                    <p className="modal__profile" data-settings-profile>
                        Saved to profile <strong>{username}</strong>
                    </p>
                ) : null}

                <h3 className="modal__subtitle">Controls</h3>
                <dl className="keybinds">
                    {KEYBINDS.map(([key, action]) => (
                        <div className="keybinds__row" key={key}>
                            <dt className="keybinds__key">{key}</dt>
                            <dd className="keybinds__action">{action}</dd>
                        </div>
                    ))}
                </dl>

                <div className="modal__actions">
                    <Button variant="primary" onClick={close} autoFocus data-settings-close>
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
};
