import { useEffect } from "react";

import { useSession } from "@/ui/viewmodels/session";
import {
    selectArsenalInventory,
    loadArsenalFromServer,
    useArsenal,
} from "@/ui/viewmodels/arsenal/arsenal.state";
import { inventoryEntryIds } from "@/ui/viewmodels/arsenal/arsenal.model";
import { useShop } from "@/ui/viewmodels/shop/shop.state";

import { Wordmark } from "../views/atoms/Wordmark";
import { RarityBadge, Swatch } from "./Swatch";
import { MenuTemplate } from "../views/templates/MenuTemplate";
import { cx } from "../views/cx";

/* The shop catalog (SHOP-001).
 *
 * One card per item the validated catalog serves, each linking whole-card
 * to the item's detail route - browse alone never mutates state. Back path
 * (locked): catalog -> arsenal.
 */
const ShopCatalog = () => {
    const exitShopToArsenal = useSession((s) => s.exitShopToArsenal);
    const openShopItem = useSession((s) => s.openShopItem);
    const selectItem = useShop((s) => s.selectItem);
    const items = useShop((s) => s.items);
    const loaded = useShop((s) => s.loaded);
    const error = useShop((s) => s.error);
    const inventory = useArsenal(selectArsenalInventory);
    // Derived from the stable envelope reference; a selector that returned
    // a fresh array every call would re-render this screen forever.
    const ownedIds = inventoryEntryIds(inventory);

    useEffect(() => {
        void useShop.getState().loadCatalog();
        void loadArsenalFromServer();
    }, []);

    return (
        <MenuTemplate
            width="wide"
            header={
                <>
                    <Wordmark>SHOOT4FUN</Wordmark>
                    <p className="menu__lead">
                        Skins and cosmetics for your operator. Free unlocks.
                    </p>
                </>
            }
        >
            <div className="shop" data-shop-catalog>
                <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={exitShopToArsenal}
                    data-shop-back
                >
                    &larr; Back to arsenal
                </button>

                {error ? (
                    <p className="join__error" role="alert">
                        {error}
                    </p>
                ) : null}

                <ul className="shop__grid" data-shop-grid>
                    {items.map((item) => (
                        <li key={item.id}>
                            <button
                                type="button"
                                className={cx(
                                    "shop-card",
                                    `shop-card--${item.rarity}`,
                                )}
                                onClick={() => {
                                    selectItem(item.id);
                                    openShopItem();
                                }}
                                data-item-link={item.id}
                            >
                                <span
                                    className={cx(
                                        "swatch",
                                        `swatch--${item.rarity}`,
                                    )}
                                    aria-hidden="true"
                                >
                                    <Swatch spec={item.preview} />
                                </span>
                                <span className="shop-card__name">
                                    {item.name}
                                </span>
                                <RarityBadge rarity={item.rarity} />
                                {ownedIds.includes(item.id) ? (
                                    <span
                                        className="shop-card__owned"
                                        data-item-owned
                                    >
                                        Owned
                                    </span>
                                ) : null}
                            </button>
                        </li>
                    ))}
                </ul>

                {loaded && items.length === 0 ? (
                    <p className="panel__empty">The catalog is empty.</p>
                ) : null}
            </div>
        </MenuTemplate>
    );
};

export default ShopCatalog;
