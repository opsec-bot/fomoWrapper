const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { FomoClient, FomoApiError, FomoAuthError } = require("../src");
const { buildQueryString } = require("../src/client");
const { makeJwt, now, mockClient } = require("./helpers");

test("buildQueryString repeats array keys and skips nullish values", () => {
  assert.equal(buildQueryString({ limit: 5, types: ["a", "b"], skip: undefined, none: null }), "?limit=5&types=a&types=b");
  assert.equal(buildQueryString({}), "");
  assert.equal(buildQueryString(undefined), "");
});

test("request sends auth header, JSON body, and returns parsed JSON", async () => {
  const { client, calls } = mockClient([{ body: { ok: true } }]);
  const data = await client.tokens.details("0xabc:8453");

  assert.deepEqual(data, { ok: true });
  assert.equal(calls[0].url, "https://prod-api.fomo.family/proxy/tokenDetails");
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(calls[0].body, { tokenId: "0xabc:8453" });
  assert.match(calls[0].headers.authorization, /^Bearer ey/);
});

test("non-2xx responses throw FomoApiError with status and body", async () => {
  const { client } = mockClient([{ status: 404, body: { error: "User not found" } }]);

  await assert.rejects(client.users.byHandle("@nobody"), (error) => {
    assert.ok(error instanceof FomoApiError);
    assert.equal(error.status, 404);
    assert.equal(error.path, "/v2/users/userHandle/nobody");
    assert.match(error.message, /User not found/);
    return true;
  });
});

test("missing required arguments throw before any request", async () => {
  const { client, calls } = mockClient();

  assert.throws(() => client.tokens.bars({ symbol: "x" }), /Missing required arguments: from, to, resolution/);
  assert.throws(() => client.tokens.prices("nope"), /items must be an array/);
  assert.equal(calls.length, 0);
});

test("expired token without a refresh token fails with FomoAuthError", async () => {
  const { client, calls } = mockClient([], { accessToken: makeJwt({ exp: now() - 10 }) });

  await assert.rejects(client.tokens.trending(), FomoAuthError);
  assert.equal(calls.length, 0);
});

test("expired token is refreshed once, persisted, and reported", async (t) => {
  const tokenFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fomo-")), "tokens.json");
  const fresh = makeJwt({ exp: now() + 3600 });
  let refreshCalls = 0;

  t.mock.method(globalThis, "fetch", async (url, init) => {
    refreshCalls += 1;
    assert.deepEqual(JSON.parse(init.body), { refresh_token: "old-refresh" });
    assert.match(init.headers.Authorization, /^Bearer ey/);
    return new Response(JSON.stringify({ token: fresh, privy_access_token: "privy-internal", refresh_token: "new-refresh", session_update_action: "set" }));
  });

  const refreshed = [];
  const { client, calls } = mockClient([{ body: [] }, { body: [] }], {
    accessToken: makeJwt({ exp: now() - 10 }),
    refreshToken: "old-refresh",
    tokenFile,
    onTokenRefresh: (tokens) => refreshed.push(tokens),
  });

  await Promise.all([client.tokens.trending(), client.tokens.verified()]);

  assert.equal(refreshCalls, 1);
  assert.equal(calls[0].headers.authorization, `Bearer ${fresh}`);
  assert.deepEqual(JSON.parse(fs.readFileSync(tokenFile, "utf8")), { access_token: fresh, refresh_token: "new-refresh" });
  assert.equal(refreshed.length, 1);
});

test("token file values take precedence over constructor values", async () => {
  const tokenFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fomo-")), "tokens.json");
  const fromFile = makeJwt({ exp: now() + 3600, src: "file" });
  fs.writeFileSync(tokenFile, JSON.stringify({ access_token: fromFile, refresh_token: "r" }));

  const { client, calls } = mockClient([{ body: {} }], { tokenFile, refreshToken: "stale" });
  await client.users.following();

  assert.equal(calls[0].headers.authorization, `Bearer ${fromFile}`);
  assert.equal(client.refreshToken, "r");
});

test("fromEnv reads FOMO_* variables and the legacy token-file flag", () => {
  const client = FomoClient.fromEnv({
    FOMO_ACCESS_TOKEN: "Authorization: Bearer abc",
    FOMO_REFRESH_TOKEN: "r",
    FOMO_USE_TOKEN_FILE: "true",
  });

  assert.equal(client.accessToken, "abc");
  assert.equal(client.refreshToken, "r");
  assert.equal(path.basename(client.tokenFile), "tokens.json");
});

test("status hits the status host without auth", async () => {
  const { client, calls } = mockClient([{ body: { success: "true" } }], { accessToken: makeJwt({ exp: now() - 10 }) });
  await client.status();

  assert.equal(calls[0].url, "https://status.fomo.family/prod");
  assert.equal(calls[0].headers.authorization, undefined);
});

test("leaderboard.last24h omits limit unless given", async () => {
  const { client, calls } = mockClient([{ body: {} }, { body: {} }]);
  await client.leaderboard.last24h();
  await client.leaderboard.last24h(10);

  assert.equal(calls[0].url, "https://prod-api.fomo.family/v2/leaderboard/24h");
  assert.equal(calls[1].url, "https://prod-api.fomo.family/v2/leaderboard/24h?limit=10");
});

test("401 permission errors do not trigger a refresh", async (t) => {
  const refresh = t.mock.method(globalThis, "fetch", async () => new Response("{}"));
  const { client } = mockClient(
    [{ status: 401, body: { message: "Not authorized: you can only view your own referrer details" } }],
    { refreshToken: "r" }
  );

  await assert.rejects(client.users.referralDetails("someone-else"), (error) => error.status === 401);
  assert.equal(refresh.mock.callCount(), 0);
});

test("401 token errors refresh once and retry", async (t) => {
  const fresh = makeJwt({ exp: now() + 3600 });
  t.mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ token: fresh, privy_access_token: "privy-internal", refresh_token: "r2", session_update_action: "set" }))
  );
  const { client, calls } = mockClient(
    [{ status: 401, body: { message: "Unexpected error in JWT authentication middleware" } }, { body: { ok: 1 } }],
    { refreshToken: "r" }
  );

  assert.deepEqual(await client.users.watchlist(), { ok: 1 });
  assert.equal(calls[1].headers.authorization, `Bearer ${fresh}`);
});

test("refresh keeps the current access token when Privy answers ignore", async (t) => {
  const current = makeJwt({ exp: now() + 3600 });
  t.mock.method(globalThis, "fetch", async () =>
    new Response(
      JSON.stringify({ token: null, privy_access_token: "privy-internal", refresh_token: "r", session_update_action: "ignore" })
    )
  );
  const { client } = mockClient([], { accessToken: current, refreshToken: "r" });

  assert.deepEqual(await client.refresh(), { access_token: current, refresh_token: "r" });
  assert.equal(client.accessToken, current);
});

test("refresh fails when Privy clears the session", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ token: null, refresh_token: null, session_update_action: "clear" }))
  );
  const { client } = mockClient([], { accessToken: makeJwt({ exp: now() - 10 }), refreshToken: "r" });

  await assert.rejects(client.refresh(), FomoAuthError);
});
