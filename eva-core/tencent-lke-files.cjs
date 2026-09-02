const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const COS = require("cos-nodejs-sdk-v5");
const { getDataDir } = require("./env.cjs");

try {
  require("node:dns").setDefaultResultOrder("ipv4first");
} catch (_) {}

const MAX_FILE_BYTES = Number(process.env.EVA_CHAT_FILE_MAX_BYTES || 8 * 1024 * 1024);
const MAX_FILES = 3;
const DEFAULT_TEXT_CHARS = 32000;

const TEXT_EXTS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "html",
  "htm",
  "xml",
  "log",
  "yml",
  "yaml",
  "ini",
  "toml",
  "sql",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "css",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "c",
  "h",
  "cpp",
  "hpp",
  "cs",
  "sh",
  "ps1",
  "bat",
]);

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff"]);

const DOC_PARSE_EXTS = new Set(["txt", "doc", "docx", "pdf", "ppt", "pptx"]);

function tencentUploadConfigured() {
  return Boolean(
    String(process.env.TENCENT_SECRET_ID || "").trim() &&
      String(process.env.TENCENT_SECRET_KEY || "").trim(),
  );
}

function uploadHint() {
  return "PDF／圖片／Office 需要喺 .env 填 TENCENT_SECRET_ID、TENCENT_SECRET_KEY、TENCENT_LKE_BOT_BIZ_ID 之後重啟 Eva。純文字檔（txt／md／csv／json）而家已經可以揀。";
}

function extOf(name) {
  const m = String(name || "")
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function looksLikeText(buf, mime, ext) {
  if (TEXT_EXTS.has(ext) || String(mime || "").toLowerCase().startsWith("text/")) {
    return true;
  }
  if (IMAGE_EXTS.has(ext) || ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext)) {
    return false;
  }
  const sample = buf.subarray(0, 4096);
  if (!sample.length || sample.includes(0)) return false;
  const s = sample.toString("utf8");
  let bad = 0;
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code === 0xfffd || (code < 9 && code !== 0) || (code > 13 && code < 32)) bad += 1;
  }
  return bad / Math.max(s.length, 1) < 0.05;
}

function clipText(text, maxChars) {
  const raw = String(text || "");
  const max = Number(maxChars);
  const limit = Number.isFinite(max) && max > 200 ? max : DEFAULT_TEXT_CHARS;
  if (raw.length <= limit) return raw;
  return `${raw.slice(0, limit)}\n\n[檔案過長，已截斷至 ${limit} 字。]`;
}

