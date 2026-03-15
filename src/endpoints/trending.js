/**
 * Fetch trending tokens
 * @param {import("../client").FomoClient} client
 * @returns {Promise<Object>}
 */
async function getTrendingTokens(client) {
  return client.request("/proxy/trendingTokens", {
    method: "POST",
    body: {},
  });
}

module.exports = {
  getTrendingTokens,
};