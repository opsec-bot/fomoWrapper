const { FomoClient } = require("./src/client");
const { getTrendingTokens } = require("./src/endpoints/trending");
const { getTrendingFriends } = require("./src/endpoints/trendingFriends");
const { getTokenDetails } = require("./src/endpoints/tokenDetails");
const { getTokenBars } = require("./src/endpoints/bars");
const { getTokenPrices } = require("./src/endpoints/tokenPrices");
const { getFilterTokens } = require("./src/endpoints/filterTokens");
const { getFilterTokensSearch } = require("./src/endpoints/filterTokensSearch");
const { getTokenWarnings } = require("./src/endpoints/tokenWarnings");
const { getVerifiedTokens } = require("./src/endpoints/verifiedTokens");
const { getFeed, getFriendsFeed } = require("./src/endpoints/feed");
const { getTrades, getTradeComments, getTradesTopCombined } = require("./src/endpoints/trades");
const {
  getUser,
  getUserActiveTrade,
  getUserActivity,
  getUserBalances,
  getUsersFollowing,
  getUsersFuzzySearch,
  getUserReferralDetails,
  getUserTokensAggregatedSnapshotById,
} = require("./src/endpoints/users");
const { getLeaderboard24h } = require("./src/endpoints/leaderboard");
const { getStatus } = require("./src/endpoints/status");
const { sendTransaction } = require("./src/endpoints/transactions");
const tokenManager = require("./src/utils/tokenManager");
const constants = require("./src/constants");

module.exports = {
  FomoClient,
  getTrendingTokens,
  getTrendingFriends,
  getTokenDetails,
  getTokenBars,
  getTokenPrices,
  getFilterTokens,
  getFilterTokensSearch,
  getTokenWarnings,
  getVerifiedTokens,
  getFeed,
  getFriendsFeed,
  getTrades,
  getTradeComments,
  getTradesTopCombined,
  getUser,
  getUserActiveTrade,
  getUserActivity,
  getUserBalances,
  getUsersFollowing,
  getUsersFuzzySearch,
  getUserReferralDetails,
  getUserTokensAggregatedSnapshotById,
  getLeaderboard24h,
  getStatus,
  sendTransaction,
  tokenManager,
  constants,
};