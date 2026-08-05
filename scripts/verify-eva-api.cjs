/**
 * Smoke-test eva-core HTTP API (health, history, prefs, SSE chat).
 * Usage: node scripts/verify-eva-api.cjs
 * Requires eva-core server already listening (npm run eva:server).
 */
const token = String(process.env.EVA_API_TOKEN || "").trim();
const base = String(process.env.EVA_API_BASE || "http://127.0.0.1:8787").replace(/\/$/, "");

if (!token) {
  console.error("Set EVA_API_TOKEN to match the running server.");
  process.exit(1);
}

async function req(method, path, body) {
  const headers = { Authorization: `Bearer ${token}` };
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${base}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return data;
}

async function chatSse(messages) {
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`chat → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const stages = [];
  let answer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      for (const line of chunk.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const info = JSON.parse(line.slice(5).trim());
        stages.push(info.stage);
        if (info.stage === "answer") answer = info.message;
        if (info.stage === "error") throw new Error(info.message);
        process.stdout.write(`[sse] ${info.stage}: ${String(info.message || "").slice(0, 80)}\n`);
      }
    }
  }
  return { stages, answer };
}

(async () => {
  console.log("health", await req("GET", "/api/health"));
  console.log("prefs", await req("GET", "/api/prefs"));
  const before = await req("GET", "/api/history");
  console.log("history.len", Array.isArray(before) ? before.length : before);

  const probe = [
    ...(Array.isArray(before) ? before.slice(-20) : []),
    { role: "user", content: "verify-ping", ts: new Date().toISOString() },
  ];
  await req("PUT", "/api/history", probe);
  const after = await req("GET", "/api/history");
  console.log("history.len after put", after.length);

  console.log("chat SSE…");
  const { stages, answer } = await chatSse([{ role: "user", content: "hi" }]);
  console.log("stages", stages.join(" → "));
  console.log("answer", String(answer).slice(0, 200));
  if (!answer) throw new Error("No answer from SSE");
  if (!stages.includes("done") && !stages.includes("answer")) {
    throw new Error("Missing answer/done stages");
  }
  console.log("VERIFY OK");
})().catch((err) => {
  console.error("VERIFY FAIL", err?.message || err);
  process.exit(1);
});
