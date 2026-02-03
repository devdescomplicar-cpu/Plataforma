/**
 * Generates PWA icons (192x192 and 512x512) from public/favicon.svg.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const svg = readFileSync(join(publicDir, "favicon.svg"));

for (const size of [192, 512]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(publicDir, `pwa-${size}.png`));
  console.log(`Generated public/pwa-${size}.png`);
}
