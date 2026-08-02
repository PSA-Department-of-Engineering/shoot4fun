import type { InputHTMLAttributes } from "react";

import { cx } from "../cx";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    /** Room codes are read aloud and typed back in, so they get the mono
     * face, wide tracking and no autocorrect. */
    code?: boolean;
}

export const TextField = ({ code = false, className, ...rest }: TextFieldProps) => (
    <input
        type="text"
        className={cx("input", code && "input--code", className)}
        autoComplete="off"
        autoCapitalize={code ? "characters" : "off"}
        autoCorrect="off"
        spellCheck={false}
        {...rest}
    />
);
