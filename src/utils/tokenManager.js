const axios = require("axios");
const jwt = require("jsonwebtoken");
const fs = require("fs-extra");
const {
  DEFAULT_TOKENS_FILE,
  TOKEN_REFRESH_MARGIN_SECONDS,
  PRIVY_BASE_URL,
  PRIVY_SESSION_PATH,
  PRIVY_HEADERS,
} = require("../constants");

/**
 * Load tokens from disk
 * @param {string} tokenFile
 * @returns {Promise<{ access_token: string, refresh_token: string }>}
 */
async function loadTokens(tokenFile = DEFAULT_TOKENS_FILE) {
  if (!(await fs.pathExists(tokenFile))) {
    throw new Error(`Token file not found: ${tokenFile}`);
  }

  return fs.readJSON(tokenFile);
}

/**
 * Save tokens to disk
 * @param {{ access_token: string, refresh_token: string }} tokens
 * @param {string} tokenFile
 * @returns {Promise<void>}
 */
async function saveTokens(tokens, tokenFile = DEFAULT_TOKENS_FILE) {
  await fs.writeJSON(tokenFile, tokens, { spaces: 2 });
}

/**
 * Extract expiration from JWT
 * @param {string} accessToken
 * @returns {number}
 */
function getExpiration(accessToken) {
  const decoded = jwt.decode(accessToken);

  if (!decoded || typeof decoded.exp !== "number") {
    throw new Error("Invalid access token expiration");
  }

  return decoded.exp;
}

/**
 * Refresh Privy tokens
 * @param {string} refreshToken
 * @returns {Promise<{ access_token: string, refresh_token: string }>}
 */
async function refreshTokens(refreshToken) {
  try {
    const response = await axios.post(
      `${PRIVY_BASE_URL}${PRIVY_SESSION_PATH}`,
      { refresh_token: refreshToken },
      { headers: PRIVY_HEADERS }
    );

    if (!response.data?.privy_access_token || !response.data?.refresh_token) {
      throw new Error("Empty token refresh response");
    }

    return {
      access_token: response.data.privy_access_token,
      refresh_token: response.data.refresh_token,
    };
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.error || error.message;
    throw new Error(`API error ${status || "unknown"}: ${message}`);
  }
}

/**
 * Ensure valid access token and refresh if needed
 * @param {string} tokenFile
 * @returns {Promise<string>}
 */
async function ensureValidToken(tokenFile = DEFAULT_TOKENS_FILE) {
  const tokens = await loadTokens(tokenFile);
  const exp = getExpiration(tokens.access_token);
  const now = Math.floor(Date.now() / 1000);

  if (now > exp - TOKEN_REFRESH_MARGIN_SECONDS) {
    const newTokens = await refreshTokens(tokens.refresh_token);
    await saveTokens(newTokens, tokenFile);
    return newTokens.access_token;
  }

  return tokens.access_token;
}

module.exports = {
  loadTokens,
  saveTokens,
  getExpiration,
  refreshTokens,
  ensureValidToken,
};