function decodeUtf8(buf) {
  let s = buf.toString("utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s;
}

function normalizeAttachments(raw) {
  if (!Array.isArray(raw) || !raw.length) return [];
  const out = [];
  for (const item of raw.slice(0, MAX_FILES)) {
    const name = String(item?.name || "file")
      .replace(/[/\\]/g, "_")
      .slice(0, 180)
      .trim() || "file";
    const mime = String(item?.mime || "application/octet-stream");
    const data = String(item?.data || "").replace(/\s/g, "");
    if (!data) continue;
    let buffer;
    try {
      buffer = Buffer.from(data, "base64");
    } catch {
      throw new Error(`附件「${name}」格式無效`);
    }
    if (!buffer.length) continue;
    const maxBytes =
      Number.isFinite(MAX_FILE_BYTES) && MAX_FILE_BYTES > 0
        ? MAX_FILE_BYTES
        : 8 * 1024 * 1024;
    if (buffer.length > maxBytes) {
      throw new Error(
        `檔案太大（上限 ${Math.round(maxBytes / 1024 / 1024)}MB）：${name}`,
      );
    }
    out.push({ name, mime, size: buffer.length, buffer });
  }
  return out;
}

function extractTextPrefix(attachments, { maxChars } = {}) {
  const files = Array.isArray(attachments) ? attachments : [];
  const parts = [];
  const leftover = [];
  for (const att of files) {
    const ext = extOf(att.name);
    if (!looksLikeText(att.buffer, att.mime, ext)) {
      leftover.push(att);
      continue;
    }
    parts.push(
      `----- 附件 ${att.name} -----\n${clipText(decodeUtf8(att.buffer), maxChars)}`,
    );
  }
  return { textPrefix: parts.join("\n\n"), leftover };
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function hmacSha256(key, s) {
  return crypto.createHmac("sha256", key).update(s).digest();
}

const LKE_REGION_FALLBACKS = [
  "ap-jakarta",
  "ap-singapore",
  "ap-hongkong",
  "ap-guangzhou",
  "ap-shanghai",
  "ap-beijing",
  "ap-nanjing",
  "ap-chengdu",
];

/** @type {{ region: string, host: string } | null} */
let cachedLkeEndpoint = null;

function endpointCacheFile() {
  return path.join(getDataDir(), "lke-api-endpoint.json");
}

function loadCachedEndpoint() {
  if (cachedLkeEndpoint) return cachedLkeEndpoint;
  try {
    const raw = JSON.parse(fs.readFileSync(endpointCacheFile(), "utf8"));
    if (raw?.region && raw?.host) cachedLkeEndpoint = { region: raw.region, host: raw.host };
  } catch (_) {}
  return cachedLkeEndpoint;
}

function saveCachedEndpoint(ep) {
  cachedLkeEndpoint = ep;
  try {
    fs.mkdirSync(getDataDir(), { recursive: true });
    fs.writeFileSync(endpointCacheFile(), JSON.stringify(ep), "utf8");
  } catch (_) {}
}

function uniqueNonEmpty(items) {
  const out = [];
  const seen = new Set();
  for (const raw of items) {
    const v = String(raw || "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function hostsForRegion(region) {
  const hosts = ["lke.tencentcloudapi.com", `lke.${region}.tencentcloudapi.com`];
  if (region === "ap-jakarta" || region === "ap-singapore" || region === "ap-hongkong") {
    hosts.push("lke.intl.tencentcloudapi.com");
  }
  return uniqueNonEmpty(hosts);
}

function networkDetail(err) {
  const cause = err?.cause;
  const parts = [
    err?.code,
    err?.message,
    cause?.code,
    cause?.syscall,
    cause?.hostname,
    cause?.message,
  ].filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const part of parts) {
    const s = String(part);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.join(" | ") || String(err);
}

function isUnsupportedRegion(err) {
  return /不支持此地域|UnsupportedRegion/i.test(String(err?.message || err || ""));
}

function isRetryableNetwork(err) {
  const blob = `${err?.code || ""} ${err?.message || ""} ${err?.cause?.code || ""} ${err?.cause?.message || ""}`;
  return /fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|socket|cert|UNABLE_TO|aborted|timeout|ConnectTimeout|other side closed|network/i.test(
    blob,
  );
}

function isRetryableApi(err) {
  const blob = `${err?.apiCode || ""} ${err?.message || ""} ${err?.httpStatus || ""}`;
  return /内部服务|稍后重试|InternalError|InternalService|ServiceUnavailable|RequestLimitExceeded|LimitExceeded|ResourceUnavailable|FailedOperation|TryAgain|too many requests|429|502|503|504/i.test(
    blob,
  );
}

function isRetryableLke(err) {
  return isUnsupportedRegion(err) || isRetryableNetwork(err) || isRetryableApi(err);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rawUrlParts(url) {
  const raw = String(url || "").trim();
  const noHash = raw.split("#")[0];
  const m = noHash.match(/^(https?):\/\/([^/]+)(\/[^?]*)?(\?.*)?$/i);
  if (!m) {
    const u = new URL(url);
    return {
      protocol: u.protocol.replace(":", ""),
      host: u.host,
      hostname: u.hostname,
      port: u.port,
      pathname: u.pathname || "/",
      search: u.search || "",
      path: `${u.pathname || "/"}${u.search || ""}`,
    };
  }
  const host = m[2];
  const hostname = host.split(":")[0];
  const port = host.includes(":") ? host.slice(host.indexOf(":") + 1) : "";
  const pathname = m[3] || "/";
  const search = m[4] || "";
  return {
    protocol: m[1].toLowerCase(),
    host,
    hostname,
    port,
    pathname,
    search,
    path: `${pathname}${search}`,
  };
}

function httpsRequest({ url, method, headers, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let parts;
    try {
      parts = rawUrlParts(url);
    } catch (err) {
      reject(err);
      return;
    }
    const payload =
      body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    const hdrs = { ...(headers || {}) };
    if (payload && hdrs["Content-Length"] == null && hdrs["content-length"] == null) {
      hdrs["Content-Length"] = payload.length;
    }
    const req = https.request(
      {
        protocol: `${parts.protocol}:`,
        hostname: parts.hostname,
        port: parts.port || 443,
        path: parts.path || "/",
        method: method || "GET",
        headers: hdrs,
        family: 4,
        timeout: timeoutMs || 20000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }));
    });
    if (payload) req.end(payload);
    else req.end();
  });
}

function tc3Headers({ secretId, secretKey, action, payload, region, host }) {
  const service = "lke";
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const contentType = "application/json; charset=utf-8";
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256Hex(payload),
  ].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = crypto
    .createHmac("sha256", secretSigning)
    .update(stringToSign)
    .digest("hex");
  const headers = {
    Authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "Content-Type": contentType,
    Host: host,
    "X-TC-Action": action,
    "X-TC-Version": "2023-11-30",
    "X-TC-Timestamp": String(timestamp),
    "X-TC-Language": "zh-CN",
  };
  if (region) headers["X-TC-Region"] = region;
  return headers;
}

