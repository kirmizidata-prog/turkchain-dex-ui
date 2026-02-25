import { decodeFunctionResult, encodeFunctionData, type Abi, type Address, type Hex } from "viem";
import { publicClient } from "@/lib/evm";
import { contracts } from "@/lib/turkchain";

// Multicall2 compatible: tryAggregate(bool requireSuccess, (address target, bytes callData)[] calls)
const multicall2Abi = [
  {
    type: "function",
    name: "tryAggregate",
    stateMutability: "view",
    inputs: [
      { name: "requireSuccess", type: "bool" },
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
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
] as const;

export type MultiCallItem = {
  target: Address;
  allowFailure?: boolean; // kept for compatibility, tryAggregate already returns per-call success
  abi: Abi;
  functionName: string;
  args?: any[];
};

export async function multicallRead(items: MultiCallItem[]) {
  if (!items.length) return [];

  const calls = items.map((it) => {
    const callData = encodeFunctionData({
      abi: it.abi,
      functionName: it.functionName as any,
      args: it.args ?? []
    });
    return {
      target: it.target,
      callData
    };
  });

  const res = await publicClient.readContract({
    address: contracts.multicall2,
    abi: multicall2Abi,
    functionName: "tryAggregate",
    args: [false, calls]
  });

  const rows = res as readonly { success: boolean; returnData: Hex }[];

  return rows.map((row, idx) => {
    if (!row.success) return { ok: false as const, value: null as any };

    const it = items[idx];
    try {
      const value = decodeFunctionResult({
        abi: it.abi,
        functionName: it.functionName as any,
        data: row.returnData
      });
      return { ok: true as const, value };
    } catch {
      return { ok: false as const, value: null as any };
    }
  });
}
