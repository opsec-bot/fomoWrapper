/**
 * Throw a TypeError naming every argument that is missing (undefined, null, or "").
 * @param {Record<string, unknown>} args
 */
function requireArgs(args) {
  const missing = Object.entries(args)
    .filter(([, value]) => value === undefined || value === null || value === "")
    .map(([name]) => name);

  if (missing.length) {
    throw new TypeError(`Missing required argument${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
  }
}

module.exports = { requireArgs };
