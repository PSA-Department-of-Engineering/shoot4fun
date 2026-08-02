import { cx } from "../cx";

interface WordmarkProps {
    /** The banner the screen is named by, rendered as the page heading. */
    children: string;
    className?: string;
}

/* The locked Wordmark role: Russo One at the weight and size the brand
 * fixes. It belongs to the surfaces that announce the game itself, the
 * entry splash, the pointer-lock gate and the results banner. */
export const Wordmark = ({ children, className }: WordmarkProps) => (
    <h1 className={cx("wordmark", className)}>{children}</h1>
);
