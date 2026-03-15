/**
 * Fetch verified tokens
 * @param {import("../client").FomoClient} client
 * @returns {Promise<Object>}
 */
async function getVerifiedTokens(client) {
  return client.request("/proxy/verifiedTokens", {
    method: "GET",
  });
}

module.exports = {
  getVerifiedTokens,
};