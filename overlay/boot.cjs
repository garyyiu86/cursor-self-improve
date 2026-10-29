/**
 * Bootstrap so load/syntax errors exit cleanly instead of leaving a stuck Electron shell.
 * package.json "main" points here.
 */
const { app } = require("electron");
// Transparent always-on-top windows are otherwise treated as occluded and stop painting.
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

try {
  require("./main.cjs");
} catch (err) {
  console.error("[Eva] Fatal load error — exiting app.");
  console.error(err && err.stack ? err.stack : err);
  // Use a non-restart code so overlay-runner does not loop
  process.exit(1);
}
