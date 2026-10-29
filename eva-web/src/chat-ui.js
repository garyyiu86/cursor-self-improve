import { renderMarkdownInto } from "./markdown.js";

const BOTTOM_THRESHOLD = 56;
const SMOOTH_SCROLL_MS = 380;
const scrollers = new WeakMap();

/**
 * Track whether the user is reading history vs following the latest turn.
 * Auto-scroll only when pinned (near bottom) unless `force` is set.
 */
export function attachChatAutoScroll(responseEl) {
  if (scrollers.has(responseEl)) return scrollers.get(responseEl);

  let pinned = true;
  let scrollRaf = 0;
  let smoothTimer = 0;

  function gap() {
    return Math.max(0, responseEl.scrollHeight - responseEl.scrollTop - responseEl.clientHeight);
  }

  function isNearBottom() {
    return gap() <= BOTTOM_THRESHOLD;
  }

  function syncPinned() {
    pinned = isNearBottom();
  }

  function onScroll() {
    if (responseEl.dataset.programmaticScroll) return;
    syncPinned();
  }

  responseEl.addEventListener("scroll", onScroll, { passive: true });

  function scrollToBottom({ force = false, smooth = true } = {}) {
    if (!force && !pinned) return;

    cancelAnimationFrame(scrollRaf);
    if (smoothTimer) clearTimeout(smoothTimer);

    scrollRaf = requestAnimationFrame(() => {
      const top = responseEl.scrollHeight;
      responseEl.dataset.programmaticScroll = "1";

      if (smooth && typeof responseEl.scrollTo === "function") {
        responseEl.scrollTo({ top, behavior: "smooth" });
        smoothTimer = window.setTimeout(() => {
          delete responseEl.dataset.programmaticScroll;
          if (force) pinned = true;
          else syncPinned();
        }, SMOOTH_SCROLL_MS);
      } else {
        responseEl.scrollTop = top;
        delete responseEl.dataset.programmaticScroll;
        if (force) pinned = true;
      }
    });
  }

  const api = {
    scrollToBottom,
    pin: () => {
      pinned = true;
    },
    syncPinned,
    isPinned: () => pinned,
  };
  scrollers.set(responseEl, api);
  return api;
}

function getScroller(responseEl) {
  return scrollers.get(responseEl) || attachChatAutoScroll(responseEl);
}

export function formatTs(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

export function historySig(list) {
  return (Array.isArray(list) ? list : [])
    .map((m) => `${m.role}|${m.ts}|${String(m.content ?? "")}`)
    .join("\n");
}

function createMessageEl(m, { animate = false, index = -1, getRegenerate } = {}) {
  const div = document.createElement("div");
  div.className = "msg " + (m.role === "user" ? "you" : "eva");
  if (animate) div.classList.add("msg-enter");
  if (index >= 0) div.dataset.historyIndex = String(index);

  const meta = document.createElement("div");
  meta.className = "meta";
  const who = document.createElement("div");
  who.className = "who";
  who.textContent = m.role === "user" ? "You" : "Eva";

  const metaActions = document.createElement("div");
  metaActions.className = "meta-actions";

  if (m.role === "assistant" && typeof getRegenerate === "function") {
    const regen = getRegenerate(index, m);
    if (regen) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "msg-regenerate";
      btn.title = "Regenerate reply";
      btn.setAttribute("aria-label", "Regenerate reply");
      btn.textContent = "↻";
      btn.disabled = !regen.enabled;
      if (regen.enabled && typeof regen.onClick === "function") {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          regen.onClick();
        });
      }
      metaActions.appendChild(btn);
    }
  }

  const ts = document.createElement("div");
  ts.className = "ts";
  ts.textContent = formatTs(m.ts);
  metaActions.appendChild(ts);

  meta.appendChild(who);
  meta.appendChild(metaActions);

  const body = document.createElement("div");
  body.className = "msg-body";
  renderMarkdownInto(body, m.content);
  div.appendChild(meta);
  div.appendChild(body);
  return div;
}

/** Refresh regenerate button enabled state after chatBusy toggles. */
export function syncRegenerateButtons(responseEl, getRegenerate) {
  if (typeof getRegenerate !== "function") return;
  for (const el of responseEl.querySelectorAll(".msg.eva:not([data-progress])")) {
    const btn = el.querySelector(".msg-regenerate");
    if (!btn) continue;
    const index = Number(el.dataset.historyIndex);
    if (!Number.isFinite(index) || index < 0) continue;
    const regen = getRegenerate(index);
    btn.disabled = !regen?.enabled;
  }
}

/**
 * Append one chat bubble with optional fade-in (avoids full history repaint).
 */
export function appendChatMessage(responseEl, message, {
  animate = true,
  scrollToBottom = true,
  index = -1,
  getRegenerate,
} = {}) {
  responseEl.classList.remove("muted");
  const el = createMessageEl(message, { animate, index, getRegenerate });
  responseEl.appendChild(el);
  if (scrollToBottom) {
    getScroller(responseEl).scrollToBottom({ force: true, smooth: true });
  }
  return el;
}

