/**
 * Prefix console output with local timestamps.
 * Safe to require multiple times (installs once per process).
 */

function formatTimestamp(d = new Date()) {
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  );
}

function installConsoleTimestamps() {
  if (global.__evaConsoleTimestampsInstalled) return;
  global.__evaConsoleTimestampsInstalled = true;

  for (const level of ["log", "warn", "error", "info", "debug"]) {
    if (typeof console[level] !== "function") continue;
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(`[${formatTimestamp()}]`, ...args);
    };
  }
}

installConsoleTimestamps();

module.exports = { formatTimestamp, installConsoleTimestamps };
