# API reference

Every method returns a promise that resolves to the parsed JSON response. Response shapes come from Fomo's private API and aren't documented here. Run the matching [CLI command](cli.md) to see a real one.

Conventions:

- **Token id:** `<address>:<networkId>`, e.g. `0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf:8453`
- **Network ids:** `1` Ethereum, `56` BNB Chain, `8453` Base, `1399811149` Solana, plus `143`, `4663`, and `5042`, which the web app also requests
- **Timestamps:** unix seconds

## Contents

- [FomoClient](#fomoclient)
- [tokens](#tokens)
- [users](#users)
- [feed](#feed)
- [trades](#trades)
- [leaderboard](#leaderboard)
- [Other methods](#other-methods)
- [Errors](#errors)

## FomoClient

```js
const { FomoClient } = require("fomowrapper");
const fomo = new FomoClient(options);
```

| Option | Type | Default | |
|---|---|---|---|
| `accessToken` | `string` | none | Raw JWT, `Bearer <jwt>`, or `Authorization: Bearer <jwt>`. `token` also works. |
| `refreshToken` | `string` | none | Enables automatic refresh. |
| `tokenFile` | `string` | none | Where to read and save the token pair. See [Authentication](authentication.md). |
| `onTokenRefresh` | `(tokens) => void` | none | Called after each refresh with `{ access_token, refresh_token }`. |
| `baseUrl` | `string` | `https://prod-api.fomo.family` | |
| `timeoutMs` | `number` | `30000` | Per-request timeout. |
| `http` | `{ fetch(url, init) }` | impit (Chrome) | Custom transport, e.g. for tests. |

`FomoClient.fromEnv(env = process.env, overrides = {})` builds a client from `FOMO_ACCESS_TOKEN`, `FOMO_REFRESH_TOKEN`, `FOMO_TOKEN_FILE`, and `FOMO_BASE_URL`.

## tokens

| Method | Endpoint |
|---|---|
| `tokens.trending()` | `POST /proxy/trendingTokens` |
| `tokens.trendingFriends()` | `POST /proxy/trendingTokens/friends` |
| `tokens.verified()` | `GET /proxy/verifiedTokens` |
| `tokens.details(tokenId)` | `POST /proxy/tokenDetails` |
| `tokens.bars({ symbol, from, to, resolution })` | `POST /proxy/getBars` |
| `tokens.prices(items)` | `POST /proxy/getTokenPrices` |
| `tokens.filter(tokenIds)` | `POST /proxy/filterTokens` |
| `tokens.search(phrase)` | `POST /proxy/filterTokensSearch` |
| `tokens.warnings({ address, networkId })` | `POST /proxy/tokenWarnings` |
| `tokens.topHolders(tokens)` | `GET /hodlers/top` |
| `tokens.friendHolders(tokens, limit = 50)` | `POST /hodlers/friends` |
| `tokens.allowList()` | `GET /tokenAllowList/detailed` |
| `tokens.transferable()` | `GET /transfers/v2/supportedTokens` |

**`bars`** returns OHLCV candles. `symbol` is a token id and `resolution` is a candle size in minutes (`"1"`, `"5"`, `"60"`) or `"1D"`.

```js
await fomo.tokens.bars({ symbol: "0xacfe...21bf:8453", from: 1773547200, to: 1773550800, resolution: "1" });
```

The web app now loads its charts from a separate service (`mobula-api.fomo.family`) rather than `/proxy/getBars`. `bars` still points at the old endpoint, which may be retired.

**`topHolders`** and **`friendHolders`** take `[{ address, networkId }]`, so you can ask about several tokens in one call.

**`prices`** takes `[{ address, networkId, timestamp? }]`. Leave out `timestamp` for the current price.

**`filter`** takes an array of token ids and returns their metadata.

## users

| Method | Endpoint |
|---|---|
| `users.me()` | `GET /v2/users/current` |
| `users.get(userId)` | `GET /v2/users/{userId}` |
| `users.byHandle(handle)` | `GET /v2/users/userHandle/{handle}` |
| `users.addresses(handleOrWallet, { solanaRpcUrl? })` | see below |
| `users.search(searchTerm)` | `GET /v2/users/fuzzy-search` |
| `users.balances(userId)` | `GET /v2/users/{userId}/balances` |
| `users.activity({ userId, includeUsdcHistory? })` | `GET /v2/users/{userId}/activity` |
| `users.activeTrade({ userId, tokenAddress, networkId })` | `GET /v2/users/{userId}/activeTrade` |
| `users.referralDetails(userId)` | `GET /v2/users/{userId}/referrerDetails` |
| `users.tokensSnapshot({ userId, snapshotId })` | `GET /v2/userTokens/aggregatedSnapshotById` |
| `users.tokensSnapshotAt({ userId, timestamp? })` | `GET /v2/userTokens/aggregatedSnapshot` |
| `users.swaps(userId)` | `GET /v2/users/{userId}/swaps` |
| `users.spotlight(userId)` | `GET /v2/users/{userId}/spotlight` |
| `users.leaderboard(userId)` | `GET /v2/users/{userId}/leaderboard` |
| `users.transfersWith(userId)` | `GET /v2/transfers/with/{userId}` |
| `users.watchlist()` | `GET /watchlist` |
| `users.following()` | `GET /v2/users/current/followingIds` |

`users.referralDetails` only works for your own id. For anyone else, the API returns 401 "you can only view your own referrer details". Get your id from `users.me()`.

Handles are matched exactly, and a leading `@` is stripped. An unknown handle throws `FomoApiError` with status `404`. Use `users.search` to find a handle from part of a name.

User endpoints wrap their result in `{ success, message, responseObject, statusCode }`. The profile is in `responseObject`.

**`addresses`** resolves a handle, `@handle`, `fomo.family` profile URL, or Solana address to its wallets:

```js
await fomo.users.addresses("@somehandle");
// {
//   userHandle: "somehandle",
//   displayName: "Some Handle",
//   userId: "ab1aba9c-...",
//   solanaAddress: "3cmts6...",
//   evmAddress: "0x22CDAC...",        // EIP-55 checksummed, or null
//   evmUnavailableReason: null,       // why evmAddress is null
//   robinhoodAddress: "0x22CDAC..."   // deprecated alias of evmAddress
// }
```

It does not read the profile's `address` / `evmAddress` fields, which don't reliably match the wallets a user actually receives at and trades from. It follows the method of [fomo-wallet-resolver](https://github.com/YvesxDev/fomo-wallet-resolver):

- **Solana:** asks Fomo to prepare a 2 USDC transfer to the user (`POST /transfers/v2/send`), decodes the unsigned transaction, and takes the recipient's wallet from the associated-token-account instruction. When the recipient already has a USDC account, it reads that account's owner from Solana RPC (`SOLANA_RPC_URL`, default mainnet-beta). Nothing is signed or sent. Fomo only prepares transfers the signed-in account could afford, so **that account needs at least 2 USDC on Solana**, or the call throws.
- **EVM:** ties the user's completed Solana-to-EVM Relay swaps (`GET /v2/users/{userId}/swaps`) to Relay's public request history for the Solana wallet, matching chains and tokens, time within 2 minutes, and amount within 1% (Fomo's clock and fee make both differ slightly). The newest matched swap decides. `evmAddress` is `null` when there's no match, or when a swap matches two recipients, and `evmUnavailableReason` says why. The swap records' own `address` / `recipient` fields aren't used: live, they didn't name wallets with any on-chain activity.

Given a Solana address, it skips Fomo entirely and resolves the EVM wallet from Relay history alone. That needs no token and no balance, but it is strict: any Fomo bridge from that wallet to a second address (a send to a friend, say) makes it return `null`.

Users who have only bridged *into* Solana have no Solana-to-EVM swap to check, so they get `evmAddress: null`.

Relay's `/requests/v2` is deprecated, rate-limited, and shuts down on 2026-11-24. Its successor, `/requests/v3`, needs a Relay API key. Each lookup reads that history once, usually a single request.

## feed

| Method | Endpoint |
|---|---|
| `feed.list({ limit?, feedTypes? })` | `GET /feed` |
| `feed.friends({ limit?, feedTypes? })` | `GET /feed/friends` |
| `feed.token({ tokenAddress, networkId, excludeThesis?, threshold? })` | `GET /feed/token` |
| `feed.tokenTheses({ tokenAddress, networkId, threshold?, lastId? })` | `GET /feed/token/thesis` |
| `feed.tradingActivity({ limit?, threshold? })` | `GET /feed/tradingActivity` |

`limit` defaults to 50. `feedTypes` defaults to every type the web app requests. The full list is in `constants.DEFAULT_FEED_TYPES`:

`single_user_sell`, `single_user_transfer_out`, `user_trade_profit_milestone`, `large_buy`, `large_sell`, `large_transfer_in`, `large_transfer_out`, `manual`, `multi_user_buy`, `multi_user_sell`, `new_token_listing`, `price_since_listing`, `user_with_smart_following`, `thesis_created`

```js
await fomo.feed.list({ limit: 20, feedTypes: ["large_buy", "new_token_listing"] });
```

## trades

| Method | Endpoint |
|---|---|
| `trades.list({ userId, orderBy, tokenAddress? })` | `GET /trades` |
| `trades.comments(tradeId)` | `GET /trades/{tradeId}/comments` |
| `trades.topCombined({ limit?, window? })` | `GET /trades/top-combined` |

`orderBy` is a field name, for example `closedAt`. `topCombined` defaults to `limit: 5, window: "all"`.

## leaderboard

| Method | Endpoint |
|---|---|
| `leaderboard.last24h(limit?)` | `GET /v2/leaderboard/24h` |
| `leaderboard.clans({ window = "24h", limit = 50 })` | `GET /v2/clans/leaderboard` |

## Other methods

| Method | |
|---|---|
| `status()` | `GET https://status.fomo.family/prod`: Fomo's service status banner. Needs no token. |
| `config()` | `GET /config`: app configuration for your account |
| `request(path, { method, params, body, headers, auth })` | Raw request for endpoints the wrapper doesn't cover. Handles auth, refresh, and errors. `path` can be an absolute URL. `auth: false` sends no token. |
| `sendTransaction(payload)` | `POST /` with a signed transaction payload. **This can move funds.** Only send payloads you built and understand. |
| `getAuthInfo()`, `ensureToken()`, `refresh()`, `setToken(token)` | See [Authentication](authentication.md). |

```js
// An endpoint the wrapper doesn't cover:
await fomo.request("/v2/some/new/endpoint", { params: { limit: 10 } });
```

In `params`, array values are sent as `key=a&key=b` (as the web app does), and `null`/`undefined` values are dropped.

## Errors

| Class | Thrown when | Extra fields |
|---|---|---|
| `FomoApiError` | The API returns a non-2xx status | `status`, `method`, `path`, `body` |
| `FomoAuthError` | No usable token, or a refresh fails | none |
| `FomoError` | Base class. Also thrown directly for network failures and timeouts. | `cause` |
| `TypeError` | A required argument is missing, before any request is sent | none |

A non-JSON error body (for example a Cloudflare challenge page) shows up as `body` being a string.