async function callLkeApiOnce({ secretId, secretKey, action, payload, region, host }) {
  const headers = tc3Headers({
    secretId,
    secretKey,
    action,
    payload,
    region,
    host,
  });
  let res;
  try {
    res = await httpsRequest({
      url: `https://${host}/`,
      method: "POST",
      headers,
      body: payload,
      timeoutMs: 20000,
    });
  } catch (err) {
    throw Object.assign(new Error(`${action} 網絡錯誤：${networkDetail(err)}`), {
      cause: err,
      code: err?.code || err?.cause?.code,
    });
  }
  let json = null;
  try {
    json = JSON.parse(res.body.toString("utf8"));
  } catch (_) {}
  const apiErr = json?.Response?.Error;
  if (res.status >= 400 || apiErr) {
    throw Object.assign(
      new Error(`${action} 失敗：${apiErr?.Message || apiErr?.Code || res.status}`),
      { apiCode: apiErr?.Code || "", httpStatus: res.status },
    );
  }
  if (!json?.Response) {
    throw new Error(`${action} 失敗：空回應`);
  }
  return json.Response;
}

async function callLkeApiOnceWithRetry(opts) {
  const attempts = 3;
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await callLkeApiOnce(opts);
    } catch (err) {
      lastErr = err;
      if (!isRetryableNetwork(err) && !isRetryableApi(err)) throw err;
      if (i >= attempts - 1) break;
      const wait = 500 * 3 ** i;
      console.warn(
        `[Eva] LKE ${opts.action} retry ${i + 1}/${attempts - 1} ${opts.host} (${opts.region}) wait=${wait}ms ${String(err.message).slice(0, 100)}`,
      );
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function callLkeApi(action, body = {}) {
  const secretId = String(process.env.TENCENT_SECRET_ID || "").trim();
  const secretKey = String(process.env.TENCENT_SECRET_KEY || "").trim();
  if (!secretId || !secretKey) {
    throw new Error("TENCENT_SECRET_ID / TENCENT_SECRET_KEY missing");
  }
  const payload = JSON.stringify(body || {});
  const preferred = String(process.env.TENCENT_LKE_REGION || "").trim();
  loadCachedEndpoint();
  const regions = uniqueNonEmpty([
    cachedLkeEndpoint?.region,
    "ap-jakarta",
    preferred,
    ...LKE_REGION_FALLBACKS,
  ]);
  let lastErr = null;
  for (const region of regions) {
    const hosts = uniqueNonEmpty([
      cachedLkeEndpoint?.region === region ? cachedLkeEndpoint.host : "",
      ...hostsForRegion(region),
    ]);
    for (const host of hosts) {
      try {
        const response = await callLkeApiOnceWithRetry({
          secretId,
          secretKey,
          action,
          payload,
          region,
          host,
        });
        if (
          !cachedLkeEndpoint ||
          cachedLkeEndpoint.region !== region ||
          cachedLkeEndpoint.host !== host
        ) {
          saveCachedEndpoint({ region, host });
          console.log(`[Eva] LKE API endpoint region=${region} host=${host}`);
        }
        return response;
      } catch (err) {
        lastErr = err;
        if (!isRetryableLke(err)) throw err;
        const usingCache =
          cachedLkeEndpoint &&
          cachedLkeEndpoint.region === region &&
          cachedLkeEndpoint.host === host;
        if (usingCache && isRetryableApi(err)) {
          cachedLkeEndpoint = null;
          try {
            fs.unlinkSync(endpointCacheFile());
          } catch (_) {}
        }
        console.warn(
          `[Eva] LKE ${action} skip ${host} (${region}): ${networkDetail(err).slice(0, 180)}`,
        );
      }
    }
  }
  throw lastErr || new Error(`${action} 失敗：該接口不支援此地域`);
}

async function describeStorageCredential({ fileType, isPublic }) {
  const botBizId = String(process.env.TENCENT_LKE_BOT_BIZ_ID || "").trim();
  const body = {
    FileType: fileType,
    IsPublic: Boolean(isPublic),
    TypeKey: "realtime",
  };
  if (botBizId) body.BotBizId = botBizId;
  return await callLkeApi("DescribeStorageCredential", body);
}

function credsFrom(response) {
  let c = response?.Credentials || response?.credentials || {};
  if (typeof c === "string") {
    try {
      c = JSON.parse(c);
    } catch {
      c = {};
    }
  }
  if (c && typeof c === "object" && (c.credentials || c.Credentials)) {
    c = { ...c, ...(c.credentials || c.Credentials) };
  }
  return {
    secretId: String(c.TmpSecretId || c.tmpSecretId || c.TmpSecretID || "").trim(),
    secretKey: String(c.TmpSecretKey || c.tmpSecretKey || "").trim(),
    token: String(
      c.Token || c.token || c.SessionToken || c.sessionToken || c.SecurityToken || "",
    ).trim(),
  };
}

function objectKeyFrom(info) {
  const uploadPath = String(info?.UploadPath || "").trim();
  if (uploadPath) return uploadPath.replace(/^\/+/, "");
  if (!info?.UploadUrl) return "";
  try {
    const decoded = decodeURIComponent(new URL(info.UploadUrl).pathname || "");
    return decoded.replace(/^\/+/, "");
  } catch {
    return "";
  }
}

function concatCosUrl(info) {
  const bucket = String(info?.Bucket || "").trim();
  const type = String(info?.Type || "cos").trim();
  const region = String(info?.Region || "").trim();
  const uploadPath = String(info?.UploadPath || "").trim();
  if (!bucket || !region || !uploadPath) return "";
  const pathPart = uploadPath.startsWith("/") ? uploadPath : `/${uploadPath}`;
  return `https://${bucket}.${type}.${region}.myqcloud.com${pathPart}`;
}

function chatAssetUrl(info) {
  const official = concatCosUrl(info);
  if (official) return official;
  const direct = String(info?.FileUrl || "").trim();
  if (direct.startsWith("http")) return direct.split("?")[0];
  return publicFileUrl(info);
}

function publicFileUrl(info) {
  const direct = String(info?.FileUrl || "").trim();
  if (direct.startsWith("http")) {
    try {
      const u = new URL(direct);
      u.search = "";
      return u.toString();
    } catch {
      return direct.split("?")[0];
    }
  }
  const bucket = String(info?.Bucket || "").trim();
  const type = String(info?.Type || "cos").trim();
  const region = String(info?.Region || "ap-guangzhou").trim();
  const uploadUrl = String(info?.UploadUrl || "").trim();
  if (uploadUrl.startsWith("http")) {
    try {
      const u = new URL(uploadUrl);
      u.search = "";
      return u.toString();
    } catch {
      /* fall through */
    }
  }
  const key = objectKeyFrom(info);
  if (!bucket || !key) return "";
  return `https://${bucket}.${type}.${region}.myqcloud.com/${key}`;
}

function toUnixSec(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
}

function stsTimes(info) {
  const start = toUnixSec(
    info?.StartTime ?? info?.startTime ?? info?.Credentials?.StartTime,
  );
  const exp = toUnixSec(
    info?.ExpiredTime ?? info?.expiredTime ?? info?.Credentials?.ExpiredTime,
  );
  return { start, exp };
}

function formatCosErr(err, extra) {
  const msg =
    err?.error?.Message ||
    err?.error?.Code ||
    err?.message ||
    String(err);
  const status = err?.statusCode || err?.status || "";
  const detail = extra ? ` ${extra}` : "";
  return new Error(
    `COS 上傳失敗 ${status}: ${String(msg).slice(0, 240)}${detail}`.trim(),
  );
}

function xmlCode(body) {
  const m = String(body || "").match(/<Code>([^<]+)<\/Code>/i);
  return m ? m[1] : "";
}

function cosResult(info, headers) {
  const hdrs = headers || {};
  return {
    etag: String(hdrs.etag || hdrs.ETag || "").trim(),
    crc64: String(
      hdrs["x-cos-hash-crc64ecma"] || hdrs["X-Cos-Hash-Crc64ecma"] || "",
    ).trim(),
    fileUrl: chatAssetUrl(info),
    uploadPath: String(info?.UploadPath || "").trim(),
    bucket: String(info?.Bucket || "").trim(),
  };
}

function sdkPutObject(info, buffer, mime, { useRawKey, key, creds, start, exp, domain }) {
  const bucket = String(info.Bucket || "").trim();
  const region = String(info.Region || "ap-guangzhou").trim();
  const cos = new COS({
    UseRawKey: Boolean(useRawKey),
    Protocol: "https:",
    Timeout: 60000,
    Domain: domain || undefined,
    getAuthorization: (_opt, cb) => {
      cb({
        TmpSecretId: creds.secretId,
        TmpSecretKey: creds.secretKey,
        SecurityToken: creds.token,
        StartTime: start,
        ExpiredTime: exp,
      });
    },
  });
  return new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: bucket,
        Region: region,
        Key: key,
        Body: buffer,
        ContentType: mime || "application/octet-stream",
      },
      (err, data) => (err ? reject(err) : resolve(data)),
    );
  });
}

