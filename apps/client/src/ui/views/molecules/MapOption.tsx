interface MapOptionProps {
    /** Shared across the options so the group is one radio set. */
    groupName: string;
    value: string;
    name: string;
    blurb: string;
    selected: boolean;
    disabled: boolean;
    onSelect: (value: string) => void;
}

/* One arena to choose. A real radio underneath: the arrow keys walk the
 * group, and the whole card is the label, so the click target is the card
 * rather than a dot beside it. */
export const MapOption = ({
    groupName,
    value,
    name,
    blurb,
    selected,
    disabled,
    onSelect,
}: MapOptionProps) => (
    <label
        className="map-option"
        data-arena={value}
        data-selected={selected}
        data-disabled={disabled}
    >
        <input
            className="map-option__input"
            type="radio"
            name={groupName}
            value={value}
            checked={selected}
            disabled={disabled}
            onChange={() => onSelect(value)}
        />
        <span className="map-option__name">{name}</span>
        <span className="map-option__blurb">{blurb}</span>
    </label>
);
