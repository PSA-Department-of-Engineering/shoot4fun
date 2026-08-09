interface SettingToggleProps {
    id: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

/* An on/off preference: a labelled checkbox that sits in the same row
 * shape as `SettingSlider`, so a boolean setting reads as a peer of the
 * dials above it rather than a different kind of control. */
export const SettingToggle = ({ id, label, checked, onChange }: SettingToggleProps) => (
    <div className="setting">
        <div className="setting__header">
            <label className="setting__label" htmlFor={id}>
                {label}
            </label>
            <input
                id={id}
                type="checkbox"
                className="setting__toggle"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
            />
        </div>
    </div>
);
