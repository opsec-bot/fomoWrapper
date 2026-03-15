/**
 * Fetch API status
 * @param {import("../client").FomoClient} client
 * @returns {Promise<Object>}
 */
async function getStatus(client) {
  return client.request("/prod", {
    method: "GET",
  });
}

module.exports = {
  getStatus,
};