const axios = require("axios");
const { BASE_URL, REQUEST_TIMEOUT_MS } = require("./constants");
const { getTrendingTokens } = require("./endpoints/trending");
const { getTrendingFriends } = require("./endpoints/trendingFriends");
const { getTokenDetails } = require("./endpoints/tokenDetails");
const { getTokenBars } = require("./endpoints/bars");
const { getTokenPrices } = require("./endpoints/tokenPrices");
const { getFilterTokens } = require("./endpoints/filterTokens");
const { getFilterTokensSearch } = require("./endpoints/filterTokensSearch");
const { getTokenWarnings } = require("./endpoints/tokenWarnings");
const { getVerifiedTokens } = require("./endpoints/verifiedTokens");
const { getFeed, getFriendsFeed } = require("./endpoints/feed");
const { getTrades, getTradeComments, getTradesTopCombined } = require("./endpoints/trades");
const {
  getUser,
  getUserActiveTrade,
  getUserActivity,
  getUserBalances,
  getUsersFollowing,
  getUsersFuzzySearch,
  getUserReferralDetails,
  getUserTokensAggregatedSnapshotById,
} = require("./endpoints/users");
const { getLeaderboard24h } = require("./endpoints/leaderboard");
const { getStatus } = require("./endpoints/status");
const { sendTransaction } = require("./endpoints/transactions");

class FomoClient {
  /**
   * Create a Fomo API client
   * @param {{ token?: string, baseUrl?: string, timeoutMs?: number }} options
   */
  constructor({ token, baseUrl = BASE_URL, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
    this.token = token;
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Set bearer token for authenticated requests
   * @param {string} token
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * Perform an API request
   * @param {string} path
   * @param {{ method?: string, params?: Object, body?: Object, headers?: Object }} options
   * @returns {Promise<Object>}
   */
  async request(path, options = {}) {
    const { method = "GET", params, body, headers = {} } = options;
    const requestHeaders = { ...headers };

    if (this.token) {
      requestHeaders.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${path}`,
        params,
        data: body,
        headers: requestHeaders,
        timeout: this.timeoutMs,
      });

      if (typeof response.data === "undefined") {
        throw new Error("Empty API response");
      }

      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const apiError = error.response?.data?.error || error.response?.data?.message;
      const message = apiError || error.message || "Request failed";
      throw new Error(`API error ${status || "unknown"}: ${message}`);
    }
  }

  /**
   * Fetch trending tokens
   * @returns {Promise<Object>}
   */
  async trending() {
    return getTrendingTokens(this);
  }

  /**
   * Fetch token details
   * @param {string} tokenId
   * @returns {Promise<Object>}
   */
  async tokenDetails(tokenId) {
    return getTokenDetails(this, tokenId);
  }

  /**
   * Fetch token bars
   * @param {{ from: number, to: number, resolution: string, symbol: string }} options
   * @returns {Promise<Object>}
   */
  async bars(options) {
    return getTokenBars(this, options);
  }

  /**
   * Fetch public feed
   * @param {{ limit?: number, feedTypes?: string[] }} options
   * @returns {Promise<Object>}
   */
  async feed(options = {}) {
    return getFeed(this, options);
  }

  /**
   * Fetch friends feed
   * @param {{ limit?: number, feedTypes?: string[] }} options
   * @returns {Promise<Object>}
   */
  async feedFriends(options = {}) {
    return getFriendsFeed(this, options);
  }

  async trendingFriends() {
    return getTrendingFriends(this);
  }

  async tokenPrices(items) {
    return getTokenPrices(this, items);
  }

  async filterTokens(tokenIds) {
    return getFilterTokens(this, tokenIds);
  }

  async filterTokensSearch(phrase) {
    return getFilterTokensSearch(this, phrase);
  }

  async tokenWarnings(options) {
    return getTokenWarnings(this, options);
  }

  async verifiedTokens() {
    return getVerifiedTokens(this);
  }

  async trades(options) {
    return getTrades(this, options);
  }

  async tradeComments(tradeId) {
    return getTradeComments(this, tradeId);
  }

  async tradesTopCombined(options = {}) {
    return getTradesTopCombined(this, options);
  }

  async user(userId) {
    return getUser(this, userId);
  }

  async userActiveTrade(options) {
    return getUserActiveTrade(this, options);
  }

  async userActivity(options) {
    return getUserActivity(this, options);
  }

  async userBalances(userId) {
    return getUserBalances(this, userId);
  }

  async usersFollowing() {
    return getUsersFollowing(this);
  }

  async usersFuzzySearch(searchTerm) {
    return getUsersFuzzySearch(this, searchTerm);
  }

  async usersReferralDetails(userId) {
    return getUserReferralDetails(this, userId);
  }

  async userTokensAggregatedSnapshotById(options) {
    return getUserTokensAggregatedSnapshotById(this, options);
  }

  async leaderboard24h(limit = 100) {
    return getLeaderboard24h(this, limit);
  }

  async status() {
    return getStatus(this);
  }

  async sendTransaction(payload) {
    return sendTransaction(this, payload);
  }
}

module.exports = {
  FomoClient,
};