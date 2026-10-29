/** @typedef {{ id: string, text: string, tags: { memberWeight: Record<string, number>, genreWeight: Record<string, number>, styleWeight: Record<string, number> } }} OshiOption */

/** @typedef {{ id: string, questionText: string, emoji: string, options: OshiOption[] }} OshiQuestion */

/** @typedef {{ id: string, name: string, color: string, imageEmoji: string, catchphrase: string, description: string, songGenreAffinity: Record<string, number>, recommendedSong: string }} LuminaMember */

/** @typedef {{ id: string, name: string, description: string, exampleSong: string }} MusicGenre */

/** @typedef {{ id: string, name: string, description: string, penlightPattern: string }} CheerStyle */

/** @type {LuminaMember[]} */
export const LUMINA_MEMBERS = [
  {
    id: "sakura",
    name: "桜月 Sakura",
    color: "#ffb7c5",
    imageEmoji: "🌸",
    catchphrase: "一齊綻放最靚嘅笑容啦～",
    description:
      "隊長兼 center。溫柔但好有帶領力，擅長把全場氣氛帶到最高。專長：舞台走位、fan service、治癒系 ballad。",
    songGenreAffinity: { "jpop-idol": 5, ballad: 5, "dance-electro": 3, "rock-pop": 2, acoustic: 4 },
    recommendedSong: "推し色メモリー",
  },
  {
    id: "hoshino",
    name: "星野 Hoshino",
    color: "#7ec8e3",
    imageEmoji: "⭐",
    catchphrase: "今日都要閃到爆呀！",
    description:
      "元氣担当。跳躍力同 smile 都係 top tier，live 一定係最活潑嗰個。專長：高強度 dance、MC、帶 call & response。",
    songGenreAffinity: { "jpop-idol": 5, ballad: 2, "dance-electro": 5, "rock-pop": 4, acoustic: 2 },
    recommendedSong: "星路の始まり",
  },
  {
    id: "rei",
    name: "零 Rei",
    color: "#b794f6",
    imageEmoji: "🌙",
    catchphrase: "…你睇緊我？咁就唔准走喇。",
    description:
      "酷系 ace。話唔多但一開口就係 killer line，舞台存在感極強。專長：低音 rap、暗黑系編曲、眼神殺。",
    songGenreAffinity: { "jpop-idol": 3, ballad: 3, "dance-electro": 4, "rock-pop": 5, acoustic: 2 },
    recommendedSong: "Midnight Signal",
  },
  {
    id: "miko",
    name: "美子 Miko",
    color: "#ffd166",
    imageEmoji: "🎀",
    catchphrase: "えへへ～今日都要可愛到犯規！",
    description:
      "可愛擔當。天然系 charm 同精緻 choreography 兼備，fan cam 永遠最多 view。專長：wink 應援、手勢舞、acoustic 小劇場。",
    songGenreAffinity: { "jpop-idol": 4, ballad: 4, "dance-electro": 3, "rock-pop": 2, acoustic: 5 },
    recommendedSong: "Ribbon Heartbeat",
  },
  {
    id: "luna",
    name: "月野 Luna",
    color: "#c0c0d0",
    imageEmoji: "💫",
    catchphrase: "月光底下，我哋嘅緣份先開始。",
    description:
      "神秘系 vocal。聲線像夢境一樣飄渺，擅長把 ballad 唱到全場安靜落淚。專長：和聲、鋼琴 intro、encore 驚喜曲。",
    songGenreAffinity: { "jpop-idol": 3, ballad: 5, "dance-electro": 2, "rock-pop": 3, acoustic: 5 },
    recommendedSong: "Silver Lullaby",
  },
];

/** @type {MusicGenre[]} */
export const GENRES = [
  {
    id: "jpop-idol",
    name: "J-Pop 偶像曲",
    description: "經典 idol sound，副歌一嚟就係全場應援位。",
    exampleSong: "推し色メモリー",
  },
  {
    id: "ballad",
    name: "Ballad 抒情",
    description: "慢板、情感濃，適合 penlight 慢慢搖。",
    exampleSong: "Silver Lullaby",
  },
  {
    id: "dance-electro",
    name: "Dance × Electro",
    description: "快節奏 electronic，跳躍應援同 mix 最啱。",
    exampleSong: "Neon Pulse",
  },
  {
    id: "rock-pop",
    name: "Rock Pop",
    description: "吉他 riff + 強烈 beat，現場 energy 爆表。",
    exampleSong: "Midnight Signal",
  },
  {
    id: "acoustic",
    name: "Acoustic 不插電",
    description: "木吉他、親密感，fan meeting 必備 vibe。",
    exampleSong: "Ribbon Heartbeat",
  },
];

