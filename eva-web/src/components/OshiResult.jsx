import OshiProfileCard from "./OshiProfileCard.jsx";

/** @param {{ matchResult: ReturnType<import('../../../eva-core/services/oshi-matcher.js').calculateMatch>, certificate: ReturnType<import('../../../eva-core/services/oshi-matcher.js').generateOshiCertificate>, onRetry: () => void }} props */
export default function OshiResult({ matchResult, certificate, onRetry }) {
  if (!matchResult || !certificate) return null;

  const { topGenre, topStyle, fullRankings } = matchResult;

  return (
    <section className="om-result" aria-label="配對結果">
      <div className="om-certificate">
        <div className="om-certificate-badge" aria-hidden="true">
          🏆
        </div>
        <h2 className="om-certificate-title">推し認證書</h2>
        <p className="om-certificate-text">{certificate.certificateText}</p>
        <p className="om-certificate-quote">{certificate.memberQuote}</p>
        <p className="om-certificate-rec">{certificate.recommendation}</p>
      </div>

      <OshiProfileCard member={matchResult.topMember} />

      <div className="om-result-grid">
        <div className="om-result-card">
          <h4 className="om-result-card-title">🎵 音樂 DNA</h4>
          <p className="om-result-card-name">{topGenre.name}</p>
          <p className="om-result-card-desc">{topGenre.description}</p>
          <p className="om-result-card-meta">
            配對 {topGenre.matchPercent}% · 例曲 {topGenre.exampleSong}
          </p>
        </div>
        <div className="om-result-card">
          <h4 className="om-result-card-title">💡 應援風格</h4>
          <p className="om-result-card-name">{topStyle.name}</p>
          <p className="om-result-card-desc">{topStyle.description}</p>
          <p className="om-result-card-meta">
            配對 {topStyle.matchPercent}% · {topStyle.penlightPattern}
          </p>
        </div>
      </div>

      <details className="om-rankings">
        <summary>完整排名</summary>
        <div className="om-rankings-grid">
          <RankingList title="Member" items={fullRankings.members} />
          <RankingList title="Genre" items={fullRankings.genres} />
          <RankingList title="Style" items={fullRankings.styles} />
        </div>
      </details>

      <button type="button" className="om-btn om-btn--ghost" onClick={onRetry}>
        重新配對
      </button>
    </section>
  );
}

/** @param {{ title: string, items: Array<{ id: string, name: string, matchPercent: number, imageEmoji?: string }> }} props */
function RankingList({ title, items }) {
  return (
    <div className="om-ranking-col">
      <h5>{title}</h5>
      <ol>
        {items.map((item, idx) => (
          <li key={item.id} className={idx === 0 ? "om-ranking-top" : ""}>
            <span className="om-ranking-label">
              {item.imageEmoji ? `${item.imageEmoji} ` : ""}
              {item.name}
            </span>
            <span className="om-ranking-pct">{item.matchPercent}%</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
