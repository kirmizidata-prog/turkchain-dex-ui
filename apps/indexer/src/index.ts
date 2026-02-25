import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import fs from "node:fs";
import path from "node:path";

function normAddr(a: any): string {
  if (typeof a !== "string") return "";
  const x = a.trim();
  if (!x.startsWith("0x") || x.length !== 42) return "";
  return x.toLowerCase();
}

const CHAIN_ID = 1919;

const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) {
  console.error("missing_env_RPC_URL");
  process.exit(1);
}

const FACTORY = process.env.FACTORY as Address | undefined;
if (!FACTORY || !FACTORY.startsWith("0x") || FACTORY.length !== 42) {
  console.error("missing_or_invalid_env_FACTORY");
  process.exit(1);
}

const OUT_FILE =
  process.env.OUT_FILE || "/root/turkchain-dex-ui/apps/web/public/pairs.json";
const STATE_FILE =
  process.env.STATE_FILE || "/root/turkchain-dex-ui/apps/indexer/state.json";

// optional tuning
const START_BLOCK = BigInt(process.env.START_BLOCK || "1");
const REORG_BUFFER = BigInt(process.env.REORG_BUFFER || "64");

// chunk is adaptive; default 20000; can shrink on RPC limits
const DEFAULT_CHUNK = BigInt(process.env.CHUNK || "20000");
const MIN_CHUNK = 1000n;

type PairRow = { pair: Address; token0: Address; token1: Address };

type StateV2 = {
  nextBlock: string; // next block to start scanning from (exclusive of already scanned range)
  chunk: string; // last known good chunk size
  updatedAt: string; // iso timestamp
};

type StateCompat = {
  lastScannedBlock?: string; // legacy key used before hardening
  nextBlock?: string;
  chunk?: string;
  updatedAt?: string;
};

function atomicWriteFile(filePath: string, data: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = filePath + ".tmp." + process.pid + "." + Date.now();
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
}

function readState(): StateV2 {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const j = JSON.parse(raw) as StateCompat;

    // prefer new key
    if (typeof j.nextBlock === "string") {
      return {
        nextBlock: j.nextBlock,
        chunk: typeof j.chunk === "string" ? j.chunk : DEFAULT_CHUNK.toString(),
        updatedAt: typeof j.updatedAt === "string" ? j.updatedAt : new Date(0).toISOString()
      };
    }

    // legacy fallback
    if (typeof j.lastScannedBlock === "string") {
      return {
        nextBlock: j.lastScannedBlock,
        chunk: typeof j.chunk === "string" ? j.chunk : DEFAULT_CHUNK.toString(),
        updatedAt: typeof j.updatedAt === "string" ? j.updatedAt : new Date(0).toISOString()
      };
    }
  } catch {}

  return {
    nextBlock: START_BLOCK.toString(),
    chunk: DEFAULT_CHUNK.toString(),
    updatedAt: new Date(0).toISOString()
  };
}

function writeState(nextBlock: bigint, chunk: bigint) {
  const st: StateV2 = {
    nextBlock: nextBlock.toString(),
    chunk: chunk.toString(),
    updatedAt: new Date().toISOString()
  };
  atomicWriteFile(STATE_FILE, JSON.stringify(st, null, 2));
}

function writePairs(pairs: PairRow[], updatedAtIso: string) {
  const payload = {
    chainId: CHAIN_ID,
    factory: FACTORY,
    updatedAt: updatedAtIso,
    pairs
  };
  atomicWriteFile(OUT_FILE, JSON.stringify(payload, null, 2));
}

async function main() {
  const client = createPublicClient({ transport: http(RPC_URL) });

  const latest = await client.getBlockNumber();

  const st = readState();
  let cursor = BigInt(st.nextBlock);
  let chunk = BigInt(st.chunk || DEFAULT_CHUNK.toString());

  if (chunk < MIN_CHUNK) chunk = MIN_CHUNK;

  if (cursor < START_BLOCK) cursor = START_BLOCK;
  if (cursor > latest) cursor = latest;

  // reorg tolerance: always rewind a bit
  let fromBlock = cursor - REORG_BUFFER;
  if (fromBlock < START_BLOCK) fromBlock = START_BLOCK;

  const event = parseAbiItem(
    "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)"
  );

  // load existing pairs.json (append mode)
  let existing: PairRow[] = [];
  try {
    const raw = fs.readFileSync(OUT_FILE, "utf8");
    const j = JSON.parse(raw);
    if (Array.isArray(j.pairs)) existing = j.pairs as PairRow[];
  } catch {}

  const seen = new Set(existing.map((p: any) => normAddr(p.pair)));
  const out: PairRow[] = [...existing];

  console.log(`latest_block=${latest.toString()}`);
  console.log(`state_nextBlock=${cursor.toString()}`);
  console.log(`reorg_buffer=${REORG_BUFFER.toString()}`);
  console.log(`from_block=${fromBlock.toString()}`);
  console.log("chunk=" + chunk.toString());

  let scanCursor = fromBlock;

  while (scanCursor <= latest) {
    let logs: any[] = [];
    let toBlock = scanCursor + chunk - 1n <= latest ? scanCursor + chunk - 1n : latest;

    while (true) {
      try {
        toBlock = scanCursor + chunk - 1n <= latest ? scanCursor + chunk - 1n : latest;
        logs = await client.getLogs({
          address: FACTORY,
          event,
          fromBlock: scanCursor,
          toBlock
        });
        break;
      } catch (err: any) {
        const msg = String(err?.shortMessage || err?.message || err);
        const m = msg.toLowerCase();
        const looksLikeParam =
          m.includes("invalid") || m.includes("missing") || msg.includes("-32602");
        const looksLikeRange =
          m.includes("block range") ||
          m.includes("range") ||
          m.includes("too large") ||
          m.includes("limit");

        if ((looksLikeParam || looksLikeRange) && chunk > MIN_CHUNK) {
          const next = chunk / 2n;
          chunk = next < MIN_CHUNK ? MIN_CHUNK : next;
          console.log("getLogs_retry_shrink_chunk=" + chunk.toString());

          // persist chunk adaptation immediately
          writeState(cursor, chunk);
          continue;
        }

        throw err;
      }
    }

    for (const lg of logs) {
      const args: any = lg.args;
      const pair = args.pair as Address;
      const token0 = args.token0 as Address;
      const token1 = args.token1 as Address;

      const key = normAddr(pair);
      if (!key) continue;
      if (seen.has(key)) continue;

      seen.add(key);
      out.push({ pair, token0, token1 });
    }

    console.log(
      `scanned=${scanCursor.toString()}..${toBlock.toString()} logs=${logs.length} pairs_total=${out.length}`
    );

    // advance scan cursor
    scanCursor = toBlock + 1n;

    // state cursor should move forward to next block AFTER this processed range,
    // but never move backwards from the original state cursor (cursor)
    // because we rewound for reorg buffer.
    const nextBlock = scanCursor > cursor ? scanCursor : cursor;

    // persist progress atomically
    writeState(nextBlock, chunk);
  }

  writePairs(out, new Date().toISOString());
  console.log(`done pairs_total=${out.length} out=${OUT_FILE}`);
}

main().catch((e: any) => {
  console.error("fatal", e?.shortMessage || e?.message || e);
  process.exit(1);
});