/** @type {CheerStyle[]} */
export const CHEER_STYLES = [
  {
    id: "penlight-wave",
    name: "Penlight 波浪",
    description: "全場同步左右／上下 wave，視覺效果最靚。",
    penlightPattern: "← → ↑ ↓ 循環，副歌全亮",
  },
  {
    id: "call-response",
    name: "Call & Response",
    description: "偶像 call、fan 答，互動感最強。",
    penlightPattern: "call 時熄燈，response 時推し色全亮",
  },
  {
    id: "mix-chant",
    name: "Mix 應援",
    description: "日文 mix + 合聲，熟練 fan 嘅浪漫。",
    penlightPattern: "intro 單色 → mix 段彩虹快閃",
  },
  {
    id: "silent-support",
    name: "靜默應援",
    description: "安静舉燈、專心聽，適合 ballad 段落。",
    penlightPattern: "全程推し色常亮，副歌輕微搖擺",
  },
];

/** @type {OshiQuestion[]} */
export const QUESTIONS = [
  {
    id: "q1",
    emoji: "🛋️",
    questionText: "週末你最想點樣放鬆？",
    options: [
      {
        id: "q1-a",
        text: "窩喺度睇 live 重播",
        tags: {
          memberWeight: { luna: 3, sakura: 2, miko: 1 },
          genreWeight: { ballad: 3, acoustic: 2 },
          styleWeight: { "silent-support": 4, "penlight-wave": 1 },
        },
      },
      {
        id: "q1-b",
        text: "出街行街食好嘢",
        tags: {
          memberWeight: { hoshino: 3, miko: 2 },
          genreWeight: { "jpop-idol": 3, "dance-electro": 2 },
          styleWeight: { "call-response": 3, "mix-chant": 2 },
        },
      },
      {
        id: "q1-c",
        text: "練應援 mix / 排舞",
        tags: {
          memberWeight: { hoshino: 2, rei: 3 },
          genreWeight: { "rock-pop": 3, "dance-electro": 3 },
          styleWeight: { "mix-chant": 5, "call-response": 2 },
        },
      },
      {
        id: "q1-d",
        text: "寫 diary / 整應援物",
        tags: {
          memberWeight: { sakura: 3, luna: 2, miko: 2 },
          genreWeight: { ballad: 2, acoustic: 4 },
          styleWeight: { "silent-support": 3, "penlight-wave": 2 },
        },
      },
    ],
  },
  {
    id: "q2",
    emoji: "🎵",
    questionText: "你最鍾意邊種音樂 vibe？",
    options: [
      {
        id: "q2-a",
        text: "治癒系慢歌",
        tags: {
          memberWeight: { sakura: 3, luna: 4, miko: 2 },
          genreWeight: { ballad: 5, acoustic: 3 },
          styleWeight: { "silent-support": 4 },
        },
      },
      {
        id: "q2-b",
        text: "快節奏 dance track",
        tags: {
          memberWeight: { hoshino: 4, rei: 2 },
          genreWeight: { "dance-electro": 5, "jpop-idol": 3 },
          styleWeight: { "mix-chant": 3, "penlight-wave": 3 },
        },
      },
      {
        id: "q2-c",
        text: "型格 rock edge",
        tags: {
          memberWeight: { rei: 5, hoshino: 2 },
          genreWeight: { "rock-pop": 5, "dance-electro": 2 },
          styleWeight: { "call-response": 4, "mix-chant": 3 },
        },
      },
      {
        id: "q2-d",
        text: "可愛 acoustic 小調",
        tags: {
          memberWeight: { miko: 5, sakura: 2 },
          genreWeight: { acoustic: 5, "jpop-idol": 2 },
          styleWeight: { "penlight-wave": 3, "silent-support": 2 },
        },
      },
    ],
  },
  {
    id: "q3",
    emoji: "🎤",
    questionText: "Live 現場你通常會…",
    options: [
      {
        id: "q3-a",
        text: "全程舉住推し色 penlight",
        tags: {
          memberWeight: { sakura: 3, luna: 2 },
          genreWeight: { ballad: 3, "jpop-idol": 2 },
          styleWeight: { "penlight-wave": 5, "silent-support": 3 },
        },
      },
      {
        id: "q3-b",
        text: "大聲 call & response",
        tags: {
          memberWeight: { hoshino: 4, rei: 2 },
          genreWeight: { "jpop-idol": 3, "rock-pop": 3 },
          styleWeight: { "call-response": 5, "mix-chant": 2 },
        },
      },
      {
        id: "q3-c",
        text: "背熟 mix 帶全場應援",
        tags: {
          memberWeight: { hoshino: 3, rei: 3 },
          genreWeight: { "dance-electro": 3, "rock-pop": 3 },
          styleWeight: { "mix-chant": 5 },
        },
      },
      {
        id: "q3-d",
        text: "安靜錄影留紀念",
        tags: {
          memberWeight: { luna: 3, miko: 3, sakura: 2 },
          genreWeight: { ballad: 3, acoustic: 3 },
          styleWeight: { "silent-support": 5 },
        },
      },
    ],
  },
  {
    id: "q4",
    emoji: "✨",
    questionText: "如果可以做一日 idol，你想…",
    options: [
      {
        id: "q4-a",
        text: "做 center 帶領全團",
        tags: {
          memberWeight: { sakura: 5, hoshino: 2 },
          genreWeight: { "jpop-idol": 4, ballad: 2 },
          styleWeight: { "penlight-wave": 4, "call-response": 2 },
        },
      },
      {
        id: "q4-b",
        text: "跳最難嘅 dance break",
        tags: {
          memberWeight: { hoshino: 5, rei: 2 },
          genreWeight: { "dance-electro": 5, "rock-pop": 2 },
          styleWeight: { "mix-chant": 4, "call-response": 2 },
        },
      },
      {
        id: "q4-c",
        text: "唱一首感動全場嘅 ballad",
        tags: {
          memberWeight: { luna: 5, sakura: 2, miko: 1 },
          genreWeight: { ballad: 5, acoustic: 3 },
          styleWeight: { "silent-support": 5 },
        },
      },
      {
        id: "q4-d",
        text: "做 MC 同 fan 玩遊戲",
        tags: {
          memberWeight: { miko: 4, hoshino: 3 },
          genreWeight: { "jpop-idol": 4, acoustic: 2 },
          styleWeight: { "call-response": 4, "penlight-wave": 2 },
        },
      },
    ],
  },
  {
    id: "q5",
    emoji: "💬",
    questionText: "邊句最啱形容你？",
    options: [
      {
        id: "q5-a",
        text: "溫柔可靠，大家嘅定心丸",
        tags: {
          memberWeight: { sakura: 5, luna: 2 },
          genreWeight: { ballad: 3, "jpop-idol": 2 },
          styleWeight: { "penlight-wave": 3, "silent-support": 3 },
        },
      },
      {
        id: "q5-b",
        text: "精力旺盛，永遠停唔到",
        tags: {
          memberWeight: { hoshino: 5, miko: 2 },
          genreWeight: { "dance-electro": 4, "jpop-idol": 3 },
          styleWeight: { "call-response": 4, "mix-chant": 3 },
        },
      },
      {
        id: "q5-c",
        text: "外冷內熱，型到爆",
        tags: {
          memberWeight: { rei: 5, luna: 2 },
          genreWeight: { "rock-pop": 4, "dance-electro": 3 },
          styleWeight: { "mix-chant": 4, "call-response": 2 },
        },
      },
      {
        id: "q5-d",
        text: "可愛即正義！",
        tags: {
          memberWeight: { miko: 5, sakura: 1 },
          genreWeight: { acoustic: 4, "jpop-idol": 3 },
          styleWeight: { "penlight-wave": 4, "call-response": 2 },
        },
      },
    ],
  },
];

