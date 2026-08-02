import type { ButtonHTMLAttributes } from "react";

import { cx } from "../cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    /** Fill the width of the row it sits in. */
    block?: boolean;
}

/* Every button in the game. The rest of the attributes pass through, so
 * a caller can hang the hooks the e2e suite drives off one. */
export const Button = ({
    variant = "secondary",
    block = false,
    className,
    type = "button",
    ...rest
}: ButtonProps) => (
    <button
        type={type}
        className={cx("btn", `btn--${variant}`, block && "btn--block", className)}
        {...rest}
    />
);
