import { useSession } from "@/ui/viewmodels/session";
import {
    selectArsenalInventory,
    selectArsenalModel,
    useArsenal,
} from "@/ui/viewmodels/arsenal/arsenal.state";

import { Button } from "../atoms/Button";
import { Wordmark } from "../atoms/Wordmark";
import { RigView } from "../molecules/RigView";
import { MenuTemplate } from "../templates/MenuTemplate";

/* The Arsenal view (issue #41).
 *
 * Two panels. The player-model panel renders the CharacterLibrary rig the
 * match avatars use and names it; the full 3D viewer is deferred, so this
 * panel stays its placeholder until then. The inventory/loadout panel renders
 * gracefully empty, bound to the forward-compatible Arsenal data shape
 * (ARS-004) so the deferred shop and unlock flow drops into a structure
 * already present.
 */
const Arsenal = () => {
    const exitArsenal = useSession((s) => s.exitArsenal);
    const model = useArsenal(selectArsenalModel);
    const inventory = useArsenal(selectArsenalInventory);

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
                    <RigView />
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
                    {inventory.length === 0 ? (
                        <div className="arsenal__empty" data-arsenal-empty>
                            <p className="arsenal__empty-copy">
                                Nothing in your loadout yet.
                            </p>
                            <Button variant="secondary" disabled data-arsenal-shop>
                                Browse shop
                            </Button>
                        </div>
                    ) : (
                        <ul className="arsenal__list" data-arsenal-list>
                            {inventory.map((item, index) => (
                                <li key={index} className="arsenal__item">
                                    {typeof item === "string" ? item : String(item)}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </MenuTemplate>
    );
};

export default Arsenal;