async function putExactUploadUrl(info, buffer, mime, creds, start, exp) {
  const uploadUrl = String(info?.UploadUrl || "").trim();
  if (!uploadUrl.startsWith("http")) return null;
  const parts = rawUrlParts(uploadUrl);
  const contentType = mime || "application/octet-stream";
  const preSigned = /q-sign-algorithm=|q-ak=/i.test(parts.search);
  console.log(
    `[Eva] COS PUT host=${parts.host} path=${parts.pathname.slice(0, 80)} presign=${preSigned} ak=${creds.secretId.slice(0, 4)}… start=${start} exp=${exp}`,
  );

  if (preSigned) {
    const res = await httpsRequest({
      url: uploadUrl,
      method: "PUT",
      headers: {
        Host: parts.host,
        "Content-Type": contentType,
        "Content-Length": buffer.length,
      },
      body: buffer,
      timeoutMs: 60000,
    });
    if (res.status >= 200 && res.status < 300) return cosResult(info, res.headers);
    throw new Error(
      `COS 上傳失敗 ${res.status}: ${xmlCode(res.body) || res.body.toString("utf8").slice(0, 180)}`,
    );
  }

  const signVariants = [
    {
      Host: parts.host,
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
    },
    {
      Host: parts.host,
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
      "x-cos-security-token": creds.token,
    },
    { Host: parts.host, "Content-Type": contentType },
  ];
  let lastErr = null;
  for (const signHeaders of signVariants) {
    const authorization = COS.getAuthorization({
      SecretId: creds.secretId,
      SecretKey: creds.secretKey,
      Method: "put",
      Pathname: parts.pathname,
      Headers: signHeaders,
      KeyTime: `${start};${exp}`,
      UseRawKey: true,
      ForceSignHost: true,
    });
    const reqHeaders = {
      Authorization: authorization,
      Host: parts.host,
      "Content-Type": contentType,
      "Content-Length": buffer.length,
      "x-cos-security-token": creds.token,
    };
    try {
      const res = await httpsRequest({
        url: uploadUrl,
        method: "PUT",
        headers: reqHeaders,
        body: buffer,
        timeoutMs: 60000,
      });
      if (res.status >= 200 && res.status < 300) return cosResult(info, res.headers);
      const code = xmlCode(res.body);
      lastErr = new Error(
        `COS 上傳失敗 ${res.status}: ${code || res.body.toString("utf8").slice(0, 180)}`,
      );
      console.warn(
        `[Eva] COS PUT ${res.status} ${code || ""} signed=${Object.keys(signHeaders).join(",")}`,
      );
    } catch (err) {
      lastErr = Object.assign(
        new Error(`COS 上傳網絡錯誤：${networkDetail(err)}`),
        { cause: err },
      );
    }
  }
  throw lastErr || new Error("COS 上傳失敗");
}

