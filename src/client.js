const path = require("path");
const { Impit } = require("impit");
const {
  BASE_URL,
  REQUEST_TIMEOUT_MS,
  BROWSER_HEADERS,
  TOKEN_REFRESH_MARGIN_SECONDS,
  DEFAULT_TOKEN_FILE,
} = require("./constants");
const auth = require("./auth");
const { FomoApiError, FomoAuthError, FomoError } = require("./errors");
const { TokensResource } = require("./resources/tokens");
const { FeedResource } = require("./resources/feed");
const { TradesResource } = require("./resources/trades");
const { UsersResource } = require("./resources/users");
const { LeaderboardResource } = require("./resources/leaderboard");

/**
 * @typedef {Object} FomoClientOptions
 * @property {string} [accessToken] Privy access token. Raw JWT, `Bearer <jwt>`, or a full Authorization header.
 * @property {string} [refreshToken] Privy refresh token. Enables automatic refresh when the access token expires.
 * @property {string} [tokenFile] JSON file holding `{ access_token, refresh_token }`. Read on first request,
 *   rewritten after every refresh so the rotated refresh token is never lost.
 * @property {(tokens: import("./auth").TokenPair) => void} [onTokenRefresh] Called after every successful refresh.
 * @property {string} [baseUrl]
 * @property {number} [timeoutMs]
 * @property {{ fetch: Function }} [http] Custom transport with a fetch-compatible `fetch(url, init)`. Defaults to impit.
 */

/**
 * Serialize query params the way the web app does (arrays repeat as `key[]=value`).
 * @param {Object|undefined} params
 * @returns {string}
 */
function buildQueryString(params) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => search.append(`${key}[]`, item));
    } else {
      search.append(key, value);
    }
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

class FomoClient {
  /**
   * @param {FomoClientOptions} [options]
   */
  constructor(options = {}) {
    const {
      accessToken = options.token,
      refreshToken,
      tokenFile,
      onTokenRefresh,
      baseUrl = BASE_URL,
      timeoutMs = REQUEST_TIMEOUT_MS,
      http,
    } = options;

    this.accessToken = auth.normalizeAccessToken(accessToken);
    this.refreshToken = refreshToken || undefined;
    this.tokenFile = tokenFile ? path.resolve(tokenFile) : undefined;
    this.onTokenRefresh = onTokenRefresh;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeoutMs = timeoutMs;
    this.http = http || new Impit({ browser: "chrome", timeout: timeoutMs });

    this._tokenFileLoaded = !this.tokenFile;
    this._refreshing = null;

    this.tokens = new TokensResource(this);
    this.feed = new FeedResource(this);
    this.trades = new TradesResource(this);
    this.users = new UsersResource(this);
    this.leaderboard = new LeaderboardResource(this);
  }

  /**
   * Build a client from environment variables:
   * `FOMO_ACCESS_TOKEN`, `FOMO_REFRESH_TOKEN`, `FOMO_TOKEN_FILE`, `FOMO_BASE_URL`.
   * @param {NodeJS.ProcessEnv} [env=process.env]
   * @param {FomoClientOptions} [overrides]
   * @returns {FomoClient}
   */
  static fromEnv(env = process.env, overrides = {}) {
    // FOMO_USE_TOKEN_FILE=true is the pre-0.2 way of opting into the default token file.
    const tokenFile = env.FOMO_TOKEN_FILE || (env.FOMO_USE_TOKEN_FILE === "true" ? DEFAULT_TOKEN_FILE : undefined);

    return new FomoClient({
      accessToken: env.FOMO_ACCESS_TOKEN,
      refreshToken: env.FOMO_REFRESH_TOKEN,
      tokenFile,
      baseUrl: env.FOMO_BASE_URL || undefined,
      ...overrides,
    });
  }

  /**
   * Replace the access token used for requests.
   * @param {string} token
   */
  setToken(token) {
    this.accessToken = auth.normalizeAccessToken(token);
  }

  /**
   * Current token state, without making a request.
   * @returns {{ authenticated: boolean, canRefresh: boolean, expiresAt: number|null,
   *   expiresInSeconds: number|null, expired: boolean|null }}
   */
  getAuthInfo() {
    const expiresAt = this.accessToken ? auth.getExpiration(this.accessToken) : null;
    const expiresInSeconds = expiresAt === null ? null : expiresAt - Math.floor(Date.now() / 1000);

    return {
      authenticated: Boolean(this.accessToken),
      canRefresh: Boolean(this.refreshToken),
      expiresAt,
      expiresInSeconds,
      expired: expiresInSeconds === null ? null : expiresInSeconds <= 0,
    };
  }

