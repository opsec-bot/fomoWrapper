# Rate limits and account restrictions

What we measured running this wrapper against fomo with one account, September and October 2026. fomo doesn't publish limits, so treat these as one data point, not a contract.

## Short version

- Use the wrapper for lookups, not for crawling. An account used as a 24/7 crawler was restricted in about a day.
- A `429` means slow down. A `403` with a valid token means the account is restricted. Stop.
- One account, one process. Several processes sharing a token pair multiply your request rate without you noticing.

## Read endpoints

Mixed reads (trending, trading activity, leaderboard, feed), ramped up in 90 second steps:

| Requests per minute | Result |
|---|---|
| 21 | clean |
| 30 | first `429` (`feed.tradingActivity`) |

We settled on 15 per minute with backoff on any `429`. That stayed free of `429`s, but see the restriction below.

## Wallet lookups have their own quota

`users.addresses()` and `users.solanaWallet()` ask fomo to prepare a transfer for the user. That endpoint has a separate, much smaller quota. It returned `429` after about 25 lookups in 12 minutes and kept refusing for more than 10 minutes. Keep these to a few per hour, and back off for an hour or more on a `429`.

## Account restriction

An account crawling around the clock was restricted after about 26 hours of continuous use at 15 requests per minute (roughly 24,000 calls), about 2 days after its first use. Earlier it also had one accidental hour at up to about 120 requests per minute from several processes sharing its tokens. We don't know which of these tripped it.

What a restriction looks like:

- Every authenticated call returns `403` with `{"success":false,"message":"Forbidden","statusCode":403}`. The wrapper throws `FomoApiError` with `status === 403` and the message `Forbidden`.
- Token refresh through Privy keeps working, so a refresh loop can look healthy while every API call fails.
- It is the account, not the IP. The same token gets the same `403` from a different network, and calls without a token still get `unauthorized`.
- The app shows "Account restricted. This account is restricted from using the app. Please contact support if you believe this is an error."

We saw no warning beforehand that we know of.

## Recommendations

- Treat a `403` `Forbidden` on a call that normally works as fatal: stop all requests from that account instead of retrying.
- Count every call your code makes, across processes, and alert when the rate is higher than you expect.
- Don't run unattended crawlers. If you need history at scale, use on-chain data instead.
