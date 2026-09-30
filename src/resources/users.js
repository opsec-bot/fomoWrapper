const { requireArgs } = require("./validate");
const { resolveWallets, resolveSolanaWalletForUser } = require("../wallets");

/**
 * User profiles, balances, activity, and search.
 */
class UsersResource {
  /** @param {import("../client").FomoClient} client */
  constructor(client) {
    this.client = client;
  }

  /** The signed-in user's own profile. */
  me() {
    return this.client.request("/v2/users/current");
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
   * Resolve a handle, `@handle`, profile URL, or Solana address to verified wallet addresses.
   *
   * Profile fields are not used: the Solana wallet is read from a transfer Fomo prepares for the user
   * (decoded only, never signed or sent), and the EVM wallet from matching Relay swap history.
   * `evmAddress` is null, with `evmUnavailableReason`, when that history doesn't prove one wallet.
   * @param {string} input
   * @param {{ solanaRpcUrl?: string }} [options]
   * @returns {Promise<import("../wallets").WalletResolution & { robinhoodAddress: string|null }>}
   */
  async addresses(input, options) {
    requireArgs({ input: typeof input === "string" ? input.trim() : input });
    const wallets = await resolveWallets(this.client, input, options);
    // `robinhoodAddress` is the pre-0.4 name for `evmAddress`.
    return { ...wallets, robinhoodAddress: wallets.evmAddress };
  }

  /**
   * The Solana wallet of a user whose id you already have. One Fomo call instead of the three
   * `addresses()` makes (profile, swaps, transfer). Same method: read from a prepared, unsigned transfer.
   * Needs 2 USDC (Solana) in the signed-in account, like `addresses()`.
   * @param {string} userId
   * @param {{ solanaRpcUrl?: string }} [options]
   * @returns {Promise<string>}
   */
  solanaWallet(userId, options) {
    requireArgs({ userId });
    return resolveSolanaWalletForUser(this.client, userId, options);
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
   * Referral stats and code. The API only allows this for your own user id (others get 401).
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

  /**
   * Token holdings snapshot for a user at a point in time.
   * @param {{ userId: string, timestamp?: string|Date }} options ISO timestamp, defaults to now
   */
  tokensSnapshotAt({ userId, timestamp = new Date() } = {}) {
    requireArgs({ userId });
    const at = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
    return this.client.request("/v2/userTokens/aggregatedSnapshot", { params: { userId, timestamp: at } });
  }

  /**
   * A user's swap history.
   * @param {string} userId
   */
  swaps(userId) {
    requireArgs({ userId });
    return this.client.request(`/v2/users/${encodeURIComponent(userId)}/swaps`);
  }

  /**
   * A user's profile spotlight.
   * @param {string} userId
   */
  spotlight(userId) {
    requireArgs({ userId });
    return this.client.request(`/v2/users/${encodeURIComponent(userId)}/spotlight`);
  }

  /**
   * A user's leaderboard entry.
   * @param {string} userId
   */
  leaderboard(userId) {
    requireArgs({ userId });
    return this.client.request(`/v2/users/${encodeURIComponent(userId)}/leaderboard`);
  }

  /**
   * Transfers between you and another user.
   * @param {string} userId
   */
  transfersWith(userId) {
    requireArgs({ userId });
    return this.client.request(`/v2/transfers/with/${encodeURIComponent(userId)}`);
  }

  /** The authenticated user's watchlist. */
  watchlist() {
    return this.client.request("/watchlist");
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