  /**
   * Make sure the client holds a usable access token, loading the token file and refreshing as needed.
   * Called automatically before every request.
   * @returns {Promise<string|undefined>} the access token, or undefined when running unauthenticated
   */
  async ensureToken() {
    if (!this._tokenFileLoaded) {
      await this._loadTokenFile();
    }

    if (this.refreshToken && (!this.accessToken || auth.isExpired(this.accessToken, TOKEN_REFRESH_MARGIN_SECONDS))) {
      await this.refresh();
    }

    if (this.accessToken && auth.isExpired(this.accessToken)) {
      throw new FomoAuthError(
        "Access token is expired and no refresh token is configured. Set a new FOMO_ACCESS_TOKEN or add FOMO_REFRESH_TOKEN."
      );
    }

    return this.accessToken;
  }

  /**
   * Force a token refresh. Concurrent callers share one refresh request.
   * @returns {Promise<import("./auth").TokenPair>}
   */
  refresh() {
    if (!this.refreshToken) {
      return Promise.reject(new FomoAuthError("No refresh token configured"));
    }

    this._refreshing ||= (async () => {
      try {
        const tokens = await auth.refreshTokens(this.refreshToken);
        this.accessToken = tokens.access_token;
        this.refreshToken = tokens.refresh_token;

        if (this.tokenFile) {
          await auth.saveTokens(tokens, this.tokenFile);
        }

        this.onTokenRefresh?.(tokens);
        return tokens;
      } finally {
        this._refreshing = null;
      }
    })();

    return this._refreshing;
  }

  /**
   * Perform a raw API request. Resource methods are built on this; use it for endpoints the wrapper doesn't cover.
   * @param {string} path e.g. "/v2/users/current/followingIds"
   * @param {{ method?: string, params?: Object, body?: unknown, headers?: Object }} [options]
   * @returns {Promise<any>} parsed JSON body
   */
  async request(path, options = {}) {
    await this.ensureToken();

    try {
      return await this._send(path, options);
    } catch (error) {
      // A token can be revoked before its exp; retry once with a fresh one.
      if (error instanceof FomoApiError && error.status === 401 && this.refreshToken) {
        await this.refresh();
        return this._send(path, options);
      }
      throw error;
    }
  }

  /** Check that the API is reachable. */
  status() {
    return this.request("/prod");
  }

  /**
   * POST a signed transaction payload to the API root, as the Fomo app does when trading.
   * This can move funds. Only send payloads you built and understand.
   * @param {Object} payload
   */
  sendTransaction(payload) {
    if (!payload || typeof payload !== "object") {
      throw new TypeError("payload must be an object");
    }
    return this.request("/", { method: "POST", body: payload });
  }

  async _send(path, { method = "GET", params, body, headers = {} }) {
    const requestHeaders = { ...BROWSER_HEADERS, ...headers };

    if (this.accessToken) {
      requestHeaders.authorization = `Bearer ${this.accessToken}`;
    }

    const url = `${this.baseUrl}${path}${buildQueryString(params)}`;
    let response;

    try {
      response = await this.http.fetch(url, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new FomoError(`${method} ${path} failed: ${error.message || "network error"}`, { cause: error });
    }

    const text = await response.text();
    let data;

    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }

    if (!response.ok) {
      throw new FomoApiError({ status: response.status, method, path, body: data });
    }

    return data;
  }

  async _loadTokenFile() {
    this._tokenFileLoaded = true;

    let tokens;
    try {
      tokens = await auth.loadTokens(this.tokenFile);
    } catch (error) {
      // A missing file is fine when other credentials seed it; it's written on the first refresh.
      if (error.cause?.code === "ENOENT" && (this.accessToken || this.refreshToken)) {
        return;
      }
      throw error;
    }

    // The file holds the newest pair (refresh tokens rotate), so it wins over constructor/env values.
    this.accessToken = auth.normalizeAccessToken(tokens.access_token) || this.accessToken;
    this.refreshToken = tokens.refresh_token || this.refreshToken;
  }
}

module.exports = { FomoClient, buildQueryString };
