/**
 * Fetch 24h leaderboard
 * @param {import("../client").FomoClient} client
 * @param {number} [limit=100]
 * @returns {Promise<Object>}
 */
async function getLeaderboard24h(client, limit = 100) {
  return client.request("/v2/leaderboard/24h", {
    method: "GET",
    params: { limit },
  });
}

module.exports = {
  getLeaderboard24h,
};