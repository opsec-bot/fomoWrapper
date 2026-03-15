const { DEFAULT_FEED_LIMIT, DEFAULT_FEED_TYPES } = require("../constants");

/**
 * Build feed query params
 * @param {{ limit?: number, feedTypes?: string[] }} options
 * @returns {{ limit: number, feedTypes: string[] }}
 */
function buildFeedParams(options = {}) {
  return {
    limit: options.limit || DEFAULT_FEED_LIMIT,
    feedTypes: options.feedTypes || DEFAULT_FEED_TYPES,
  };
}

/**
 * Fetch public feed
 * @param {import("../client").FomoClient} client
 * @param {{ limit?: number, feedTypes?: string[] }} options
 * @returns {Promise<Object>}
 */
async function getFeed(client, options = {}) {
  return client.request("/feed", {
    method: "GET",
    params: buildFeedParams(options),
  });
}

/**
 * Fetch friends feed
 * @param {import("../client").FomoClient} client
 * @param {{ limit?: number, feedTypes?: string[] }} options
 * @returns {Promise<Object>}
 */
async function getFriendsFeed(client, options = {}) {
  return client.request("/feed/friends", {
    method: "GET",
    params: buildFeedParams(options),
  });
}

module.exports = {
  getFeed,
  getFriendsFeed,
};