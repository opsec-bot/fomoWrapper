// Keeps a session alive across runs: the refreshed token pair is written to tokens.json.
// First run: set FOMO_REFRESH_TOKEN in .env. Later runs read tokens.json.
require("dotenv").config({ quiet: true });

const { FomoClient } = require("..");

const fomo = FomoClient.fromEnv(process.env, {
  tokenFile: "tokens.json",
  onTokenRefresh: () => console.error("token refreshed and saved to tokens.json"),
});

fomo.tokens
  .trending()
  .then((data) => console.log(JSON.stringify(data, null, 2)))
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
