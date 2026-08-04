const sharp = require("sharp");
const path = require("node:path");
const fs = require("node:fs");

const assets = path.join(__dirname, "..", "..", "assets");
const TARGET_W = 1024;
const TARGET_H = 737; // match anime-girl-mascot-half.png

async function opaqueBounds(file) {
  const { data, info } = await sharp(file)
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
      const a = data[(y * w + x) * 4 + 3];
      if (a < 24) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function normalizeToStandee(srcName, outName, sizeHint) {
  const src = path.join(assets, srcName);
  const bounds = await opaqueBounds(src);
  if (!bounds) throw new Error("no opaque pixels: " + srcName);

  const trimmed = await sharp(src).extract(bounds).ensureAlpha().png().toBuffer();

  // Match idle standee body HEIGHT primarily so face/torso scale matches
  const maxH = sizeHint?.height || Math.round(TARGET_H * 0.96);
  const maxW = sizeHint?.width
    ? Math.round(sizeHint.width * 1.15)
    : Math.round(TARGET_W * 0.62);

  const fittedPng = await sharp(trimmed)
    .resize({
      width: maxW,
      height: maxH,
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const meta = await sharp(fittedPng).metadata();
  const fw = meta.width;
  const fh = meta.height;
  const left = Math.round((TARGET_W - fw) / 2);
  const top = Math.max(0, TARGET_H - fh);

  await sharp({
    create: {
      width: TARGET_W,
      height: TARGET_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: fittedPng, left, top }])
    .png()
    .toFile(path.join(assets, outName));

  console.log(outName, `${TARGET_W}x${TARGET_H}`, `char ${fw}x${fh}`, `pad top=${top}`);
  return { width: fw, height: fh };
}

(async () => {
  // Restore idle from a clean pass first, then lock that size for expressions.
  // Re-read current half as source of truth for body scale.
  const idleSize = await normalizeToStandee(
    "anime-girl-mascot-half.png",
    "anime-girl-mascot-half.png",
    { width: 580, height: 708 },
  );
  const hint = { width: idleSize.width, height: idleSize.height };
  await normalizeToStandee("eva-expr-thinking.png", "eva-expr-thinking.png", hint);
  await normalizeToStandee("eva-expr-happy.png", "eva-expr-happy.png", hint);
  await normalizeToStandee("eva-expr-confused.png", "eva-expr-confused.png", hint);
  await normalizeToStandee("eva-expr-shy.png", "eva-expr-shy.png", hint);
})().catch((err) => {
  console.error(err);
  require("node:process").exit(1);
});
