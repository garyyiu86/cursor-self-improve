const { isPersonaChangeRequest, isMetaStyleFeedback } = require("./persona.cjs");
const { languageInstruction } = require("./language.cjs");

function isGreeting(text) {
  const s = String(text || "").trim().toLowerCase();
  return /^(hi|hello|hey|yo|sup|你好|嗨|哈囉|哈啰|早晨|午安|晚安|早上好|下午好|晚上好)[!！.。\s]*$/i.test(
    s,
  );
}

function getNowParts(timeZone = "Asia/Hong_Kong") {
  const now = new Date();
  const fmt = (options) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, ...options }).format(now);
  const y = Number(fmt({ year: "numeric" }));
  const m = Number(fmt({ month: "numeric" }));
  const d = Number(fmt({ day: "numeric" }));
  const weekdayEn = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  const weekdayZhHant = {
    Sunday: "星期日",
    Monday: "星期一",
    Tuesday: "星期二",
    Wednesday: "星期三",
    Thursday: "星期四",
    Friday: "星期五",
    Saturday: "星期六",
  }[weekdayEn];
  const weekdayZhHans = {
    Sunday: "星期日",
    Monday: "星期一",
    Tuesday: "星期二",
    Wednesday: "星期三",
    Thursday: "星期四",
    Friday: "星期五",
    Saturday: "星期六",
  }[weekdayEn];
  return { y, m, d, time, weekdayEn, weekdayZhHant, weekdayZhHans, timeZone };
}

function formatNowForLang(lang) {
  const p = getNowParts();
  if (lang === "en") {
    return `Today is ${p.weekdayEn}, ${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}. Current time is ${p.time} (${p.timeZone}).`;
  }
  if (lang === "zh-Hans") {
    return `今天是${p.y}年${p.m}月${p.d}日，${p.weekdayZhHans}。现在时间是 ${p.time}（${p.timeZone}）。`;
  }
  return `今天是${p.y}年${p.m}月${p.d}日，${p.weekdayZhHant}。現在時間是 ${p.time}（${p.timeZone}）。`;
}

function isDateTimeQuestion(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (
    /(覺得|认为|認為|think|prefer|喜歡|喜欢|選擇|选择|邊個|哪个|哪個|定係|还是|還是|意見|意见|看法|點睇|点睇|點看)/i.test(
      s,
    )
  ) {
    return false;
  }
  return /(今天幾號|今日幾號|今天几号|今日几号|今天的?日期|今日的?日期|今天星期幾|今天星期几|今日星期|而家幾點|现在几点|現在幾點|现在几号|現在幾點鐘|现在几点钟|what\s+time\s+is\s+it|what(?:'s|\s+is)\s+today(?:'s)?\s+date|current\s+(?:date|time)|todays?\s+date|date\s+of\s+today|what\s+day\s+is\s+(?:it|today))/i.test(
    s,
  );
}

function isOpinionOrPreferenceQuestion(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (extractBinaryChoice(s)) return true;
  return /(覺得|认为|認為|think|prefer|喜歡|喜欢|選擇|选择|邊個好|哪个好|哪個好|揀邊|选哪|選哪|定係|还是|還是|意見|意见|看法|點睇|点睇|你呢|你怎麼看|你怎么看|what\s+do\s+you\s+think|which\s+(?:one|do\s+you)|your\s+(?:take|opinion|preference)|A\s*(?:or|還是|还是|定係)\s*B|\b[Aa]\s*[.．、:：)]|\b[Bb]\s*[.．、:：)])/i.test(
    s,
  );
}

