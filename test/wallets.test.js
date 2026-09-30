const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const solana = require("../src/wallets/solana");
const evm = require("../src/wallets/evm");
const { parseHandle, recipientAmountHint } = require("../src/wallets");
const { FomoClient } = require("../src");
const { makeJwt, now, mockClient } = require("./helpers");

const USDC = evm.USDC_MINT;
const WALLET = "3cmts6s9Dhhbnw1ZMjkjnC6Ru3mRW6ckqzVPrax7mk78";
const RECIPIENT = "0x22CDAC3BBCA5Bc8472dfa81BC7a535f3d98ae9be";
const OTHER_RECIPIENT = "0xB1e70177777125eBf46dFCA33e6Dc905c9533ba0";
const OUT_TOKEN = "0x6662060b16b61ba3f83bca6ccc796eb3acdf7777";
const CREATED_AT = "2026-08-19T19:16:40.617Z";

const randomKey = () => solana.base58Encode(crypto.randomBytes(32));
const shortVec = (length) => {
  const bytes = [];
  do {
    let byte = length & 0x7f;
    length >>= 7;
    if (length) byte |= 0x80;
    bytes.push(byte);
  } while (length);
  return Buffer.from(bytes);
};
const u64 = (value) => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
};

/**
 * Serialize an unsigned transaction. Instructions reference accounts by key; keys missing
 * from `staticKeys` are appended. `lookups` makes it a v0 transaction.
 */
function serialize({ staticKeys = [], instructions, lookups }) {
  const keys = [...staticKeys];
  const indexOf = (key) => {
    if (!keys.includes(key)) keys.push(key);
    return keys.indexOf(key);
  };
  const compiled = instructions.map(({ program, accounts, data }) => ({
    program: typeof program === "number" ? program : indexOf(program),
    accounts: accounts.map((account) => (typeof account === "number" ? account : indexOf(account))),
    data: Buffer.from(data),
  }));

  const parts = [shortVec(0)];
  if (lookups) parts.push(Buffer.from([0x80]));
  parts.push(Buffer.from([1, 0, 0]), shortVec(keys.length), ...keys.map(solana.base58Decode), Buffer.alloc(32));
  parts.push(shortVec(compiled.length));
  for (const instruction of compiled) {
    parts.push(Buffer.from([instruction.program]), shortVec(instruction.accounts.length), Buffer.from(instruction.accounts));
    parts.push(shortVec(instruction.data.length), instruction.data);
  }
  if (lookups) {
    parts.push(shortVec(lookups.length));
    for (const lookup of lookups) {
      parts.push(solana.base58Decode(lookup.key), shortVec(lookup.writable.length), Buffer.from(lookup.writable));
      parts.push(shortVec(lookup.readonly.length), Buffer.from(lookup.readonly));
    }
  }
  return Buffer.concat(parts).toString("base64");
}

const transferChecked = (source, destination, amount, mint = USDC) => ({
  program: solana.TOKEN_PROGRAM,
  accounts: [source, mint, destination, randomKey()],
  data: Buffer.concat([Buffer.from([12]), u64(amount), Buffer.from([6])]),
});

function relayRequest(recipient, { status = "success", amount = "2000000", createdAt = CREATED_AT } = {}) {
  return {
    status,
    user: WALLET,
    recipient,
    createdAt,
    referrer: "fomo",
    data: {
      metadata: {
        sender: WALLET,
        recipient,
        currencyIn: { currency: { chainId: 792703809, address: USDC }, amount },
        currencyOut: { currency: { chainId: 4663, address: OUT_TOKEN }, amount: "100" },
      },
      outTxs: [
        {
          chainId: 4663,
          status: "success",
          stateChanges: [{ address: recipient, change: { balanceDiff: "100", data: { tokenAddress: OUT_TOKEN } } }],
        },
      ],
    },
  };
}

const relaySwap = (overrides = {}) => ({
  provider: "RELAY",
  createdAt: CREATED_AT,
  inAmount: 1_990_000,
  platformFeeAmount: 10_000,
  inNetworkId: evm.FOMO_SOLANA_NETWORK_ID,
  inTokenAddress: USDC,
  outNetworkId: 4663,
  outTokenAddress: OUT_TOKEN,
  outTradeId: "trade-id",
  ...overrides,
});

