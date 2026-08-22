import { useEffect } from "react";

import { useSession } from "@/ui/viewmodels/session";
import {
    loadArsenalFromServer,
    selectArsenalInventory,
    selectArsenalModel,
    selectEquippedCosmetic,
    useArsenal,
} from "@/ui/viewmodels/arsenal/arsenal.state";
import { inventoryEntryIds } from "@/ui/viewmodels/arsenal/arsenal.model";
import { useShop } from "@/ui/viewmodels/shop/shop.state";
import type { CatalogItem } from "@/net/shopApi";

import { Button } from "../atoms/Button";
import { Wordmark } from "../atoms/Wordmark";
import { RarityBadge } from "../../shop/Swatch";
import { RigView } from "../molecules/RigView";
import { MenuTemplate } from "../templates/MenuTemplate";

/* The Arsenal view (issue #41).
 *
 * Two panels. The player-model panel renders the CharacterLibrary rig the
 * match avatars use - now carrying any equipped cosmetic's skin through
 * the shared application routine (COS-001) - and names it; the full 3D
 * viewer is deferred, so this panel stays its placeholder until then. The
 * inventory panel joins the envelope's ownership records against the
 * catalog and renders gracefully empty, bound to the forward-compatible
 * Arsenal data shape (ARS-004); legacy plain-string entries render as
 * themselves rather than crashing the join.
 */
const Arsenal = () => {
    const exitArsenal = useSession((s) => s.exitArsenal);
    const enterShop = useSession((s) => s.enterShop);
    const model = useArsenal(selectArsenalModel);
    const inventory = useArsenal(selectArsenalInventory);
    // The catalog names what ownership entries mean; a failed or empty
    // fetch leaves the ids speaking for themselves.
    const catalogItems = useShop((s) => s.items);

    useEffect(() => {
        void loadArsenalFromServer();
        void useShop.getState().loadCatalog();
    }, []);

    const byId = new Map<string, CatalogItem>(
        catalogItems.map((item) => [item.id, item]),
    );
    const ownedIds = inventoryEntryIds(inventory);
    const equippedId = useArsenal(selectEquippedCosmetic);
    const equippedItem = equippedId ? byId.get(equippedId) : undefined;

    return (
        <MenuTemplate
            width="wide"
            header={
                <>
                    <Wordmark>SHOOT4FUN</Wordmark>
                    <p className="menu__lead">Your loadout and inventory.</p>
                </>
            }
        >
            <div className="arsenal" data-arsenal-view>
                <Button
                    variant="ghost"
                    onClick={exitArsenal}
                    data-arsenal-back
                >
                    &larr; Back to menu
                </Button>

                <section
                    className="arsenal__panel arsenal__model"
                    data-arsenal-model
                >
                    <h2 className="arsenal__title">Operator</h2>
                    <RigView
                        cosmeticId={equippedId}
                        cosmeticSkin={equippedItem?.skin ?? null}
                    />
                    <p className="arsenal__model-name" data-arsenal-model-name>
                        {model}
                    </p>
                    <p className="arsenal__hint">
                        Your current rig, standing idle. The full 3D character
                        viewer lands in a later drop.
                    </p>
                </section>

                <section
                    className="arsenal__panel arsenal__inventory"
                    data-arsenal-inventory
                >
                    <h2 className="arsenal__title">Inventory &amp; loadout</h2>
                    {ownedIds.length === 0 ? (
                        <div className="arsenal__empty" data-arsenal-empty>
                            <p className="arsenal__empty-copy">
                                Nothing in your loadout yet.
                            </p>
                            <Button
                                variant="secondary"
                                onClick={enterShop}
                                data-arsenal-shop
                            >
                                Browse shop
                            </Button>
                        </div>
                    ) : (
                        <ul className="arsenal__list" data-arsenal-list>
                            {ownedIds.map((itemId) => {
                                const item = byId.get(itemId);
                                return (
                                    <li key={itemId} className="arsenal__item">
                                        {item ? (
                                            <>
                                                {item.name}
                                                <RarityBadge rarity={item.rarity} />
                                            </>
                                        ) : (
                                            itemId
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
        </MenuTemplate>
    );
};

export default Arsenal;
