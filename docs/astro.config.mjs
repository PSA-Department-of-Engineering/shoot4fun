import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  base: process.env.DOCS_BASE || "/",
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
