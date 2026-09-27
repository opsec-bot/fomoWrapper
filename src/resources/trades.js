const { requireArgs } = require("./validate");

/**
 * Trades and trade comments.
 */
class TradesResource {
  /** @param {import("../client").FomoClient} client */
  constructor(client) {
    this.client = client;
  }

  /**
   * A user's trades.
   * @param {{ userId: string, orderBy: string, tokenAddress?: string }} options
   *   `orderBy` is a field name such as "closedAt"; `tokenAddress` narrows to one token.
   */
  list({ userId, orderBy, tokenAddress } = {}) {
    requireArgs({ userId, orderBy });
    return this.client.request("/trades", { params: { userId, orderBy, tokenAddress } });
  }

  /**
   * Comments on a trade.
   * @param {string} tradeId
   */
  comments(tradeId) {
    requireArgs({ tradeId });
    return this.client.request(`/trades/${encodeURIComponent(tradeId)}/comments`);
  }

  /**
   * Best trades across all users.
   * @param {{ limit?: number, window?: string }} [options] window defaults to "all"
   */
  topCombined({ limit = 5, window = "all" } = {}) {
    return this.client.request("/trades/top-combined", { params: { limit, window } });
  }
}

module.exports = { TradesResource };
