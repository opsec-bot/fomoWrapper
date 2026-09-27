const { DEFAULT_FEED_LIMIT, DEFAULT_FEED_TYPES } = require("../constants");

/**
 * The activity feed: large buys/sells, new listings, milestones, and so on.
 */
class FeedResource {
  /** @param {import("../client").FomoClient} client */
  constructor(client) {
    this.client = client;
  }

  /**
   * Global feed.
   * @param {{ limit?: number, feedTypes?: string[] }} [options]
   */
  list(options = {}) {
    return this.client.request("/feed", { params: feedParams(options) });
  }

  /**
   * Feed limited to accounts you follow.
   * @param {{ limit?: number, feedTypes?: string[] }} [options]
   */
  friends(options = {}) {
    return this.client.request("/feed/friends", { params: feedParams(options) });
  }
}

function feedParams({ limit = DEFAULT_FEED_LIMIT, feedTypes = DEFAULT_FEED_TYPES } = {}) {
  return { limit, feedTypes };
}

module.exports = { FeedResource };