const OPTION_EMOJI = {
  "q1-a": "📺",
  "q1-b": "🍜",
  "q1-c": "💃",
  "q1-d": "📔",
  "q2-a": "🌙",
  "q2-b": "⚡",
  "q2-c": "🎸",
  "q2-d": "🎻",
  "q3-a": "💡",
  "q3-b": "📣",
  "q3-c": "🔥",
  "q3-d": "📱",
  "q4-a": "👑",
  "q4-b": "🕺",
  "q4-c": "🎹",
  "q4-d": "🎲",
  "q5-a": "🤝",
  "q5-b": "🏃",
  "q5-c": "😎",
  "q5-d": "🥰",
};

/** @param {string} optionId */
export function getOptionEmoji(optionId) {
  return OPTION_EMOJI[optionId] || "✨";
}

/** @param {Record<string, number>} scores @param {string[]} ids */
function rankScores(scores, ids) {
  const max = Math.max(1, ...ids.map((id) => scores[id] || 0));
  return ids
    .map((id) => ({
      id,
      score: scores[id] || 0,
      matchPercent: Math.round(((scores[id] || 0) / max) * 100),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * @param {{ questionId: string, optionId: string }[]} answers
 * @returns {{
 *   topMember: LuminaMember & { matchPercent: number },
 *   topGenre: MusicGenre & { matchPercent: number },
 *   topStyle: CheerStyle & { matchPercent: number },
 *   fullRankings: {
 *     members: Array<LuminaMember & { matchPercent: number, score: number }>,
 *     genres: Array<MusicGenre & { matchPercent: number, score: number }>,
 *     styles: Array<CheerStyle & { matchPercent: number, score: number }>,
 *   },
 * }}
 */
export function calculateMatch(answers) {
  /** @type {Record<string, number>} */
  const memberScores = {};
  /** @type {Record<string, number>} */
  const genreScores = {};
  /** @type {Record<string, number>} */
  const styleScores = {};

  for (const member of LUMINA_MEMBERS) memberScores[member.id] = 0;
  for (const genre of GENRES) genreScores[genre.id] = 0;
  for (const style of CHEER_STYLES) styleScores[style.id] = 0;

  const optionMap = new Map();
  for (const q of QUESTIONS) {
    for (const opt of q.options) optionMap.set(opt.id, opt);
  }

  for (const { optionId } of answers) {
    const opt = optionMap.get(optionId);
    if (!opt) continue;
    for (const [id, w] of Object.entries(opt.tags.memberWeight)) {
      memberScores[id] = (memberScores[id] || 0) + w;
    }
    for (const [id, w] of Object.entries(opt.tags.genreWeight)) {
      genreScores[id] = (genreScores[id] || 0) + w;
    }
    for (const [id, w] of Object.entries(opt.tags.styleWeight)) {
      styleScores[id] = (styleScores[id] || 0) + w;
    }
  }

  const memberRank = rankScores(
    memberScores,
    LUMINA_MEMBERS.map((m) => m.id),
  );
  const genreRank = rankScores(
    genreScores,
    GENRES.map((g) => g.id),
  );
  const styleRank = rankScores(
    styleScores,
    CHEER_STYLES.map((s) => s.id),
  );

  const topMemberRaw = memberRank[0];
  const topGenreRaw = genreRank[0];
  const topStyleRaw = styleRank[0];

  const memberById = Object.fromEntries(LUMINA_MEMBERS.map((m) => [m.id, m]));
  const genreById = Object.fromEntries(GENRES.map((g) => [g.id, g]));
  const styleById = Object.fromEntries(CHEER_STYLES.map((s) => [s.id, s]));

  return {
    topMember: {
      ...memberById[topMemberRaw.id],
      matchPercent: topMemberRaw.matchPercent,
      score: topMemberRaw.score,
    },
    topGenre: {
      ...genreById[topGenreRaw.id],
      matchPercent: topGenreRaw.matchPercent,
      score: topGenreRaw.score,
    },
    topStyle: {
      ...styleById[topStyleRaw.id],
      matchPercent: topStyleRaw.matchPercent,
      score: topStyleRaw.score,
    },
    fullRankings: {
      members: memberRank.map((r) => ({
        ...memberById[r.id],
        matchPercent: r.matchPercent,
        score: r.score,
      })),
      genres: genreRank.map((r) => ({
        ...genreById[r.id],
        matchPercent: r.matchPercent,
        score: r.score,
      })),
      styles: styleRank.map((r) => ({
        ...styleById[r.id],
        matchPercent: r.matchPercent,
        score: r.score,
      })),
    },
  };
}

/**
 * @param {ReturnType<typeof calculateMatch>} matchResult
 */
export function generateOshiCertificate(matchResult) {
  const { topMember, topGenre, topStyle } = matchResult;
  const certificateText =
    `恭喜晒！你同 LUMINA 嘅 ${topMember.name} 配對度 ${topMember.matchPercent}% ✨\n` +
    `你嘅音樂 DNA 偏向「${topGenre.name}」，現場應援就交畀「${topStyle.name}」啦～\n` +
    `Eva 認證：你係正宗 ${topMember.imageEmoji} 推！`;

  const memberQuote = `${topMember.name}：「${topMember.catchphrase}」`;

  const recommendation =
    `入坑首選曲：${topMember.recommendedSong} · ` +
    `試下用 ${topStyle.penlightPattern} 應援，${topGenre.exampleSong} 都超啱你 vibe！`;

  return { certificateText, memberQuote, recommendation };
}
