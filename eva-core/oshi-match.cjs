const OSHI_MATCH_RE =
  /推し配對|配對分析|oshi\s*match|lumina\s*配對|邊個\s*member\s*最啱|邊個member最啱|推し診断|偶像配對/i;

function isOshiMatchRequest(text) {
  return OSHI_MATCH_RE.test(String(text || "").trim());
}

function formatOshiMatchReply(lang) {
  if (lang === "en") {
    return (
      "Ooh, let me see which LUMINA member vibes with you~ ✨\n\n" +
      ":::oshi-match:::\n\n" +
      "Answer 5 quick questions and I'll issue your oshi certificate!"
    );
  }
  if (lang === "zh-Hans") {
    return (
      "好呀～让我看看你跟 LUMINA 哪位 member 最有缘分 ✨\n\n" +
      ":::oshi-match:::\n\n" +
      "答完 5 题小测验，Eva 就帮你出推し认证书～"
    );
  }
  return (
    "好呀～等我睇下你同 LUMINA 邊個 member 最有緣份 ✨\n\n" +
    ":::oshi-match:::\n\n" +
    "答完 5 題小測驗，Eva 就幫你出推し認證書～"
  );
}

module.exports = {
  isOshiMatchRequest,
  formatOshiMatchReply,
};
