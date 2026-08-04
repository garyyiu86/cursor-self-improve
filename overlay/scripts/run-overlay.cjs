/**
 * Keeps `npm run overlay` alive across Eva restarts.
 * Eva exits with code EVA_RESTART_EXIT_CODE (default 75) → this runner spawns Electron again.
 * Quit / crash with other codes → runner exits (npm stops).
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const electronBin = require("electron");
const RESTART_CODE = Number(process.env.EVA_RESTART_EXIT_CODE || 75);

let child = null;
let stopping = false;

function start() {
  console.log("[overlay-runner] starting Electron…");
  child = spawn(electronBin, ["."], {
    cwd: root,
    env: {
      ...process.env,
      EVA_UNDER_RUNNER: "1",
      EVA_RESTART_EXIT_CODE: String(RESTART_CODE),
    },
    stdio: "inherit",
    windowsHide: false,
  });

  child.on("exit", (code, signal) => {
    child = null;
    const exitCode = code == null ? (signal ? 1 : 0) : code;

    if (stopping) {
      process.exit(exitCode);
      return;
    }

    if (exitCode === RESTART_CODE) {
      console.log(`[overlay-runner] Eva requested restart (code ${RESTART_CODE}) — relaunching…`);
      start();
      return;
    }

    console.log(`[overlay-runner] Electron exited code=${exitCode}${signal ? ` signal=${signal}` : ""}`);
    process.exit(exitCode);
  });

  child.on("error", (err) => {
    console.error("[overlay-runner] failed to start Electron:", err?.message || err);
    process.exit(1);
  });
}

function shutdown() {
  if (stopping) return;
  stopping = true;
  if (child && !child.killed) {
    child.kill("SIGTERM");
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
