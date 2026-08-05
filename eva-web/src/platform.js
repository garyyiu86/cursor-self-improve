/**
 * platform=desktop|android — feature flags for shared chat UI.
 * Desktop Electron injects window.__EVA_PLATFORM__ via preload.
 * Capacitor / mobile uses android (or query ?platform=android).
 */

const params = new URLSearchParams(location.search);

export function detectPlatform() {
  const injected = String(window.__EVA_PLATFORM__ || "").toLowerCase();
  if (injected === "desktop" || injected === "android") return injected;
  const q = String(params.get("platform") || "").toLowerCase();
  if (q === "desktop" || q === "android") return q;
  if (window.companion?.isDesktop) return "desktop";
  if (/Android/i.test(navigator.userAgent)) return "android";
  return "android";
}

export function isDesktop() {
  return detectPlatform() === "desktop";
}

export function isAndroid() {
  return detectPlatform() === "android";
}

export function features() {
  const desktop = isDesktop();
  return {
    platform: detectPlatform(),
    // Mascot + expression animations on both PC and Android
    mascot: true,
    drag: desktop && typeof window.companion?.dragStart === "function",
    applyWithCursor: desktop && typeof window.companion?.applyWithCursor === "function",
    connectionSettings: !desktop,
    transparentShell: desktop,
  };
}
