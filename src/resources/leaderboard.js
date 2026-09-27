/**
 * PnL leaderboards.
 */
class LeaderboardResource {
  /** @param {import("../client").FomoClient} client */
  constructor(client) {
    this.client = client;
  }

  /**
   * Top traders over the last 24 hours.
   * @param {number} [limit=100]
   */
  last24h(limit = 100) {
    return this.client.request("/v2/leaderboard/24h", { params: { limit } });
  }
}

module.exports = { LeaderboardResource };
