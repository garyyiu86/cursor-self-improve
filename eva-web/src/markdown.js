/**
 * Render a subset of Markdown into DOM.
 * Uses createElement/textContent — no HTML string interpolation.
 */

import { mediaUrl } from "./api.js";

function splitCells(line) {
  let s = String(line || "").trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function isSepRow(line) {
  const cells = splitCells(line);
  if (!cells.length) return false;
  return cells.every((c) => /^:?-{3,}:?$/.test(c.replace(/\s+/g, "")));
}

function looksLikeTableRow(line) {
  const t = String(line || "").trim();
  if (!t.includes("|")) return false;
  return splitCells(t).length >= 2;
}

function alignFromSep(cell) {
  const c = String(cell || "").replace(/\s+/g, "");
  const left = c.startsWith(":");
  const right = c.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return "left";
}

function parseHeading(line) {
  const t = String(line || "").trim();
  const m = /^(#{1,6})\s+(.+)$/.exec(t) || /^(#{1,6})([^#\s].+)$/.exec(t);
  if (!m) return null;
  return { level: m[1].length, text: m[2].trim() };
}

function isHr(line) {
  return /^(\*{3,}|-{3,}|_{3,})\s*$/.test(String(line || "").trim());
}

function parseBullet(line) {
  const m = /^\s*([-*+])\s+(.+)$/.exec(line);
  if (!m) return null;
  return { ordered: false, text: m[2] };
}

function parseOrdered(line) {
  const m = /^\s*(\d+)[.)]\s+(.+)$/.exec(line);
  if (!m) return null;
  return { ordered: true, text: m[2], start: Number(m[1]) };
}

function parseQuote(line) {
  const m = /^\s{0,3}>\s?(.*)$/.exec(line);
  if (!m) return null;
  return m[1];
}

function mediaKind(url) {
  let pathname = "";
  try {
    pathname = decodeURIComponent(new URL(url).pathname || "");
  } catch {
    pathname = String(url).split("?")[0];
  }
  const p = pathname.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(p) || /\/image\//.test(p)) return "image";
  if (/\.html?$/.test(p)) return "html";
  return "link";
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function withHtmlBase(html, href) {
  const raw = String(html || "");
  let baseHref = href;
  try {
    baseHref = new URL(".", href).href;
  } catch (_) {}
  const tag = `<base href="${escapeAttr(baseHref)}"><style>html,body{margin:0!important;padding:0!important;overflow:hidden!important;width:100%!important;height:100%!important;}body{-webkit-overflow-scrolling:auto;}</style>`;
  if (/<head[^>]*>/i.test(raw)) {
    return raw.replace(/<head[^>]*>/i, (m) => `${m}${tag}`);
  }
  if (/<html[^>]*>/i.test(raw)) {
    return raw.replace(/<html[^>]*>/i, (m) => `${m}<head>${tag}</head>`);
  }
  return `<!DOCTYPE html><head>${tag}</head>${raw}`;
}

function fitEmbedFrame(frame) {
  try {
    const doc = frame.contentDocument;
    if (!doc?.documentElement) return;
    const body = doc.body;
    if (body) {
      body.style.overflow = "hidden";
      body.style.margin = "0";
      body.style.transformOrigin = "top left";
    }
    doc.documentElement.style.overflow = "hidden";
    const w = Math.max(doc.documentElement.scrollWidth, body?.scrollWidth || 0, 1);
    const h = Math.max(doc.documentElement.scrollHeight, body?.scrollHeight || 0, 1);
    const scale = Math.min(frame.clientWidth / w, frame.clientHeight / h, 1);
    if (body && scale > 0 && scale < 0.999) {
      body.style.transform = `scale(${scale})`;
      body.style.width = `${Math.round(w)}px`;
    }
  } catch (_) {}
}

async function embedHtmlPreview(wrap, href, alt) {
  const frame = document.createElement("iframe");
  frame.className = "md-embed";
  frame.title = alt || "preview";
  frame.scrolling = "no";
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  frame.referrerPolicy = "no-referrer";
  frame.addEventListener("load", () => fitEmbedFrame(frame));
  wrap.appendChild(frame);
  try {
    const res = await fetch(mediaUrl(href));
    if (!res.ok) throw new Error(String(res.status));
    frame.srcdoc = withHtmlBase(await res.text(), href);
  } catch (_) {
    frame.src = mediaUrl(href);
  }
}

function appendChatMedia(parent, url, alt) {
  const href = String(url || "").trim();
  const kind = mediaKind(href);
  const src = mediaUrl(href);
  if (kind === "image") {
    const img = document.createElement("img");
    img.className = "md-img";
    img.src = src;
    img.alt = alt || "";
    img.referrerPolicy = "no-referrer";
    parent.appendChild(img);
    return;
  }
  if (kind === "html") {
    const wrap = document.createElement("div");
    wrap.className = "md-embed-wrap";
    parent.appendChild(wrap);
    void embedHtmlPreview(wrap, href, alt);
    return;
  }
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener noreferrer";
  a.textContent = alt || href;
  a.addEventListener("click", (e) => e.preventDefault());
  parent.appendChild(a);
}

function appendInline(parent, text) {
  const s = String(text ?? "");
  const re =
    /(!\[([^\]]*)\]\((https?:[^)\s]+)\)|\[([^\]]+)\]\((https?:[^)\s]+)\)|https?:\/\/[^\s)<]+|\*\*[^*]+?\*\*|~~[^~]+?~~|`[^`]+?`|\*[^*\n]+?\*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) {
      parent.appendChild(document.createTextNode(s.slice(last, m.index)));
    }
    const token = m[0];
    if (token.startsWith("![")) {
      appendChatMedia(parent, m[3], m[2] || "");
    } else if (token.startsWith("[")) {
      appendChatMedia(parent, m[5], m[4] || "");
    } else if (/^https?:\/\//i.test(token)) {
      const href = token.replace(/[.,;:!?]+$/, "");
      const trail = token.slice(href.length);
      appendChatMedia(parent, href, "");
      if (trail) parent.appendChild(document.createTextNode(trail));
    } else if (token.startsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = token.slice(2, -2);
      parent.appendChild(strong);
    } else if (token.startsWith("~~")) {
      const del = document.createElement("del");
      del.textContent = token.slice(2, -2);
      parent.appendChild(del);
    } else if (token.startsWith("`")) {
      const code = document.createElement("code");
      code.textContent = token.slice(1, -1);
      parent.appendChild(code);
    } else {
      const em = document.createElement("em");
      em.textContent = token.slice(1, -1);
      parent.appendChild(em);
    }
    last = m.index + token.length;
  }
  if (last < s.length) {
    parent.appendChild(document.createTextNode(s.slice(last)));
  }
}

