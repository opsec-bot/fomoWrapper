/**
 * Fetch trending tokens for friends
 * @param {import("../client").FomoClient} client
 * @returns {Promise<Object>}
 */
async function getTrendingFriends(client) {
  return client.request("/proxy/trendingTokens/friends", {
    method: "POST",
    body: {},
  });
}

module.exports = {
  getTrendingFriends,
};