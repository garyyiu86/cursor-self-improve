/** @typedef {'sold out'|'available'|'limited'} TicketStatus */

/**
 * @typedef {Object} LiveEvent
 * @property {string} id
 * @property {string} name
 * @property {string} date ISO datetime
 * @property {string} venue
 * @property {string} doorsOpen HH:mm
 * @property {string} startTime HH:mm
 * @property {TicketStatus} ticketStatus
 * @property {string} imagePlaceholder emoji
 */

/**
 * @typedef {Object} SetlistTrack
 * @property {number} trackNumber
 * @property {string} title 粵語+日語
 * @property {boolean} isEncore
 * @property {string} recommendedPenlightColor
 * @property {boolean} hasCallAndResponse
 * @property {'推し初心者'|'熟練'} difficulty
 * @property {string} duration mm:ss
 */

/**
 * @typedef {Object} Countdown
 * @property {number} days
 * @property {number} hours
 * @property {number} minutes
 * @property {number} seconds
 * @property {boolean} isToday
 * @property {boolean} isPast
 */

/** @param {number} days @param {number} [hour] @param {number} [minute] */
function daysFromNow(days, hour = 19, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** @type {LiveEvent[]} */
const EVENTS = [
  {
    id: "lumina-hk-starlight",
    name: "LUMINA 星夢啟程 Tour · 香港站",
    date: daysFromNow(4, 18, 30),
    venue: "AsiaWorld-Arena · 博覽館",
    doorsOpen: "17:00",
    startTime: "18:30",
    ticketStatus: "available",
    imagePlaceholder: "🌟",
  },
  {
    id: "lumina-sakura-live",
    name: "LUMINA 櫻花祭 Special Live",
    date: daysFromNow(0, 19, 0),
    venue: "K Arena 東京",
    doorsOpen: "17:30",
    startTime: "19:00",
    ticketStatus: "limited",
    imagePlaceholder: "🌸",
  },
  {
    id: "lumina-anniversary",
    name: "LUMINA 週年紀念 Night",
    date: daysFromNow(12, 19, 0),
    venue: "Zepp Haneda",
    doorsOpen: "17:00",
    startTime: "19:00",
    ticketStatus: "sold out",
    imagePlaceholder: "💫",
  },
  {
    id: "lumina-tokyo-special",
    name: "LUMINA 東京特別公演",
    date: daysFromNow(21, 18, 0),
    venue: "Nippon Budokan",
    doorsOpen: "16:30",
    startTime: "18:00",
    ticketStatus: "sold out",
    imagePlaceholder: "🎤",
  },
];

/** @type {Record<string, SetlistTrack[]>} */
const SETLISTS = {
  "lumina-hk-starlight": [
    {
      trackNumber: 1,
      title: "星路の始まり（星路開端）",
      isEncore: false,
      recommendedPenlightColor: "#ffb7c5",
      hasCallAndResponse: true,
      difficulty: "推し初心者",
      duration: "4:12",
    },
    {
      trackNumber: 2,
      title: "銀河ダンス（銀河之舞）",
      isEncore: false,
      recommendedPenlightColor: "#c0c0c0",
      hasCallAndResponse: false,
      difficulty: "推し初心者",
      duration: "3:48",
    },
    {
      trackNumber: 3,
      title: "ハートビート（心跳）",
      isEncore: false,
      recommendedPenlightColor: "#ff6b9d",
      hasCallAndResponse: true,
      difficulty: "熟練",
      duration: "5:02",
    },
    {
      trackNumber: 4,
      title: "Midnight Call（午夜應援）",
      isEncore: false,
      recommendedPenlightColor: "#9b59b6",
      hasCallAndResponse: true,
      difficulty: "熟練",
      duration: "4:35",
    },
    {
      trackNumber: 5,
      title: "アンコール · 永遠の光（Encore · 永恆之光）",
      isEncore: true,
      recommendedPenlightColor: "#ffd700",
      hasCallAndResponse: true,
      difficulty: "推し初心者",
      duration: "6:10",
    },
  ],
  "lumina-sakura-live": [
    {
      trackNumber: 1,
      title: "桜吹雪（櫻吹雪）",
      isEncore: false,
      recommendedPenlightColor: "#ffb7c5",
      hasCallAndResponse: false,
      difficulty: "推し初心者",
      duration: "3:55",
    },
    {
      trackNumber: 2,
      title: "春風セレナーデ（春風小夜曲）",
      isEncore: false,
      recommendedPenlightColor: "#ffc0cb",
      hasCallAndResponse: true,
      difficulty: "推し初心者",
      duration: "4:20",
    },
    {
      trackNumber: 3,
      title: "推し色メモリー（推し色記憶）",
      isEncore: false,
      recommendedPenlightColor: "#e88fa0",
      hasCallAndResponse: true,
      difficulty: "熟練",
      duration: "5:15",
    },
    {
      trackNumber: 4,
      title: "アンコール · さくらの約束（Encore · 櫻之約）",
      isEncore: true,
      recommendedPenlightColor: "#ff69b4",
      hasCallAndResponse: true,
      difficulty: "熟練",
      duration: "5:40",
    },
  ],
  "lumina-anniversary": [
    {
      trackNumber: 1,
      title: "One Year Spark（週年火花）",
      isEncore: false,
      recommendedPenlightColor: "#ffd700",
      hasCallAndResponse: true,
      difficulty: "推し初心者",
      duration: "4:05",
    },
    {
      trackNumber: 2,
      title: "記念日の歌（紀念日之歌）",
      isEncore: false,
      recommendedPenlightColor: "#ffb7c5",
      hasCallAndResponse: false,
      difficulty: "推し初心者",
      duration: "3:50",
    },
    {
      trackNumber: 3,
      title: "アンコール · 未来へ（Encore · 向未來）",
      isEncore: true,
      recommendedPenlightColor: "#c0c0c0",
      hasCallAndResponse: true,
      difficulty: "熟練",
      duration: "6:00",
    },
  ],
  "lumina-tokyo-special": [
    {
      trackNumber: 1,
      title: "武道館の夜（武道館之夜）",
      isEncore: false,
      recommendedPenlightColor: "#c0c0c0",
      hasCallAndResponse: true,
      difficulty: "熟練",
      duration: "5:30",
    },
    {
      trackNumber: 2,
      title: "東京ドリーム（東京之夢）",
      isEncore: false,
      recommendedPenlightColor: "#ffb7c5",
      hasCallAndResponse: true,
      difficulty: "熟練",
      duration: "4:45",
    },
    {
      trackNumber: 3,
      title: "アンコール · 最高の瞬間（Encore · 最佳瞬間）",
      isEncore: true,
      recommendedPenlightColor: "#ffd700",
      hasCallAndResponse: true,
      difficulty: "推し初心者",
      duration: "7:00",
    },
  ],
};

/** @type {Record<string, { penlightColors: string[], callTimings: string[], outfitSuggestion: string, beforeShowChecklist: string[] }>} */
const CHEERING_GUIDES = {
  "lumina-hk-starlight": {
    penlightColors: ["櫻粉 #ffb7c5", "星光銀 #c0c0c0", "紫 #9b59b6"],
    callTimings: [
      "Track 1 副歌前 8 拍：「LUMINA——！」",
      "Track 3 bridge：跟 member call「星野！玲！」",
      "Encore 全曲：penlight 波浪 + 大合唱",
    ],
    outfitSuggestion: "推し色 tee + 輕便運動鞋；場館冷氣足，帶薄外套。",
    beforeShowChecklist: [
      "check penlight 電量同備用電池",
      "download 應援口號 cheat sheet",
      "預早 45 分鐘入場搵位",
      "帶水同喉糖",
      "關 silent mode，flash 只跟 MC 指示",
    ],
  },
  "lumina-sakura-live": {
    penlightColors: ["櫻粉 #ffb7c5", "淡粉 #ffc0cb", "白 #ffffff"],
    callTimings: [
      "Track 2 前奏：輕搖 penlight",
      "Track 3 副歌：「推し色メモリー！」合聲",
      "Encore：全場櫻花粉波浪",
    ],
    outfitSuggestion: "櫻花主題配件 OK，但唔好阻到後面觀眾視線。",
    beforeShowChecklist: [
      "confirm 門票 QR code",
      "練熟 Track 2 call timing",
      "帶應援毛巾（可能甩汗）",
      "check 交通末班車時間",
    ],
  },
  "lumina-anniversary": {
    penlightColors: ["金 #ffd700", "櫻粉 #ffb7c5", "銀 #c0c0c0"],
    callTimings: [
      "Opening：週年口號三連",
      "Track 2 結尾：生日 call",
      "Encore：全場舉高 penlight",
    ],
    outfitSuggestion: "週年限定 goods 可以著，但 penlight 顏色跟 setlist 表。",
    beforeShowChecklist: [
      "帶週年應援物",
      "預早排隊買 goods",
      "熟讀 member 生日 call",
      "影相位要早到",
    ],
  },
  "lumina-tokyo-special": {
    penlightColors: ["銀 #c0c0c0", "金 #ffd700", "櫻粉 #ffb7c5"],
    callTimings: [
      "Track 1 前 16 拍：武道館 tradition call",
      "Track 2 全曲：高難度 wave",
      "Encore：7 分鐘 endurance call",
    ],
    outfitSuggestion: "武道館 dress code 偏正式；唔好穿太高 heels。",
    beforeShowChecklist: [
      "confirm 日文 call sheet",
      "帶護喉 + 水",
      "熟練 Track 2 wave timing",
      "預留 goods queue 時間",
    ],
  },
};

/** @returns {LiveEvent[]} */
export function getUpcomingEvents() {
  const now = Date.now();
  return EVENTS.filter((e) => {
    const start = new Date(e.date).getTime();
    return start >= now - 24 * 60 * 60 * 1000;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));
}

/** @param {string} id @returns {LiveEvent|null} */
export function getEventById(id) {
  return EVENTS.find((e) => e.id === id) || null;
}

/** @param {string|Date} eventDate @returns {Countdown} */
export function getCountdown(eventDate) {
  const target = new Date(eventDate);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const isToday = target >= todayStart && target < todayEnd;

  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isToday, isPast: true };
  }

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return { days, hours, minutes, seconds, isToday, isPast: false };
}

