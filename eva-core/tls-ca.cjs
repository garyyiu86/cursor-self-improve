/**
 * Merge OS trust store into Node's TLS roots.
 * Needed when SSL inspection breaks Cursor API (UNABLE_TO_VERIFY_LEAF_SIGNATURE).
 * Electron often ignores NODE_OPTIONS=--use-system-ca, so do it in-process.
 */
function installSystemCa() {
  if (global.__evaSystemCaInstalled) return global.__evaSystemCaInstalled;
  const result = { ok: false, system: 0, error: "" };
  try {
    const tls = require("node:tls");
    if (
      typeof tls.getCACertificates !== "function" ||
      typeof tls.setDefaultCACertificates !== "function"
    ) {
      result.error = "tls.getCACertificates unavailable";
      global.__evaSystemCaInstalled = result;
      return result;
    }
    const bundled = tls.getCACertificates("default") || [];
    const system = tls.getCACertificates("system") || [];
    tls.setDefaultCACertificates([...bundled, ...system]);
    result.ok = true;
    result.system = system.length;
    if (!process.env.EVA_TLS_CA_QUIET) {
      console.log(`[Eva] TLS system CA merged (${system.length} certs)`);
    }
  } catch (err) {
    result.error = String(err?.message || err);
    console.warn("[Eva] TLS system CA merge failed:", result.error);
  }
  global.__evaSystemCaInstalled = result;
  return result;
}

module.exports = { installSystemCa };
