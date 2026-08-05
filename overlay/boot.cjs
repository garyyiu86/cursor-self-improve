/**
 * Bootstrap so load/syntax errors exit cleanly instead of leaving a stuck Electron shell.
 * package.json "main" points here.
 */
try {
  require("./main.cjs");
} catch (err) {
  console.error("[Eva] Fatal load error — exiting app.");
  console.error(err && err.stack ? err.stack : err);
  // Use a non-restart code so overlay-runner does not loop
  process.exit(1);
}
