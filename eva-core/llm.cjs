const { nowMs, logTiming } = require("./timing.cjs");

function formatFetchError(err) {
  const msg = String(err?.message || err || "unknown");
  const cause = err?.cause;
  const bits = [msg];
  if (cause) {
    if (cause.code) bits.push(`code=${cause.code}`);
    if (cause.message && cause.message !== msg) bits.push(String(cause.message));
    if (cause.errno) bits.push(`errno=${cause.errno}`);
  }
  return bits.join(" | ");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const llmProviderDisabled = new Map();

function llmKeys() {
  return {
    openrouter: String(process.env.OPENROUTER_API_KEY || "").trim(),
    deepseek: String(process.env.DEEPSEEK_API_KEY || "").trim(),
    gemini: String(process.env.GEMINI_API_KEY || "").trim(),
    groq: String(process.env.GROQ_API_KEY || "").trim(),
  };
}

function buildLlmConfig(provider) {
  const keys = llmKeys();
  if (provider === "openrouter") {
    return {
      provider: "openrouter",
      model: String(process.env.OPENROUTER_MODEL || "openrouter/free").trim(),
      apiKey: keys.openrouter,
      baseUrl: String(process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(
        /\/$/,
        "",
      ),
      timeoutMs: Number(process.env.OPENROUTER_TIMEOUT_MS || 60000),
    };
  }
  if (provider === "deepseek") {
    return {
      provider: "deepseek",
      model: String(process.env.DEEPSEEK_MODEL || "deepseek-chat").trim(),
      apiKey: keys.deepseek,
      baseUrl: String(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(
        /\/$/,
        "",
      ),
      timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS || 60000),
    };
  }
  if (provider === "gemini") {
    return {
      provider: "gemini",
      model: String(process.env.GEMINI_MODEL || "gemini-2.0-flash").trim(),
      apiKey: keys.gemini,
      timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 60000),
    };
  }
  if (provider === "groq") {
    return {
      provider: "groq",
      model: String(process.env.GROQ_MODEL || "llama-3.1-8b-instant").trim(),
      apiKey: keys.groq,
      baseUrl: String(process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(
        /\/$/,
        "",
      ),
      timeoutMs: Number(process.env.GROQ_TIMEOUT_MS || 60000),
    };
  }
  return {
    provider: "ollama",
    model: String(process.env.OLLAMA_MODEL || "llama3.1:8b").trim(),
    host: String(process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, ""),
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS || 1800000),
    keepAlive: String(process.env.OLLAMA_KEEP_ALIVE || "30m").trim() || "30m",
  };
}

function providerHasCredentials(provider) {
  if (provider === "ollama") return true;
  const keys = llmKeys();
  if (provider === "openrouter") return Boolean(keys.openrouter);
  if (provider === "deepseek") return Boolean(keys.deepseek);
  if (provider === "gemini") return Boolean(keys.gemini);
  if (provider === "groq") return Boolean(keys.groq);
  return false;
}

function resolvePreferredLlmProvider() {
  const keys = llmKeys();
  const pref = String(process.env.EVA_LLM || "auto").trim().toLowerCase();
  const allowed = new Set([
    "auto",
    "openrouter",
    "deepseek",
    "gemini",
    "groq",
    "ollama",
  ]);
  let provider = allowed.has(pref) ? pref : "auto";

  if (provider === "auto") {
    if (keys.openrouter) provider = "openrouter";
    else if (keys.deepseek) provider = "deepseek";
    else if (keys.groq) provider = "groq";
    else if (keys.gemini) provider = "gemini";
    else provider = "ollama";
  }

  if (!providerHasCredentials(provider)) {
    console.warn(`[Eva] EVA_LLM=${provider} but API key missing — picking next available`);
    const order = ["openrouter", "deepseek", "groq", "gemini", "ollama"];
    provider = order.find((p) => providerHasCredentials(p)) || "ollama";
  }
  return provider;
}

function getLlmConfig() {
  return buildLlmConfig(resolvePreferredLlmProvider());
}

function getLlmFallbackChain() {
  const preferred = resolvePreferredLlmProvider();
  const order = ["openrouter", "deepseek", "groq", "gemini", "ollama"];
  const rest = order.filter((p) => p !== preferred);
  const names = [preferred, ...rest].filter((p) => {
    if (!providerHasCredentials(p)) return false;
    if (llmProviderDisabled.has(p)) return false;
    return true;
  });
  if (!names.includes("ollama")) names.push("ollama");
  return names.map((p) => buildLlmConfig(p));
}

function isLlmHardFail(err) {
  const detail = formatFetchError(err);
  return /error (401|402|403)\b|Insufficient Balance|invalid.?api.?key|incorrect api key|quota.?exceeded|billing/i.test(
    detail,
  );
}

async function openaiCompatibleChatRequest(
  cfg,
  { messages, temperature = 0.4, maxTokens = 160, label = "LLM" },
  retries = 2,
) {
  const url = `${cfg.baseUrl}/chat/completions`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.provider === "openrouter") {
    headers["HTTP-Referer"] = String(process.env.OPENROUTER_SITE_URL || "https://localhost/eva");
    headers["X-Title"] = String(process.env.OPENROUTER_APP_NAME || "Eva Companion");
  }
  let lastErr;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const t0 = nowMs();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature,
          top_p: 0.9,
          max_tokens: maxTokens,
          stream: false,
        }),
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
      if (!res.ok) {
        const errBody = await res.text();
        logTiming(`${label} error`, t0, `status=${res.status} attempt=${attempt}`);
        throw new Error(`${cfg.provider} error ${res.status}: ${errBody.slice(0, 300)}`);
      }
      const data = await res.json();
      const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
      logTiming(label, t0, `chars=${text.length} model=${cfg.model} attempt=${attempt}`);
      return { data, text };
    } catch (err) {
      lastErr = err;
      const detail = formatFetchError(err);
      console.warn(`[Eva] ${label} attempt ${attempt}/${retries + 1} failed: ${detail}`);
      const transient =
        /fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket|TimeoutError|aborted|timeout|network|429|503/i.test(
          detail,
        );
      if (!transient || attempt > retries) break;
      await sleep(1000 * attempt);
    }
  }
  throw lastErr;
}

