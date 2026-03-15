/**
 * Fetch token warnings
 * @param {import("../client").FomoClient} client
 * @param {{ address: string, networkId: number }} options
 * @returns {Promise<Object>}
 */
async function getTokenWarnings(client, options) {
  const { address, networkId } = options || {};

  if (!address || typeof networkId === "undefined") {
    throw new Error("address and networkId are required");
  }

  return client.request("/proxy/tokenWarnings", {
    method: "POST",
    body: { address, networkId },
  });
}

module.exports = {
  getTokenWarnings,
};