/** A client whose transport answers by path, since the send and swaps requests run concurrently. */
function routedClient(routes) {
  const calls = [];
  const http = {
    async fetch(url, init) {
      const path = new URL(url).pathname;
      calls.push({ path, body: init.body && JSON.parse(init.body) });
      if (!(path in routes)) throw new Error(`unexpected request ${path}`);
      return { ok: true, status: 200, text: async () => JSON.stringify(routes[path]) };
    },
  };
  return { client: new FomoClient({ accessToken: makeJwt({ exp: now() + 3600 }), http }), calls };
}

/** Route global fetch (Solana RPC + Relay) to handlers, recording URLs. */
function mockPublicFetch(t, { accounts = {}, relay = () => ({ requests: [] }) }) {
  const urls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    urls.push(String(url));
    if (String(url).startsWith("https://api.relay.link")) {
      return Response.json(relay(new URL(url)));
    }
    const [address] = JSON.parse(init.body).params;
    const account = accounts[address];
    return Response.json({
      result: { value: account ? { owner: account.owner, data: [account.data.toString("base64"), "base64"] } : null },
    });
  });
  return urls;
}

test("base58 round-trips and recognizes Solana addresses", () => {
  const bytes = Uint8Array.from([0, 0, ...crypto.randomBytes(30)]);
  assert.deepEqual(solana.base58Decode(solana.base58Encode(bytes)), bytes);
  assert.equal(solana.parseSolanaAddress(` ${USDC} `), USDC);
  assert.equal(solana.parseSolanaAddress("somehandle"), null);
  assert.equal(solana.parseSolanaAddress("0x22CDAC3BBCA5Bc8472dfa81BC7a535f3d98ae9be"), null);
});

test("associated token addresses match @solana/web3.js findProgramAddressSync", () => {
  const owner = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
  assert.equal(solana.associatedTokenAddress(owner, USDC), "FGETo8T8wMcN2wCjav8VK6eh3dLk63evNDPxzLSJra8B");
  assert.equal(
    solana.associatedTokenAddress(owner, USDC, solana.TOKEN_2022_PROGRAM),
    "GdjpegrtGwU3pgtzPivYVViSA8rmGL248qBVKzsrU3DD"
  );
});

test("parseHandle accepts @handle, handle, and profile URLs", () => {
  assert.equal(parseHandle("ExampleHandle"), "ExampleHandle");
  assert.equal(parseHandle("@ExampleHandle"), "ExampleHandle");
  assert.equal(parseHandle("https://fomo.family/profile/ExampleHandle/"), "ExampleHandle");
  assert.throws(() => parseHandle("https://example.com/profile/test"), /fomo\.family/);
});

test("checksumAddress produces EIP-55 addresses", () => {
  assert.equal(evm.checksumAddress("0xb1e70177777125ebf46dfca33e6dc905c9533ba0"), OTHER_RECIPIENT);
  assert.equal(evm.checksumAddress("0x52908400098527886e0f7030069857d2e4169ee7"), "0x52908400098527886E0F7030069857D2E4169EE7");
  assert.equal(evm.checksumAddress("0x123"), null);
});

test("recipientAmountHint subtracts a USDC fee from the prepared amount", () => {
  assert.equal(recipientAmountHint({ responseObject: { transferFeeTokenAddress: USDC, transferFeeUsd: 0.240519 } }), 1_759_481n);
  assert.equal(recipientAmountHint({ transferFeeTokenAddress: "other", transferFeeUsd: 0.2 }), null);
});

test("transfer destination uses the amount hint to skip the fee transfer", () => {
  const [recipient, fee] = [randomKey(), randomKey()];
  const tx = solana.decodeTransaction(
    Buffer.from(
      serialize({ instructions: [transferChecked(randomKey(), recipient, 1_759_481), transferChecked(randomKey(), fee, 240_519)] }),
      "base64"
    )
  );

  assert.equal(solana.findTransferDestination(tx, tx.staticKeys, USDC, 1_759_481n).destination, recipient);
  assert.throws(() => solana.findTransferDestination(tx, tx.staticKeys, USDC, null), /multiple checked/);
  assert.throws(() => solana.findTransferDestination(tx, tx.staticKeys, USDC, 1n), /no checked/);
});