function renderTable(header, aligns, rows) {
  const wrap = document.createElement("div");
  wrap.className = "md-table-wrap";
  const table = document.createElement("table");
  table.className = "md-table";

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  header.forEach((cell, i) => {
    const th = document.createElement("th");
    if (aligns[i]) th.style.textAlign = aligns[i];
    appendInline(th, cell);
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (let i = 0; i < header.length; i++) {
      const td = document.createElement("td");
      if (aligns[i]) td.style.textAlign = aligns[i];
      appendInline(td, row[i] ?? "");
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function parseBlocks(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      i += 1;
      const buf = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: "code", lang, text: buf.join("\n") });
      continue;
    }

    if (looksLikeTableRow(line) && i + 1 < lines.length && isSepRow(lines[i + 1])) {
      const header = splitCells(line);
      const aligns = splitCells(lines[i + 1]).map(alignFromSep);
      i += 2;
      const rows = [];
      while (i < lines.length && looksLikeTableRow(lines[i]) && !isSepRow(lines[i])) {
        const cells = splitCells(lines[i]);
        while (cells.length < header.length) cells.push("");
        rows.push(cells);
        i += 1;
      }
      blocks.push({ type: "table", header, aligns, rows });
      continue;
    }

    const heading = parseHeading(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading.level, text: heading.text });
      i += 1;
      continue;
    }

    if (isHr(line) && !looksLikeTableRow(line)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    const quote = parseQuote(line);
    if (quote != null) {
      const buf = [quote];
      i += 1;
      while (i < lines.length) {
        const q = parseQuote(lines[i]);
        if (q == null) break;
        buf.push(q);
        i += 1;
      }
      blocks.push({ type: "quote", text: buf.join("\n") });
      continue;
    }

    const bullet = parseBullet(line);
    const ordered = parseOrdered(line);
    if (bullet || ordered) {
      const list = {
        type: "list",
        ordered: Boolean(ordered),
        items: [],
        start: ordered ? ordered.start : 1,
      };
      while (i < lines.length) {
        const b = parseBullet(lines[i]);
        const o = parseOrdered(lines[i]);
        if (list.ordered) {
          if (!o) break;
          list.items.push(o.text);
        } else {
          if (!b) break;
          list.items.push(b.text);
        }
        i += 1;
      }
      blocks.push(list);
      continue;
    }

    const start = i;
    i += 1;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (t.startsWith("```")) break;
      if (looksLikeTableRow(lines[i]) && i + 1 < lines.length && isSepRow(lines[i + 1])) break;
      if (parseHeading(lines[i])) break;
      if (isHr(lines[i]) && !looksLikeTableRow(lines[i])) break;
      if (parseQuote(lines[i]) != null) break;
      if (parseBullet(lines[i]) || parseOrdered(lines[i])) break;
      i += 1;
    }
    const chunk = lines.slice(start, i).join("\n");
    if (chunk.length) blocks.push({ type: "text", text: chunk });
  }

  return blocks;
}

