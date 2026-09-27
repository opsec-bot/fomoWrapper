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
   * @param {number} [limit] the web app omits this and gets the API default
   */
  last24h(limit) {
    return this.client.request("/v2/leaderboard/24h", { params: { limit } });
  }

  /**
   * Top clans.
   * @param {{ window?: string, limit?: number }} [options] window defaults to "24h"
   */
  clans({ window = "24h", limit = 50 } = {}) {
    return this.client.request("/v2/clans/leaderboard", { params: { window, limit } });
  }
}

module.exports = { LeaderboardResource };
