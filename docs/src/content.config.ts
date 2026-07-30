// Astro 5 discovers content only through a registered collection, and Starlight
// 0.30 ships the loader and schema for its own `docs` collection. Without this
// file the build emits assets and 404.html and no pages at all, which serves as
// a 403 at the docs route root (nginx finds no index to serve).
import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

export const collections = {
    docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};
