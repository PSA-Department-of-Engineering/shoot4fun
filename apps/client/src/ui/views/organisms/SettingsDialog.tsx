import { useEffect, type MouseEvent } from "react";

import {
    formatSensitivity,
    formatVolume,
    SENSITIVITY_MAX,
    SENSITIVITY_MIN,
    SENSITIVITY_STEP,
    selectHapticsEnabled,
    selectIsSettingsOpen,
    selectMasterVolume,
    selectSensitivity,
    selectSfxVolume,
    selectTouchSensitivity,
    useSettings,
} from "@/ui/viewmodels/settings";

import { version as GAME_VERSION } from "../../../../package.json";

import { Button } from "../atoms/Button";
import { SettingSlider } from "../molecules/SettingSlider";
import { SettingToggle } from "../molecules/SettingToggle";

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
    const touchSensitivity = useSettings(selectTouchSensitivity);
    const masterVolume = useSettings(selectMasterVolume);
    const sfxVolume = useSettings(selectSfxVolume);
    const hapticsEnabled = useSettings(selectHapticsEnabled);
    const close = useSettings((s) => s.close);
    const setSensitivity = useSettings((s) => s.setSensitivity);
    const setTouchSensitivity = useSettings((s) => s.setTouchSensitivity);
    const setMasterVolume = useSettings((s) => s.setMasterVolume);
    const setSfxVolume = useSettings((s) => s.setSfxVolume);
    const setHapticsEnabled = useSettings((s) => s.setHapticsEnabled);

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
                    onChange={setSensitivity}
                />
                <SettingSlider
                    id="setting-touch-sensitivity"
                    label="Touch look sensitivity"
                    display={formatSensitivity(touchSensitivity)}
                    value={touchSensitivity}
                    min={SENSITIVITY_MIN}
                    max={SENSITIVITY_MAX}
                    step={SENSITIVITY_STEP}
                    onChange={setTouchSensitivity}
                />
                <SettingSlider
                    id="setting-master"
                    label="Master volume"
                    display={formatVolume(masterVolume)}
                    value={masterVolume}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={setMasterVolume}
                />
                <SettingSlider
                    id="setting-sfx"
                    label="Effects volume"
                    display={formatVolume(sfxVolume)}
                    value={sfxVolume}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={setSfxVolume}
                />
                <SettingToggle
                    id="setting-haptics"
                    label="Vibration (touch devices)"
                    checked={hapticsEnabled}
                    onChange={setHapticsEnabled}
                />

                <h3 className="modal__subtitle">Controls</h3>
                <dl className="keybinds">
                    {KEYBINDS.map(([key, action]) => (
                        <div className="keybinds__row" key={key}>
                            <dt className="keybinds__key">{key}</dt>
                            <dd className="keybinds__action">{action}</dd>
                        </div>
                    ))}
                </dl>

                <div className="setting" data-version-row>
                    <div className="setting__header">
                        <span className="setting__label">Version</span>
                        <span className="setting__value">{GAME_VERSION}</span>
                    </div>
                </div>

                <div className="modal__actions">
                    <Button variant="primary" onClick={close} autoFocus data-settings-close>
                        Done
                    </Button>
                </div>
            </div>
        </div>
    );
};
