/**
 * Turn "true"/"false" and numeric strings into booleans and numbers.
 * Long digit strings (ids, addresses) stay strings so they don't lose precision.
 * @param {string} value
 * @returns {string|number|boolean}
 */
function coerceValue(value) {
  if (/^(true|false)$/i.test(value)) {
    return value.toLowerCase() === "true";
  }

  if (/^-?\d{1,15}(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

/**
 * Parse CLI arguments into an options object. Accepts, in order of precedence:
 *   1. a single JSON object:        '{"limit":20}'
 *   2. key=value pairs:            limit=20 window=24h
 *   3. positional values mapped onto `positional` names, mixed freely with key=value pairs
 * @param {string[]} argv arguments after the command name
 * @param {string[]} [positional] names for positional values, in order
 * @returns {Object}
 */
function parseArgs(argv, positional = []) {
  const joined = argv.join(" ").trim();

  if (!joined) {
    return {};
  }

  if (joined.startsWith("{")) {
    let parsed;
    try {
      parsed = JSON.parse(joined);
    } catch (error) {
      throw new Error(`Invalid JSON arguments: ${error.message}`);
    }
    return parsed;
  }

  const result = {};
  const values = [];

  for (const arg of argv) {
    const match = /^([A-Za-z_][\w]*)=(.*)$/s.exec(arg);

    if (match) {
      result[match[1]] = parseValue(match[2]);
    } else {
      values.push(arg);
    }
  }

  const names = positional.filter((name) => !(name in result));

  if (values.length > names.length) {
    const expected = positional.length ? `<${positional.join("> <")}>` : "no positional arguments";
    throw new Error(`Too many arguments. Expected ${expected}, or key=value pairs, or a JSON object.`);
  }

  values.forEach((value, index) => {
    result[names[index]] = parseValue(value);
  });

  return result;
}

function parseValue(value) {
  if (/^[[{]/.test(value)) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return coerceValue(value);
}

module.exports = { parseArgs, coerceValue };
