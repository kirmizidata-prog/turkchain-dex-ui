import type { Address } from "viem";

export type TokenInfo = {
  chainId: number;
  address: Address;
  symbol: string;
  decimals: number;
  name?: string;
};

export async function loadTokenList(): Promise<TokenInfo[]> {
  const res = await fetch("/tokenlist.json", { cache: "no-store" });
  if (!res.ok) throw new Error("tokenlist_fetch_failed");
  const json = await res.json();
  const tokens = (json?.tokens ?? []) as any[];
  return tokens
    .filter((t) => Number(t.chainId) === 1919 && typeof t.address === "string")
    .map((t) => ({
      chainId: 1919,
      address: t.address as Address,
      symbol: String(t.symbol ?? "").toUpperCase(),
      decimals: Number(t.decimals ?? 18),
      name: t.name ? String(t.name) : undefined
    }));
}
