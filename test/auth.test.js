const test = require("node:test");
const assert = require("node:assert/strict");
const { auth } = require("../src");
const { makeJwt, now } = require("./helpers");

test("normalizeAccessToken strips Bearer and Authorization prefixes", () => {
  assert.equal(auth.normalizeAccessToken("abc"), "abc");
  assert.equal(auth.normalizeAccessToken("  Bearer abc "), "abc");
  assert.equal(auth.normalizeAccessToken("Authorization: bearer abc"), "abc");
  assert.equal(auth.normalizeAccessToken("   "), undefined);
  assert.equal(auth.normalizeAccessToken(undefined), undefined);
});

test("getExpiration reads exp and tolerates non-JWT input", () => {
  assert.equal(auth.getExpiration(makeJwt({ exp: 123 })), 123);
  assert.equal(auth.getExpiration("not-a-jwt"), null);
  assert.equal(auth.getExpiration(makeJwt({ sub: "x" })), null);
});

test("isExpired honours the margin and treats exp-less tokens as valid", () => {
  const token = makeJwt({ exp: now() + 30 });
  assert.equal(auth.isExpired(token), false);
  assert.equal(auth.isExpired(token, 60), true);
  assert.equal(auth.isExpired("opaque"), false);
});
