# Changelog

## Unreleased

### Changed

- `users.addresses()` / `fomo addresses` no longer trust the profile's `address` and `evmAddress` fields, which often didn't match a user's real wallets. The Solana wallet now comes from decoding a transfer Fomo prepares for the user, and the EVM wallet from the user's Fomo swaps matched to Relay history (method adapted from [fomo-wallet-resolver](https://github.com/YvesxDev/fomo-wallet-resolver) for Fomo's current swap records and Relay's v2 rate limits). The signed-in account needs at least 2 USDC on Solana for handle lookups; nothing is sent.
- The result adds `evmAddress` and `evmUnavailableReason`. `robinhoodAddress` is kept as a deprecated alias of `evmAddress`, and is now `null` when no EVM wallet can be verified.

### Added

- `addresses` also accepts a `fomo.family` profile URL or a Solana address. A Solana address resolves its EVM wallet from Relay history, with no token needed.
- `solanaRpcUrl` client option / `SOLANA_RPC_URL` env var.
- Dependencies: `@noble/hashes` (keccak for EIP-55 checksums) and `@noble/curves` (ed25519 check for associated-token-account derivation).

## 0.3.0

Synced with what fomo.family sent on 2026-09-27.

### Added

- Tokens: `topHolders`, `friendHolders`, `allowList`, `transferable`.
- Feed: `token`, `tokenTheses`, `tradingActivity`.
- Users: `tokensSnapshotAt`, `swaps`, `spotlight`, `leaderboard`, `transfersWith`, `watchlist`.
- Leaderboard: `clans`.
- `users.me()` / `fomo me` (`GET /v2/users/current`).
- `config()`, plus an optional `tokenAddress` filter on `trades.list`.
- `request()` accepts absolute URLs and `auth: false`.
- Matching CLI commands for all of the above.

### Changed

- `status()` / `fomo ping` now call `status.fomo.family/prod`, which needs no token. The old `prod-api.fomo.family/prod` returns 401.
- Array query params are sent as `feedTypes=a&feedTypes=b` instead of `feedTypes[]=a`, matching the web app.
- `leaderboard.last24h()` no longer sends `limit=100` by default. The web app omits it.
- Request headers now include `app-language: en`, and `x-supported-chains` includes chain `5042`.

### Fixed

- Token refresh failed with Privy 401 "Missing access token". The refresh request now sends the current access token (expired is fine) with the refresh token.
- The client no longer refreshes on 401 permission errors. It only refreshes when the 401 is about the token itself, which avoids needlessly rotating (spending) the refresh token.

## 0.2.0

A restructure into a proper library plus CLI. **Breaking** for code that imported the 0.1 functions.

### Added

- Resource namespaces on the client: `tokens`, `users`, `feed`, `trades`, `leaderboard`.
- Automatic token refresh inside the client, with `refreshToken`, `tokenFile`, and `onTokenRefresh` options. Concurrent requests share one refresh, and a `401` triggers one refresh and retry.
- `FomoClient.fromEnv()`.
- Error classes `FomoError`, `FomoApiError` (with `status`, `path`, `body`), and `FomoAuthError`.
- `fomo` binary (`bin/fomo.js`), grouped `fomo help`, per-command help, `--compact`, and positional arguments for every command.
- `ping` command (`GET /prod`).
- Test suite (`npm test`), docs in `docs/`, and examples in `examples/`.

### Changed

- Entry point moved from `index.js` to `src/index.js`. The CLI moved from `app.js` to `bin/fomo.js`.
- Flat client methods became namespaced: `client.trending()` → `client.tokens.trending()`, `client.userByHandle()` → `client.users.byHandle()`, and so on. See [docs/api-reference.md](docs/api-reference.md).
- `users.addresses(handle)` takes a string instead of `{ userHandle }`.
- CLI renames: `usersFuzzySearch` → `searchUsers`, `filterTokensSearch` → `searchTokens`, `leaderboard24h` → `leaderboard`, `usersFollowing` → `following`, `usersReferralDetails` → `userReferralDetails`, `userTokensAggregatedSnapshotById` → `userTokensSnapshot`. The old names still work.
- Token file location is now set with `FOMO_TOKEN_FILE`. `FOMO_USE_TOKEN_FILE=true` still works and means `./tokens.json` (previously `src/tokens.json`).
- A token file's contents now take priority over `FOMO_ACCESS_TOKEN`/`FOMO_REFRESH_TOKEN`, since it holds the latest rotated pair.
- License field in `package.json` corrected to MIT to match `LICENSE`.

### Fixed

- Token refresh sent a hard-coded `Content-Length: 106` and `Host` header, which broke any refresh token of a different length.
- Refreshing from `FOMO_REFRESH_TOKEN` discarded the rotated refresh token, so the next run's refresh failed. It's now saved to the token file, and the CLI warns when there isn't one.
- A non-JWT access token crashed the CLI on startup with "Invalid access token expiration".
- Path segments (user ids, trade ids) are now URL-encoded.

### Removed

- Dependencies `axios`, `fs-extra`, and `jsonwebtoken`. Node's built-in `fetch` and `fs/promises` and a small JWT decoder cover what they did.
- The standalone `getXxx(client, ...)` endpoint functions and `tokenManager` export. Use the client methods and the `auth` export.
