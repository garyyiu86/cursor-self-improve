const { getRepoRoot } = require("./env.cjs");
const { nowMs, logTiming } = require("./timing.cjs");
const {
  applyLanguageScript,
  detectLanguagePreference,
  languageInstruction,
  langReminder,
} = require("./language.cjs");
const { loadPersona, isPersonaChangeRequest, isMetaStyleFeedback, updatePersonaFromUserRequest } = require("./persona.cjs");
const { loadPrefs, savePrefs } = require("./prefs.cjs");
const { resolveHistoryForModel } = require("./history.cjs");
const { tavilySearch } = require("./tavily.cjs");
const { formatFetchError, getLlmConfig, getLlmFallbackChain, llmChatOnce } = require("./llm.cjs");
const {
  gatherKnowledgeForOllama,
  rememberAnswerInKb,
  scheduleKbAutoWarmupFromChat,
} = require("./knowledge.cjs");
const {
  isDateTimeQuestion,
  isOpinionOrPreferenceQuestion,
  extractBinaryChoice,
  looksLikeHedgingChoice,
  choiceStanceInstruction,
  answerDateTimeLocally,
  looksLikeCannedAssistant,
  looksLikeEcho,
  NON_FACT_OPINION_RE,
  isFactualQuestion,
  isOpinionMode,
  isPureAnaphoraFollowUp,
  isContextualFollowUp,
  getTopicAnchor,
  priorTurnWantedFacts,
  knowledgeLookupQuery,
  looksLikeDeferredSearch,
  looksLikeTruncatedReply,
  mergeContinuedReply,
  formatContinuityBlock,
  formatNowForLang,
} = require("./intent.cjs");

function buildSystemPrompt(lang, nowFact, knowledgeNotes, { includeClock = false, continuityBlock = "", knowledgeSource = "", forceChoice = false, factLookupAttempted = false, topicAnchor = "", followUp = false } = {}) {
  const parts = [
    loadPersona(),
    "",
    "VOICE FIRST (higher priority than sounding formal):",
    "- Reply as Eva the companion. Sound spoken and personal.",
    "- Put a tiny emotional beat first, then the useful answer.",
    "- Forbidden canned openings: AI disclaimers,「根據資料」「簡單來說」「總結」「以下是」, helpdesk tone.",
    "- Forbidden: asking the user to wait, or saying you will search later.",
    "- If knowledge notes exist: paraphrase into Eva's voice; do not paste them raw.",
    "- For fact answers: finish the full useful answer (about 2–6 short sentences). Do not stop mid-sentence or mid-number.",
    "",
    "CONTEXT RULES:",
    "CRITICAL: Use the recent conversation turns. Follow-ups like「你覺得呢」「為什麼」「什麼研究」refer to the previous topic — answer THAT topic.",
    "Never suddenly switch to date, time, weather, or unrelated small-talk unless the user asked for it.",
    "When the user asks your preference, opinion, or A/B choice: pick ONE clear side immediately and briefly say why. NEVER sit on both sides.",
    "Answer the user's question directly NOW in this single reply.",
    "If you are unsure, say you are unsure in character. Do not invent facts, dates, numbers, or names.",
    languageInstruction(lang),
  ];
  if (topicAnchor) {
    parts.push(
      `ONGOING TOPIC (must stay on this): ${topicAnchor}`,
      followUp
        ? "This turn is a FOLLOW-UP. Answer about the ongoing topic above. Do not start a new unrelated subject."
        : "",
    );
  }
  if (forceChoice) {
    parts.push(
      "HARD RULE FOR THIS TURN: The user gave a binary choice. Your first sentence MUST name the chosen side (A or B / left or right). Hedging is a failure.",
    );
  }
  if (includeClock && nowFact) {
    parts.push(`Trusted current date/time (use ONLY if user asks for date/time): ${nowFact}`);
  } else {
    parts.push("Do NOT mention today's date or the current time unless the user explicitly asks.");
  }
  if (continuityBlock) {
    parts.push(
      "Recent conversation transcript (highest priority for context):",
      continuityBlock,
      "Stay on this transcript's topic for the next reply.",
    );
  }
  if (knowledgeNotes) {
    parts.push(
      "PIPELINE: Materials below were already fetched (KB and/or Tavily). Your job is to ANALYZE them and answer the user.",
      knowledgeSource ? `Knowledge source: ${knowledgeSource}.` : "",
      topicAnchor || followUp
        ? "These materials support the ONGOING TOPIC. If a snippet looks unrelated, ignore it and stay on the transcript topic."
        : "Use ONLY these materials for facts. Answer NOW in Eva's spoken voice. Paraphrase; do not dump a report.",
      "Include the key facts from the materials (numbers, names, dates) when relevant — finish complete sentences.",
      "If materials are insufficient, say what is missing instead of guessing.",
      "Materials:\n" + knowledgeNotes,
    );
  } else if (factLookupAttempted) {
    parts.push(
      "PIPELINE: KB and Tavily returned no usable materials. Answer the user question directly.",
      "Do not pretend you just searched. If unsure, say so honestly.",
    );
  }
  return parts.filter((p) => p !== "").join("\n");
}

