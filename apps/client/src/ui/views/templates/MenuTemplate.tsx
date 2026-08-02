import type { ReactNode } from "react";

import { cx } from "../cx";
import { AppBar } from "../organisms/AppBar";

interface MenuTemplateProps {
    /** Narrow for a single question, wide for a room's worth of state. */
    width?: "narrow" | "wide";
    header: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
}

/* Every out-of-match screen: the bar, a card, and the arena still moving
 * behind it. The scene is never covered outright, because a shooter's
 * menus should sit in the world the match is played in. */
export const MenuTemplate = ({
    width = "narrow",
    header,
    children,
    footer,
}: MenuTemplateProps) => (
    <div className="menu">
        <AppBar />
        <main className={cx("card", "menu__card", `menu__card--${width}`)}>
            <div className="menu__header">{header}</div>
            <div className="menu__body">{children}</div>
            {footer ? <div className="menu__footer">{footer}</div> : null}
        </main>
    </div>
);
