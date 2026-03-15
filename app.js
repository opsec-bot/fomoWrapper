require("dotenv").config();

const { FomoClient, tokenManager } = require("./index");

const COMMANDS = {
  status: (api) => api.status(),
  trending: (api) => api.trending(),
  trendingFriends: (api) => api.trendingFriends(),
  verifiedTokens: (api) => api.verifiedTokens(),
  feed: (api, args) => api.feed(args || {}),
  feedFriends: (api, args) => api.feedFriends(args || {}),
  tokenDetails: (api, args) => api.tokenDetails(args.tokenId),
  bars: (api, args) => api.bars(args),
  tokenPrices: (api, args) => api.tokenPrices(args.items),
  filterTokens: (api, args) => api.filterTokens(args.tokenIds),
  filterTokensSearch: (api, args) => api.filterTokensSearch(args.phrase),
  tokenWarnings: (api, args) => api.tokenWarnings(args),
  trades: (api, args) => api.trades(args),
  tradeComments: (api, args) => api.tradeComments(args.tradeId),
  tradesTopCombined: (api, args) => api.tradesTopCombined(args || {}),
  user: (api, args) => api.user(args.userId),
  userActiveTrade: (api, args) => api.userActiveTrade(args),
  userActivity: (api, args) => api.userActivity(args),
  userBalances: (api, args) => api.userBalances(args.userId),
  usersFollowing: (api) => api.usersFollowing(),
  usersFuzzySearch: (api, args) => api.usersFuzzySearch(args.searchTerm),
  usersReferralDetails: (api, args) => api.usersReferralDetails(args.userId),
  userTokensAggregatedSnapshotById: (api, args) => api.userTokensAggregatedSnapshotById(args),
  leaderboard24h: (api, args) => api.leaderboard24h(args?.limit || 100),
  sendTransaction: (api, args) => api.sendTransaction(args.payload),
};

const EXAMPLES = {
  status: "node app.js status",
  tokenDetails: 'node app.js tokenDetails "{\"tokenId\":\"0xabc:8453\"}"',
  bars: 'node app.js bars "{\"from\":1773547200,\"to\":1773550800,\"resolution\":\"1\",\"symbol\":\"0xabc:8453\"}"',
  usersFuzzySearch: 'node app.js usersFuzzySearch "{\"searchTerm\":\"res\"}"',
};

function printHelp() {
  console.log("Fomo Wrapper App");
  console.log("Usage: node app.js <command> [jsonArgs]");
  console.log("Reads auth automatically from .env if present.");
  console.log("\nToken options:");
  console.log("- FOMO_ACCESS_TOKEN=<token|Bearer token|Authorization: Bearer token>");
  console.log("- FOMO_USE_TOKEN_FILE=true (uses src/tokens.json + refresh)");
  console.log("\nCommands:");
  Object.keys(COMMANDS).forEach((command) => console.log(`- ${command}`));
  console.log("\nExamples:");
  Object.values(EXAMPLES).forEach((example) => console.log(`- ${example}`));
}

/**
 * Parse JSON args string
 * @param {string|undefined} raw
 * @returns {Object}
 */
function parseArgs(raw) {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("jsonArgs must be an object");
    }
    return parsed;
  } catch (error) {
    throw new Error(`Invalid jsonArgs: ${error.message}`);
  }
}

/**
 * Build client with token from env or token manager
 * @returns {Promise<FomoClient>}
 */
async function createClient() {
  let token = process.env.FOMO_ACCESS_TOKEN;
  const useTokenFile = process.env.FOMO_USE_TOKEN_FILE === "true";

  if (!token && useTokenFile) {
    token = await tokenManager.ensureValidToken();
  }

  if (!token) {
    throw new Error(
      "Missing auth token. Set FOMO_ACCESS_TOKEN or set FOMO_USE_TOKEN_FILE=true to use src/tokens.json"
    );
  }

  return new FomoClient({ token });
}

async function main() {
  const command = process.argv[2];
  const rawArgs = process.argv[3];

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (!COMMANDS[command]) {
    throw new Error(`Unknown command: ${command}`);
  }

  const args = parseArgs(rawArgs);
  const client = await createClient();
  const data = await COMMANDS[command](client, args);
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});