# Fomo Wrapper App

Minimal JavaScript wrapper for `https://prod-api.fomo.family` with a runnable CLI app.

## Simple setup with `.env`

Create a `.env` file in the project root:

```bash
FOMO_ACCESS_TOKEN=your_access_token_here
```

`FOMO_ACCESS_TOKEN` accepts raw JWT, `Bearer <token>`, or full `Authorization: Bearer <token>`.

## Run the app

```bash
npm run app:help
```

Then run commands normally:

```bash
node app.js status
node app.js trending
```

## Auth options

Use one of these:

1. Direct token

```bash
FOMO_ACCESS_TOKEN=your_access_token_here
```

1. Token file + refresh (`src/tokens.json`)

```bash
FOMO_USE_TOKEN_FILE=true
```

## Command format

```bash
node app.js <command> [jsonArgs]
```

## Examples

```bash
node app.js status
node app.js trending
node app.js feed "{\"limit\":20}"
node app.js tokenDetails "{\"tokenId\":\"0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf:8453\"}"
node app.js bars "{\"from\":1773547200,\"to\":1773550800,\"resolution\":\"1\",\"symbol\":\"0xacfe6019ed1a7dc6f7b508c02d1b04ec88cc21bf:8453\"}"
node app.js usersFuzzySearch "{\"searchTerm\":\"res\"}"
```

Run `node app.js help` for all supported commands.
