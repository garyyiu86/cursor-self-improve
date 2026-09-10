const STORAGE_KEY = "eva.connection";

const defaults = {
  baseUrl: "http://127.0.0.1:8787",
  token: "",
};

export function loadConnection() {
  const injected = window.__EVA_CONNECTION__;
  const platform = String(window.__EVA_PLATFORM__ || "").toLowerCase();
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    stored = null;
  }

  // Overlay injects the embedded API. Stale localStorage tokens from an old
  // session would 401 forever and leave the UI on "Loading chat history…".
  if (platform === "desktop" && injected?.baseUrl) {
    return {
      baseUrl: String(injected.baseUrl)
        .trim()
        .replace(/\/$/, ""),
      token: String(injected.token || "").trim(),
    };
  }

  const baseUrl = String(
    stored?.baseUrl || injected?.baseUrl || defaults.baseUrl,
  )
    .trim()
    .replace(/\/$/, "");
  const token = String(stored?.token || injected?.token || defaults.token).trim();
  return { baseUrl, token };
}

export function saveConnection(patch) {
  const next = { ...loadConnection(), ...(patch || {}) };
  next.baseUrl = String(next.baseUrl || defaults.baseUrl)
    .trim()
    .replace(/\/$/, "");
  next.token = String(next.token || "").trim();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function needsSetup(platform) {
  if (platform === "desktop") return false;
  const c = loadConnection();
  return !c.baseUrl || !c.token;
}
