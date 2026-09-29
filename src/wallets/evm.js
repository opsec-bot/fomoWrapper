const { keccak_256 } = require("@noble/hashes/sha3");

const RELAY_API_BASE = "https://api.relay.link";
const RELAY_SOLANA_CHAIN_ID = 792703809;
const FOMO_SOLANA_NETWORK_ID = 1399811149;
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SUPPORTED_EVM_NETWORKS = new Set([1, 56, 143, 4663, 5042, 8453]);
const RELAY_PAGE_SIZE = 50;
const MAX_RELAY_PAGES = 20;
const MAX_CANDIDATES = 10;
const MAX_RELAY_ATTEMPTS = 3;
// Fomo stamps a swap up to ~30s after Relay does, and Relay's input can differ from Fomo's
// `inAmount` by Fomo's fee (about 0.05%). Both tolerances leave plenty of margin.
const MATCH_WINDOW_SECONDS = 120;
const AMOUNT_TOLERANCE_BPS = 100n;

/** Why no EVM wallet was returned. */
const EVM_UNAVAILABLE = {
  noEligibleSwap: "No completed Solana-to-EVM Relay swap was found",
  noMatchingRelayRequest: "No matching successful Relay request was found",
  conflictingRecipients: "Relay evidence did not identify one EVM wallet",
  fomoSwapsUnavailable: "FOMO swap history could not be read",
  relayUnavailable: "Relay history could not be read",
  relayHistoryIncomplete: "Relay history was too large to verify completely",
};

/**
 * @typedef {{ address: string } | { address: null, reason: keyof EVM_UNAVAILABLE }} EvmResolution
 */

const resolved = (address) => ({ address });
const unavailable = (reason) => ({ address: null, reason });

/**
 * EIP-55 checksummed form of an EVM address, or null when it isn't one.
 * @param {string} address
 * @returns {string|null}
 */
function checksumAddress(address) {
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null;

  const lower = address.slice(2).toLowerCase();
  const hash = keccak_256(lower);
  let checksummed = "0x";
  for (let index = 0; index < lower.length; index += 1) {
    const nibble = index % 2 === 0 ? hash[index >> 1] >> 4 : hash[index >> 1] & 0x0f;
    checksummed += nibble >= 8 ? lower[index].toUpperCase() : lower[index];
  }
  return checksummed;
}

const sameAddress = (left, right) => String(left).toLowerCase() === String(right).toLowerCase();

function toBigInt(value) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

/**
 * Completed Solana-USDC-to-EVM Relay swaps in a FOMO swaps response, newest first.
 * @param {unknown} swaps
 */
function swapCandidates(swaps) {
  const candidates = [];

  const collect = (value) => {
    if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (value && typeof value === "object") {
      const candidate = swapCandidate(value);
      if (candidate) candidates.push(candidate);
      Object.values(value).forEach(collect);
    }
  };
  collect(swaps);

  candidates.sort((left, right) => (left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0));
  return candidates.filter(
    (candidate, index) => index === 0 || JSON.stringify(candidate) !== JSON.stringify(candidates[index - 1])
  );
}

function swapCandidate(swap) {
  if (
    swap.provider !== "RELAY" ||
    typeof swap.outTradeId !== "string" ||
    !swap.outTradeId ||
    toBigInt(swap.inNetworkId) !== BigInt(FOMO_SOLANA_NETWORK_ID) ||
    swap.inTokenAddress !== USDC_MINT
  ) {
    return null;
  }

  const outputNetworkId = toBigInt(swap.outNetworkId);
  if (outputNetworkId === null || !SUPPORTED_EVM_NETWORKS.has(Number(outputNetworkId))) return null;
  if (!checksumAddress(swap.outTokenAddress)) return null;

  // Fomo stopped returning `platformFeeAmount`; when present it's part of what Relay received.
  const inAmount = toBigInt(swap.inAmount);
  const feeAmount = swap.platformFeeAmount === undefined ? 0n : toBigInt(swap.platformFeeAmount);
  const timestamp = Date.parse(swap.createdAt);
  if (inAmount === null || feeAmount === null || typeof swap.createdAt !== "string" || Number.isNaN(timestamp)) {
    return null;
  }

  return {
    createdAt: swap.createdAt,
    timestamp: Math.floor(timestamp / 1000),
    inputAmount: (inAmount + feeAmount).toString(),
    outputNetworkId: Number(outputNetworkId),
    outputToken: swap.outTokenAddress,
  };
}

