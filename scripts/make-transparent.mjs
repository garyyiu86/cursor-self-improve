import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(__dirname, "..", "assets", "anime-girl-mascot.png");
const output = path.join(
  __dirname,
  "..",
  "assets",
  "anime-girl-mascot-transparent.png",
);

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const w = info.width;
const h = info.height;
const px = Buffer.from(data);
const visited = new Uint8Array(w * h);

function idx(x, y) {
  return (y * w + x) * 4;
}

function similar(i, seed) {
  const dr = Math.abs(px[i] - seed.r);
  const dg = Math.abs(px[i + 1] - seed.g);
  const db = Math.abs(px[i + 2] - seed.b);
  // Only knock out near-background colors (studio cream / white)
  return dr + dg + db < 70 && px[i] > 175 && px[i + 1] > 160 && px[i + 2] > 140;
}

// Flood-fill ONLY from edges so face/hair interior stays solid
const stack = [];
const seeds = [
  { x: 0, y: 0 },
  { x: w - 1, y: 0 },
  { x: 0, y: h - 1 },
  { x: w - 1, y: h - 1 },
  { x: (w / 2) | 0, y: 0 },
  { x: (w / 2) | 0, y: h - 1 },
];

for (const s of seeds) {
  const i = idx(s.x, s.y);
  const seed = { r: px[i], g: px[i + 1], b: px[i + 2] };
  stack.push({ x: s.x, y: s.y, seed });
}

while (stack.length) {
  const { x, y, seed } = stack.pop();
  if (x < 0 || y < 0 || x >= w || y >= h) continue;
  const p = y * w + x;
  if (visited[p]) continue;
  const i = idx(x, y);
  if (!similar(i, seed)) continue;
  visited[p] = 1;
  px[i + 3] = 0;
  stack.push({ x: x + 1, y, seed });
  stack.push({ x: x - 1, y, seed });
  stack.push({ x: x, y: y + 1, seed });
  stack.push({ x: x, y: y - 1, seed });
}

await sharp(px, {
  raw: { width: w, height: h, channels: 4 },
})
  .png()
  .toFile(output);

console.log("Wrote edge-flood transparent mascot (face preserved)");
