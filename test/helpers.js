const { FomoClient } = require("../src");

/** Build an unsigned JWT with the given payload. */
function makeJwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.sig`;
}

const now = () => Math.floor(Date.now() / 1000);

/**
 * A client whose transport records requests and replies from a queue.
 * @param {Array<{ status?: number, body?: unknown }>} replies
 * @param {import("../src/client").FomoClientOptions} [options]
 */
function mockClient(replies = [], options = {}) {
  const calls = [];
  const http = {
    async fetch(url, init) {
      calls.push({ url, ...init, body: init.body && JSON.parse(init.body) });
      const { status = 200, body = {} } = replies.shift() || {};
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
      };
    },
  };

  const client = new FomoClient({ accessToken: makeJwt({ exp: now() + 3600 }), http, ...options });
  return { client, calls };
}

module.exports = { makeJwt, now, mockClient };
