const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs } = require("../src/cli/args");
const { findCommand } = require("../src/cli/commands");

test("positional values map onto command argument names", () => {
  assert.deepEqual(parseArgs(["0xabc", "8453"], ["address", "networkId"]), { address: "0xabc", networkId: 8453 });
});

test("key=value pairs and positionals can be mixed", () => {
  assert.deepEqual(parseArgs(["resolution=5", "sym", "1", "2"], ["symbol", "from", "to", "resolution"]), {
    symbol: "sym",
    from: 1,
    to: 2,
    resolution: 5,
  });
});

test("a JSON object is passed through untouched", () => {
  assert.deepEqual(parseArgs(['{"items":[{"networkId":8453}]}']), { items: [{ networkId: 8453 }] });
});

test("booleans are coerced, long digit strings stay strings", () => {
  assert.deepEqual(parseArgs(["flag=true", "id=12345678901234567890"]), { flag: true, id: "12345678901234567890" });
});

test("extra positionals are rejected", () => {
  assert.throws(() => parseArgs(["a", "b"], ["only"]), /Too many arguments/);
});

test("legacy command names resolve to their new names", () => {
  assert.equal(findCommand("usersFuzzySearch")[0], "searchUsers");
  assert.equal(findCommand("leaderboard24h")[0], "leaderboard");
  assert.equal(findCommand("constructor"), null);
});
