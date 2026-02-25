import type { Address } from "viem";

export type PairInfo = {
  pair: Address;
  token0: Address;
  token1: Address;
};

export async function loadPairs(): Promise<PairInfo[]> {
  const res = await fetch("/pairs.json", { cache: "no-store" });
  if (!res.ok) throw new Error("pairs_fetch_failed");
  const json = await res.json();
  const pairs = (json?.pairs ?? []) as any[];

  return pairs
    .filter((p) => typeof p.pair === "string" && typeof p.token0 === "string" && typeof p.token1 === "string")
    .map((p) => ({
      pair: p.pair as Address,
      token0: p.token0 as Address,
      token1: p.token1 as Address
    }));
}