async function putCosObject(info, buffer, mime) {
  const creds = credsFrom(info);
  const bucket = String(info?.Bucket || "").trim();
  const uploadPath = String(info?.UploadPath || "").trim();
  const { start, exp } = stsTimes(info);
  if (!creds.secretId || !creds.secretKey) {
    throw new Error(
      `ADP 未返回 COS 臨時密鑰 (credKeys=${Object.keys(info?.Credentials || {}).join(",")})`,
    );
  }
  if (!creds.token) {
    throw new Error("ADP 未返回 COS Token");
  }
  if (!bucket || !uploadPath) {
    throw new Error(
      `ADP 未返回 Bucket/UploadPath (keys=${Object.keys(info || {}).join(",")})`,
    );
  }
  if (!start || !exp) {
    throw new Error(
      `ADP 未返回 StartTime/ExpiredTime (keys=${Object.keys(info || {}).join(",")})`,
    );
  }

  let urlErr = null;
  try {
    const fromUrl = await putExactUploadUrl(info, buffer, mime, creds, start, exp);
    if (fromUrl) return fromUrl;
  } catch (err) {
    urlErr = err;
    console.warn(`[Eva] COS UploadUrl PUT failed: ${String(err?.message || err).slice(0, 180)}`);
  }

  const keyRaw = uploadPath.startsWith("/") ? uploadPath : `/${uploadPath}`;
  let uploadHost = "";
  try {
    uploadHost = new URL(String(info.UploadUrl || "")).host;
  } catch (_) {}
  try {
    const data = await sdkPutObject(info, buffer, mime, {
      useRawKey: true,
      key: keyRaw,
      creds,
      start,
      exp,
      domain: uploadHost,
    });
    return cosResult(info, {
      ...(data?.headers || {}),
      etag: data?.ETag || data?.headers?.etag,
    });
  } catch (err) {
    throw urlErr || formatCosErr(err, `ak=${creds.secretId.slice(0, 4)}…`);
  }
}