function toGeminiGenerateBody(messages, temperature, maxTokens) {
  let systemText = "";
  const contents = [];
  for (const m of messages || []) {
    const role = m?.role;
    const content = String(m?.content ?? "");
    if (!content) continue;
    if (role === "system") {
      systemText = systemText ? `${systemText}\n${content}` : content;
      continue;
    }
    contents.push({
      role: role === "assistant" ? "model" : "user",
      parts: [{ text: content }],
    });
  }
  if (!contents.length) {
    contents.push({ role: "user", parts: [{ text: "你好" }] });
  }
  const body = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };
  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] };
  }
  return body;
}

async function geminiChatRequest(cfg, { messages, temperature = 0.4, maxTokens = 160, label = "Gemini" }, retries = 2) {
  const model = encodeURIComponent(cfg.model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  let lastErr;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const t0 = nowMs();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toGeminiGenerateBody(messages, temperature, maxTokens)),
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
      if (!res.ok) {
        const errBody = await res.text();
        logTiming(`${label} error`, t0, `status=${res.status} attempt=${attempt}`);
        throw new Error(`Gemini error ${res.status}: ${errBody.slice(0, 300)}`);
      }
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts)
        ? parts.map((p) => String(p?.text || "")).join("").trim()
        : "";
      logTiming(label, t0, `chars=${text.length} model=${cfg.model} attempt=${attempt}`);
      return { data, text };
    } catch (err) {
      lastErr = err;
      const detail = formatFetchError(err);
      console.warn(`[Eva] ${label} attempt ${attempt}/${retries + 1} failed: ${detail}`);
      const transient =
        /fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket|TimeoutError|aborted|timeout|network|429|503/i.test(
          detail,
        );
      if (!transient || attempt > retries) break;
      await sleep(1000 * attempt);
    }
  }
  throw lastErr;
}