function extractBinaryChoice(text) {
  const s = String(text || "").trim();
  if (!s) return null;

  const labeled = s.match(
    /(?:^|[\s\n])A[.．、:：)\]]\s*([^\n]+?)\s*(?:\n|\s+)B[.．、:：)\]]\s*([^\n]+?)(?:\s*[?？!！。.]*)?$/i,
  );
  if (labeled) {
    return {
      kind: "ab",
      a: labeled[1].trim().replace(/[?？!！。.\s]+$/g, ""),
      b: labeled[2].trim().replace(/[?？!！。.\s]+$/g, ""),
    };
  }

  const inlineAb = s.match(
    /\bA\s*[:：.．、)]\s*([^/?？]+?)\s*(?:還是|还是|定係|或者|or|\/)\s*B\s*[:：.．、)]\s*([^/?？]+)/i,
  );
  if (inlineAb) {
    return {
      kind: "ab",
      a: inlineAb[1].trim(),
      b: inlineAb[2].trim(),
    };
  }

  const orChoice = s.match(
    /^(.{1,40}?)\s*(還是|还是|定係|或者|or)\s*(.{1,40}?)(?:\s*[?？!！。.]*)?$/i,
  );
  if (orChoice) {
    const left = orChoice[1].replace(/^(你覺得|你认为|你認為|你想|要唔要|要不要|不如|咁|那)\s*/i, "").trim();
    const right = orChoice[3].trim();
    if (left.length >= 1 && right.length >= 1 && left.length <= 36 && right.length <= 36) {
      return { kind: "or", a: left, b: right };
    }
  }

  return null;
}

function looksLikeHedgingChoice(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  return /(兩者都|两者都|都好|都可以|都行|看情況|看情况|視情況|视情况|各有(優|优)缺|各有好處|各有好处|難以取捨|难以取舍|不好說|不好说|取決|取决|沒有絕對|没有绝对|兩邊|两边|隨你|随你|你自己決定|你自己决定|A\s*(和|同|與|与|&|\/)\s*B\s*都|我唔揀|我不选|我不選)/i.test(
    s,
  );
}

function choiceStanceInstruction(lang, choice) {
  const a = choice?.a || "A";
  const b = choice?.b || "B";
  if (lang === "en") {
    return [
      `[System: BINARY CHOICE — you MUST pick ONE side now.]`,
      `Options: A) ${a}   OR   B) ${b}`,
      `Start the reply by clearly choosing A or B (e.g. "I pick A — …").`,
      `FORBIDDEN: "both are fine", "depends", "each has pros", refusing to choose.`,
      `Give one short reason in Eva's voice. Do not mention date/time.`,
    ].join("\n");
  }
  return [
    `[系統：這是二選一。你必須立刻只選一邊。]`,
    `選項：A）${a}　或　B）${b}`,
    `回覆開頭就要表明揀邊，例如「我揀 A —— …」或「我偏 B 啦」。`,
    `禁止：兩邊都好、看情況、各有好處、不表態、叫用戶自己決定。`,
    `用 Eva 口語講一句短原因。禁止提日期時間。`,
  ].join("\n");
}

function answerDateTimeLocally(lang) {
  const fact = formatNowForLang(lang === "auto" ? "zh-Hant" : lang);
  if (lang === "en") {
    return `Hmm, let me check~ ${fact}`;
  }
  if (lang === "zh-Hans") {
    return `嗯，我瞄一眼时间～${fact}`;
  }
  return `嗯，我睇下先～${fact}`;
}

function looksLikeCannedAssistant(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  return /^(作為一個|作为一个|根據我的|根据我的|簡單來說|简单来说|總結一下|总结一下|以下是|作為 AI|作为 AI|我可以幫你|我可以帮你|您好[！!]?\s*我是)/i.test(
    s,
  );
}

function looksLikeEcho(reply, userText) {
  const a = String(reply || "")
    .replace(/\s+/g, "")
    .toLowerCase();
  const b = String(userText || "")
    .replace(/\s+/g, "")
    .toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.length >= 4 && (a.includes(b) || b.includes(a)) && a.length <= b.length + 8) {
    return true;
  }
  return false;
}

