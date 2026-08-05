const knowledgeDb = require("./knowledge-db.cjs");
const { nowMs, logTiming } = require("./timing.cjs");
const { tavilySearchRaw, formatTavilyNotes, tavilyEnabled } = require("./tavily.cjs");

function formatKbHits(hits) {
  return hits
    .map((h, i) => {
      const e = h.entry;
      const lines = [
        `[KB#${i + 1} score=${h.score.toFixed(1)}] Q: ${e.query}`,
      ];
      if (e.answer) lines.push(`A: ${e.answer}`);
      if (e.notes && e.notes !== e.answer) {
        lines.push(String(e.notes).slice(0, 1600));
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function kbEnabled() {
  if (process.env.EVA_USE_KB === "0") return false;
  return Boolean(
    String(process.env.EVA_DATABASE_URL || process.env.DATABASE_URL || "").trim(),
  );
}

function searchEnabled() {
  return kbEnabled() && tavilyEnabled();
}

async function gatherKnowledgeForOllama(query, { allowSearch = true, onProgress } = {}) {
  const progress = (stage, message) => {
    try {
      onProgress?.({ stage, message });
    } catch (_) {}
  };
  const tAll = nowMs();
  let hits = [];
  let kbNotes = "";

  if (kbEnabled()) {
    progress("kb", "① 正在查知識庫…");
    const tKb = nowMs();
    try {
      hits = await knowledgeDb.searchKnowledgeBase(query, 3);
      logTiming(
        "KB search",
        tKb,
        `hits=${hits.length} best=${hits[0] ? hits[0].score.toFixed(1) : "-"}`,
      );
    } catch (err) {
      logTiming("KB search failed", tKb);
      console.warn("[Eva][KB] search failed:", err?.message || err);
    }

    const best = hits[0];
    const KB_HIT_SCORE = Number(process.env.EVA_KB_MIN_SCORE || 7);
    if (best && best.score >= KB_HIT_SCORE) {
      kbNotes = formatKbHits(hits);
      console.log(`[Eva] KB hit score=${best.score.toFixed(1)} q="${query.slice(0, 50)}"`);
      progress("kb", "① 知識庫已有資料");
      logTiming("gatherKnowledge total", tAll, "source=kb (skip tavily)");
      return { notes: kbNotes, source: "kb", refreshed: false };
    }
    if (hits.length) {
      kbNotes = formatKbHits(hits);
      console.log(`[Eva] KB weak hits=${hits.length} → try Tavily`);
    } else {
      console.log(`[Eva] KB miss q="${query.slice(0, 50)}"`);
    }
  } else {
    console.warn("[Eva][KB] skipped: EVA_DATABASE_URL missing or EVA_USE_KB=0");
  }

  if (!allowSearch) {
    progress("kb", "② 未啟用搜尋，用現有資料");
    logTiming("gatherKnowledge total", tAll, kbNotes ? "source=kb-weak (search off)" : "source=none");
    return {
      notes: kbNotes,
      source: kbNotes ? "kb-weak" : "none",
      refreshed: false,
    };
  }

  if (!tavilyEnabled()) {
    console.warn("[Eva] Tavily disabled/missing TAVILY_API_KEY");
    progress("search", "② 未啟用網路搜尋");
    logTiming("gatherKnowledge total", tAll, kbNotes ? "source=kb-weak (no tavily)" : "source=none");
    return {
      notes: kbNotes,
      source: kbNotes ? "kb-weak" : "none",
      refreshed: false,
    };
  }

  try {
    console.log(`[Eva] ② Tavily q="${query.slice(0, 50)}"`);
    progress("search", "② 正在上網搜尋（Tavily）…");
    const raw = await tavilySearchRaw(query);
    const tavilyNotes = formatTavilyNotes(raw);
    const hasTavily = Boolean(String(tavilyNotes || "").trim());

    if (hasTavily && kbEnabled()) {
      const tSave = nowMs();
      try {
        const saved = await knowledgeDb.addKnowledgeEntry({
          query,
          answer: raw.answer,
          notes: tavilyNotes,
          sources: raw.sources,
        });
        logTiming("KB save", tSave, `id=${saved.id}`);
        console.log(`[Eva][KB] saved id=${saved.id}`);
        progress("search", "② 搜尋完成，已寫入知識庫");
      } catch (err) {
        logTiming("KB save failed", tSave);
        console.warn("[Eva][KB] save failed:", err?.message || err);
        progress("search", "② 搜尋完成（寫入知識庫失敗）");
      }
    } else if (hasTavily) {
      progress("search", "② 搜尋完成");
    } else {
      progress("search", "② 搜尋無有效內容");
    }

    const combined = [kbNotes, hasTavily ? `[Fresh web search]\n${tavilyNotes}` : ""]
      .filter((x) => String(x || "").trim())
      .join("\n\n");

    if (!combined.trim()) {
      logTiming("gatherKnowledge total", tAll, "source=none (kb+tavily empty)");
      return { notes: "", source: "none", refreshed: false };
    }

    logTiming("gatherKnowledge total", tAll, hasTavily ? "source=tavily" : "source=kb-weak");
    return {
      notes: combined,
      source: hasTavily ? (kbNotes ? "kb+tavily" : "tavily") : "kb-weak",
      refreshed: hasTavily,
    };
  } catch (err) {
    console.warn("[Eva] Tavily failed:", err?.message || err);
    progress("search", "② 網路搜尋失敗");
    logTiming("gatherKnowledge total", tAll, kbNotes ? "source=kb-weak (tavily failed)" : "source=none");
    return {
      notes: kbNotes,
      source: kbNotes ? "kb-weak" : "none",
      refreshed: false,
    };
  }
}

async function rememberAnswerInKb(query, answer) {
  if (!kbEnabled()) return;
  const q = String(query || "").trim();
  const a = String(answer || "").trim();
  if (!q || !a || a.length < 8) return;
  if (/抱歉|沒答好|empty Ollama|Cursor apply/i.test(a)) return;
  try {
    const saved = await knowledgeDb.addKnowledgeEntry({
      query: q,
      answer: a,
      notes: a,
      sources: [],
    });
    console.log(`[Eva][KB] remembered chat answer id=${saved.id}`);
  } catch (err) {
    console.warn("[Eva][KB] remember failed:", err?.message || err);
  }
}

function kbAutoWarmupEnabled() {
  if (process.env.EVA_KB_AUTO_WARMUP === "0") return false;
  return kbEnabled() && tavilyEnabled();
}

function extractWarmupTopic(text) {
  let s = String(text || "").trim();
  s = s
    .replace(/[？?！!。．.、，,\s]+$/g, "")
    .replace(
      /^(請問|请问|想問|想问|幫我查|帮我查|查下|查一下|告訴我|告诉我|我想知|我想知道)\s*/i,
      "",
    )
    .replace(
      /^(什麼是|什么是|什麼係|什么係|乜嘢係|乜野係|邊個係|哪个是|哪個是|谁是|誰是|何謂|何谓)\s*/i,
      "",
    )
    .replace(
      /^(點解|点解|為何|为什么|為什麼|如何|怎麼|怎么|怎樣|怎样|幾多|多少|有幾|有几)\s*/i,
      "",
    )
    .replace(/(嗎|么|呢|呀|啊|喇|啦|喔|哦)+$/g, "")
    .trim();
  if (s.length < 2 || s.length > 40) return "";
  return s;
}

function relatedQueriesFromChat(userQuery) {
  const raw = String(userQuery || "").trim();
  if (!raw) return [];
  const topic = extractWarmupTopic(raw);
  const out = [];
  const push = (q) => {
    const t = String(q || "").trim();
    if (!t || t === raw) return;
    if (t.length < 4 || t.length > 80) return;
    if (!out.includes(t)) out.push(t);
  };

  if (topic) {
    push(`${topic}是什麼`);
    push(`${topic}簡介`);
    push(`${topic}有什麼特點`);
    if (/是什麼|是什么|係乜|係咩/.test(raw)) {
      push(`${topic}有什麼用途`);
      push(`${topic}歷史`);
    }
    if (/誰|边个|邊個|谁/.test(raw)) {
      push(`${topic}簡歷`);
      push(`${topic}成就`);
    }
    if (/幾多|多少|多大|多高|多遠|多远/.test(raw)) {
      push(`${topic}是什麼`);
      push(`${topic}相關資料`);
    }
  }

  const max = Math.max(1, Number(process.env.EVA_KB_AUTO_WARMUP_MAX || 3));
  return out.slice(0, max);
}

const kbWarmupQueue = [];
const kbWarmupQueued = new Set();
let kbWarmupBusy = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueueKbWarmup(query, reason = "auto") {
  const q = String(query || "").trim();
  if (!q) return false;
  const key = q.toLowerCase();
  if (kbWarmupQueued.has(key)) return false;
  kbWarmupQueued.add(key);
  kbWarmupQueue.push({ query: q, reason });
  return true;
}

async function warmOneKbQuery(query, reason) {
  const minScore = Number(process.env.EVA_KB_MIN_SCORE || 7);
  const hits = await knowledgeDb.searchKnowledgeBase(query, 1);
  const top = hits[0];
  if (top && top.score >= minScore) {
    console.log(
      `[Eva][KB warmup] skip (${reason}) score=${top.score.toFixed(1)} q="${query.slice(0, 50)}"`,
    );
    return "skipped";
  }
  console.log(`[Eva][KB warmup] Tavily (${reason}) q="${query.slice(0, 50)}"`);
  const raw = await tavilySearchRaw(query);
  const notes = formatTavilyNotes(raw);
  if (!String(notes || "").trim()) return "empty";
  const saved = await knowledgeDb.addKnowledgeEntry({
    query,
    answer: raw.answer,
    notes,
    sources: raw.sources,
  });
  console.log(`[Eva][KB warmup] saved ${saved.id} (${reason})`);
  return "saved";
}

async function pumpKbWarmupQueue() {
  if (kbWarmupBusy) return;
  kbWarmupBusy = true;
  const delayMs = Math.max(0, Number(process.env.EVA_KB_AUTO_WARMUP_DELAY_MS || 1500));
  try {
    while (kbWarmupQueue.length) {
      const job = kbWarmupQueue.shift();
      const key = job.query.toLowerCase();
      try {
        await warmOneKbQuery(job.query, job.reason);
      } catch (err) {
        console.warn(
          `[Eva][KB warmup] fail q="${job.query.slice(0, 40)}": ${err?.message || err}`,
        );
      } finally {
        setTimeout(() => kbWarmupQueued.delete(key), 10 * 60 * 1000);
      }
      if (kbWarmupQueue.length && delayMs > 0) await sleep(delayMs);
    }
  } finally {
    kbWarmupBusy = false;
  }
}

function scheduleKbAutoWarmupFromChat(userQuery) {
  if (!kbAutoWarmupEnabled()) return;
  const related = relatedQueriesFromChat(userQuery);
  if (!related.length) return;
  let n = 0;
  for (const q of related) {
    if (enqueueKbWarmup(q, "chat-related")) n += 1;
  }
  if (!n) return;
  console.log(
    `[Eva][KB warmup] queued ${n} related from chat: ${related.slice(0, 3).join(" · ")}`,
  );
  void pumpKbWarmupQueue();
}

module.exports = {
  formatKbHits,
  kbEnabled,
  searchEnabled,
  gatherKnowledgeForOllama,
  rememberAnswerInKb,
  kbAutoWarmupEnabled,
  scheduleKbAutoWarmupFromChat,
};