/**
 * The EVM recipient of a successful FOMO Relay request from `wallet`, when every part of the
 * request (sender, recipient, currencies, and the destination balance credit) agrees.
 */
function verifiedTransfer(wallet, request) {
  if (request?.status !== "success" || request.user !== wallet || request.referrer !== "fomo") return null;

  const recipient = checksumAddress(request.recipient);
  const metadata = request.data?.metadata;
  if (!recipient || metadata?.sender !== wallet || !metadata.recipient || !sameAddress(metadata.recipient, recipient)) {
    return null;
  }

  const input = metadata.currencyIn;
  const output = metadata.currencyOut;
  const outputToken = checksumAddress(output?.currency?.address);
  if (
    !outputToken ||
    input?.currency?.chainId !== RELAY_SOLANA_CHAIN_ID ||
    input.currency.address !== USDC_MINT ||
    !SUPPORTED_EVM_NETWORKS.has(output.currency.chainId) ||
    toBigInt(input.amount) === null
  ) {
    return null;
  }

  const credited = (request.data.outTxs || []).some(
    (tx) =>
      tx.chainId === output.currency.chainId &&
      tx.status === "success" &&
      (tx.stateChanges || []).some(
        (change) =>
          sameAddress(change.address, recipient) &&
          sameAddress(change.change?.data?.tokenAddress, output.currency.address) &&
          /^\d+$/.test(String(change.change?.balanceDiff)) &&
          BigInt(change.change.balanceDiff) > 0n
      )
  );

  return credited
    ? { recipient, inputAmount: input.amount, outputNetworkId: output.currency.chainId, outputToken }
    : null;
}

/** Resolved when exactly one recipient is found, conflicting when several, otherwise `emptyResult`. */
function uniqueRecipient(recipients, emptyResult) {
  const unique = new Set(recipients);
  if (unique.size === 1) return resolved([...unique][0]);
  if (unique.size > 1) return unavailable("conflictingRecipients");
  return emptyResult;
}

function amountsMatch(relayAmount, fomoAmount) {
  const [relay, fomo] = [BigInt(relayAmount), BigInt(fomoAmount)];
  const difference = relay > fomo ? relay - fomo : fomo - relay;
  return difference * 10_000n <= fomo * AMOUNT_TOLERANCE_BPS;
}

/**
 * The Relay request(s) behind one Fomo swap: same chains and tokens, close in time and amount.
 * @returns {EvmResolution|null} null when no request matches
 */
function matchCandidate(wallet, candidate, requests) {
  const recipients = requests
    .filter((request) => Math.abs(Date.parse(request.createdAt) / 1000 - candidate.timestamp) <= MATCH_WINDOW_SECONDS)
    .map((request) => verifiedTransfer(wallet, request))
    .filter(
      (transfer) =>
        transfer &&
        amountsMatch(transfer.inputAmount, candidate.inputAmount) &&
        transfer.outputNetworkId === candidate.outputNetworkId &&
        sameAddress(transfer.outputToken, candidate.outputToken)
    )
    .map((transfer) => transfer.recipient);

  return uniqueRecipient(recipients, null);
}

function matchWalletRequests(wallet, requests) {
  const recipients = requests.map((request) => verifiedTransfer(wallet, request)?.recipient).filter(Boolean);
  return uniqueRecipient(recipients, unavailable("noMatchingRelayRequest"));
}

