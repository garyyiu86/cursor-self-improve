import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./style.css";

const platform =
  window.__EVA_PLATFORM__ === "desktop" || window.companion?.isDesktop
    ? "desktop"
    : "android";
document.documentElement.classList.add(`platform-${platform}`);
document.body.classList.add(`platform-${platform}`);
if (platform === "desktop") {
  const hash = String(location.hash || "");
  if (hash && hash !== "#" && hash !== "#/") {
    location.replace(`${location.pathname}${location.search}#/`);
  }
}

const rootEl = document.getElementById("app");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
