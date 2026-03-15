/**
 * Fetch user profile
 * @param {import("../client").FomoClient} client
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getUser(client, userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  return client.request(`/v2/users/${userId}`, { method: "GET" });
}

/**
 * Fetch user's active trade
 * @param {import("../client").FomoClient} client
 * @param {{ userId: string, tokenAddress: string, networkId: number }} options
 * @returns {Promise<Object>}
 */
async function getUserActiveTrade(client, options) {
  const { userId, tokenAddress, networkId } = options || {};
  if (!userId || !tokenAddress || typeof networkId === "undefined") {
    throw new Error("userId, tokenAddress, and networkId are required");
  }

  return client.request(`/v2/users/${userId}/activeTrade`, {
    method: "GET",
    params: { tokenAddress, networkId },
  });
}

/**
 * Fetch user activity
 * @param {import("../client").FomoClient} client
 * @param {{ userId: string, includeUsdcHistory?: boolean }} options
 * @returns {Promise<Object>}
 */
async function getUserActivity(client, options) {
  const { userId, includeUsdcHistory = false } = options || {};
  if (!userId) {
    throw new Error("userId is required");
  }

  return client.request(`/v2/users/${userId}/activity`, {
    method: "GET",
    params: { includeUsdcHistory },
  });
}

/**
 * Fetch user balances
 * @param {import("../client").FomoClient} client
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getUserBalances(client, userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  return client.request(`/v2/users/${userId}/balances`, { method: "GET" });
}

/**
 * Fetch current user following ids
 * @param {import("../client").FomoClient} client
 * @returns {Promise<Object>}
 */
async function getUsersFollowing(client) {
  return client.request("/v2/users/current/followingIds", { method: "GET" });
}

/**
 * Search users by fuzzy search term
 * @param {import("../client").FomoClient} client
 * @param {string} searchTerm
 * @returns {Promise<Object>}
 */
async function getUsersFuzzySearch(client, searchTerm) {
  if (!searchTerm) {
    throw new Error("searchTerm is required");
  }

  return client.request("/v2/users/fuzzy-search", {
    method: "GET",
    params: { searchTerm },
  });
}

/**
 * Fetch user referrer details
 * @param {import("../client").FomoClient} client
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getUserReferralDetails(client, userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  return client.request(`/v2/users/${userId}/referrerDetails`, { method: "GET" });
}

/**
 * Fetch user token aggregated snapshot by id
 * @param {import("../client").FomoClient} client
 * @param {{ userId: string, snapshotId: number|string }} options
 * @returns {Promise<Object>}
 */
async function getUserTokensAggregatedSnapshotById(client, options) {
  const { userId, snapshotId } = options || {};
  if (!userId || typeof snapshotId === "undefined") {
    throw new Error("userId and snapshotId are required");
  }

  return client.request("/v2/userTokens/aggregatedSnapshotById", {
    method: "GET",
    params: { userId, snapshotId },
  });
}

module.exports = {
  getUser,
  getUserActiveTrade,
  getUserActivity,
  getUserBalances,
  getUsersFollowing,
  getUsersFuzzySearch,
  getUserReferralDetails,
  getUserTokensAggregatedSnapshotById,
};