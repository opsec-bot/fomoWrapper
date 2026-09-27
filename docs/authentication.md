# Authentication

Fomo signs users in with [Privy](https://privy.io). Every API request needs a Privy **access token**, a short-lived JWT. A **refresh token** is optional and lets the client get a new access token when the old one expires.

## Getting your tokens

Both tokens live in fomo.family's localStorage: `privy:token` is the access token and `privy:refresh_token` is the refresh token. The README walks through [copying them with one console command](../README.md#getting-your-tokens).

Alternatively, you can copy the access token from any `prod-api.fomo.family` request in the DevTools **Network** tab, using its `authorization` header. The client accepts the raw JWT, `Bearer <jwt>`, or the whole `authorization: Bearer <jwt>` line.

Both tokens give full access to your account. Keep them out of git. `.env` and `tokens.json` are already in `.gitignore`.

## Configuration

| Variable | Constructor option | Purpose |
|---|---|---|
| `FOMO_ACCESS_TOKEN` | `accessToken` | Access token used for requests |
| `FOMO_REFRESH_TOKEN` | `refreshToken` | Renews the access token when it's within 60s of expiring |
| `FOMO_TOKEN_FILE` | `tokenFile` | JSON file that stores the latest token pair |
| `FOMO_BASE_URL` | `baseUrl` | API host override |

`FomoClient.fromEnv()` and the CLI read the variables. The CLI also loads `.env` from the current directory, then from the package root.

## Choosing a setup

### Access token only

```env
FOMO_ACCESS_TOKEN=eyJhbGciOi...
```

The simplest setup. Once the token expires, requests throw `FomoAuthError` and you paste in a new one. `fomo status` shows how long the current token has left.

### Access token, refresh token, and a token file (recommended)

```env
FOMO_ACCESS_TOKEN=eyJhbGciOi...
FOMO_REFRESH_TOKEN=abc123...
FOMO_TOKEN_FILE=tokens.json
```

Privy **rotates refresh tokens**: each refresh spends the old one and returns a new one. With a token file, the client writes the new pair after every refresh and reads it back on the next start, so refreshes keep working across runs.

Once the file exists, its tokens take priority over the environment variables, because the file always holds the newest pair. To start over, delete the file.

### Refresh token without a token file

This works for one process, but the rotated refresh token lives only in memory. The next run starts with the spent token from `.env` and the refresh fails. The CLI prints a warning when this happens. In library code, handle it with `onTokenRefresh`:

```js
const fomo = new FomoClient({
  refreshToken: savedRefreshToken,
  onTokenRefresh: ({ access_token, refresh_token }) => saveSomewhere(refresh_token),
});
```

## How the client handles tokens

Before each request, the client:

1. loads the token file on the first request, if one is configured,
2. refreshes if there is a refresh token and the access token is missing or expires within 60 seconds,
3. throws `FomoAuthError` if the access token is expired and there's no way to refresh it.

If the API answers `401` anyway (a revoked token, for example), the client refreshes once and retries the request.

Concurrent requests share a single refresh call.

## Manual control

```js
fomo.getAuthInfo();   // { authenticated, canRefresh, expiresAt, expiresInSeconds, expired }
await fomo.refresh(); // force a refresh
fomo.setToken(jwt);   // swap the access token

const { auth } = require("fomowrapper");
auth.getExpiration(jwt);        // unix seconds, or null
auth.isExpired(jwt, 60);        // expired or expiring within 60s?
await auth.refreshTokens(rt);   // { access_token, refresh_token }
```
