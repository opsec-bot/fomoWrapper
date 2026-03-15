/**
 * Search tokens by phrase
 * @param {import("../client").FomoClient} client
 * @param {string} phrase
 * @returns {Promise<Object>}
 */
async function getFilterTokensSearch(client, phrase) {
  if (!phrase) {
    throw new Error("phrase is required");
  }

  return client.request("/proxy/filterTokensSearch", {
    method: "POST",
    body: { phrase },
  });
}

module.exports = {
  getFilterTokensSearch,
};