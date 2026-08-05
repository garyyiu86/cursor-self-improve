function nowMs() {
  return Date.now();
}

function msSince(start) {
  return Math.max(0, nowMs() - start);
}

function logTiming(label, start, extra = "") {
  const suffix = extra ? ` ${extra}` : "";
  console.log(`[Eva][timing] ${label}: ${msSince(start)}ms${suffix}`);
}

module.exports = { nowMs, msSince, logTiming };
