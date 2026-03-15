/**
 * Send transaction payload to root endpoint
 * @param {import("../client").FomoClient} client
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function sendTransaction(client, payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("payload is required");
  }

  return client.request("/", {
    method: "POST",
    body: payload,
  });
}

module.exports = {
  sendTransaction,
};