async function ollamaChatRequest(host, payload, { label = "Ollama", retries = 2, timeoutMs, onToken } = {}) {
  const url = `${host}/api/chat`;
  const idleTimeout = timeoutMs || Number(process.env.OLLAMA_TIMEOUT_MS || 1800000);
  const totalTimeout = Number(process.env.OLLAMA_TOTAL_TIMEOUT_MS || 1800000);
  const keepAlive = String(process.env.OLLAMA_KEEP_ALIVE || "30m").trim() || "30m";
  const useStream = payload.stream !== false;
  const body = {
    ...payload,
    stream: useStream,
    keep_alive: keepAlive,
  };
  let lastErr;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const t0 = nowMs();
    const ac = new AbortController();
    let idleTimer = null;
    let totalTimer = null;
    const clearTimers = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (totalTimer) clearTimeout(totalTimer);
      idleTimer = null;
      totalTimer = null;
    };
    const bumpIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        ac.abort(new Error(`Ollama idle timeout after ${idleTimeout}ms with no tokens`));
      }, idleTimeout);
    };
    try {
      totalTimer = setTimeout(() => {
        ac.abort(new Error(`Ollama total timeout after ${totalTimeout}ms`));
      }, totalTimeout);
      bumpIdle();

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (!res.ok) {
        const errBody = await res.text();
        clearTimers();
        logTiming(`${label} error`, t0, `status=${res.status} attempt=${attempt}`);
        throw new Error(`Ollama error ${res.status}: ${errBody.slice(0, 300)}`);
      }

      if (!useStream || !res.body) {
        bumpIdle();
        const data = await res.json();
        clearTimers();
        const text = String(data?.message?.content ?? "").trim();
        logTiming(label, t0, `chars=${text.length} model=${payload.model} attempt=${attempt} mode=json`);
        return { data, text };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let text = "";
      let lastData = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bumpIdle();
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let chunk;
          try {
            chunk = JSON.parse(line);
          } catch {
            continue;
          }
          lastData = chunk;
          const piece = String(chunk?.message?.content ?? "");
          if (piece) {
            text += piece;
            try {
              onToken?.(text, piece);
            } catch (_) {}
          }
          if (chunk?.done) {
            clearTimers();
            logTiming(
              label,
              t0,
              `chars=${text.trim().length} model=${payload.model} attempt=${attempt} mode=stream`,
            );
            return { data: lastData, text: text.trim() };
          }
        }
      }
      clearTimers();
      if (buf.trim()) {
        try {
          const chunk = JSON.parse(buf.trim());
          text += String(chunk?.message?.content ?? "");
          lastData = chunk;
        } catch (_) {}
      }
      logTiming(
        label,
        t0,
        `chars=${text.trim().length} model=${payload.model} attempt=${attempt} mode=stream-eof`,
      );
      return { data: lastData, text: text.trim() };
    } catch (err) {
      clearTimers();
      lastErr = err;
      const detail = formatFetchError(err);
      console.warn(`[Eva] ${label} attempt ${attempt}/${retries + 1} failed: ${detail}`);
      const transient =
        /fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket|TimeoutError|aborted|timeout|network|idle timeout/i.test(
          detail,
        );
      if (!transient || attempt > retries) break;
      const wait = 1500 * attempt;
      console.log(`[Eva] Retrying Ollama in ${wait}ms (model may still be loading)…`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function llmChatWithConfig(cfg, { messages, temperature, numPredict, numCtx, label, onToken }) {
  if (cfg.provider === "gemini") {
    return (
      await geminiChatRequest(
        cfg,
        { messages, temperature, maxTokens: numPredict, label: `${label}/gemini` },
        2,
      )
    ).text;
  }
  if (cfg.provider === "groq" || cfg.provider === "openrouter" || cfg.provider === "deepseek") {
    return (
      await openaiCompatibleChatRequest(
        cfg,
        {
          messages,
          temperature,
          maxTokens: numPredict,
          label: `${label}/${cfg.provider}`,
        },
        2,
      )
    ).text;
  }
  return (
    await ollamaChatRequest(
      cfg.host,
      {
        model: cfg.model,
        stream: true,
        messages,
        options: {
          temperature,
          top_p: 0.9,
          repeat_penalty: 1.1,
          num_predict: numPredict,
          num_ctx: numCtx,
        },
      },
      {
        label: `${label}/ollama`,
        retries: 2,
        timeoutMs: cfg.timeoutMs,
        onToken,
      },
    )
  ).text;
}

async function llmChatOnce({
  messages,
  temperature = 0.4,
  numPredict = 160,
  numCtx = 4096,
  label = "LLM",
  onToken,
}) {
  const chain = getLlmFallbackChain();
  let lastErr;
  for (let i = 0; i < chain.length; i++) {
    const cfg = chain[i];
    try {
      const text = await llmChatWithConfig(cfg, {
        messages,
        temperature,
        numPredict,
        numCtx,
        label,
        onToken: i === 0 || cfg.provider === "ollama" ? onToken : undefined,
      });
      if (i > 0) {
        console.log(`[Eva] LLM fallback OK via ${cfg.provider} (${cfg.model})`);
      }
      return text;
    } catch (err) {
      lastErr = err;
      const detail = formatFetchError(err);
      if (isLlmHardFail(err) && cfg.provider !== "ollama") {
        llmProviderDisabled.set(cfg.provider, detail);
        console.warn(`[Eva] Disabling ${cfg.provider} for this session: ${detail}`);
      }
      const next = chain[i + 1];
      if (next) {
        console.warn(
          `[Eva] ${cfg.provider} failed — falling back to ${next.provider}: ${detail}`,
        );
        continue;
      }
    }
  }
  throw lastErr;
}

async function warmLlmModel() {
  const preferred = getLlmConfig();
  const chain = getLlmFallbackChain();
  console.log(
    `[Eva] LLM preferred=${preferred.provider} fallback=${chain.map((c) => c.provider).join("→")}`,
  );
  try {
    await llmChatOnce({
      messages: [{ role: "user", content: "ping" }],
      temperature: 0,
      numPredict: 4,
      label: "LLM warm",
    });
    const active = getLlmFallbackChain()[0] || preferred;
    console.log(`[Eva] LLM warm OK via ${active.provider} (${active.model})`);
  } catch (err) {
    console.warn(`[Eva] LLM warm failed: ${formatFetchError(err)}`);
    console.warn(
      "[Eva] Tip: top up DeepSeek, set OPENROUTER_API_KEY, or ensure Ollama is running (ollama serve).",
    );
  }
}

async function ollamaChatOnce(opts) {
  return llmChatOnce(opts);
}

module.exports = {
  formatFetchError,
  llmKeys,
  buildLlmConfig,
  providerHasCredentials,
  resolvePreferredLlmProvider,
  getLlmConfig,
  getLlmFallbackChain,
  isLlmHardFail,
  openaiCompatibleChatRequest,
  geminiChatRequest,
  ollamaChatRequest,
  llmChatWithConfig,
  llmChatOnce,
  warmLlmModel,
  ollamaChatOnce,
};
