/* Rasterise the brand SVG assets to PNG/ICO for the README header,
 * the favicon, and the PWA icons. Uses @resvg/resvg-js with the
 * self-hosted WOFF2 fonts in the build context.
 *
 * Run: `node scripts/rasterise.mjs`
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const fontsDir = path.join(root, "apps/client/public/fonts");

async function loadFontFiles() {
    try {
        const files = await fs.readdir(fontsDir);
        return files
            .filter((f) => f.endsWith(".woff2") || f.endsWith(".ttf"))
            .map((f) => path.join(fontsDir, f));
    } catch {
        return [];
    }
}

async function rasterize(svgPath, outPath, width, height) {
    const svg = await fs.readFile(svgPath, "utf8");
    const fontFiles = await loadFontFiles();
    const resvg = new Resvg(svg, {
        background: "transparent",
        font: {
            fontFiles: fontFiles,
            defaultFontFamily: "Russo One",
        },
        fitTo: { mode: "width", value: width },
    });
    const png = resvg.render().asPng();
    await fs.writeFile(outPath, png);
    console.log(`  wrote ${path.relative(root, outPath)} (${width}×${height})`);
}

async function main() {
    const wordmark = path.join(root, "docs/logo.svg");
    const monogram = path.join(root, "docs/logo-monogram.svg");

    // README header.
    await rasterize(wordmark, path.join(root, "docs/logo.png"), 600, 160);
    await rasterize(wordmark, path.join(root, "docs/logo@2x.png"), 1200, 320);

    // Favicon + PWA icons from the monogram.
    const publicDir = path.join(root, "apps/client/public");
    await fs.mkdir(publicDir, { recursive: true });
    await rasterize(monogram, path.join(publicDir, "favicon.png"), 32, 32);
    await rasterize(monogram, path.join(publicDir, "apple-touch-icon.png"), 180, 180);
    await rasterize(monogram, path.join(publicDir, "icon-192.png"), 192, 192);
    await rasterize(monogram, path.join(publicDir, "icon-512.png"), 512, 512);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
