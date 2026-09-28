const fs = require("fs/promises");
const { PRIVY_BASE_URL, PRIVY_SESSION_PATH, PRIVY_HEADERS } = require("./constants");
const { FomoAuthError } = require("./errors");

/**
 * @typedef {Object} TokenPair
 * @property {string} access_token
 * @property {string} refresh_token
 */

/**
 * Normalize token input from a raw JWT, `Bearer <jwt>`, or `Authorization: Bearer <jwt>`.
 * @param {string|undefined|null} value
 * @returns {string|undefined}
 */
function normalizeAccessToken(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const token = value
    .trim()
    .replace(/^authorization\s*:\s*/i, "")
    .replace(/^bearer\s+/i, "")
    .trim();

  return token || undefined;
}

/**
 * Decode a JWT payload without verifying its signature.
 * @param {string} token
 * @returns {Object|null}
 */
function decodeJwt(token) {
  const payload = normalizeAccessToken(token)?.split(".")[1];

  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Read the `exp` claim (unix seconds) from an access token.
 * @param {string} accessToken
 * @returns {number|null} null when the token is not a JWT or has no exp claim
 */
function getExpiration(accessToken) {
  const exp = decodeJwt(accessToken)?.exp;
  return typeof exp === "number" ? exp : null;
}

/**
 * Whether the token expires within `marginSeconds` from now. Tokens without an exp never expire.
 * @param {string} accessToken
 * @param {number} [marginSeconds=0]
 * @returns {boolean}
 */
function isExpired(accessToken, marginSeconds = 0) {
  const exp = getExpiration(accessToken);
  return exp !== null && Math.floor(Date.now() / 1000) >= exp - marginSeconds;
}

/**
 * Exchange a Privy refresh token for a new token pair.
 * Privy rotates refresh tokens: the one passed in is spent, persist the returned one.
 * Privy also requires the current access token (expired is fine) alongside the refresh token.
 * @param {string} refreshToken
 * @param {string} [accessToken]
 * @returns {Promise<TokenPair>}
 */
async function refreshTokens(refreshToken, accessToken) {
  if (!refreshToken) {
    throw new FomoAuthError("refreshToken is required");
  }

  let response;
  try {
    response = await fetch(`${PRIVY_BASE_URL}${PRIVY_SESSION_PATH}`, {
      method: "POST",
      headers: accessToken
        ? { ...PRIVY_HEADERS, Authorization: `Bearer ${normalizeAccessToken(accessToken)}` }
        : PRIVY_HEADERS,
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch (error) {
    throw new FomoAuthError(`Token refresh request failed: ${error.message}`, { cause: error });
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const hint = response.status === 401 && !accessToken ? " (Privy needs the access token too; pass it as the second argument)" : "";
    throw new FomoAuthError(`Token refresh failed with ${response.status}: ${data?.error || "unknown error"}${hint}`);
  }

  // `token` is the app access token Fomo's API accepts (aud = Privy app id). `privy_access_token`
  // is Privy's own token (aud = auth.privy.io); Fomo rejects it, so never fall back to it.
  // Privy answers "ignore" with `token: null` when the access token sent is still valid.
  const action = data?.session_update_action;

  if (action === "clear") {
    throw new FomoAuthError("Privy ended the session; sign in again and set new tokens");
  }

  const newAccessToken =
    typeof data?.token === "string" ? data.token : action === "ignore" ? normalizeAccessToken(accessToken) : undefined;

  if (!newAccessToken || !data?.refresh_token) {
    throw new FomoAuthError("Token refresh response did not include a new token pair");
  }

  return { access_token: newAccessToken, refresh_token: data.refresh_token };
}

/**
 * Load a token pair from a JSON file.
 * @param {string} tokenFile
 * @returns {Promise<TokenPair>}
 */
async function loadTokens(tokenFile) {
  let raw;
  try {
    raw = await fs.readFile(tokenFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new FomoAuthError(`Token file not found: ${tokenFile}`, { cause: error });
    }
    throw error;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new FomoAuthError(`Token file is not valid JSON: ${tokenFile}`, { cause: error });
  }
}

/**
 * Write a token pair to a JSON file.
 * @param {TokenPair} tokens
 * @param {string} tokenFile
 * @returns {Promise<void>}
 */
async function saveTokens(tokens, tokenFile) {
  await fs.writeFile(tokenFile, `${JSON.stringify(tokens, null, 2)}\n`, "utf8");
}

module.exports = {
  normalizeAccessToken,
  decodeJwt,
  getExpiration,
  isExpired,
  refreshTokens,
  loadTokens,
  saveTokens,
};
