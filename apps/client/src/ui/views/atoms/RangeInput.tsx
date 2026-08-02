import type { InputHTMLAttributes } from "react";

import { cx } from "../cx";

type RangeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/* A continuous preference: mouse sensitivity, a volume. Arrow keys move
 * it by one step, which is why it is a range and not a pair of buttons. */
export const RangeInput = ({ className, ...rest }: RangeInputProps) => (
    <input
        type="range"
        className={cx("range", className)}
        {...rest}
    />
);
