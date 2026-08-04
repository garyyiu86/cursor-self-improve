const sharp = require("sharp");
const path = require("node:path");
const fs = require("node:fs");

const srcDir =
  "C:/Users/gyiu/.cursor/projects/c-Users-gyiu-source-repos-cursor-self-improve/assets";
const dstDir = path.join(__dirname, "..", "..", "assets");
const TARGET_W = 1024;
const TARGET_H = 737;

function greenAlpha(r, g, b) {
  const greenDom = g > 80 && g > r + 28 && g > b + 28;
  if (!greenDom) return 255;
  const dominance = Math.min(g - r, g - b);
  const sat = g - Math.max(r, b);
  if (sat > 55 && dominance > 45) return 0;
  if (sat > 30 && dominance > 25) return Math.max(0, 255 - sat * 3);
  if (g > 170 && r < 150 && b < 150) return Math.max(0, 255 - (g - Math.max(r, b)) * 2);
  return 255;
}

async function chromaKeyToBuffer(inputPath) {
  const { data, info } = await sharp(inputPath)
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
      const spill = Math.min(g - r, g - b) * 0.65;
      data[i + 1] = Math.max(0, g - spill);
    }
  }
  // fringe cleanup
  const idx = (x, y) => (y * w + x) * 4;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const o = idx(x, y);
      if (data[o + 3] === 0) continue;
      const r = data[o];
      const g = data[o + 1];
      const b = data[o + 2];
      if (!(g > r + 25 && g > b + 25 && g > 90)) continue;
      let nearT = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (data[idx(x + dx, y + dy) + 3] < 16) {
          nearT = true;
          break;
        }
      }
      if (nearT || g - Math.max(r, b) > 45) data[o + 3] = 0;
      else data[o + 1] = Math.max(r, b);
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

async function opaqueBoundsFromFile(bufOrPath) {
  const { data, info } = await sharp(bufOrPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < 24) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function fitToStandee(pngBuf, targetH) {
  const bounds = await opaqueBoundsFromFile(pngBuf);
  const trimmed = await sharp(pngBuf).extract(bounds).ensureAlpha().png().toBuffer();
  const fitted = await sharp(trimmed)
    .resize({ height: targetH, fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharp(fitted).metadata();
  const left = Math.round((TARGET_W - meta.width) / 2);
  const top = Math.max(0, TARGET_H - meta.height);
  return sharp({
    create: {
      width: TARGET_W,
      height: TARGET_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: fitted, left, top }])
    .png()
    .toBuffer()
    .then(async (out) => {
      console.log(`char ${meta.width}x${meta.height} top=${top}`);
      return out;
    });
}

async function process(rawName, outName, targetH) {
  const input = path.join(srcDir, rawName);
  if (!fs.existsSync(input)) throw new Error("missing " + input);
  const keyed = await chromaKeyToBuffer(input);
  const fitted = await fitToStandee(keyed, targetH);
  const out = path.join(dstDir, outName);
  fs.writeFileSync(out, fitted);
  console.log("wrote", outName);
}

(async () => {
  // Match idle half-body height closely
  const idleH = 700;
  await process("eva-half-thinking-raw.png", "eva-expr-thinking.png", idleH);
  await process("eva-half-happy-raw.png", "eva-expr-happy.png", idleH);
  await process("eva-half-confused-raw.png", "eva-expr-confused.png", idleH);
  await process("eva-half-shy-raw.png", "eva-expr-shy.png", idleH);
})().catch((err) => {
  console.error(err);
  require("node:process").exit(1);
});