async function relayPage(url) {
  for (let attempt = 0; ; attempt += 1) {
    const retry = attempt + 1 < MAX_RELAY_ATTEMPTS;
    let response;
    try {
      response = await fetch(url, { headers: { accept: "application/json" } });
    } catch (error) {
      if (retry) {
        await sleep(250 * 2 ** attempt);
        continue;
      }
      throw new Error(`Relay request failed: ${error.message}`, { cause: error });
    }

    if ((response.status >= 500 || response.status === 429) && retry) {
      await sleep((response.status === 429 ? 1000 : 250) * 2 ** attempt);
      continue;
    }
    if (!response.ok) throw new Error(`Relay returned HTTP ${response.status}`);

    const body = await response.json();
    return { requests: body.requests || [], continuation: body.continuation || null };
  }
}

// Relay 403s a `referrer` filter without an API key, so FOMO requests are picked out by
// `verifiedTransfer` instead. `/requests/v3` needs an API key; v2 is sunset on 2026-11-24.
// v2 is also heavily rate limited, so each lookup reads one history listing instead of
// querying per swap.

/**
 * Successful Relay requests sent from a Solana wallet, newest first, one page at a time.
 * @param {string} wallet
 */
async function* relayHistory(wallet) {
  const url = new URL("/requests/v2", RELAY_API_BASE);
  url.search = new URLSearchParams({
    user: wallet,
    originChainId: String(RELAY_SOLANA_CHAIN_ID),
    status: "success",
    limit: String(RELAY_PAGE_SIZE),
    sortBy: "createdAt",
    sortDirection: "desc",
  }).toString();

  let continuation = null;
  for (let page = 0; page < MAX_RELAY_PAGES; page += 1) {
    const pageUrl = new URL(url);
    if (continuation) pageUrl.searchParams.append("continuation", continuation);

    const result = await relayPage(pageUrl);
    yield { requests: result.requests, last: !result.continuation };
    if (!result.continuation) return;
    continuation = result.continuation;
  }
}

/**
 * Resolve the EVM wallet behind a Solana wallet by tying its Fomo swaps to Relay requests.
 * The newest swap with a match decides; nothing is guessed from profile or swap-record fields,
 * which don't name on-chain wallets.
 * @param {string} wallet Solana wallet
 * @param {unknown} swaps response of `GET /v2/users/{userId}/swaps`
 * @returns {Promise<EvmResolution>}
 */
async function resolveFromSwaps(wallet, swaps) {
  const candidates = swapCandidates(swaps).slice(0, MAX_CANDIDATES);
  if (!candidates.length) return unavailable("noEligibleSwap");

  const oldest = Math.min(...candidates.map((candidate) => candidate.timestamp)) - MATCH_WINDOW_SECONDS;
  const requests = [];
  let complete = false;

  for await (const page of relayHistory(wallet)) {
    requests.push(...page.requests);
    const lastSeen = Date.parse(page.requests.at(-1)?.createdAt) / 1000;
    if (page.last || lastSeen < oldest) {
      complete = true;
      break;
    }
  }

  for (const candidate of candidates) {
    const match = matchCandidate(wallet, candidate, requests);
    if (match) return match;
  }
  return unavailable(complete ? "noMatchingRelayRequest" : "relayHistoryIncomplete");
}

/**
 * Resolve the EVM wallet behind a Solana wallet from Relay history alone. Needs no FOMO auth,
 * but is strict: any FOMO bridge to a second address (e.g. a send to a friend) makes it conflict.
 * @param {string} wallet Solana wallet
 * @returns {Promise<EvmResolution>}
 */
async function resolveFromRelay(wallet) {
  const requests = [];

  for await (const page of relayHistory(wallet)) {
    requests.push(...page.requests);
    const match = matchWalletRequests(wallet, requests);
    if (match.reason === "conflictingRecipients" || page.last) return match;
  }
  return unavailable("relayHistoryIncomplete");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  EVM_UNAVAILABLE,
  FOMO_SOLANA_NETWORK_ID,
  USDC_MINT,
  checksumAddress,
  swapCandidates,
  matchCandidate,
  matchWalletRequests,
  resolveFromSwaps,
  resolveFromRelay,
};