async function askOllama(historyMessages, { onProgress } = {}) {
  const tAll = nowMs();
  const progress = (stage, message) => {
    try {
      onProgress?.({ stage, message });
    } catch (_) {}
  };

  const llm = getLlmFallbackChain()[0] || getLlmConfig();
  const model = llm.model;
  const prefs = loadPrefs();
  const lang = prefs.replyLanguage || "zh-Hant";

  const history = resolveHistoryForModel(historyMessages);
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const rawUser = String(lastUser?.content ?? "").trim() || "你好";
  console.log(
    `[Eva][timing] ask start provider=${llm.provider} model=${model} q="${rawUser.slice(0, 80)}"`,
  );

  if (isDateTimeQuestion(rawUser)) {
    progress("done", "已取得日期時間");
    logTiming("ask total (datetime local)", tAll);
    return applyLanguageScript(answerDateTimeLocally(lang), lang);
  }
  if (isPersonaChangeRequest(rawUser)) {
    try {
      return applyLanguageScript(
        await updatePersonaFromUserRequest(rawUser, lang),
        lang,
      );
    } catch (err) {
      console.warn("[Eva] Persona update failed:", err?.message || err);
      if (lang === "en") return "I tried to update my persona but failed. Check Ollama and try again.";
      return "我想更新人設但失敗了，請確認 Ollama 正常後再試一次。";
    }
  }

  const nowFact = formatNowForLang(lang);
  const followUp = isContextualFollowUp(rawUser);
  const pureFollowUp = isPureAnaphoraFollowUp(rawUser);
  const topicAnchor = getTopicAnchor(history);
  let binaryChoice = extractBinaryChoice(rawUser);
  let wantFacts = false;
  if (!binaryChoice) {
    if (isOpinionOrPreferenceQuestion(rawUser) || NON_FACT_OPINION_RE.test(rawUser)) {
      wantFacts = false;
    } else if (pureFollowUp) {
      wantFacts = priorTurnWantedFacts(history);
    } else {
      wantFacts = isFactualQuestion(rawUser);
    }
  }
  if (
    !binaryChoice &&
    !wantFacts &&
    !isMetaStyleFeedback(rawUser) &&
    !isPersonaChangeRequest(rawUser) &&
    (followUp || isOpinionOrPreferenceQuestion(rawUser))
  ) {
    for (let i = history.length - 2; i >= 0; i--) {
      if (history[i].role === "user") {
        binaryChoice = extractBinaryChoice(history[i].content);
        if (binaryChoice) break;
      }
    }
  }
  const opinion = !wantFacts && isOpinionMode(rawUser);
  const forceChoice = Boolean(binaryChoice);

  let knowledgeNotes = "";
  let knowledgeSource = "";
  if (wantFacts) {
    const kbQuery = knowledgeLookupQuery(rawUser, history);
    console.log(
      `[Eva][pipeline] ①KB → ②Tavily → ③LLM(${llm.provider}) | followUp=${followUp} topic="${(topicAnchor || "").slice(0, 40)}" q="${kbQuery.slice(0, 60)}"`,
    );
    const kb = await gatherKnowledgeForOllama(kbQuery, {
      allowSearch: true,
      onProgress,
    });
    knowledgeNotes = String(kb.notes || "").trim();
    knowledgeSource = kb.source || "none";
    if (!knowledgeNotes) {
      console.log("[Eva][pipeline] KB+Tavily empty → ③ LLM with question only");
      progress("think", "③ 無外部資料，直接問模型…");
    } else {
      console.log(
        `[Eva][pipeline] materials ready source=${knowledgeSource} chars=${knowledgeNotes.length} → ③ LLM analyze`,
      );
      progress("think", "③ 資料齊，交俾模型分析…");
    }
  } else {
    console.log(
      `[Eva][pipeline] skip KB/Tavily (non-fact) → LLM chat (${llm.provider}) followUp=${followUp} topic="${(topicAnchor || "").slice(0, 40)}"`,
    );
  }
  const hasMaterials = Boolean(knowledgeNotes);
  const factual = hasMaterials;

  const continuityWindow = followUp || pureFollowUp ? 12 : factual ? 10 : 6;
  const continuityBlock = formatContinuityBlock(history.slice(-continuityWindow));
  const historyForTurns = followUp || pureFollowUp ? history.slice(-12) : factual ? history : history.slice(-8);

  const turns = historyForTurns.map((m, i) => {
    const role = m.role === "assistant" ? "assistant" : "user";
    let content = String(m.content ?? "");
    if (role === "user" && i === historyForTurns.length - 1) {
      content += langReminder(lang, content);
      if (topicAnchor && (followUp || pureFollowUp)) {
        content +=
          lang === "en"
            ? `\n\n[System: Ongoing topic: ${topicAnchor}. Answer this follow-up about THAT topic only.]`
            : `\n\n[系統：正在傾緊嘅主題：${topicAnchor}。呢句係追問，只可以圍繞呢個主題答。]`;
      }
      if (binaryChoice) {
        content += "\n\n" + choiceStanceInstruction(lang, binaryChoice);
      } else if (opinion) {
        content +=
          lang === "en"
            ? "\n\n[System: Chat/opinion mode. If there is any preference or A/B in this message or recent chat, pick ONE side now with a short reason. Forbidden: both fine / depends / no stance. Do NOT mention date/time.]"
            : "\n\n[系統：閒聊／意見模式。若這句或上文有偏好／二選一，必須立刻只選一邊並講一句原因。禁止兩邊都好、看情況、不表態。禁止提日期時間。]";
      } else if (followUp) {
        content +=
          lang === "en"
            ? "\n\n[System: Follow-up — stay on the previous topic. Do NOT mention date/time.]"
            : "\n\n[系統：追問——承接上文主題。禁止提日期時間。]";
      }
      if (hasMaterials) {
        content +=
          lang === "en"
            ? "\n\n[System: Materials from KB/Tavily are ready. Use them only if they match the ongoing topic. Answer in Eva's voice.]"
            : "\n\n[系統：KB／Tavily 資料已備好。只採用同主題有關嘅料，用 Eva 口語即刻回答。]";
      } else if (wantFacts) {
        content +=
          lang === "en"
            ? "\n\n[System: No external materials found. Answer the question directly; say if you are unsure. Do not claim you searched.]"
            : "\n\n[系統：KB／Tavily 都無料。請直接答問題；唔肯定就講明。唔好扮啱啱去搜過。]";
      }
    }
    return { role, content };
  });

  if (!turns.length) {
    turns.push({ role: "user", content: rawUser + langReminder(lang, rawUser) });
  }

  const messages = [
    {
      role: "system",
      content: buildSystemPrompt(lang, nowFact, knowledgeNotes, {
        includeClock: false,
        continuityBlock,
        knowledgeSource,
        forceChoice: forceChoice || opinion,
        factLookupAttempted: wantFacts,
        topicAnchor,
        followUp: followUp || pureFollowUp,
      }),
    },
    ...turns,
  ];

  const heavyModel = llm.provider === "ollama" && /:8b|:7b|:13b|:14b|:70b/i.test(model);
  const envFact = Number(process.env.EVA_LLM_MAX_TOKENS_FACT || 0);
  const envChat = Number(process.env.EVA_LLM_MAX_TOKENS_CHAT || 0);
  const numPredict = factual
    ? envFact > 0
      ? envFact
      : heavyModel
        ? 320
        : 480
    : envChat > 0
      ? envChat
      : heavyModel
        ? 180
        : 280;
  const numCtx = factual ? (heavyModel ? 3072 : 4096) : heavyModel ? 2048 : 3072;

  console.log(
    `[Eva] LLM context turns=${turns.length} followUp=${followUp} opinion=${opinion} factQ=${wantFacts} materials=${hasMaterials} kb=${knowledgeSource || "none"} provider=${llm.provider} model=${model} maxTokens=${numPredict}`,
  );

  if (!wantFacts || hasMaterials) {
    progress("think", hasMaterials ? "③ Eva 正在分析資料…" : "Eva 正在整理回答…");
  }
  const tLlm = nowMs();
  let lastStreamUi = 0;
  const streamToUi = (partial) => {
    const now = Date.now();
    if (now - lastStreamUi < 80 && String(partial || "").length % 24 !== 0) return;
    lastStreamUi = now;
    const shown = String(partial || "");
    progress("stream", shown.length > 1200 ? `…${shown.slice(-1200)}` : shown);
  };
  let text;
  try {
    text =
      (await llmChatOnce({
        messages,
        temperature: factual ? 0.4 : 0.72,
        numPredict,
        numCtx,
        label: "LLM main",
        onToken: streamToUi,
      })) || "(empty LLM response)";
  } catch (err) {
    logTiming("LLM main failed", tLlm, formatFetchError(err));
    throw err;
  }

  if (looksLikeTruncatedReply(text, numPredict)) {
    console.warn("[Eva] Reply looks truncated; continuing once");
    progress("think", "補完未寫完嘅答覆…");
    try {
      const cont =
        (await llmChatOnce({
          messages: [
            ...messages,
            { role: "assistant", content: text },
            {
              role: "user",
              content:
                lang === "en"
                  ? "[Continue exactly from where you stopped. Finish the answer. No restart, no apology.]"
                  : "[從剛才停住嘅地方繼續寫完，唔好重頭、唔好道歉。]",
            },
          ],
          temperature: factual ? 0.35 : 0.6,
          numPredict: Math.min(280, Math.max(120, Math.floor(numPredict * 0.6))),
          numCtx,
          label: "LLM continue",
          onToken: (partial) => streamToUi(mergeContinuedReply(text, partial)),
        })) || "";
      if (cont.trim()) {
        text = mergeContinuedReply(text, cont);
      }
    } catch (err) {
      console.warn("[Eva] Continue failed:", err?.message || err);
    }
  }

  const dumpedClock =
    !isDateTimeQuestion(rawUser) &&
    /(今天是\d{4}年|現在時間是|现在时间是|Asia\/Hong_Kong)/.test(text);
  if (dumpedClock) {
    console.warn("[Eva] Model dumped clock on non-date question; retrying");
    const retryMessages = [
      {
        role: "system",
        content: [
          loadPersona(),
          "Answer ONLY about the recent conversation topic.",
          "FORBIDDEN: mentioning today's date or current time.",
          continuityBlock ? `Transcript:\n${continuityBlock}` : "",
          languageInstruction(lang),
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        role: "user",
        content:
          rawUser +
          (lang === "en"
            ? "\n\n[Reply about the previous topic only.]"
            : "\n\n[請只回答上文主題，不要提日期時間。]"),
      },
    ];
    try {
      text =
        (await llmChatOnce({
          messages: retryMessages,
          temperature: 0.4,
          numPredict: 100,
          numCtx: 2048,
          label: "LLM retry(clock)",
        })) || text;
    } catch (err) {
      console.warn("[Eva] Retry failed:", err?.message || err);
    }
  }

  if (looksLikeDeferredSearch(text)) {
    console.warn("[Eva] Model deferred search; forcing direct answer");
    progress("think", "改為直接回答…");
    const forceMessages = [
      {
        role: "system",
        content: [
          loadPersona(),
          "Answer the user NOW with a concrete reply in Eva's spoken voice.",
          "FORBIDDEN: asking the user to wait, or saying you will search later.",
          knowledgeNotes
            ? `Use these notes (paraphrase in character):\n${knowledgeNotes}`
            : "If you lack facts, say you are unsure in character.",
          languageInstruction(lang),
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        role: "user",
        content:
          rawUser +
          (lang === "en"
            ? "\n\n[Give the answer now, as Eva.]"
            : "\n\n[請用 Eva 口語語氣現在直接給出答案，不要說稍等。]"),
      },
    ];
    try {
      text =
        (await llmChatOnce({
          messages: forceMessages,
          temperature: 0.55,
          numPredict: 120,
          numCtx: numCtx,
          label: "LLM retry(deferred)",
        })) || text;
    } catch (err) {
      console.warn("[Eva] Force-answer retry failed:", err?.message || err);
      if (knowledgeNotes) {
        const firstLine = knowledgeNotes.split(/\r?\n/).find((l) => l.trim());
        if (firstLine) {
          text = firstLine.replace(/^\[KB#[^\]]+\]\s*/i, "").replace(/^A:\s*/i, "");
        }
      }
    }
  }

  if ((forceChoice || opinion) && looksLikeHedgingChoice(text)) {
    console.warn("[Eva] Hedged on A/B choice; forcing a pick");
    progress("think", "逼佢揀邊…");
    const pick = binaryChoice || { a: "A", b: "B" };
    const pickMessages = [
      {
        role: "system",
        content: [
          loadPersona(),
          "The user asked a binary preference or opinion. You MUST pick exactly one side.",
          binaryChoice ? `A = ${pick.a}` : "Pick one clear stance from the conversation topic.",
          binaryChoice ? `B = ${pick.b}` : "",
          "First words must clearly commit (e.g.「我揀 A」「我偏呢邊」).",
          "FORBIDDEN: both fine / depends / each has pros / let user decide.",
          continuityBlock ? `Transcript:\n${continuityBlock}` : "",
          languageInstruction(lang),
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        role: "user",
        content:
          rawUser +
          "\n\n" +
          (binaryChoice
            ? choiceStanceInstruction(lang, pick)
            : lang === "en"
              ? "[Pick one side now. One short reason.]"
              : "[而家立刻只選一邊，再講一句原因。]") +
          (lang === "en"
            ? "\n\n[Commit now.]"
            : "\n\n[而家表態，唔好騎牆。]"),
      },
    ];
    try {
      text =
        (await llmChatOnce({
          messages: pickMessages,
          temperature: 0.55,
          numPredict: 90,
          numCtx: 2048,
          label: "LLM retry(pick)",
        })) || text;
    } catch (err) {
      console.warn("[Eva] Force-pick retry failed:", err?.message || err);
      if (binaryChoice) {
        const side = Math.random() < 0.5 ? "A" : "B";
        const label = side === "A" ? pick.a : pick.b;
        text =
          lang === "en"
            ? `I pick ${side} — ${label}. Feels more like me today.`
            : `我揀 ${side} 啦——${label}。今日心情比較傾向呢邊～`;
      }
    }
  }

  if (process.env.EVA_VOICE_REWRITE === "1" && looksLikeCannedAssistant(text)) {
    console.warn("[Eva] Canned assistant tone; rewriting with persona");
    progress("think", "調整語氣…");
    const voiceMessages = [
      {
        role: "system",
        content: [
          loadPersona(),
          "Rewrite the draft below as Eva: warm, teasing, spoken HK Traditional Chinese.",
          "Keep the same facts. Do not add new facts. No FAQ openings.",
          languageInstruction(lang),
          "",
          "Draft to rewrite:",
          text,
        ].join("\n"),
      },
      {
        role: "user",
        content:
          rawUser +
          (lang === "en"
            ? "\n\n[Rewrite as Eva.]"
            : "\n\n[請改寫成 Eva 嘅口語語氣。]"),
      },
    ];
    try {
      text =
        (await llmChatOnce({
          messages: voiceMessages,
          temperature: 0.7,
          numPredict: 120,
          numCtx: 2048,
          label: "LLM voice rewrite",
        })) || text;
    } catch (err) {
      console.warn("[Eva] Voice rewrite failed:", err?.message || err);
    }
  }

  if (looksLikeEcho(text, rawUser)) {
    if (knowledgeNotes) {
      const firstLine = knowledgeNotes.split(/\r?\n/).find((l) => l.trim());
      if (firstLine) return applyLanguageScript(firstLine.replace(/^Answer:\s*|^A:\s*/i, ""), lang);
    }
    if (lang === "en") {
      return "Sorry — I didn't catch that clearly. Could you ask again in another way?";
    }
    if (lang === "zh-Hans") {
      return "抱歉，我刚才没答好。可以换个说法再问我一次吗？";
    }
    return "抱歉，我剛才沒答好。可以換個說法再問我一次嗎？";
  }

  if (wantFacts && !hasMaterials) {
    const tRemember = nowMs();
    await rememberAnswerInKb(rawUser, text);
    logTiming("KB remember answer", tRemember);
  }

  if (wantFacts) {
    scheduleKbAutoWarmupFromChat(knowledgeLookupQuery(rawUser, history));
  }

  progress("done", "完成");
  logTiming(
    "ask total",
    tAll,
    `factQ=${wantFacts} materials=${hasMaterials} kb=${knowledgeSource || "none"} chars=${text.length}`,
  );
  return applyLanguageScript(text, lang);
}

async function askChatInner(historyMessages, { onProgress } = {}) {
  const history = Array.isArray(historyMessages) ? historyMessages : [];
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const prompt = lastUser ? String(lastUser.content ?? "") : "";

  const currentLang = loadPrefs().replyLanguage || "zh-Hant";
  if (currentLang === "auto") {
    const detected = detectLanguagePreference(prompt);
    if (detected) savePrefs({ replyLanguage: detected });
  }

  try {
    return await askOllama(history, { onProgress });
  } catch (ollamaErr) {
    console.warn("LLM unavailable, falling back:", formatFetchError(ollamaErr));
  }

  if (!process.env.TAVILY_API_KEY) {
    throw new Error(
      "LLM unavailable. DeepSeek may be out of balance (402). Set OPENROUTER_API_KEY, top up DeepSeek, or run local Ollama (ollama serve).",
    );
  }

  const tavilyText = await tavilySearch(prompt || "hello");
  const lang = loadPrefs().replyLanguage || "zh-Hant";
  const cursorKey = process.env.CURSOR_API_KEY;
  if (!cursorKey) return applyLanguageScript(tavilyText, lang);

  try {
    const { Agent } = await import("@cursor/sdk");
    const result = await Agent.prompt(
      [
        "You are Eva, a helpful desktop companion.",
        "Using ONLY the Tavily search notes below, answer the user briefly.",
        "Do NOT edit files or run tools. Plain text only.",
        languageInstruction(lang),
        "",
        `User question: ${prompt}`,
        "",
        "Tavily notes:",
        tavilyText,
      ].join("\n"),
      {
        apiKey: cursorKey,
        model: { id: "composer-2.5" },
        local: { cwd: getRepoRoot() },
      },
    );
    if (result.status === "error") return applyLanguageScript(tavilyText, lang);
    return applyLanguageScript(
      String(result.result ?? "").trim() || tavilyText,
      lang,
    );
  } catch {
    return applyLanguageScript(tavilyText, lang);
  }
}

async function askChat(historyMessages, { onProgress } = {}) {
  const lang = loadPrefs().replyLanguage || "zh-Hant";
  const answer = await askChatInner(historyMessages, { onProgress });
  return applyLanguageScript(answer, lang);
}

module.exports = {
  buildSystemPrompt,
  askOllama,
  askChat,
  askChatInner,
};
