const path = require("node:path");
const fs = require("node:fs");

try {
  require("node:dns").setDefaultResultOrder("ipv4first");
} catch (_) {}

let _dataDir = null;
const _repoRoot = path.join(__dirname, "..");
const _overlayDir = path.join(_repoRoot, "overlay");

function setDataDir(dir) {
  _dataDir = String(dir || "").trim() || null;
  if (_dataDir) fs.mkdirSync(_dataDir, { recursive: true });
}

function getDataDir() {
  if (_dataDir) return _dataDir;
  const fromEnv = String(process.env.EVA_DATA_DIR || "").trim();
  if (fromEnv) {
    _dataDir = fromEnv;
    fs.mkdirSync(_dataDir, { recursive: true });
    return _dataDir;
  }
  _dataDir = path.join(_overlayDir, "data");
  fs.mkdirSync(_dataDir, { recursive: true });
  return _dataDir;
}

function getOverlayDir() {
  return _overlayDir;
}

function getRepoRoot() {
  return _repoRoot;
}

function loadEnvFile(rootDir) {
  const envPath = path.join(rootDir || _repoRoot, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i <= 0) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

module.exports = {
  loadEnvFile,
  getDataDir,
  setDataDir,
  getOverlayDir,
  getRepoRoot,
};
