const axios = require("axios");
const jwt = require("jsonwebtoken");
const fs = require("fs-extra");

const TOKEN_FILE = "./tokens.json";

async function loadTokens() {
  if (await fs.pathExists(TOKEN_FILE)) {
    return fs.readJSON(TOKEN_FILE);
  }
  throw new Error("tokens.json not found");
}

async function saveTokens(tokens) {
  await fs.writeJSON(TOKEN_FILE, tokens, { spaces: 2 });
}

function getExpiration(token) {
  const decoded = jwt.decode(token);
  return decoded.exp;
}

async function refreshTokens(refreshToken) {
const response = await axios.post(
    "https://auth.privy.io/api/v1/sessions",
    {
        refresh_token: refreshToken,
    },
    {
        headers: {
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
        },
    },
);

  return {
    access_token: response.data.privy_access_token,
    refresh_token: response.data.refresh_token,
  };
}

async function ensureValidToken() {
  const tokens = await loadTokens();

  const exp = getExpiration(tokens.access_token);
  const now = Math.floor(Date.now() / 1000);

  if (now > exp - 60) {
    console.log("Token expiring, refreshing...");

    const newTokens = await refreshTokens(tokens.refresh_token);

    await saveTokens(newTokens);

    return newTokens.access_token;
  }

  return tokens.access_token;
}

async function run() {
  while (true) {
    const token = await ensureValidToken();

    console.log("Access token valid");

    await new Promise((r) => setTimeout(r, 30000));
  }
}

run();
