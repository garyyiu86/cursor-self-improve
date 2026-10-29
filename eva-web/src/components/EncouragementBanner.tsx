import type { Encouragement } from "../services/progressStats";
import "../styles/dashboard.css";

export interface EncouragementBannerProps {
  encouragement: Encouragement;
}

const TONE_EMOJI: Record<Encouragement["tone"], string> = {
  celebrate: "✨",
  motivate: "💪",
  gentle: "🌸",
  welcome: "👋",
};

export function EncouragementBanner({ encouragement }: EncouragementBannerProps) {
  return (
    <aside
      className={`dash-encouragement dash-encouragement--${encouragement.tone}`}
      role="status"
      aria-live="polite"
    >
      <span className="dash-encouragement-avatar" aria-hidden="true">
        {TONE_EMOJI[encouragement.tone]}
      </span>
      <p className="dash-encouragement-text">{encouragement.message}</p>
    </aside>
  );
}
