/**
 * Fetch token prices
 * @param {import("../client").FomoClient} client
 * @param {{address: string, networkId: number, timestamp: number}[]} items
 * @returns {Promise<Object>}
 */
async function getTokenPrices(client, items) {
  if (!Array.isArray(items)) {
    throw new Error("items must be an array");
  }

  return client.request("/proxy/getTokenPrices", {
    method: "POST",
    body: items,
  });
}

module.exports = {
  getTokenPrices,
};