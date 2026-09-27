const { requireArgs } = require("./validate");

/**
 * Token discovery, pricing, and chart data.
 * Token ids use the `<address>:<networkId>` format, e.g. `0xacfe...21bf:8453`.
 */
class TokensResource {
  /** @param {import("../client").FomoClient} client */
  constructor(client) {
    this.client = client;
  }

  /** Trending tokens across Fomo. */
  trending() {
    return this.client.request("/proxy/trendingTokens", { method: "POST", body: {} });
  }

  /** Tokens trending among the accounts you follow. */
  trendingFriends() {
    return this.client.request("/proxy/trendingTokens/friends", { method: "POST", body: {} });
  }

  /** Tokens Fomo has marked as verified. */
  verified() {
    return this.client.request("/proxy/verifiedTokens");
  }

  /**
   * Full details for one token.
   * @param {string} tokenId `<address>:<networkId>`
   */
  details(tokenId) {
    requireArgs({ tokenId });
    return this.client.request("/proxy/tokenDetails", { method: "POST", body: { tokenId } });
  }

  /**
   * OHLCV candles for a token.
   * @param {{ symbol: string, from: number, to: number, resolution: string }} options
   *   `symbol` is a token id, `from`/`to` are unix seconds, `resolution` is minutes ("1", "5", "60") or "1D".
   */
  bars({ symbol, from, to, resolution } = {}) {
    requireArgs({ symbol, from, to, resolution });
    return this.client.request("/proxy/getBars", {
      method: "POST",
      body: { from, to, resolution: String(resolution), symbol },
    });
  }

  /**
   * Prices for several tokens, optionally at a point in time.
   * @param {{ address: string, networkId: number, timestamp?: number }[]} items
   */
  prices(items) {
    requireArray("items", items);
    return this.client.request("/proxy/getTokenPrices", { method: "POST", body: items });
  }

  /**
   * Token metadata for a list of token ids.
   * @param {string[]} tokenIds
   */
  filter(tokenIds) {
    requireArray("tokenIds", tokenIds);
    return this.client.request("/proxy/filterTokens", { method: "POST", body: tokenIds });
  }

  /**
   * Search tokens by name, ticker, or address.
   * @param {string} phrase
   */
  search(phrase) {
    requireArgs({ phrase });
    return this.client.request("/proxy/filterTokensSearch", { method: "POST", body: { phrase } });
  }

  /**
   * Risk warnings (honeypot, mintable, etc.) for a token.
   * @param {{ address: string, networkId: number }} options
   */
  warnings({ address, networkId } = {}) {
    requireArgs({ address, networkId });
    return this.client.request("/proxy/tokenWarnings", { method: "POST", body: { address, networkId } });
  }
}

function requireArray(name, value) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array`);
  }
}

module.exports = { TokensResource };
