/**
 * Fetch filtered tokens
 * @param {import("../client").FomoClient} client
 * @param {string[]} tokenIds
 * @returns {Promise<Object>}
 */
async function getFilterTokens(client, tokenIds) {
  if (!Array.isArray(tokenIds)) {
    throw new Error("tokenIds must be an array");
  }

  return client.request("/proxy/filterTokens", {
    method: "POST",
    body: tokenIds,
  });
}

module.exports = {
  getFilterTokens,
};