import fs from "node:fs";
import path from "node:path";
import { createPublicClient, http, decodeFunctionResult, encodeFunctionData, zeroAddress } from "viem";

const CHAIN_ID = 1919;
const RPC_URL = "https://rpc.turkchain1919.com";
const FACTORY = "0xCb8A04a9Cd9a0Cbdf7E4f9f23caA4d206e98aef7";
const MULTICALL = "0x03a37156c217F4a7eB5Dcd1B668436d45B29aF24";

const factoryAbi = [
  {
    type: "function",
    name: "allPairsLength",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "allPairs",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ type: "address" }]
  }
];

const pairAbi = [
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }
];

const multicallAbi = [
  {
    type: "function",
    name: "aggregate3",
    stateMutability: "view",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" }
        ]
      }
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" }
        ]
      }
    ]
  }
];

const client = createPublicClient({ transport: http(RPC_URL) });

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function multicallToken01(pairs) {
  const calls = [];
  for (const p of pairs) {
    calls.push({
      target: p,
      allowFailure: true,
      callData: encodeFunctionData({ abi: pairAbi, functionName: "token0", args: [] })
    });
    calls.push({
      target: p,
      allowFailure: true,
      callData: encodeFunctionData({ abi: pairAbi, functionName: "token1", args: [] })
    });
  }

  const res = await client.readContract({
    address: MULTICALL,
    abi: multicallAbi,
    functionName: "aggregate3",
    args: [calls]
  });

  const rows = res;
  const mapped = [];

  for (let i = 0; i < pairs.length; i++) {
    const r0 = rows[i * 2 + 0];
    const r1 = rows[i * 2 + 1];

    const token0 = r0.success
      ? decodeFunctionResult({ abi: pairAbi, functionName: "token0", data: r0.returnData })
      : zeroAddress;
    const token1 = r1.success
      ? decodeFunctionResult({ abi: pairAbi, functionName: "token1", data: r1.returnData })
      : zeroAddress;

    mapped.push({
      pair: pairs[i],
      token0: Array.isArray(token0) ? token0[0] : token0,
      token1: Array.isArray(token1) ? token1[0] : token1
    });
  }

  return mapped.filter((x) => x.token0 !== zeroAddress && x.token1 !== zeroAddress);
}

async function main() {
  const total = await client.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: "allPairsLength",
    args: []
  });

  const totalNum = Number(total);
  const pairs = [];
  for (let i = 0; i < totalNum; i++) {
    const p = await client.readContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "allPairs",
      args: [BigInt(i)]
    });
    pairs.push(p);
  }

  const outPairs = [];
  for (const batch of chunk(pairs, 200)) {
    const rows = await multicallToken01(batch);
    outPairs.push(...rows);
  }

  const json = {
    chainId: CHAIN_ID,
    factory: FACTORY,
    updatedAt: new Date().toISOString(),
    pairs: outPairs
  };

  const outPath = path.resolve(process.cwd(), "apps/web/public/pairs.json");
  fs.writeFileSync(outPath, JSON.stringify(json, null, 2));
  console.log("written", outPath, "pairs", outPairs.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
