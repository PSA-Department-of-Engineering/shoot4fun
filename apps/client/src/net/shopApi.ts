/* The shop HTTP surface, client side.
 *
 * Reads ride the session carrier like every other call (`sessionHeaders`),
 * so acquisition and equip are scoped to the caller's account and the shop
 * opens no second authentication path (ADR-0008, INT-037). The catalog is
 * the validated static source the server serves (INT-032); the client
 * renders only what it names.
 */

import { AccountRequestError, sessionHeaders } from "./accountApi";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/** Token-backed specs: they name brand tokens, never raw colours. */
export interface PreviewSpec {
    kind: "solid" | "gradient";
    token?: string;
    tokens?: string[];
    direction?: string;
}

export interface SkinSpec {
    region?: string;
    finish?: "solid" | "metallic" | "gradient";
    token?: string;
    tokens?: string[];
    metalness?: number;
    roughness?: number;
}

export interface CatalogItem {
    id: string;
    name: string;
    description: string;
    rarity: Rarity;
    preview: PreviewSpec;
    skin: SkinSpec;
}

export interface AcquireResult {
    item_id: string;
    already_owned: boolean;
    equipped: string | null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(path, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init.headers as Record<string, string>),
        },
    });
    if (!response.ok) {
        const detail = await response
            .json()
            .then((body: { detail?: string }) => body.detail)
            .catch(() => undefined);
        throw new AccountRequestError(response.status, detail ?? "request failed");
    }
    return (await response.json()) as T;
}

export function fetchCatalog(): Promise<{ items: CatalogItem[] }> {
    return request<{ items: CatalogItem[] }>("/api/shop/catalog");
}

export function acquireItem(itemId: string): Promise<AcquireResult> {
    return request<AcquireResult>("/api/shop/acquire", {
        method: "POST",
        headers: sessionHeaders(),
        body: JSON.stringify({ item_id: itemId }),
    });
}

export function equipCosmetic(itemId: string): Promise<{ item_id: string }> {
    return request<{ item_id: string }>("/api/shop/equip", {
        method: "POST",
        headers: sessionHeaders(),
        body: JSON.stringify({ item_id: itemId }),
    });
}
