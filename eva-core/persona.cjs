const fs = require("node:fs");
const path = require("node:path");
const { getDataDir, getOverlayDir } = require("./env.cjs");
const { applyLanguageScript } = require("./language.cjs");
const { llmChatOnce } = require("./llm.cjs");

function personaPath() {
  return path.join(getDataDir(), "persona.txt");
}

function personaSeedPath() {
  return path.join(getOverlayDir(), "persona.txt");
}

function defaultPersona() {
  return [
    "You are Eva (伊娃), a desktop anime companion living on the user's screen.",
    "Warm, playful, a little teasing, caring like a close friend.",
    "Short replies (1–3 sentences). Natural companion voice, not a helpdesk.",
    "If unsure, admit it honestly. Never only repeat the user's question.",
  ].join(" ");
}

function loadPersona() {
  try {
    const live = personaPath();
    if (!fs.existsSync(live)) {
      const seed = personaSeedPath();
      if (fs.existsSync(seed)) {
        fs.copyFileSync(seed, live);
      } else {
        fs.writeFileSync(live, defaultPersona() + "\n", "utf8");
      }
    }
    const text = fs.readFileSync(live, "utf8").trim();
    return text || defaultPersona();
  } catch {
    return defaultPersona();
  }
}

function savePersona(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) throw new Error("Empty persona");
  fs.writeFileSync(personaPath(), cleaned + "\n", "utf8");
  return cleaned;
}

function isMetaStyleFeedback(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  return (
    /(假謙虛|假谦虚|謙虛感|谦虚感|口頭禪|口头禅|語氣|语气|口吻|人設感|说话方式|說話方式)/i.test(s) ||
    /(點解係都要講|点解系都要讲|點解成日|为什么总是|為什麼總是|可唔可以修正|可不可以修正|唔好再講|不要再说|唔好成日|別再|别再|少啲|少点|收埋|收起)/i.test(
      s,
    ) ||
    /(改(一)?下|修正(一)?下).{0,12}(感|語氣|语气|講法|讲法|口吻|習慣|习惯)/i.test(s) ||
    /(stop\s+saying|sound\s+less|less\s+humble|fake\s+humility|change\s+your\s+(tone|vibe|style))/i.test(s)
  );
}

function isPersonaChangeRequest(text) {
  const s = String(text || "").trim();
  if (!s) return false;
  if (
    /(人設|人格|性格|persona|personality|character)/i.test(s) &&
    /(改|換|变|變|更新|設定|设置|變成|变成|改成|換成|换成|調整|调整|修正|change|update|rewrite|make\s+you|be\s+more)/i.test(
      s,
    )
  ) {
    return true;
  }
  return isMetaStyleFeedback(s);
}

async function updatePersonaFromUserRequest(rawUser, lang) {
  const current = loadPersona();

  const draft = await llmChatOnce({
    temperature: 0.35,
    numPredict: 400,
    numCtx: 2048,
    label: "persona rewrite",
    messages: [
      {
        role: "system",
        content: [
          "You rewrite Eva's persona profile for a desktop companion.",
          "Output ONLY the new persona plain text file contents.",
          "Keep the name Eva / 伊娃.",
          "Include sections: Personality / Core vibe, Speech rules, Boundaries.",
          "Merge the user's requested changes into the current persona.",
          "If the user complains about fake humility / catchphrases / tone,",
          "REMOVE those habits and forbid repeating them.",
          "Especially forbid overused lines like「欸我唔敢亂講呀」unless truly unsure.",
          "Do not wrap in markdown fences. No preamble.",
          "Keep it under 40 lines.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Current persona:",
          current,
          "",
          "User request:",
          rawUser,
        ].join("\n"),
      },
    ],
  });

  let next = draft
    .replace(/^```[\w]*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
  if (!/eva|伊娃/i.test(next)) {
    next = `You are Eva (伊娃).\n${next}`;
  }
  savePersona(next);

  if (lang === "en") {
    return "Got it — I updated my vibe/persona. Try me again; I won't do that fake-humble bit.";
  }
  if (lang === "zh-Hans") {
    return "得，我改好人设/语气了。下次唔会再玩那种假谦虚～你再讲一句试下？";
  }
  return "得，我改好人設／語氣喇。下次唔會再玩嗰種假謙虛～你再講一句試下？";
}

module.exports = {
  loadPersona,
  savePersona,
  defaultPersona,
  isPersonaChangeRequest,
  isMetaStyleFeedback,
  updatePersonaFromUserRequest,
};