function localGreeting(lang) {
  if (lang === "en") {
    return "Hehe, hi~ I'm Eva. Miss me already, or got something fun to share?";
  }
  if (lang === "zh-Hans") {
    return "嘿嘿，嗨～我是 Eva。想我了，还是有事找我聊呀？";
  }
  return "嘿嘿，嗨～我是 Eva。想我了，定係有嘢想同我傾呀？";
}

const NON_FACT_SOFT_CHAT_RE =
  /^(謝謝|谢谢|thanks|thank you|thx|拜拜|bye|再見|再见|我累|好悶|想你|想你了|哈哈+|嘿嘿+|呵呵+|嗯+|哦+|喔+|唉|心塞|開心|开心|無聊|无聊|好呀|好啊|得|行|可以|ok|okay|cool|nice)[!！.。~\s]*$/i;

const NON_FACT_OPINION_RE =
  /(你覺得|你认为|你認為|你點睇|你点睇|你怎麼看|你怎么看|你呢\b|覺得點|觉得点|點睇|点睇|prefer|你喜歡邊|你喜欢哪|邊個好|哪个好|哪個好|揀邊|选哪|選哪|(?:定係|还是|還是).{0,20}(?:好|啱|適合|适合)|what\s+do\s+you\s+think|which\s+do\s+you\s+prefer|your\s+(?:take|opinion|preference)|do\s+you\s+(?:like|prefer)\b)/i;

const NON_FACT_SOCIAL_RE =
  /(傾偈|倾偈|傾下|陪我|講笑话|讲笑话|講個笑|讲个笑|講故事|讲故事|唱(一)?首|睡覺啦|睡觉啦|講啲甜|讲点甜|抱抱|錫我|锡我|love\s+you|miss\s+you|roleplay|扮演|我們玩|我们玩)/i;

function isNonFactIntent(text) {
  const s = String(text || "").trim();
  if (!s) return true;
  if (isGreeting(s) || isDateTimeQuestion(s)) return true;
  if (isPersonaChangeRequest(s) || isMetaStyleFeedback(s)) return true;
  if (extractBinaryChoice(s)) return true;
  if (NON_FACT_SOFT_CHAT_RE.test(s)) return true;
  if (NON_FACT_OPINION_RE.test(s)) return true;
  if (NON_FACT_SOCIAL_RE.test(s)) return true;
  return false;
}

function isFactualQuestion(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (isNonFactIntent(s)) return false;
  return true;
}

function isOpinionMode(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (isGreeting(s) || isDateTimeQuestion(s) || isPersonaChangeRequest(s)) return false;
  return !isFactualQuestion(s);
}

function isPureAnaphoraFollowUp(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (s.length > 20) return false;
  return /^(為什麼|为甚么|為甚麼|点解|點解|然後呢|然后呢|之後呢|之后呢|還有呢|还有呢|同埋呢|詳情|详情|來源|来源|多啲|多点|多點|繼續|继续|嗯\??|哦\??|呀\??|係咩|是吗|是嗎|真的嗎|真的吗|真嘅|huh|why|really|and\s+then|tell\s+me\s+more|more\s+details?)[!？?。.\s]*$/i.test(
    s,
  );
}

function isContextualFollowUp(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (isDateTimeQuestion(s) || isGreeting(s)) return false;
  if (isPureAnaphoraFollowUp(s)) return true;
  if (s.length <= 28) {
    if (
      /(你覺得|你呢|點睇|点睇|為什麼|为甚么|為甚麼|点解|點解|然後|然后|之後|之后|呢\s*$|真的|係咩|是吗|是嗎|什麼研究|什么研究|邊個|哪个|哪個|同埋|還有|还有|繼續|继续|詳情|详情|來源|来源|多啲|多点|哦|呀|嗯|huh|why|really|and\s+you|tell\s+me\s+more)/i.test(
        s,
      )
    ) {
      return true;
    }
  }
  return /^(為什麼|为甚么|為甚麼|點解|点解|然後呢|然后呢|還有呢|还有呢|你覺得呢|你呢|真的嗎|真的吗|係咪|是吗|是嗎|詳情|详情)\s*[?？!！.。]*$/i.test(
    s,
  );
}