/** @param {string} eventId @returns {SetlistTrack[]} */
export function getSetlist(eventId) {
  return SETLISTS[eventId] ? [...SETLISTS[eventId]] : [];
}

/** @param {string} eventId */
export function getCheeringGuide(eventId) {
  const guide = CHEERING_GUIDES[eventId];
  if (!guide) {
    return {
      penlightColors: [],
      callTimings: [],
      outfitSuggestion: "",
      beforeShowChecklist: [],
    };
  }
  return {
    penlightColors: [...guide.penlightColors],
    callTimings: [...guide.callTimings],
    outfitSuggestion: guide.outfitSuggestion,
    beforeShowChecklist: [...guide.beforeShowChecklist],
  };
}

/** @param {Countdown} countdown @returns {string} */
export function formatCountdownString(countdown) {
  if (countdown.isPast) return "演出已經結束喇～多謝你嚟應援！";
  if (countdown.isToday) return "🎉 就係今日！準備好 penlight 未？";

  const parts = [];
  if (countdown.days > 0) parts.push(`${countdown.days} 日`);
  if (countdown.hours > 0) parts.push(`${countdown.hours} 個鐘`);
  if (countdown.days === 0 && countdown.minutes > 0) {
    parts.push(`${countdown.minutes} 分鐘`);
  }
  if (parts.length === 0) parts.push(`${countdown.seconds} 秒`);

  return `仲有 ${parts.join(" ")} 就開演喇！`;
}
