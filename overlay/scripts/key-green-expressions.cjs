const sharp = require("sharp");
const path = require("node:path");

const srcDir =
  "C:/Users/gyiu/.cursor/projects/c-Users-gyiu-source-repos-cursor-self-improve/assets";
const dstDir = path.join(__dirname, "..", "..", "assets");

function greenAlpha(r, g, b) {
  const greenDom = g > 80 && g > r + 30 && g > b + 30;
  if (!greenDom) return 255;
  const dominance = Math.min(g - r, g - b);
  const sat = g - Math.max(r, b);
  if (sat > 60 && dominance > 50) return 0;
  if (sat > 35 && dominance > 30) return Math.max(0, 255 - sat * 3);
  if (g > 180 && r < 140 && b < 140) return Math.max(0, 255 - (g - Math.max(r, b)) * 2);
  return 255;
}

async function process(name, outName) {
  const input = path.join(srcDir, name);
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = greenAlpha(r, g, b);
    data[i + 3] = a;
    if (a > 0 && a < 255 && g > r && g > b) {
      const spill = Math.min(g - r, g - b) * 0.6;
      data[i + 1] = Math.max(0, g - spill);
    }
  }
  const cropH = Math.round(h * 0.52);
  const cropped = Buffer.alloc(w * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    data.copy(cropped, y * w * 4, y * w * 4, (y + 1) * w * 4);
  }
  let trans = 0;
  for (let i = 3; i < cropped.length; i += 4) if (cropped[i] < 16) trans++;
  const out = path.join(dstDir, outName);
  await sharp(cropped, { raw: { width: w, height: cropH, channels: 4 } })
    .png()
    .toFile(out);
  console.log(outName, `${w}x${cropH}`, "trans", trans);
}

(async () => {
  await process("eva-expr-thinking-raw.png", "eva-expr-thinking.png");
  await process("eva-expr-happy-raw.png", "eva-expr-happy.png");
  await process("eva-expr-confused-raw.png", "eva-expr-confused.png");
  await process("eva-expr-shy-raw.png", "eva-expr-shy.png");
})().catch((err) => {
  console.error(err);
  require("node:process").exit(1);
});
