# CLI

```bash
fomo <command> [args...]
```

Run `npm link` once to install the `fomo` command, or use `node bin/fomo.js` / `npm run fomo --` in its place.

`fomo help` lists every command. `fomo help <command>` (or `fomo <command> --help`) shows its usage and an example.

## Passing arguments

Any of these three forms works:

```bash
# 1. positional, in the order shown by `fomo help <command>`
fomo tokenWarnings 0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf 8453

# 2. key=value, in any order (you can mix these with positionals)
fomo bars symbol=0xacfe...21bf:8453 from=1773547200 to=1773550800 resolution=1

# 3. a single JSON object, for arrays and nested values
fomo tokenPrices '{"items":[{"address":"0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf","networkId":8453}]}'
```

`true`/`false` become booleans. Numbers up to 15 digits become numbers. Anything longer stays a string, so ids and addresses keep full precision.

On Windows `cmd.exe`, write the JSON with escaped double quotes: `"{\"limit\":20}"`.

## Commands

| Command | Arguments | Library method |
|---|---|---|
| **Account** | | |
| `status` | none | `getAuthInfo()`. Local only, no network call. |
| `ping` | none | `status()` |
| **Tokens** | | |
| `trending` | none | `tokens.trending()` |
| `trendingFriends` | none | `tokens.trendingFriends()` |
| `verifiedTokens` | none | `tokens.verified()` |
| `tokenDetails` | `<tokenId>` | `tokens.details()` |
| `bars` | `<symbol> <from> <to> <resolution>` | `tokens.bars()` |
| `tokenPrices` | JSON `items` | `tokens.prices()` |
| `filterTokens` | JSON `tokenIds` | `tokens.filter()` |
| `searchTokens` | `<phrase>` | `tokens.search()` |
| `tokenWarnings` | `<address> <networkId>` | `tokens.warnings()` |
| **Feed** | | |
| `feed` | `[limit]` | `feed.list()` |
| `feedFriends` | `[limit]` | `feed.friends()` |
| **Trades** | | |
| `trades` | `<userId> <orderBy>` | `trades.list()` |
| `tradeComments` | `<tradeId>` | `trades.comments()` |
| `tradesTopCombined` | `[limit] [window]` | `trades.topCombined()` |
| **Users** | | |
| `addresses` | `<userHandle>` | `users.addresses()` |
| `userByHandle` | `<userHandle>` | `users.byHandle()` |
| `user` | `<userId>` | `users.get()` |
| `searchUsers` | `<searchTerm>` | `users.search()` |
| `userBalances` | `<userId>` | `users.balances()` |
| `userActivity` | `<userId> [includeUsdcHistory]` | `users.activity()` |
| `userActiveTrade` | `<userId> <tokenAddress> <networkId>` | `users.activeTrade()` |
| `userReferralDetails` | `<userId>` | `users.referralDetails()` |
| `userTokensSnapshot` | `<userId> <snapshotId>` | `users.tokensSnapshot()` |
| `following` | none | `users.following()` |
| **Leaderboard** | | |
| `leaderboard` | `[limit]` | `leaderboard.last24h()` |
| **Advanced** | | |
| `sendTransaction` | JSON `payload` | `sendTransaction()`. Can move funds. |

Command names from 0.1 still work as aliases: `usersFuzzySearch`, `filterTokensSearch`, `leaderboard24h`, `usersFollowing`, `usersReferralDetails`, `userTokensAggregatedSnapshotById`, `userAddresses`, `wallets`.

## Output and exit codes

Results print to stdout as indented JSON. Add `--compact` for one line per result. Errors print to stderr, and the process exits with code `1`.

```bash
fomo trending --compact > trending.json
fomo addresses @somehandle | jq -r .solanaAddress
```

## Configuration

The CLI reads `.env` from the current directory, then from the package root. Variables already set in your shell take priority. See [Authentication](authentication.md).
