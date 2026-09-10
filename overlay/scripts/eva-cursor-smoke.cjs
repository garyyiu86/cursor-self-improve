/**
 * Smoke-test Cursor API key + optional one-file Agent edit.
 *
 *   npm run eva:cursor-smoke
 *   npm run eva:cursor-smoke -- --api-only
 */
require("../../eva-core/log.cjs");
const path = require("node:path");
const { loadEnvFile, getRepoRoot } = require("../../eva-core/env.cjs");

function parseArgs(argv) {
  return { apiOnly: argv.includes("--api-only") };
}

async function main() {
  const { apiOnly } = parseArgs(process.argv.slice(2));
  const root = getRepoRoot();
  loadEnvFile(root);

  const key = String(process.env.CURSOR_API_KEY || "").trim();
  if (!key) {
    console.error("CURSOR_API_KEY missing in .env");
    process.exit(1);
  }
  console.log(`CURSOR_API_KEY: set (len=${key.length})`);

  const { Cursor, Agent } = await import("@cursor/sdk");
  const models = await Cursor.models.list({ apiKey: key });
  const items = Array.isArray(models) ? models : models?.models || models?.items || [];
  const ids = items
    .map((m) => String(m?.id || m?.name || "").trim())
    .filter(Boolean)
    .slice(0, 8);
  console.log(`Cursor.models.list: ok count=${items.length || "?"} sample=${ids.join(",") || "(no ids)"}`);

  if (apiOnly) return;

  console.log("Agent.prompt: confirm :root --send color…");
  const result = await Agent.prompt(
    [
      "Edit ONLY eva-web/src/style.css if needed.",
      "In :root, --send must be #6366f1. If it already is, change nothing and reply already applied.",
      "Do not edit any other file. Do not commit. Reply with the hex you see.",
    ].join("\n"),
    {
      apiKey: key,
      model: { id: "composer-2.5" },
      mode: "agent",
      local: { cwd: root, settingSources: [] },
    },
  );
  console.log(`Agent.prompt status=${result.status} run=${result.id || "-"}`);
  const text = String(result.result || result.error?.message || "").trim();
  if (text) console.log(text.slice(0, 800));
  if (result.status === "error" || result.status === "cancelled") {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err?.name || "Error", err?.message || err);
  process.exit(1);
});
