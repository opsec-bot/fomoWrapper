/**
 * Fetch token bars
 * @param {import("../client").FomoClient} client
 * @param {{ from: number, to: number, resolution: string, symbol: string }} options
 * @returns {Promise<Object>}
 */
async function getTokenBars(client, options) {
  const { from, to, resolution, symbol } = options || {};

  if (!from || !to || !resolution || !symbol) {
    throw new Error("from, to, resolution, and symbol are required");
  }

  return client.request("/proxy/getBars", {
    method: "POST",
    body: { from, to, resolution, symbol },
  });
}

module.exports = {
  getTokenBars,
};