/**
 * Paint saved chat history into #response.
 * @returns {string} render signature for dedupe
 */
export function renderChat(responseEl, history, {
  scrollToBottom = false,
  preserveScroll = false,
  force = false,
  animateFrom = -1,
  emptyText = "",
  chatRenderSig = "",
  getRegenerate,
} = {}) {
  const scroller = getScroller(responseEl);
  const prevTop = responseEl.scrollTop;
  const sig = historySig(history);
  const alreadyPainted = history.length
    ? Boolean(responseEl.querySelector(".msg:not([data-progress])"))
    : responseEl.classList.contains("muted");
  if (!force && sig === chatRenderSig && alreadyPainted) {
    if (scrollToBottom) scroller.scrollToBottom({ force: true, smooth: true });
    return sig;
  }
  if (!history.length) {
    responseEl.classList.add("muted");
    responseEl.textContent = emptyText;
    return sig;
  }
  responseEl.classList.remove("muted");
  responseEl.innerHTML = "";
  for (let i = 0; i < history.length; i++) {
    const animate = animateFrom >= 0 && i >= animateFrom;
    responseEl.appendChild(createMessageEl(history[i], { animate, index: i, getRegenerate }));
  }
  if (scrollToBottom) {
    scroller.scrollToBottom({ force: true, smooth: true });
  } else if (preserveScroll) {
    responseEl.scrollTop = prevTop;
    scroller.syncPinned();
  }
  return sig;
}

/**
 * Append Eva「打字中」指示器（星野玲應援色）。收到 stream / 最終回覆前保持顯示。
 */
export function appendTypingIndicator(responseEl) {
  const el = document.createElement("div");
  el.className = "msg eva typing-indicator msg-enter";
  el.dataset.progress = "1";
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-busy", "true");

  const meta = document.createElement("div");
  meta.className = "meta";
  const who = document.createElement("div");
  who.className = "who";
  who.textContent = "Eva";
  meta.appendChild(who);

  const body = document.createElement("div");
  body.className = "msg-body";

  const dots = document.createElement("div");
  dots.className = "typing-dots";
  dots.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 3; i++) {
    dots.appendChild(document.createElement("span"));
  }

  const status = document.createElement("div");
  status.className = "typing-status hidden";

  const stream = document.createElement("div");
  stream.className = "typing-stream hidden";

  body.appendChild(dots);
  body.appendChild(status);
  body.appendChild(stream);
  el.appendChild(meta);
  el.appendChild(body);
  responseEl.appendChild(el);

  const scroller = getScroller(responseEl);
  scroller.scrollToBottom({ smooth: true });

  function scrollIfNeeded(smooth = false) {
    scroller.scrollToBottom({ smooth });
  }

  return {
    el,
    showTyping(message) {
      el.classList.add("typing-indicator");
      el.classList.remove("streaming");
      el.setAttribute("aria-busy", "true");
      dots.classList.remove("hidden");
      stream.classList.add("hidden");
      stream.innerHTML = "";
      const tip = String(message || "").trim();
      if (tip) {
        status.textContent = tip;
        status.classList.remove("hidden");
      } else {
        status.textContent = "";
        status.classList.add("hidden");
      }
      scrollIfNeeded(true);
    },
    showStream(text) {
      el.classList.remove("typing-indicator");
      el.classList.add("streaming");
      el.setAttribute("aria-busy", "true");
      dots.classList.add("hidden");
      status.classList.add("hidden");
      stream.classList.remove("hidden");
      renderMarkdownInto(stream, text || "…");
      scrollIfNeeded(false);
    },
    remove() {
      el.remove();
    },
  };
}

/** Platform-aware label for the modifier+Enter send shortcut. */
export function composerSendShortcutLabel() {
  const mac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform || "");
  return mac ? "⌘+Enter" : "Ctrl+Enter";
}

/**
 * Composer keyboard: Enter or Ctrl/Cmd+Enter sends; Shift+Enter inserts a newline.
 * Skips IME composition and Alt+Enter.
 * @param {HTMLTextAreaElement} textareaEl
 * @param {() => void} onSend
 * @param {{ canSend?: () => boolean }} [opts]
 * @returns {() => void} detach listener
 */
export function attachComposerEnterToSend(textareaEl, onSend, { canSend } = {}) {
  if (!textareaEl || typeof onSend !== "function") return () => {};

  function onKeyDown(e) {
    if (e.key !== "Enter" && e.code !== "Enter") return;
    if (e.isComposing || e.keyCode === 229) return;

    const modifierSend = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey;
    const plainSend = !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!modifierSend && !plainSend) return;
    if (typeof canSend === "function" && !canSend()) return;
    e.preventDefault();
    onSend();
  }

  textareaEl.addEventListener("keydown", onKeyDown);
  return () => textareaEl.removeEventListener("keydown", onKeyDown);
}