function parseSseJsonBlocks(raw) {
  const blocks = String(raw || "").split(/\n\n+/);
  const out = [];
  for (const block of blocks) {
    const dataLines = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    const dataStr = dataLines.join("\n").trim();
    if (!dataStr || dataStr === "[DONE]") continue;
    try {
      out.push(JSON.parse(dataStr));
    } catch {
      try {
        out.push(JSON.parse(block.trim()));
      } catch {
        /* ignore */
      }
    }
  }
  return out;
}

async function docParse({ cfg, conversationId, fileName, fileType, size, cos }) {
  const url =
    String(process.env.TENCENT_LKE_DOC_PARSE_URL || "").trim() ||
    `${cfg.baseUrl}/v1/qbot/chat/docParse`;
  const body = {
    session_id: conversationId,
    bot_app_key: cfg.appKey,
    request_id: crypto.randomUUID(),
    cos_bucket: cos.bucket,
    file_type: fileType,
    file_name: fileName,
    cos_url: cos.uploadPath,
    cos_hash: cos.crc64,
    e_tag: cos.etag,
    size: String(size),
  };
  let res;
  try {
    res = await httpsRequest({
      url,
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      timeoutMs: cfg.timeoutMs || 120000,
    });
  } catch (err) {
    throw new Error(`docParse 網絡錯誤：${networkDetail(err)}`.slice(0, 360));
  }
  const raw = res.body.toString("utf8");
  if (res.status >= 400) {
    throw new Error(`docParse 失敗 ${res.status}: ${raw.slice(0, 300)}`);
  }
  let docId = "";
  let lastError = "";
  for (const parsed of parseSseJsonBlocks(raw)) {
    const payload = parsed?.payload || parsed;
    const status = String(payload?.status || parsed?.type || "").toUpperCase();
    if (payload?.doc_id && payload.doc_id !== "0") docId = String(payload.doc_id);
    if (status === "FAILED" || parsed?.type === "error") {
      lastError = String(payload?.error_message || payload?.Message || "docParse failed");
    }
  }
  if (!docId && lastError) throw new Error(`docParse 失敗：${lastError}`);
  if (!docId) throw new Error("docParse 未返回 doc_id");
  return docId;
}

