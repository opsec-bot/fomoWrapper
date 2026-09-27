const { FomoClient } = require("../client");
const { FomoApiError } = require("../errors");
const { parseArgs } = require("./args");
const { COMMANDS, findCommand } = require("./commands");

// Commands that work without credentials.
const NO_AUTH_COMMANDS = new Set(["status", "ping"]);

function usage(name, command) {
  const args = (command.args || []).map((arg) => `<${arg}>`).join(" ");
  return `fomo ${name}${args ? ` ${args}` : ""}`;
}

function printHelp() {
  const lines = [
    "fomo - command line client for the Fomo API",
    "",
    "Usage:",
    "  fomo <command> [args...]",
    "  fomo <command> key=value ...",
    `  fomo <command> '{"key":"value"}'`,
    "  fomo help <command>",
    "",
    "Options:",
    "  --compact   print JSON on one line",
    "",
  ];

  const groups = {};
  for (const [name, command] of Object.entries(COMMANDS)) {
    (groups[command.group] ||= []).push([name, command]);
  }

  const width = Math.max(...Object.keys(COMMANDS).map((name) => name.length)) + 2;

  for (const [group, commands] of Object.entries(groups)) {
    lines.push(`${group}:`);
    commands.forEach(([name, command]) => lines.push(`  ${name.padEnd(width)}${command.summary}`));
    lines.push("");
  }

  lines.push("Auth is read from .env: FOMO_ACCESS_TOKEN, FOMO_REFRESH_TOKEN, FOMO_TOKEN_FILE.");
  lines.push("See docs/authentication.md.");
  console.log(lines.join("\n"));
}

function printCommandHelp(name, command) {
  const lines = [`${command.summary}`, "", "Usage:", `  ${usage(name, command)}`];

  if (command.example) {
    lines.push("", "Example:", `  fomo ${name} ${command.example}`);
  }

  console.log(lines.join("\n"));
}

/**
 * Run the CLI.
 * @param {string[]} argv arguments after `node <script>`
 * @param {{ env?: NodeJS.ProcessEnv }} [options]
 * @returns {Promise<number>} exit code
 */
async function run(argv, { env = process.env } = {}) {
  const compact = argv.includes("--compact");
  const [name, ...rest] = argv.filter((arg) => arg !== "--compact");

  if (!name || name === "help" || name === "--help" || name === "-h") {
    const target = rest[0] && findCommand(rest[0]);
    target ? printCommandHelp(...target) : printHelp();
    return 0;
  }

  const found = findCommand(name);

  if (!found) {
    console.error(`Unknown command: ${name}\nRun "fomo help" to list commands.`);
    return 1;
  }

  const [canonical, command] = found;

  if (rest.includes("--help") || rest.includes("-h")) {
    printCommandHelp(canonical, command);
    return 0;
  }

  let args;
  try {
    args = parseArgs(rest, command.args);
  } catch (error) {
    console.error(`${error.message}\nUsage: ${usage(canonical, command)}`);
    return 1;
  }

  const client = FomoClient.fromEnv(env, {
    onTokenRefresh: () => {
      if (!client.tokenFile) {
        console.error(
          "warning: access token refreshed, but the rotated refresh token was not saved. " +
            "Set FOMO_TOKEN_FILE so the next run can refresh again."
        );
      }
    },
  });

  if (!NO_AUTH_COMMANDS.has(canonical)) {
    await client.ensureToken();

    if (!client.accessToken) {
      console.error("Not authenticated. Set FOMO_ACCESS_TOKEN or FOMO_REFRESH_TOKEN in .env (see .env.example).");
      return 1;
    }
  }

  try {
    const data = await command.run(client, args);
    console.log(JSON.stringify(data, null, compact ? 0 : 2));
    return 0;
  } catch (error) {
    if (error instanceof TypeError && /^Missing required/.test(error.message)) {
      console.error(`${error.message}\nUsage: ${usage(canonical, command)}`);
      return 1;
    }
    throw error;
  }
}

/**
 * Format an error for the terminal.
 * @param {Error} error
 * @returns {string}
 */
function formatError(error) {
  if (error instanceof FomoApiError && error.body && typeof error.body === "object") {
    return `${error.message}\n${JSON.stringify(error.body, null, 2)}`;
  }
  return error.message;
}

module.exports = { run, formatError };
