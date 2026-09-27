# fomowrapper

A Node.js client and command-line tool for the [Fomo](https://fomo.family) API (`prod-api.fomo.family`).

- **One client, grouped by resource:** `fomo.tokens`, `fomo.users`, `fomo.feed`, `fomo.trades`, `fomo.leaderboard`
- **Automatic token refresh:** give it a Privy refresh token and it renews expired access tokens, saving the rotated pair to disk
- **Gets past Cloudflare:** requests go through [impit](https://github.com/apify/impit) with Chrome TLS impersonation, so the API doesn't block you as a bot
- **Typed errors:** `FomoApiError` carries the HTTP status and response body
- **A CLI covering every endpoint:** `fomo trending`, `fomo addresses @handle`, `fomo bars ...`

> This is an unofficial wrapper around a private API. Endpoints can change without notice.

## Install

Requires Node.js 20 or newer.

```bash
# from a clone of this repo
npm install
cp .env.example .env     # then paste your tokens in (next section)
```

To get the `fomo` command on your PATH, run `npm link`. Otherwise use `npm run fomo -- <command>` or `node bin/fomo.js <command>`.

## Getting your tokens

Fomo signs you in through [Privy](https://privy.io), which stores your session in the browser's localStorage:

| localStorage key | What it is | Goes in |
|---|---|---|
| `privy:token` | Access token, a JWT that expires quickly | `FOMO_ACCESS_TOKEN` |
| `privy:refresh_token` | Refresh token, used to get new access tokens | `FOMO_REFRESH_TOKEN` |

### Quickest way: the DevTools console

1. Sign in at [fomo.family](https://fomo.family) in Chrome, Edge, or Firefox on a desktop.
2. Press **F12** (or **Ctrl+Shift+I**, **Cmd+Option+I** on macOS) and open the **Console** tab.
3. Paste this and press Enter:

   ```js
   copy(`FOMO_ACCESS_TOKEN=${JSON.parse(localStorage["privy:token"])}
   FOMO_REFRESH_TOKEN=${JSON.parse(localStorage["privy:refresh_token"])}
   FOMO_TOKEN_FILE=tokens.json`)
   ```

4. Your clipboard now holds three lines ready for `.env`. Paste them in, replacing the empty entries.

If the browser refuses to paste into the console, type `allow pasting` first and try again.

### Manual way: the Application tab

1. In DevTools, open **Application** (Chrome/Edge) or **Storage** (Firefox).
2. Go to **Local Storage → https://fomo.family**.
3. Copy the values of `privy:token` and `privy:refresh_token` into `.env`. **Drop the surrounding double quotes.** They are stored as JSON strings.

### Check it worked

```bash
fomo status      # "expired": false and "canRefresh": true means you're set
fomo trending
```

### Keep them safe

- These tokens give **full access to your Fomo account**, including trading. Never commit them, paste them into chats, or share screenshots of them. `.env` and `tokens.json` are already gitignored.
- Keep `FOMO_TOKEN_FILE=tokens.json` set. Privy replaces the refresh token on every refresh, and the old one stops working. The token file stores the new pair so the next run can still refresh.
- If you log out of fomo.family, the tokens may be invalidated. Repeat the steps above to get fresh ones.

See [docs/authentication.md](docs/authentication.md) for how refresh works in detail.

## Quick start

### As a library

```js
const { FomoClient } = require("fomowrapper");

const fomo = new FomoClient({
  accessToken: process.env.FOMO_ACCESS_TOKEN,
  refreshToken: process.env.FOMO_REFRESH_TOKEN, // optional
  tokenFile: "tokens.json",                     // optional, saves refreshed tokens
});

// or, reading FOMO_* variables for you:
// const fomo = FomoClient.fromEnv();

const trending = await fomo.tokens.trending();
const wallets = await fomo.users.addresses("@somehandle");
const candles = await fomo.tokens.bars({
  symbol: "0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf:8453",
  from: 1773547200,
  to: 1773550800,
  resolution: "1",
});
```

### From the terminal

```bash
fomo status                          # is my token still valid?
fomo trending
fomo addresses @somehandle
fomo searchUsers res
fomo feed 20
fomo tokenWarnings 0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf 8453
fomo help bars                       # usage for one command
```

Output is pretty-printed JSON, so you can pipe it into `jq`.

## Documentation

| Guide | Covers |
|---|---|
| [Authentication](docs/authentication.md) | Where to find your tokens, refresh behaviour, token files |
| [API reference](docs/api-reference.md) | Every client method, its arguments, and the endpoint it calls |
| [CLI](docs/cli.md) | Command list, the three ways to pass arguments, scripting tips |
| [Examples](examples/) | Runnable scripts |

## Project layout

```
fomoWrapper/
├── bin/
│   └── fomo.js              CLI entry point (loads .env, runs src/cli)
├── src/
│   ├── index.js             public exports
│   ├── client.js            FomoClient: transport, auth lifecycle, resources
│   ├── auth.js              token parsing, Privy refresh, token file I/O
│   ├── errors.js            FomoError, FomoApiError, FomoAuthError
│   ├── constants.js         base URLs, headers, defaults
│   ├── resources/           one file per API area
│   │   ├── tokens.js
│   │   ├── users.js
│   │   ├── feed.js
│   │   ├── trades.js
│   │   ├── leaderboard.js
│   │   └── validate.js
│   └── cli/
│       ├── index.js         help output and command runner
│       ├── commands.js      command registry
│       └── args.js          argument parser
├── test/                    node:test suites, no network access
├── docs/
├── examples/
└── .env.example
```

## Error handling

```js
const { FomoApiError, FomoAuthError } = require("fomowrapper");

try {
  await fomo.users.byHandle("does-not-exist");
} catch (error) {
  if (error instanceof FomoApiError && error.status === 404) {
    // unknown handle
  } else if (error instanceof FomoAuthError) {
    // token expired and could not be refreshed
  } else {
    throw error;
  }
}
```

Missing required arguments throw a `TypeError` before any request goes out.

## Development

```bash
npm test          # runs test/*.test.js with node:test
```

Tests use a mock transport and never touch the network.

See [CHANGELOG.md](CHANGELOG.md) for the version history.

## License

[MIT](LICENSE)