async function prepareTencentAttachments({
  attachments,
  conversationId,
  cfg,
  onProgress,
} = {}) {
  const files = Array.isArray(attachments) ? attachments : [];
  const extraContents = [];
  const { textPrefix, leftover } = extractTextPrefix(files, {
    maxChars: Number(process.env.TENCENT_LKE_FILE_MAX_CHARS || DEFAULT_TEXT_CHARS),
  });
  if (!leftover.length) {
    return { extraContents, textPrefix };
  }
  if (!tencentUploadConfigured()) {
    const names = leftover.map((f) => f.name).join("、");
    throw new Error(`附件「${names}」要先上傳 COS。${uploadHint()}`);
  }

  for (const att of leftover) {
    const ext = extOf(att.name) || "bin";
    const isImage = IMAGE_EXTS.has(ext) || String(att.mime || "").startsWith("image/");
    if (!isImage && !DOC_PARSE_EXTS.has(ext)) {
      throw new Error(
        `未支援嘅檔案類型「.${ext}」。可用 txt／md／csv／json／pdf／docx／pptx／圖片。`,
      );
    }
    try {
      onProgress?.({
        stage: "think",
        message: isImage ? `正在上傳圖片 ${att.name}…` : `正在上傳文件 ${att.name}…`,
      });
    } catch (_) {}

    const info = await describeStorageCredential({
      fileType: ext,
      isPublic: isImage,
    });
    const mime =
      att.mime && att.mime !== "application/octet-stream"
        ? att.mime
        : isImage
          ? `image/${ext === "jpg" ? "jpeg" : ext}`
          : "application/octet-stream";
    const cos = await putCosObject(info, att.buffer, mime);

    if (isImage) {
      let imageUrl = concatCosUrl(info) || cos.fileUrl;
      let headStatus = 0;
      try {
        const head = await httpsRequest({ url: imageUrl, method: "HEAD", timeoutMs: 4000 });
        headStatus = head.status;
      } catch (err) {
        console.warn(`[Eva] image HEAD ${networkDetail(err).slice(0, 120)}`);
      }
      if (!(headStatus >= 200 && headStatus < 400)) {
        const signed = String(info?.FileUrl || "").trim();
        if (signed.startsWith("http")) imageUrl = signed;
      }
      extraContents.push({ Type: "image", Image: { Url: imageUrl } });
      console.log(
        `[Eva] image chat head=${headStatus} url=${imageUrl.split("?")[0].slice(0, 140)}`,
      );
      continue;
    }

    try {
      onProgress?.({ stage: "think", message: `正在解析 ${att.name}…` });
    } catch (_) {}
    const docId = await docParse({
      cfg,
      conversationId,
      fileName: att.name,
      fileType: ext,
      size: att.size,
      cos,
    });
    extraContents.push({
      Type: "file",
      File: {
        FileName: att.name,
        FileSize: String(att.size),
        FileUrl: cos.fileUrl,
        FileType: ext,
        DocId: docId,
        CreateTime: Date.now(),
      },
    });
  }

  return { extraContents, textPrefix };
}

module.exports = {
  tencentUploadConfigured,
  normalizeAttachments,
  extractTextPrefix,
  prepareTencentAttachments,
  uploadHint,
  callLkeApi,
};