test("swapCandidates keeps completed Solana-USDC-to-EVM Relay swaps, newest first", () => {
  const candidates = evm.swapCandidates({
    responseObject: [
      relaySwap({ createdAt: "2026-08-19T19:15:00.000Z" }),
      relaySwap(),
      relaySwap({ outTradeId: null }),
      relaySwap({ provider: "OTHER" }),
    ],
  });

  assert.deepEqual(
    candidates.map((candidate) => candidate.createdAt),
    [CREATED_AT, "2026-08-19T19:15:00.000Z"]
  );
  assert.equal(candidates[0].inputAmount, "2000000");
});

test("swapCandidates tolerates the missing platformFeeAmount field", () => {
  const [candidate] = evm.swapCandidates([relaySwap({ platformFeeAmount: undefined, inAmount: 3_498_250_000 })]);
  assert.equal(candidate.inputAmount, "3498250000");
});

test("matchCandidate allows Fomo's clock skew and fee, but requires the rest of the evidence to agree", () => {
  const [candidate] = evm.swapCandidates([relaySwap()]);
  // Seen live: Relay stamps the request seconds before Fomo records the swap, and charges Fomo's fee on top.
  const skewed = { createdAt: "2026-08-19T19:16:21.000Z", amount: "2001000" };

  assert.deepEqual(evm.matchCandidate(WALLET, candidate, [relayRequest(RECIPIENT)]), { address: RECIPIENT });
  assert.deepEqual(evm.matchCandidate(WALLET, candidate, [relayRequest(RECIPIENT, skewed)]), { address: RECIPIENT });
  assert.equal(evm.matchCandidate(WALLET, candidate, [relayRequest(RECIPIENT, { amount: "1900000" })]), null);
  assert.equal(
    evm.matchCandidate(WALLET, candidate, [relayRequest(RECIPIENT, { createdAt: "2026-08-19T19:30:00.000Z" })]),
    null
  );
  assert.equal(evm.matchCandidate(WALLET, candidate, [relayRequest(RECIPIENT, { status: "refund" })]), null);
  assert.deepEqual(evm.matchCandidate(WALLET, candidate, [relayRequest(RECIPIENT), relayRequest(OTHER_RECIPIENT)]), {
    address: null,
    reason: "conflictingRecipients",
  });
});

test("addresses resolves a new recipient from the ATA it creates, ignoring profile fields", async (t) => {
  const owner = randomKey();
  const ata = solana.associatedTokenAddress(owner, USDC);
  const payer = randomKey();
  const transaction = serialize({
    staticKeys: [payer],
    instructions: [
      {
        program: solana.ASSOCIATED_TOKEN_PROGRAM,
        accounts: [payer, ata, owner, USDC, "11111111111111111111111111111111", solana.TOKEN_PROGRAM],
        data: [1],
      },
      transferChecked(randomKey(), ata, 1_759_481),
      transferChecked(randomKey(), randomKey(), 240_519),
    ],
  });

  const { client, calls } = routedClient({
    "/v2/users/userHandle/alice": {
      responseObject: { id: "u1", userHandle: "alice", displayName: "Alice", address: "WRONG", evmAddress: "0xWRONG" },
    },
    "/transfers/v2/send": {
      responseObject: { transferTransaction: transaction, transferFeeTokenAddress: USDC, transferFeeUsd: 0.240519 },
    },
    "/v2/users/u1/swaps": { responseObject: [] },
  });
  const publicUrls = mockPublicFetch(t, {});

  assert.deepEqual(await client.users.addresses("https://fomo.family/profile/alice"), {
    userHandle: "alice",
    displayName: "Alice",
    userId: "u1",
    solanaAddress: owner,
    evmAddress: null,
    evmUnavailableReason: evm.EVM_UNAVAILABLE.noEligibleSwap,
    robinhoodAddress: null,
  });
  const send = calls.find((call) => call.path === "/transfers/v2/send");
  assert.deepEqual(send.body, { destinationUserId: "u1", tokenAddress: USDC, amount: "2000000" });
  assert.deepEqual(publicUrls, []);
});

