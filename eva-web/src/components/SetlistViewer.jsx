import { useCallback, useState } from "react";

/** @param {{ track: import('../../../eva-core/services/event-service.js').SetlistTrack, expanded: boolean, onToggle: () => void }} props */
function SetlistRow({ track, expanded, onToggle }) {
  return (
    <li className={`le-setlist-row${track.isEncore ? " le-setlist-row--encore" : ""}`}>
      <button
        type="button"
        className="le-setlist-row-btn"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="le-setlist-num">{track.trackNumber}</span>
        <div className="le-setlist-main">
          <span className="le-setlist-title">{track.title}</span>
          <div className="le-setlist-badges">
            {track.isEncore && <span className="le-badge le-badge--encore">Encore</span>}
            <span
              className="le-penlight-dot"
              style={{ backgroundColor: track.recommendedPenlightColor }}
              title={`推薦 penlight：${track.recommendedPenlightColor}`}
            />
            <span
              className={`le-badge le-badge--diff${track.difficulty === "熟練" ? " le-badge--pro" : ""}`}
            >
              {track.difficulty}
            </span>
            {track.hasCallAndResponse && (
              <span className="le-badge le-badge--call" title="有 call & response">
                📣 Call
              </span>
            )}
            <span className="le-setlist-duration">{track.duration}</span>
          </div>
        </div>
        <span className="le-setlist-chevron" aria-hidden="true">
          {expanded ? "▾" : "▸"}
        </span>
      </button>
      {expanded && (
        <div className="le-setlist-detail">
          <p>
            <strong>Penlight：</strong>
            <span
              className="le-penlight-swatch"
              style={{ backgroundColor: track.recommendedPenlightColor }}
            />
            {track.recommendedPenlightColor}
          </p>
          {track.hasCallAndResponse ? (
            <p>
              <strong>應援：</strong>副歌前有 member call，記得跟 timing～
            </p>
          ) : (
            <p>
              <strong>應援：</strong>輕搖 penlight 就得，唔使 shout call。
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** @param {{ tracks: import('../../../eva-core/services/event-service.js').SetlistTrack[], guide?: { penlightColors: string[], callTimings: string[], outfitSuggestion: string, beforeShowChecklist: string[] } | null }} props */
export default function SetlistViewer({ tracks, guide = null }) {
  const [expandedId, setExpandedId] = useState(null);

  const toggle = useCallback((trackNumber) => {
    setExpandedId((prev) => (prev === trackNumber ? null : trackNumber));
  }, []);

  const mainTracks = tracks.filter((t) => !t.isEncore);
  const encoreTracks = tracks.filter((t) => t.isEncore);

  if (!tracks.length) {
    return <p className="le-empty">Setlist 稍後公布～</p>;
  }

  return (
    <div className="le-setlist">
      <h3 className="le-section-title">Setlist</h3>
      <ol className="le-setlist-list">
        {mainTracks.map((track) => (
          <SetlistRow
            key={track.trackNumber}
            track={track}
            expanded={expandedId === track.trackNumber}
            onToggle={() => toggle(track.trackNumber)}
          />
        ))}
      </ol>

      {encoreTracks.length > 0 && (
        <>
          <h4 className="le-setlist-encore-heading">🎵 Encore</h4>
          <ol className="le-setlist-list">
            {encoreTracks.map((track) => (
              <SetlistRow
                key={track.trackNumber}
                track={track}
                expanded={expandedId === track.trackNumber}
                onToggle={() => toggle(track.trackNumber)}
              />
            ))}
          </ol>
        </>
      )}

      {guide && (
        <aside className="le-cheering-guide">
          <h3 className="le-section-title">應援指南</h3>
          {guide.penlightColors.length > 0 && (
            <div className="le-guide-block">
              <h4>Penlight 色</h4>
              <ul>
                {guide.penlightColors.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {guide.callTimings.length > 0 && (
            <div className="le-guide-block">
              <h4>Call timing</h4>
              <ul>
                {guide.callTimings.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {guide.outfitSuggestion && (
            <div className="le-guide-block">
              <h4>穿搭建議</h4>
              <p>{guide.outfitSuggestion}</p>
            </div>
          )}
          {guide.beforeShowChecklist.length > 0 && (
            <div className="le-guide-block">
              <h4>開場前 checklist</h4>
              <ul className="le-checklist">
                {guide.beforeShowChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
