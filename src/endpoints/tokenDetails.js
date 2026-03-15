/**
 * Fetch token details
 * @param {import("../client").FomoClient} client
 * @param {string} tokenId
 * @returns {Promise<Object>}
 */
async function getTokenDetails(client, tokenId) {
  if (!tokenId) {
    throw new Error("tokenId is required");
  }

  return client.request("/proxy/tokenDetails", {
    method: "POST",
    body: { tokenId },
  });
}

module.exports = {
  getTokenDetails,
};