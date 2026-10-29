import { Link } from "react-router-dom";
import MoodCheckIn from "../components/MoodCheckIn.jsx";
import MoodStreak from "../components/MoodStreak.jsx";
import MoodTimeline from "../components/MoodTimeline.jsx";
import { useMoodJournal } from "../hooks/useMoodJournal.js";
import "../styles/mood-journal.css";

export default function MoodJournal() {
  const {
    history,
    streak,
    stats,
    isCheckInOpen,
    checkedInToday,
    logEntry,
    deleteEntry,
    openCheckIn,
    closeCheckIn,
  } = useMoodJournal();

  return (
    <div className="mj-page">
      <header className="mj-header">
        <div className="mj-header-top">
          <Link to="/" className="mj-back">
            ← 聊天
          </Link>
          <h1 className="mj-heading">心情日記</h1>
        </div>
        <p className="mj-tagline">Eva 陪你記低每日心情 · 櫻粉 streak ✨</p>
      </header>

      <div className="mj-actions">
        <button type="button" className="mj-btn" onClick={openCheckIn}>
          {checkedInToday ? "更新今日心情" : "今日打卡"}
        </button>
        <Link to="/fitness" className="mj-btn mj-btn--ghost">
          健身顧問
        </Link>
      </div>

      <MoodStreak streak={streak} stats={stats} />
      <MoodTimeline entries={history} onDelete={deleteEntry} />

      <MoodCheckIn
        open={isCheckInOpen}
        onClose={closeCheckIn}
        onSubmit={(mood, note, tags) => logEntry(mood, note, tags)}
      />
    </div>
  );
}
