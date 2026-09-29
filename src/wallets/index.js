const { FomoApiError, FomoAuthError, FomoError } = require("../errors");
const solana = require("./solana");
const evm = require("./evm");

const DEFAULT_SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
// Fomo subtracts its dynamic fee from the prepared amount, so it has to cover the fee.
// The prepared transaction is only decoded, never signed or sent, so no balance is needed.
const PREPARED_TRANSFER_AMOUNT = 2_000_000n;
const MAX_FOMO_ATTEMPTS = 5;

/**
 * @typedef {Object} WalletResolution
 * @property {string|null} userHandle null when the input was a Solana address
 * @property {string|null} displayName
 * @property {string|null} userId
 * @property {string} solanaAddress
 * @property {string|null} evmAddress EIP-55 checksummed, only when Relay history proves it
 * @property {string|null} evmUnavailableReason why `evmAddress` is null
 */

/**
 * A handle from `@handle`, `handle`, or a fomo.family profile URL.
 * @param {string} input
 * @returns {string}
 */
function parseHandle(input) {
  const trimmed = String(input ?? "")
    .trim()
    .replace(/\/+$/, "");
  let handle = trimmed.replace(/^@/, "");

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    if (!["fomo.family", "www.fomo.family"].includes(url.hostname)) {
      throw new TypeError("Profile URL must use fomo.family");
    }
    handle = url.pathname.split("/").filter(Boolean).pop() || "";
  }

  if (!handle || handle.includes("/")) {
    throw new TypeError(`Invalid Fomo handle: ${input}`);
  }
  return handle;
}

function isAuthFailure(error) {
  return error instanceof FomoAuthError || (error instanceof FomoApiError && error.status === 401);
}

/** client.request, retrying rate limits and server errors with backoff. */
async function requestWithRetry(client, path, options) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await client.request(path, options);
    } catch (error) {
      const retryable = error instanceof FomoApiError && (error.status === 429 || error.status >= 500);
      if (!retryable || attempt + 1 >= MAX_FOMO_ATTEMPTS) throw error;
      const base = error.status === 429 ? 1000 : 250;
      await new Promise((resolve) => setTimeout(resolve, base * 2 ** Math.min(attempt, 3)));
    }
  }
}

function firstDefined(value, paths) {
  for (const path of paths) {
    const found = path.reduce((node, key) => (node == null ? undefined : node[key]), value);
    if (found !== undefined && found !== null) return found;
  }
  return undefined;
}

/** Recipient share of the prepared amount, when the fee is charged in the same token. */
function recipientAmountHint(prepared) {
  const feeToken = firstDefined(prepared, [["responseObject", "transferFeeTokenAddress"], ["transferFeeTokenAddress"]]);
  const feeUsd = Number(firstDefined(prepared, [["responseObject", "transferFeeUsd"], ["transferFeeUsd"]]));
  if (feeToken !== evm.USDC_MINT || !Number.isFinite(feeUsd) || feeUsd < 0) return null;

  const fee = BigInt(Math.round(feeUsd * 1_000_000));
  return fee <= PREPARED_TRANSFER_AMOUNT ? PREPARED_TRANSFER_AMOUNT - fee : null;
}

/**
 * The Solana wallet a user receives transfers at, read from a transfer Fomo prepares for them.
 * @param {import("../client").FomoClient} client
 * @param {string} userId
 * @param {solana.SolanaRpc} rpc
 * @returns {Promise<string>}
 */
