const { DEFAULT_FEED_LIMIT, DEFAULT_FEED_TYPES } = require("../constants");
const { requireArgs } = require("./validate");

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

  /**
   * Activity for one token.
   * @param {{ tokenAddress: string, networkId: number, excludeThesis?: boolean, threshold?: number }} options
   */
  token({ tokenAddress, networkId, excludeThesis, threshold = 0 } = {}) {
    requireArgs({ tokenAddress, networkId });
    return this.client.request("/feed/token", { params: { tokenAddress, networkId, excludeThesis, threshold } });
  }

  /**
   * Theses (posts) about one token. Pass `lastId` from the previous page to paginate.
   * @param {{ tokenAddress: string, networkId: number, threshold?: number, lastId?: string }} options
   */
  tokenTheses({ tokenAddress, networkId, threshold = 0, lastId } = {}) {
    requireArgs({ tokenAddress, networkId });
    return this.client.request("/feed/token/thesis", { params: { tokenAddress, networkId, lastId, threshold } });
  }

  /**
   * Recent trading activity across Fomo.
   * @param {{ limit?: number, threshold?: number }} [options]
   */
  tradingActivity({ limit = DEFAULT_FEED_LIMIT, threshold } = {}) {
    return this.client.request("/feed/tradingActivity", { params: { limit, threshold } });
  }
}

function feedParams({ limit = DEFAULT_FEED_LIMIT, feedTypes = DEFAULT_FEED_TYPES } = {}) {
  return { limit, feedTypes };
}

module.exports = { FeedResource };
