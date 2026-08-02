import { RangeInput } from "../atoms/RangeInput";

interface SettingSliderProps {
    id: string;
    label: string;
    /** The current value, already formatted for a human. */
    display: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
}

/* A preference with its current value beside it, so moving the slider
 * shows what it is being moved to. */
export const SettingSlider = ({
    id,
    label,
    display,
    value,
    min,
    max,
    step,
    onChange,
}: SettingSliderProps) => (
    <div className="setting">
        <div className="setting__header">
            <label className="setting__label" htmlFor={id}>
                {label}
            </label>
            <output className="setting__value" htmlFor={id}>
                {display}
            </output>
        </div>
        <RangeInput
            id={id}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(event) => onChange(Number(event.target.value))}
        />
    </div>
);