function getTopicAnchor(history) {
  const users = (Array.isArray(history) ? history : [])
    .filter((m) => m && m.role === "user")
    .map((m) => String(m.content || "").trim())
    .filter(Boolean);
  for (let i = users.length - 1; i >= 0; i--) {
    const u = users[i];
    if (i === users.length - 1 && (isPureAnaphoraFollowUp(u) || isContextualFollowUp(u))) {
      continue;
    }
    if (isPureAnaphoraFollowUp(u) || isGreeting(u) || isDateTimeQuestion(u)) continue;
    if (isMetaStyleFeedback(u) || isPersonaChangeRequest(u)) continue;
    return u;
  }
  return "";
}

function priorTurnWantedFacts(history) {
  const anchor = getTopicAnchor(history);
  if (!anchor) return false;
  if (extractBinaryChoice(anchor)) return false;
  return isFactualQuestion(anchor);
}

function knowledgeLookupQuery(rawUser, history) {
  const anchor = getTopicAnchor(history);
  if (!anchor) return String(rawUser || "").trim();

  if (isPureAnaphoraFollowUp(rawUser)) {
    return anchor;
  }
  if (isContextualFollowUp(rawUser)) {
    return `${anchor} ${String(rawUser || "").trim()}`.trim();
  }
  return String(rawUser || "").trim();
}

function looksLikeDeferredSearch(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  return (
    /(請稍等|稍等一下|等我一下|我現在就(開始)?找|讓我(先)?(查|搜|找)|我去(查|搜|找)|我來(查|搜)|稍後回|please\s+wait|hold\s+on|let\s+me\s+(search|look|find|check)|i('ll| will)\s+(search|look|find|check|get\s+back))/i.test(
      s,
    ) && s.length < 160
  );
}

function looksLikeTruncatedReply(text, numPredict = 0) {
  const s = String(text || "").trim();
  if (s.length < 24) return false;
  if (/[。！？!?…」』）)\]》]$/.test(s)) return false;
  if (/[,，、：:；;（(「『\-–—~～]$/.test(s)) return true;
  const budgetChars = numPredict > 0 ? numPredict * 1.2 : 0;
  if (budgetChars > 0 && s.length >= budgetChars * 0.85 && /[\u4e00-\u9fffA-Za-z0-9%]$/.test(s)) {
    return true;
  }
  if (/(而且|但是|所以|因為|因为|以及|還有|还有|例如|譬如|另外|其中|大約|大约|等於|等于)\s*$/.test(s)) {
    return true;
  }
  return false;
}

function mergeContinuedReply(head, tail) {
  const a = String(head || "").trim();
  const b = String(tail || "").trim();
  if (!b) return a;
  if (!a) return b;
  const aTail = a.slice(-40);
  if (b.startsWith(aTail)) return a + b.slice(aTail.length);
  for (let n = Math.min(80, a.length, b.length); n >= 12; n--) {
    if (b.startsWith(a.slice(-n))) return a + b.slice(n);
  }
  const needSpace = /[A-Za-z0-9]$/.test(a) && /^[A-Za-z0-9]/.test(b);
  return needSpace ? `${a} ${b}` : a + b;
}

function formatContinuityBlock(turns) {
  return turns
    .map((m) => {
      const who = m.role === "assistant" ? "Eva" : "User";
      return `${who}: ${String(m.content ?? "").trim()}`;
    })
    .filter((line) => line.length > 6)
    .join("\n");
}

module.exports = {
  isGreeting,
  getNowParts,
  formatNowForLang,
  isDateTimeQuestion,
  isOpinionOrPreferenceQuestion,
  extractBinaryChoice,
  looksLikeHedgingChoice,
  choiceStanceInstruction,
  answerDateTimeLocally,
  looksLikeCannedAssistant,
  looksLikeEcho,
  localGreeting,
  NON_FACT_OPINION_RE,
  isNonFactIntent,
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
};
