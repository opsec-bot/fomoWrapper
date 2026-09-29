const crypto = require("crypto");
const { ed25519 } = require("@noble/curves/ed25519");

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const ADDRESS_LOOKUP_TABLE_PROGRAM = "AddressLookupTab1e1111111111111111111111111";
const LOOKUP_TABLE_META_SIZE = 56;

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function base58Encode(bytes) {
  let value = 0n;
  for (const byte of bytes) {
    value = value * 256n + BigInt(byte);
  }

  let encoded = "";
  while (value > 0n) {
    encoded = BASE58_ALPHABET[Number(value % 58n)] + encoded;
    value /= 58n;
  }

  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = `1${encoded}`;
  }
  return encoded;
}

/**
 * @param {string} text
 * @returns {Uint8Array|null} null when `text` is not valid base58
 */
function base58Decode(text) {
  let value = 0n;
  for (const char of text) {
    const digit = BASE58_ALPHABET.indexOf(char);
    if (digit < 0) return null;
    value = value * 58n + BigInt(digit);
  }

  const bytes = [];
  while (value > 0n) {
    bytes.unshift(Number(value % 256n));
    value /= 256n;
  }
  for (const char of text) {
    if (char !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

/**
 * The input as a Solana address, or null when it isn't one (32 bytes of base58).
 * @param {unknown} input
 * @returns {string|null}
 */
function parseSolanaAddress(input) {
  const text = String(input ?? "").trim();
  if (text.length < 32 || text.length > 44) return null;
  const bytes = base58Decode(text);
  return bytes?.length === 32 ? text : null;
}

/**
 * Solana's `find_program_address`: the first off-curve hash, trying bumps 255 down to 0.
 * @param {Uint8Array[]} seeds
 * @param {string} programId
 * @returns {string}
 */
function findProgramAddress(seeds, programId) {
  const program = base58Decode(programId);

  for (let bump = 255; bump >= 0; bump -= 1) {
    const hash = crypto
      .createHash("sha256")
      .update(Buffer.concat([...seeds, Uint8Array.of(bump), program, Buffer.from("ProgramDerivedAddress")]))
      .digest();
    if (!isOnCurve(hash)) {
      return base58Encode(hash);
    }
  }
  throw new Error("could not find a program address");
}

function isOnCurve(bytes) {
  try {
    ed25519.ExtendedPoint.fromHex(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * The associated token account for a wallet and mint.
 * @param {string} owner
 * @param {string} mint
 * @param {string} [tokenProgram]
 */
function associatedTokenAddress(owner, mint, tokenProgram = TOKEN_PROGRAM) {
  return findProgramAddress(
    [base58Decode(owner), base58Decode(tokenProgram), base58Decode(mint)],
    ASSOCIATED_TOKEN_PROGRAM
  );
}

/**
 * Sequential reader over a serialized transaction.
 */
class Reader {
  constructor(bytes) {
    this.bytes = bytes;
    this.offset = 0;
  }

  take(length) {
    if (this.offset + length > this.bytes.length) {
      throw new Error("transaction data ended unexpectedly");
    }
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  u8() {
    return this.take(1)[0];
  }

  /** Solana's compact-u16 length prefix. */
  shortVec() {
    let value = 0;
    for (let shift = 0; shift < 21; shift += 7) {
      const byte = this.u8();
      value |= (byte & 0x7f) << shift;
      if (!(byte & 0x80)) return value;
    }
    throw new Error("invalid compact-u16 length");
  }

  bytesVec() {
    return this.take(this.shortVec());
  }

  key() {
    return base58Encode(this.take(32));
  }
}

/**
 * @typedef {Object} DecodedTransaction
 * @property {string[]} staticKeys
 * @property {{ programIdIndex: number, accounts: number[], data: Uint8Array }[]} instructions
 * @property {{ accountKey: string, writableIndexes: number[], readonlyIndexes: number[] }[]} lookups
 */

/**
 * Decode a wire-format (legacy or v0) Solana transaction.
 * @param {Uint8Array} bytes
 * @returns {DecodedTransaction}
 */
function decodeTransaction(bytes) {
  const reader = new Reader(bytes);
  reader.take(reader.shortVec() * 64);

  const versioned = (reader.bytes[reader.offset] & 0x80) !== 0;
  if (versioned) {
    const version = reader.u8() & 0x7f;
    if (version !== 0) throw new Error(`unsupported transaction version ${version}`);
  }

  reader.take(3);
  const staticKeys = Array.from({ length: reader.shortVec() }, () => reader.key());
  reader.take(32);

  const instructions = Array.from({ length: reader.shortVec() }, () => ({
    programIdIndex: reader.u8(),
    accounts: Array.from(reader.bytesVec()),
    data: Uint8Array.from(reader.bytesVec()),
  }));

  const lookups = versioned
    ? Array.from({ length: reader.shortVec() }, () => ({
        accountKey: reader.key(),
        writableIndexes: Array.from(reader.bytesVec()),
        readonlyIndexes: Array.from(reader.bytesVec()),
      }))
    : [];

  return { staticKeys, instructions, lookups };
}

/**
 * Minimal Solana JSON-RPC reader.
 */
class SolanaRpc {
  /** @param {string} url */
  constructor(url) {
    this.url = url;
  }

  /**
   * @param {string} address
   * @returns {Promise<{ owner: string, data: Buffer }|null>}
   */
  async getAccount(address) {
    let response;
    try {
      response = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountInfo",
          params: [address, { encoding: "base64", commitment: "confirmed" }],
        }),
      });
    } catch (error) {
      throw new Error(`Solana RPC request failed: ${error.message}`, { cause: error });
    }

    if (!response.ok) {
      throw new Error(`Solana RPC returned HTTP ${response.status}`);
    }
    const body = await response.json();
    if (body.error) {
      throw new Error(`Solana RPC error: ${JSON.stringify(body.error)}`);
    }

    const account = body.result?.value;
    if (account === undefined) throw new Error("Solana RPC response did not contain result.value");
    if (account === null) return null;
    return { owner: account.owner, data: Buffer.from(account.data[0], "base64") };
  }
}

/**
 * Every account key the transaction references: static keys, then lookup-table writable, then readonly.
 * @param {DecodedTransaction} transaction
 * @param {SolanaRpc} rpc
 * @returns {Promise<string[]>}
 */
async function resolveAccountKeys(transaction, rpc) {
  const writable = [];
  const readonly = [];

  for (const lookup of transaction.lookups) {
    const account = await rpc.getAccount(lookup.accountKey);
    if (!account) throw new Error(`address lookup table ${lookup.accountKey} is missing`);
    if (account.owner !== ADDRESS_LOOKUP_TABLE_PROGRAM) {
      throw new Error(`address lookup table ${lookup.accountKey} has unexpected owner ${account.owner}`);
    }

    const addresses = [];
    for (let offset = LOOKUP_TABLE_META_SIZE; offset + 32 <= account.data.length; offset += 32) {
      addresses.push(base58Encode(account.data.subarray(offset, offset + 32)));
    }
    const pick = (index) => {
      if (index >= addresses.length) throw new Error("lookup-table index is out of range");
      return addresses[index];
    };
    writable.push(...lookup.writableIndexes.map(pick));
    readonly.push(...lookup.readonlyIndexes.map(pick));
  }

  return [...transaction.staticKeys, ...writable, ...readonly];
}

function keyAt(keys, index) {
  if (index >= keys.length) throw new Error(`transaction account index ${index} is out of range`);
  return keys[index];
}

function readU64(data, start) {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength).readBigUInt64LE(start);
}

/**
 * The token account receiving `mint` in a prepared transfer.
 * When the transfer also pays a fee, `amountHint` (the recipient's share) picks the right one.
 * @param {DecodedTransaction} transaction
 * @param {string[]} keys
 * @param {string} mint
 * @param {bigint|null} amountHint
 * @returns {{ destination: string, amount: bigint }}
 */
function findTransferDestination(transaction, keys, mint, amountHint) {
  const checked = [];
  const unchecked = [];

  for (const instruction of transaction.instructions) {
    const program = keyAt(keys, instruction.programIdIndex);
    if (program !== TOKEN_PROGRAM && program !== TOKEN_2022_PROGRAM) continue;

    const { data, accounts } = instruction;
    // TransferChecked (12), or Token-2022 TransferCheckedWithFee (26, 1).
    const isChecked = data[0] === 12 || (program === TOKEN_2022_PROGRAM && data[0] === 26 && data[1] === 1);

    if (isChecked) {
      if (accounts.length < 4) throw new Error("checked SPL transfer instruction has too few accounts");
      let amount;
      if (data[0] === 12 && data.length === 10) amount = readU64(data, 1);
      else if (data[0] === 26 && data.length === 19) amount = readU64(data, 2);
      else throw new Error("checked SPL transfer data has an invalid layout");

      if (keyAt(keys, accounts[1]) === mint) {
        checked.push({ destination: keyAt(keys, accounts[2]), amount });
      }
    } else if (data[0] === 3) {
      if (accounts.length < 3) throw new Error("unchecked SPL transfer instruction has too few accounts");
      if (data.length !== 9) throw new Error("SPL transfer data has an invalid layout");
      unchecked.push({ destination: keyAt(keys, accounts[1]), amount: readU64(data, 1) });
    }
  }

  const [kind, transfers] = checked.length ? ["checked", checked] : ["unchecked", unchecked];
  const matches = amountHint === null ? transfers : transfers.filter((transfer) => transfer.amount === amountHint);

  if (matches.length === 1) return matches[0];
  if (!matches.length) throw new Error(`no ${kind} SPL transfer destination found`);
  throw new Error(`prepared transaction contains multiple ${kind} SPL transfer destinations`);
}

function assertTokenProgram(program) {
  if (program !== TOKEN_PROGRAM && program !== TOKEN_2022_PROGRAM) {
    throw new Error("account is not owned by an SPL token program");
  }
}

/**
 * The wallet owning `destination`, when the transaction creates it as an associated token account.
 * @param {DecodedTransaction} transaction
 * @param {string[]} keys
 * @param {string} destination
 * @param {string} mint
 * @returns {string|null}
 */
function ataOwnerFromTransaction(transaction, keys, destination, mint) {
  const owners = [];

  for (const instruction of transaction.instructions) {
    if (keyAt(keys, instruction.programIdIndex) !== ASSOCIATED_TOKEN_PROGRAM || instruction.accounts.length < 6) {
      continue;
    }
    const [, ata, owner, ataMint, , tokenProgram] = instruction.accounts.map((index) => keyAt(keys, index));
    assertTokenProgram(tokenProgram);

    if (ata === destination && ataMint === mint && ata === associatedTokenAddress(owner, mint, tokenProgram)) {
      owners.push(owner);
    }
  }

  if (owners.length > 1) throw new Error("prepared transaction contains multiple matching ATA owners");
  return owners[0] || null;
}

/**
 * The wallet owning an existing SPL token account.
 * @param {{ owner: string, data: Buffer }} account
 * @param {string} mint
 * @returns {string}
 */
function tokenAccountOwner(account, mint) {
  assertTokenProgram(account.owner);
  if (account.data.length < 64) throw new Error("destination token account data is too short");
  if (base58Encode(account.data.subarray(0, 32)) !== mint) {
    throw new Error("prepared transaction destination uses an unexpected mint");
  }
  return base58Encode(account.data.subarray(32, 64));
}

module.exports = {
  TOKEN_PROGRAM,
  TOKEN_2022_PROGRAM,
  ASSOCIATED_TOKEN_PROGRAM,
  base58Encode,
  base58Decode,
  parseSolanaAddress,
  associatedTokenAddress,
  decodeTransaction,
  SolanaRpc,
  resolveAccountKeys,
  findTransferDestination,
  ataOwnerFromTransaction,
  tokenAccountOwner,
};
