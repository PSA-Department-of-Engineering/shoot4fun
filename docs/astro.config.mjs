import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

const base = process.env.DOCS_BASE || "/apps/shoot4fun";

export default defineConfig({
  base,
  site: "https://shoot4fun.chaos-architect.dev",
  integrations: [
    starlight({
      title: "Shoot4Fun",
      favicon: "/favicon.ico",
      logo: { light: "/logo.png", dark: "/logo.png" },
    }),
  ],
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
