/**
 * Copy built eva-web into Capacitor www/ before `cap sync`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "..", "eva-web", "dist");
const dest = path.join(root, "www");

if (!fs.existsSync(path.join(src, "index.html"))) {
  console.error("[eva-mobile] Missing eva-web/dist. Run: npm run eva:web:build");
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`[eva-mobile] Copied ${src} → ${dest}`);
