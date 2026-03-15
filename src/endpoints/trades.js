/**
 * Fetch trades by user and order
 * @param {import("../client").FomoClient} client
 * @param {{ userId: string, orderBy: string }} options
 * @returns {Promise<Object>}
 */
async function getTrades(client, options) {
  const { userId, orderBy } = options || {};

  if (!userId || !orderBy) {
    throw new Error("userId and orderBy are required");
  }

  return client.request("/trades", {
    method: "GET",
    params: { userId, orderBy },
  });
}

/**
 * Fetch comments for a trade
 * @param {import("../client").FomoClient} client
 * @param {string} tradeId
 * @returns {Promise<Object>}
 */
async function getTradeComments(client, tradeId) {
  if (!tradeId) {
    throw new Error("tradeId is required");
  }

  return client.request(`/trades/${tradeId}/comments`, {
    method: "GET",
  });
}

/**
 * Fetch top combined trades
 * @param {import("../client").FomoClient} client
 * @param {{ limit?: number, window?: string }} options
 * @returns {Promise<Object>}
 */
async function getTradesTopCombined(client, options = {}) {
  return client.request("/trades/top-combined", {
    method: "GET",
    params: {
      limit: options.limit || 5,
      window: options.window || "all",
    },
  });
}

module.exports = {
  getTrades,
  getTradeComments,
  getTradesTopCombined,
};