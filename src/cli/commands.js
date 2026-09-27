/**
 * @typedef {Object} Command
 * @property {string} group
 * @property {string} summary
 * @property {string[]} [args] positional argument names, in order
 * @property {string} [example] arguments for the help example
 * @property {(client: import("../client").FomoClient, args: Object) => unknown} run
 */

/** @type {Record<string, Command>} */
const COMMANDS = {
  // Account
  status: {
    group: "Account",
    summary: "Show local auth state (token expiry, refresh available). No network call.",
    run: async (client) => {
      if (client.tokenFile) {
        await client._loadTokenFile().catch(() => {});
      }
      return { ...client.getAuthInfo(), tokenFile: client.tokenFile || null, baseUrl: client.baseUrl };
    },
  },
  ping: {
    group: "Account",
    summary: "Fomo's service status banner. No auth needed.",
    run: (client) => client.status(),
  },
  config: {
    group: "Account",
    summary: "App configuration for your account.",
    run: (client) => client.config(),
  },
  watchlist: {
    group: "Account",
    summary: "Your watchlist.",
    run: (client) => client.users.watchlist(),
  },

  // Tokens
  trending: {
    group: "Tokens",
    summary: "Trending tokens.",
    run: (client) => client.tokens.trending(),
  },
  trendingFriends: {
    group: "Tokens",
    summary: "Tokens trending among accounts you follow.",
    run: (client) => client.tokens.trendingFriends(),
  },
  verifiedTokens: {
    group: "Tokens",
    summary: "Verified tokens.",
    run: (client) => client.tokens.verified(),
  },
  tokenDetails: {
    group: "Tokens",
    summary: "Details for one token.",
    args: ["tokenId"],
    example: "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf:8453",
    run: (client, { tokenId }) => client.tokens.details(tokenId),
  },
  bars: {
    group: "Tokens",
    summary: "OHLCV candles. from/to are unix seconds, resolution is minutes or 1D.",
    args: ["symbol", "from", "to", "resolution"],
    example: "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf:8453 1773547200 1773550800 1",
    run: (client, args) => client.tokens.bars(args),
  },
  tokenPrices: {
    group: "Tokens",
    summary: "Prices for several tokens.",
    example: `'{"items":[{"address":"0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf","networkId":8453}]}'`,
    run: (client, { items }) => client.tokens.prices(items),
  },
  filterTokens: {
    group: "Tokens",
    summary: "Metadata for a list of token ids.",
    example: `'{"tokenIds":["0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf:8453"]}'`,
    run: (client, { tokenIds }) => client.tokens.filter(tokenIds),
  },
  searchTokens: {
    group: "Tokens",
    summary: "Search tokens by name, ticker, or address.",
    args: ["phrase"],
    example: "pepe",
    run: (client, { phrase }) => client.tokens.search(String(phrase)),
  },
  tokenWarnings: {
    group: "Tokens",
    summary: "Risk warnings for a token.",
    args: ["address", "networkId"],
    example: "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf 8453",
    run: (client, args) => client.tokens.warnings(args),
  },
  topHolders: {
    group: "Tokens",
    summary: "Biggest Fomo holders of a token.",
    args: ["address", "networkId"],
    example: "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf 8453",
    run: (client, { address, networkId, tokens }) =>
      client.tokens.topHolders(tokens || [{ address: String(address), networkId }]),
  },
  friendHolders: {
    group: "Tokens",
    summary: "Accounts you follow that hold a token.",
    args: ["address", "networkId", "limit"],
    example: "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf 8453",
    run: (client, { address, networkId, tokens, limit }) =>
      client.tokens.friendHolders(tokens || [{ address: String(address), networkId }], limit),
  },
  allowList: {
    group: "Tokens",
    summary: "Tokens Fomo allows trading, with details.",
    run: (client) => client.tokens.allowList(),
  },
  transferableTokens: {
    group: "Tokens",
    summary: "Tokens that can be transferred in and out of Fomo.",
    run: (client) => client.tokens.transferable(),
  },

  // Feed
  feed: {
    group: "Feed",
    summary: "Global activity feed.",
    args: ["limit"],
    example: "20",
    run: (client, args) => client.feed.list(args),
  },
  feedFriends: {
    group: "Feed",
    summary: "Activity feed for accounts you follow.",
    args: ["limit"],
    example: "20",
    run: (client, args) => client.feed.friends(args),
  },
  tokenFeed: {
    group: "Feed",
    summary: "Activity for one token.",
    args: ["tokenAddress", "networkId"],
    example: "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf 8453",
    run: (client, args) => client.feed.token({ ...args, tokenAddress: String(args.tokenAddress) }),
  },
  tokenTheses: {
    group: "Feed",
    summary: "Theses (posts) about one token.",
    args: ["tokenAddress", "networkId", "lastId"],
    example: "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf 8453",
    run: (client, args) => client.feed.tokenTheses({ ...args, tokenAddress: String(args.tokenAddress) }),
  },
  tradingActivity: {
    group: "Feed",
    summary: "Recent trading activity across Fomo.",
    args: ["limit"],
    example: "20",
    run: (client, args) => client.feed.tradingActivity(args),
  },

  // Trades
  trades: {
    group: "Trades",
    summary: "A user's trades.",
    args: ["userId", "orderBy", "tokenAddress"],
    example: "<userId> closedAt",
    run: (client, args) => client.trades.list(args),
  },
  tradeComments: {
    group: "Trades",
    summary: "Comments on a trade.",
    args: ["tradeId"],
    example: "<tradeId>",
    run: (client, { tradeId }) => client.trades.comments(String(tradeId)),
  },
  tradesTopCombined: {
    group: "Trades",
    summary: "Top trades across all users.",
    args: ["limit", "window"],
    example: "10 all",
    run: (client, args) => client.trades.topCombined(args),
  },

  // Users
  addresses: {
    group: "Users",
    summary: "Resolve a handle to its Robinhood (EVM) and Solana addresses.",
    args: ["userHandle"],
    example: "@somehandle",
    run: (client, { userHandle }) => client.users.addresses(String(userHandle)),
  },
  userByHandle: {
    group: "Users",
    summary: "Full profile by exact handle.",
    args: ["userHandle"],
    example: "@somehandle",
    run: (client, { userHandle }) => client.users.byHandle(String(userHandle)),
  },
  user: {
    group: "Users",
    summary: "Full profile by user id.",
    args: ["userId"],
    example: "<userId>",
    run: (client, { userId }) => client.users.get(String(userId)),
  },
  searchUsers: {
    group: "Users",
    summary: "Find users by partial name or handle.",
    args: ["searchTerm"],
    example: "res",
    run: (client, { searchTerm }) => client.users.search(String(searchTerm)),
  },
  userBalances: {
    group: "Users",
    summary: "Token balances for a user.",
    args: ["userId"],
    example: "<userId>",
    run: (client, { userId }) => client.users.balances(String(userId)),
  },
  userActivity: {
    group: "Users",
    summary: "Activity history for a user.",
    args: ["userId", "includeUsdcHistory"],
    example: "<userId> true",
    run: (client, args) => client.users.activity(args),
  },
  userActiveTrade: {
    group: "Users",
    summary: "A user's open position in one token.",
    args: ["userId", "tokenAddress", "networkId"],
    example: "<userId> 0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf 8453",
    run: (client, args) => client.users.activeTrade(args),
  },
  userReferralDetails: {
    group: "Users",
    summary: "Who referred a user.",
    args: ["userId"],
    example: "<userId>",
    run: (client, { userId }) => client.users.referralDetails(String(userId)),
  },
  userTokensSnapshot: {
    group: "Users",
    summary: "Aggregated token snapshot for a user.",
    args: ["userId", "snapshotId"],
    example: "<userId> <snapshotId>",
    run: (client, args) => client.users.tokensSnapshot(args),
  },
  userTokensSnapshotAt: {
    group: "Users",
    summary: "A user's token holdings at a point in time (ISO timestamp, default now).",
    args: ["userId", "timestamp"],
    example: "<userId> 2026-09-26T00:00:00Z",
    run: (client, args) => client.users.tokensSnapshotAt(args),
  },
  userSwaps: {
    group: "Users",
    summary: "A user's swap history.",
    args: ["userId"],
    example: "<userId>",
    run: (client, { userId }) => client.users.swaps(String(userId)),
  },
  userSpotlight: {
    group: "Users",
    summary: "A user's profile spotlight.",
    args: ["userId"],
    example: "<userId>",
    run: (client, { userId }) => client.users.spotlight(String(userId)),
  },
  userLeaderboard: {
    group: "Users",
    summary: "A user's leaderboard entry.",
    args: ["userId"],
    example: "<userId>",
    run: (client, { userId }) => client.users.leaderboard(String(userId)),
  },
  transfersWith: {
    group: "Users",
    summary: "Transfers between you and another user.",
    args: ["userId"],
    example: "<userId>",
    run: (client, { userId }) => client.users.transfersWith(String(userId)),
  },
  following: {
    group: "Users",
    summary: "Ids of accounts you follow.",
    run: (client) => client.users.following(),
  },

  // Leaderboard
  leaderboard: {
    group: "Leaderboard",
    summary: "Top traders over the last 24h.",
    args: ["limit"],
    example: "25",
    run: (client, { limit }) => client.leaderboard.last24h(limit),
  },
  clans: {
    group: "Leaderboard",
    summary: "Top clans.",
    args: ["window", "limit"],
    example: "24h 25",
    run: (client, args) => client.leaderboard.clans(args),
  },

  // Advanced
  sendTransaction: {
    group: "Advanced",
    summary: "POST a signed transaction payload. Can move funds.",
    example: `'{"payload":{...}}'`,
    run: (client, args) => client.sendTransaction(args.payload ?? args),
  },
};

// Older command names, kept so existing scripts keep working.
const ALIASES = {
  filterTokensSearch: "searchTokens",
  usersFuzzySearch: "searchUsers",
  userFuzzySearch: "searchUsers",
  fuzzySearch: "searchUsers",
  userAddresses: "addresses",
  wallets: "addresses",
  usersFollowing: "following",
  usersReferralDetails: "userReferralDetails",
  userTokensAggregatedSnapshotById: "userTokensSnapshot",
  leaderboard24h: "leaderboard",
};

/**
 * @param {string} name
 * @returns {[string, Command]|null}
 */
function findCommand(name) {
  const canonical = ALIASES[name] || name;
  return Object.hasOwn(COMMANDS, canonical) ? [canonical, COMMANDS[canonical]] : null;
}

module.exports = { COMMANDS, ALIASES, findCommand };
