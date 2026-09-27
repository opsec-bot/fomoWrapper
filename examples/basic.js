// Run with: node examples/basic.js @somehandle
require("dotenv").config({ quiet: true });

const { FomoClient, FomoApiError } = require("..");

async function main() {
  const fomo = FomoClient.fromEnv();
  const handle = process.argv[2];

  const leaders = await fomo.leaderboard.last24h(5);
  console.log("Top 5 traders (24h):", JSON.stringify(leaders, null, 2));

  if (handle) {
    try {
      console.log(await fomo.users.addresses(handle));
    } catch (error) {
      if (error instanceof FomoApiError && error.status === 404) {
        console.log(`No user with handle ${handle}`);
      } else {
        throw error;
      }
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
