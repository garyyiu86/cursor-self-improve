/** @param {{ member: import('../../../eva-core/services/oshi-matcher.js').LuminaMember & { matchPercent?: number }, compact?: boolean }} props */
export default function OshiProfileCard({ member, compact = false }) {
  if (!member) return null;

  return (
    <article
      className={`om-profile${compact ? " om-profile--compact" : ""}`}
      style={{ "--om-member-color": member.color }}
    >
      <div className="om-profile-glow" aria-hidden="true" />
      <div className="om-profile-avatar" aria-hidden="true">
        {member.imageEmoji}
      </div>
      <div className="om-profile-body">
        <h3 className="om-profile-name">{member.name}</h3>
        {member.matchPercent != null && (
          <p className="om-profile-match">配對度 {member.matchPercent}%</p>
        )}
        <p className="om-profile-catchphrase">「{member.catchphrase}」</p>
        {!compact && (
          <>
            <p className="om-profile-desc">{member.description}</p>
            <p className="om-profile-song">
              推薦入坑曲：<strong>{member.recommendedSong}</strong>
            </p>
          </>
        )}
      </div>
    </article>
  );
}