async function resolveSolanaWallet(client, userId, rpc) {
  let prepared;
  try {
    prepared = await requestWithRetry(client, "/transfers/v2/send", {
      method: "POST",
      body: { destinationUserId: userId, tokenAddress: evm.USDC_MINT, amount: PREPARED_TRANSFER_AMOUNT.toString() },
    });
  } catch (error) {
    // Fomo checks the sender's balance before preparing, even though nothing is sent.
    if (error instanceof FomoApiError && error.status === 400 && /available balance/i.test(error.message)) {
      throw new FomoError(
        "Resolving a Solana wallet needs 2 USDC (Solana) in the signed-in account: Fomo only prepares " +
          "transfers the sender could afford. Nothing is sent. Pass a Solana address to resolve only its EVM wallet.",
        { cause: error }
      );
    }
    throw error;
  }

  const encoded = firstDefined(prepared, [
    ["responseObject", "transferTransaction", "transferTransaction"],
    ["transferTransaction", "transferTransaction"],
    ["responseObject", "transferTransaction"],
    ["transferTransaction"],
  ]);
  if (typeof encoded !== "string") {
    throw new FomoError("Fomo send response did not contain a prepared transaction");
  }

  const transaction = solana.decodeTransaction(Buffer.from(encoded, "base64"));
  const keys = await solana.resolveAccountKeys(transaction, rpc);
  const { destination } = solana.findTransferDestination(transaction, keys, evm.USDC_MINT, recipientAmountHint(prepared));

  const owner = solana.ataOwnerFromTransaction(transaction, keys, destination, evm.USDC_MINT);
  if (owner) return owner;

  const account = await rpc.getAccount(destination);
  if (!account) throw new FomoError("destination token account does not exist");
  return solana.tokenAccountOwner(account, evm.USDC_MINT);
}

/**
 * Resolve a Fomo user (handle, `@handle`, or profile URL) or a Solana address to its wallets.
 *
 * Profile fields are not trusted. The Solana wallet comes from a transfer Fomo prepares for the user
 * (decoded only, never signed or sent). The EVM wallet comes from Relay swap history and is only
 * returned when the evidence names exactly one recipient.
 *
 * @param {import("../client").FomoClient} client
 * @param {string} input
 * @param {{ solanaRpcUrl?: string }} [options]
 * @returns {Promise<WalletResolution>}
 */
async function resolveWallets(client, input, { solanaRpcUrl } = {}) {
  const directWallet = solana.parseSolanaAddress(input);
  if (directWallet) {
    const resolution = await evm.resolveFromRelay(directWallet).catch(() => ({ address: null, reason: "relayUnavailable" }));
    return formatResult(null, directWallet, resolution);
  }

  const handle = parseHandle(input);
  const profile = await requestWithRetry(client, `/v2/users/userHandle/${encodeURIComponent(handle)}`);
  const user = profile?.responseObject;
  if (!user?.id) {
    throw new FomoError(`Unexpected user response: ${JSON.stringify(profile).slice(0, 200)}`);
  }

  const rpc = new solana.SolanaRpc(solanaRpcUrl || client.solanaRpcUrl || DEFAULT_SOLANA_RPC_URL);
  const swapsRequest = requestWithRetry(client, `/v2/users/${encodeURIComponent(user.id)}/swaps`).then(
    (swaps) => ({ swaps }),
    (error) => ({ error })
  );
  const [wallet, swapsResult] = await Promise.all([resolveSolanaWallet(client, user.id, rpc), swapsRequest]);

  let resolution;
  if (swapsResult.error) {
    if (isAuthFailure(swapsResult.error)) throw swapsResult.error;
    resolution = { address: null, reason: "fomoSwapsUnavailable" };
  } else {
    resolution = await evm
      .resolveFromSwaps(wallet, swapsResult.swaps)
      .catch(() => ({ address: null, reason: "relayUnavailable" }));
  }

  return formatResult(user, wallet, resolution);
}

function formatResult(user, solanaAddress, resolution) {
  return {
    userHandle: user?.userHandle ?? null,
    displayName: user?.displayName ?? null,
    userId: user?.id ?? null,
    solanaAddress,
    evmAddress: resolution.address,
    evmUnavailableReason: resolution.address ? null : evm.EVM_UNAVAILABLE[resolution.reason],
  };
}

module.exports = {
  DEFAULT_SOLANA_RPC_URL,
  resolveWallets,
  parseHandle,
  recipientAmountHint,
};