function renderTextBlock(text, className) {
  const p = document.createElement("div");
  p.className = className;
  const parts = String(text).split(/\n/);
  parts.forEach((line, idx) => {
    if (idx) p.appendChild(document.createElement("br"));
    appendInline(p, line);
  });
  return p;
}

export function renderMarkdownInto(el, text) {
  el.replaceChildren();
  const blocks = parseBlocks(text);
  if (!blocks.length) {
    el.textContent = "";
    return el;
  }
  for (const block of blocks) {
    if (block.type === "table") {
      el.appendChild(renderTable(block.header, block.aligns, block.rows));
      continue;
    }
    if (block.type === "code") {
      const pre = document.createElement("pre");
      pre.className = "md-pre";
      const code = document.createElement("code");
      code.textContent = block.text;
      pre.appendChild(code);
      el.appendChild(pre);
      continue;
    }
    if (block.type === "heading") {
      const tag = `h${Math.min(6, Math.max(1, block.level))}`;
      const h = document.createElement(tag);
      h.className = `md-h md-h${block.level}`;
      appendInline(h, block.text);
      el.appendChild(h);
      continue;
    }
    if (block.type === "hr") {
      el.appendChild(document.createElement("hr")).className = "md-hr";
      continue;
    }
    if (block.type === "quote") {
      const q = document.createElement("blockquote");
      q.className = "md-quote";
      appendInline(q, block.text.replace(/\n/g, " "));
      el.appendChild(q);
      continue;
    }
    if (block.type === "list") {
      const list = document.createElement(block.ordered ? "ol" : "ul");
      list.className = "md-list";
      if (block.ordered && block.start > 1) list.start = block.start;
      for (const item of block.items) {
        const li = document.createElement("li");
        appendInline(li, item);
        list.appendChild(li);
      }
      el.appendChild(list);
      continue;
    }
    el.appendChild(renderTextBlock(block.text, "md-text"));
  }
  return el;
}
