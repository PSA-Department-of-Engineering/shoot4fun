import { useEffect } from "react";

import { useSession } from "@/ui/viewmodels/session";
import {
    loadArsenalFromServer,
    selectArsenalModel,
    useArsenal,
} from "@/ui/viewmodels/arsenal/arsenal.state";
import { selectAcquiredItem, useShop } from "@/ui/viewmodels/shop/shop.state";

import { Button } from "../views/atoms/Button";
import { Wordmark } from "../views/atoms/Wordmark";
import { RigView } from "../views/molecules/RigView";
import { MenuTemplate } from "../views/templates/MenuTemplate";

/* The Acquired & Apply screen.
 *
 * The unlock wrote the ownership record and auto-equipped the item; this
 * screen confirms it by showing the rig with the just-applied skin - the
 * SAME RigView molecule the Arsenal mounts, one rig surface reused, not a
 * second renderer. The applied material is observable on the host element
 * as `data-equipped-skin`, set by the shared application routine (COS-001).
 */
const ShopAcquired = () => {
    const backToShopCatalog = useSession((s) => s.backToShopCatalog);
    const exitShopToArsenal = useSession((s) => s.exitShopToArsenal);
    const item = useShop(selectAcquiredItem);
    const model = useArsenal(selectArsenalModel);

    useEffect(() => {
        void loadArsenalFromServer();
    }, []);

    return (
        <MenuTemplate
            width="narrow"
            header={
                <>
                    <Wordmark>UNLOCKED</Wordmark>
                    <p className="menu__lead">
                        {item ? (
                            <>
                                <strong data-acquired-name>{item.name}</strong>{" "}
                                is yours and equipped on your operator.
                            </>
                        ) : (
                            "Your unlock is equipped."
                        )}
                    </p>
                </>
            }
        >
            <div className="shop-acquired" data-shop-acquired>
                <div className="arsenal__panel" data-acquired-rig-panel>
                    <RigView
                        cosmeticId={item?.id ?? null}
                        cosmeticSkin={item?.skin ?? null}
                    />
                    {item ? (
                        <p className="arsenal__hint">
                            {item.name}, applied to the {model} rig.
                        </p>
                    ) : (
                        <p className="arsenal__hint">Applied to your rig.</p>
                    )}
                </div>

                <Button
                    variant="primary"
                    onClick={exitShopToArsenal}
                    data-acquired-arsenal
                >
                    Open your Arsenal
                </Button>
                <Button variant="ghost" onClick={backToShopCatalog} data-shop-back>
                    &larr; Back to shop
                </Button>
            </div>
        </MenuTemplate>
    );
};

export default ShopAcquired;