test("solanaWallet resolves a known user id with a single Fomo call", async (t) => {
  const owner = randomKey();
  const ata = solana.associatedTokenAddress(owner, USDC);
  const payer = randomKey();
  const transaction = serialize({
    staticKeys: [payer],
    instructions: [
      {
        program: solana.ASSOCIATED_TOKEN_PROGRAM,
        accounts: [payer, ata, owner, USDC, "11111111111111111111111111111111", solana.TOKEN_PROGRAM],
        data: [1],
      },
      transferChecked(randomKey(), ata, 1_759_481),
      transferChecked(randomKey(), randomKey(), 240_519),
    ],
  });
  const { client, calls } = routedClient({
    "/transfers/v2/send": {
      responseObject: { transferTransaction: transaction, transferFeeTokenAddress: USDC, transferFeeUsd: 0.240519 },
    },
  });
  mockPublicFetch(t, {});

  assert.equal(await client.users.solanaWallet("u1"), owner);
  assert.deepEqual(calls.map((call) => call.path), ["/transfers/v2/send"]);
});

test("addresses reads an existing token account through a lookup table, then verifies the EVM wallet", async (t) => {
  const tokenAccount = randomKey();
  const lookupTable = randomKey();
  const tableData = Buffer.concat([Buffer.alloc(56), solana.base58Decode(randomKey()), solana.base58Decode(tokenAccount)]);
  // Static keys: 0 payer, 1 USDC, 2 token program, 3 source, 4 authority. Index 5 is loaded from the table.
  const transaction = serialize({
    staticKeys: [randomKey(), USDC, solana.TOKEN_PROGRAM, randomKey(), randomKey()],
    instructions: [
      { program: 2, accounts: [3, 1, 5, 4], data: Buffer.concat([Buffer.from([12]), u64(2_000_000), Buffer.from([6])]) },
    ],
    lookups: [{ key: lookupTable, writable: [1], readonly: [] }],
  });
  const tokenData = Buffer.concat([solana.base58Decode(USDC), solana.base58Decode(WALLET), Buffer.alloc(101)]);

  const { client } = routedClient({
    "/v2/users/userHandle/bob": { responseObject: { id: "u2", userHandle: "bob", displayName: "Bob" } },
    "/transfers/v2/send": { transferTransaction: transaction },
    "/v2/users/u2/swaps": { responseObject: [relaySwap()] },
  });
  const publicUrls = mockPublicFetch(t, {
    accounts: {
      [lookupTable]: { owner: "AddressLookupTab1e1111111111111111111111111", data: tableData },
      [tokenAccount]: { owner: solana.TOKEN_PROGRAM, data: tokenData },
    },
    // An older send to someone else must not stop the swap-matched wallet from resolving.
    relay: () => ({
      requests: [relayRequest(RECIPIENT), relayRequest(OTHER_RECIPIENT, { createdAt: "2026-08-01T00:00:00.000Z" })],
    }),
  });

  const result = await client.users.addresses("bob");

  assert.equal(result.solanaAddress, WALLET);
  assert.equal(result.evmAddress, RECIPIENT);
  assert.equal(result.robinhoodAddress, RECIPIENT);
  const relayUrls = publicUrls.filter((url) => url.includes("relay.link")).map((url) => new URL(url));
  assert.equal(relayUrls.length, 1);
  assert.equal(relayUrls[0].searchParams.get("user"), WALLET);
  assert.equal(relayUrls[0].searchParams.get("referrer"), null);
});

test("addresses on a Solana address uses Relay only and rejects conflicting recipients", async (t) => {
  const { client, calls } = mockClient();
  mockPublicFetch(t, {
    relay: (url) =>
      url.searchParams.get("continuation")
        ? { requests: [relayRequest(OTHER_RECIPIENT)] }
        : { requests: [relayRequest(RECIPIENT)], continuation: "next" },
  });

  const result = await client.users.addresses(WALLET);

  assert.equal(calls.length, 0);
  assert.equal(result.solanaAddress, WALLET);
  assert.equal(result.userId, null);
  assert.equal(result.evmAddress, null);
  assert.equal(result.evmUnavailableReason, evm.EVM_UNAVAILABLE.conflictingRecipients);
});
