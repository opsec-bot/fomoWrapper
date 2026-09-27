const BASE_URL = "https://prod-api.fomo.family";
const PRIVY_BASE_URL = "https://auth.privy.io";
const PRIVY_SESSION_PATH = "/api/v1/sessions";
const REQUEST_TIMEOUT_MS = 30000;
const TOKEN_REFRESH_MARGIN_SECONDS = 60;
const DEFAULT_TOKEN_FILE = "tokens.json";

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

// Sent on every API call so the request matches what fomo.family sends from Chrome.
// prod-api.fomo.family sits behind Cloudflare bot protection, which blocks plain
// Node HTTP clients; requests are made through impit's Chrome impersonation.
const BROWSER_HEADERS = {
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/json",
  priority: "u=1, i",
  "sec-ch-ua": '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "x-supported-chains": "1,56,143,4663,8453,1399811149",
  Referer: "https://fomo.family/",
};

// Headers the Fomo iOS app sends to Privy when refreshing a session.
const PRIVY_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "Privy-App-Id": "cm6h485o300n3zj9yl6vpedq7",
  "Privy-Client-Id": "client-WY5gFSayQjxnQhG4rP6SnwPAyPZWZpNRhJ6xkhmfgbmVh",
  "Privy-Client": "expo:0.60.0",
  "Privy-Ca-Id": "d079dd8d-e70d-43f1-a49f-32a1a53da9af",
  "User-Agent": "fomo/283 CFNetwork/3860.400.51 Darwin/25.3.0",
  "X-Native-App-Identifier": "family.fomo.app",
};

module.exports = {
  BASE_URL,
  PRIVY_BASE_URL,
  PRIVY_SESSION_PATH,
  REQUEST_TIMEOUT_MS,
  TOKEN_REFRESH_MARGIN_SECONDS,
  DEFAULT_TOKEN_FILE,
  DEFAULT_FEED_LIMIT,
  DEFAULT_FEED_TYPES,
  BROWSER_HEADERS,
  PRIVY_HEADERS,
};
