const { requireArgs } = require("./validate");

/**
 * User profiles, balances, activity, and search.
 */
class UsersResource {
  /** @param {import("../client").FomoClient} client */
  constructor(client) {
    this.client = client;
  }

  /**
   * Profile by user id.
   * @param {string} userId
   */
  get(userId) {
    requireArgs({ userId });
    return this.client.request(`/v2/users/${encodeURIComponent(userId)}`);
  }

  /**
   * Profile by exact handle (a leading `@` is ignored). 404s on an unknown handle.
   * @param {string} userHandle
   */
  byHandle(userHandle) {
    const handle = normalizeHandle(userHandle);
    requireArgs({ userHandle: handle });
    return this.client.request(`/v2/users/userHandle/${encodeURIComponent(handle)}`);
  }

  /**
   * Resolve a handle to its wallet addresses.
   * @param {string} userHandle
   * @returns {Promise<{ userHandle: string, displayName: string, userId: string,
   *   robinhoodAddress: string|null, solanaAddress: string|null }>}
   */
  async addresses(userHandle) {
    const user = unwrapUser(await this.byHandle(userHandle));

    return {
      userHandle: user.userHandle,
      displayName: user.displayName,
      userId: user.id,
      robinhoodAddress: user.evmAddress || null,
      solanaAddress: user.address || null,
    };
  }

  /**
   * Find users by partial name or handle.
   * @param {string} searchTerm
   */
  search(searchTerm) {
    requireArgs({ searchTerm });
    return this.client.request("/v2/users/fuzzy-search", { params: { searchTerm } });
  }

  /**
   * Token balances held by a user.
   * @param {string} userId
   */
  balances(userId) {
    requireArgs({ userId });
    return this.client.request(`/v2/users/${encodeURIComponent(userId)}/balances`);
  }

  /**
   * A user's activity history.
   * @param {{ userId: string, includeUsdcHistory?: boolean }} options
   */
  activity({ userId, includeUsdcHistory = false } = {}) {
    requireArgs({ userId });
    return this.client.request(`/v2/users/${encodeURIComponent(userId)}/activity`, {
      params: { includeUsdcHistory },
    });
  }

  /**
   * A user's open position in one token.
   * @param {{ userId: string, tokenAddress: string, networkId: number }} options
   */
  activeTrade({ userId, tokenAddress, networkId } = {}) {
    requireArgs({ userId, tokenAddress, networkId });
    return this.client.request(`/v2/users/${encodeURIComponent(userId)}/activeTrade`, {
      params: { tokenAddress, networkId },
    });
  }

  /**
   * Who referred a user.
   * @param {string} userId
   */
  referralDetails(userId) {
    requireArgs({ userId });
    return this.client.request(`/v2/users/${encodeURIComponent(userId)}/referrerDetails`);
  }

  /**
   * Aggregated token snapshot for a user.
   * @param {{ userId: string, snapshotId: number|string }} options
   */
  tokensSnapshot({ userId, snapshotId } = {}) {
    requireArgs({ userId, snapshotId });
    return this.client.request("/v2/userTokens/aggregatedSnapshotById", { params: { userId, snapshotId } });
  }

  /** Ids of the accounts the authenticated user follows. */
  following() {
    return this.client.request("/v2/users/current/followingIds");
  }
}

/**
 * Strip whitespace and a leading `@` from a handle.
 * @param {string} userHandle
 * @returns {string}
 */
function normalizeHandle(userHandle) {
  return String(userHandle ?? "")
    .trim()
    .replace(/^@/, "");
}

/**
 * Unwrap the `responseObject` envelope returned by the users API.
 * @param {Object} response
 * @returns {Object}
 */
function unwrapUser(response) {
  const user = response?.responseObject;

  if (!user?.id) {
    throw new Error(`Unexpected user response: ${JSON.stringify(response).slice(0, 200)}`);
  }

  return user;
}

module.exports = { UsersResource, normalizeHandle, unwrapUser };
