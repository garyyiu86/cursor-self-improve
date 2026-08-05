const { nowMs, logTiming } = require("./timing.cjs");

async function tavilySearchRaw(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing TAVILY_API_KEY in .env. Add it locally (do not paste keys in chat).",
    );
  }

  const t0 = nowMs();
  console.log(`[Eva][timing] Tavily start q="${String(query).slice(0, 60)}"`);
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_answer: true,
      max_results: 5,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logTiming("Tavily error", t0, `status=${res.status}`);
    throw new Error(`Tavily error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const sources = (Array.isArray(data.results) ? data.results : [])
    .slice(0, 5)
    .map((r) => ({
      title: String(r.title || "Result"),
      url: String(r.url || ""),
      snippet: String(r.content || "").trim().slice(0, 280),
    }));

  logTiming(
    "Tavily OK",
    t0,
    `results=${sources.length} answerChars=${String(data.answer || "").length}`,
  );

  return {
    answer: String(data.answer || "").trim(),
    sources,
  };
}

function formatTavilyNotes(raw) {
  const lines = [];
  if (raw?.answer) {
    lines.push(String(raw.answer).trim());
    lines.push("");
  }
  for (const r of raw?.sources || []) {
    lines.push(`• ${r.title}`);
    if (r.snippet) lines.push(`  ${r.snippet}`);
    if (r.url) lines.push(`  ${r.url}`);
    lines.push("");
  }
  return lines.join("\n").trim() || "(No Tavily results)";
}

async function tavilySearch(query) {
  return formatTavilyNotes(await tavilySearchRaw(query));
}

function tavilyEnabled() {
  if (process.env.EVA_USE_SEARCH === "0") return false;
  return Boolean(String(process.env.TAVILY_API_KEY || "").trim());
}

module.exports = {
  tavilySearchRaw,
  formatTavilyNotes,
  tavilySearch,
  tavilyEnabled,
};
