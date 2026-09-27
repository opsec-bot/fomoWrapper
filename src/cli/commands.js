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
    summary: "Check the API is reachable.",
    run: (client) => client.status(),
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

  // Trades
  trades: {
    group: "Trades",
    summary: "A user's trades.",
    args: ["userId", "orderBy"],
    example: "<userId> recent",
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
