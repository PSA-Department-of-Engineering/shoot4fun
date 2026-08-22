import { useEffect } from "react";

import { useSession } from "@/ui/viewmodels/session";
import {
    selectArsenalInventory,
    selectEquippedCosmetic,
    loadArsenalFromServer,
    useArsenal,
} from "@/ui/viewmodels/arsenal/arsenal.state";
import { inventoryEntryIds } from "@/ui/viewmodels/arsenal/arsenal.model";
import { selectSelectedItem, useShop } from "@/ui/viewmodels/shop/shop.state";

import { Button } from "../views/atoms/Button";
import { RarityBadge, Swatch } from "./Swatch";
import { MenuTemplate } from "../views/templates/MenuTemplate";

/* The item detail screen (SHOP-002).
 *
 * Name, description, preview and rarity badge - and the Unlock affordance,
 * which lives here and nowhere else: browse never mutates state. Unlock is
 * a free grant; it writes the ADR-0007 ownership record, auto-equips, and
 * hands over to the Acquired screen. Back path (locked): detail -> catalog.
 */
const ShopItemDetail = () => {
    const backToShopCatalog = useSession((s) => s.backToShopCatalog);
    const gotoShopAcquired = useSession((s) => s.gotoShopAcquired);
    const item = useShop(selectSelectedItem);
    const acquire = useShop((s) => s.acquire);
    const inventory = useArsenal(selectArsenalInventory);
    const ownedIds = inventoryEntryIds(inventory);
    const equipped = useArsenal(selectEquippedCosmetic);

    useEffect(() => {
        void loadArsenalFromServer();
    }, []);

    if (!item) {
        return (
            <MenuTemplate width="narrow" header={<></>}>
                <Button variant="ghost" onClick={backToShopCatalog} data-shop-back>
                    &larr; Back to shop
                </Button>
                <p className="panel__empty">Pick an item from the catalog first.</p>
            </MenuTemplate>
        );
    }

    const owned = ownedIds.includes(item.id);

    return (
        <MenuTemplate
            width="narrow"
            header={
                <>
                    <RarityBadge rarity={item.rarity} />
                    <h2 className="menu__title" data-item-name>
                        {item.name}
                    </h2>
                    <p className="menu__lead" data-item-description>
                        {item.description}
                    </p>
                </>
            }
        >
            <div className="shop-detail" data-shop-detail>
                <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={backToShopCatalog}
                    data-shop-back
                >
                    &larr; Back to shop
                </button>

                <RarityBadge rarity={item.rarity} />

                <div className={`shop-detail__preview swatch--${item.rarity}`}>
                    <Swatch spec={item.preview} />
                </div>

                {owned ? (
                    <div className="shop-detail__owned" data-item-owned-panel>
                        {equipped === item.id ? (
                            <p className="field__hint">
                                Owned, and equipped on your rig.
                            </p>
                        ) : (
                            <p className="field__hint">Owned.</p>
                        )}
                    </div>
                ) : (
                    <Button
                        variant="primary"
                        block
                        onClick={async () => {
                            // Free unlock: no price to check (MON-001).
                            const ok = await acquire(item.id);
                            if (ok) gotoShopAcquired();
                        }}
                        data-unlock={item.id}
                    >
                        Unlock
                    </Button>
                )}
            </div>
        </MenuTemplate>
    );
};

export default ShopItemDetail;
