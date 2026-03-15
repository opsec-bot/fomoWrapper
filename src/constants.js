const path = require("path");

const BASE_URL = "https://prod-api.fomo.family";
const PRIVY_BASE_URL = "https://auth.privy.io";
const PRIVY_SESSION_PATH = "/api/v1/sessions";
const REQUEST_TIMEOUT_MS = 30000;
const TOKEN_REFRESH_MARGIN_SECONDS = 60;
const DEFAULT_TOKENS_FILE = path.join(__dirname, "tokens.json");
const DEFAULT_FEED_LIMIT = 50;
const DEFAULT_FEED_TYPES = [
  "single_user_sell",
  "single_user_transfer_out",
  "user_trade_profit_milestone",
  "large_buy",
  "large_sell",
  "large_transfer_in",
  "large_transfer_out",
  "manual",
  "multi_user_buy",
  "multi_user_sell",
  "new_token_listing",
  "price_since_listing",
  "user_with_smart_following",
  "thesis_created",
];
const PRIVY_HEADERS = {
  "Content-Type": "application/json",
  "Privy-Client-Id": "client-WY5gFSayQjxnQhG4rP6SnwPAyPZWZpNRhJ6xkhmfgbmVh",
  "Privy-Client": "expo:0.60.0",
  Accept: "application/json",
  "Privy-Ca-Id": "d079dd8d-e70d-43f1-a49f-32a1a53da9af",
  Priority: "u=3, i",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Privy-App-Id": "cm6h485o300n3zj9yl6vpedq7",
  "User-Agent": "fomo/283 CFNetwork/3860.400.51 Darwin/25.3.0",
  "X-Native-App-Identifier": "family.fomo.app",
  Host: "auth.privy.io",
  "Content-Length": "106",
};

module.exports = {
  BASE_URL,
  PRIVY_BASE_URL,
  PRIVY_SESSION_PATH,
  REQUEST_TIMEOUT_MS,
  TOKEN_REFRESH_MARGIN_SECONDS,
  DEFAULT_TOKENS_FILE,
  DEFAULT_FEED_LIMIT,
  DEFAULT_FEED_TYPES,
  PRIVY_HEADERS,
};