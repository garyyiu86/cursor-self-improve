import { execSync } from "node:child_process";
import { Agent, CursorAgentError } from "@cursor/sdk";

const MAX_ROUNDS = Number(process.env.MAX_ROUNDS ?? 5);
const TEST_CMD = process.env.TEST_CMD ?? "npm test";

function runTests(): { ok: boolean; log: string } {
  try {
    const log = execSync(TEST_CMD, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, log };
  } catch (error: unknown) {
    const e = error as { stdout?: string; stderr?: string; message?: string };
    const log = `${e.stdout ?? ""}\n${e.stderr ?? ""}\n${e.message ?? ""}`;
    return { ok: false, log };
  }
}

async function main() {
  if (!process.env.CURSOR_API_KEY) {
    console.error(
      "Missing CURSOR_API_KEY. Copy .env.example to .env and set your key from https://cursor.com/dashboard/api",
    );
    process.exit(1);
  }

  await using agent = await Agent.create({
    apiKey: process.env.CURSOR_API_KEY,
    model: { id: "composer-2.5" },
    local: { cwd: process.cwd() },
  });

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    console.log(`\n=== Round ${round}/${MAX_ROUNDS} ===`);
    const { ok, log } = runTests();

    if (ok) {
      console.log("Tests passed. Stopping.");
      return;
    }

    console.log("Tests failed. Asking Cursor agent to fix...");

    const run = await agent.send(
      [
        `Round ${round}: tests failed. Fix the codebase so \`${TEST_CMD}\` passes.`,
        "Keep changes minimal. Do not refactor unrelated code.",
        "The sample under sample/ is intentionally broken for this demo.",
        "Failure output:",
        "```",
        log.slice(-12000),
        "```",
      ].join("\n"),
    );

    const result = await run.wait();
    if (result.status === "error") {
      console.error("Agent run failed:", result.id);
      process.exit(2);
    }
  }

  console.error(`Still failing after ${MAX_ROUNDS} rounds. Needs human review.`);
  process.exit(1);
}

main().catch((err: unknown) => {
  if (err instanceof CursorAgentError) {
    console.error(
      "Startup failed:",
      err.message,
      "retryable=",
      err.isRetryable,
    );
    process.exit(1);
  }
  throw err;
});
