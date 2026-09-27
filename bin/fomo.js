#!/usr/bin/env node
const path = require("path");

// Values already in the environment win; then ./.env, then the .env next to this package.
require("dotenv").config({
  path: [path.resolve(".env"), path.join(__dirname, "..", ".env")],
  quiet: true,
});

const { run, formatError } = require("../src/cli");

run(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(formatError(error));
    process.exitCode = 1;
  }
);
