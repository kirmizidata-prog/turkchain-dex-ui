import { type TokenInfo, loadTokenList } from "./tokenlist";
import type { Address } from "viem";

type TokenList = {
  name: string;
  timestamp?: string;
  version?: { major: number; minor: number; patch: number };
  tokens: TokenInfo[];
};

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function normalizeAddress(a: string): Address {
  return a as Address;
}

function validateToken(t: any): TokenInfo | null {
  if (!isObj(t)) return null;
  if (t.chainId !== 1919) return null;
  if (typeof t.address !== "string") return null;
  if (typeof t.symbol !== "string") return null;
  if (typeof t.decimals !== "number") return null;
  if (typeof t.name !== "string") return null;

  const out: TokenInfo = {
    chainId: 1919,
    address: normalizeAddress(t.address),
    symbol: t.symbol,
    decimals: t.decimals,
    name: (typeof t.name === "string" && t.name.length > 0) ? t.name : t.symbol
  };

  if (typeof t.logoURI === "string") out.logoURI = t.logoURI;
  return out;
}

async function fetchList(url: string): Promise<TokenList> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("tokenlist_fetch_failed: " + r.status);
  const j = await r.json();
  if (!isObj(j) || !Array.isArray((j as any).tokens)) throw new Error("tokenlist_invalid_json");
  const tokens = (j as any).tokens.map(validateToken).filter(Boolean) as TokenInfo[];
  return { name: String((j as any).name || "TokenList"), tokens };
}

export async function loadMergedTokenList(): Promise<TokenInfo[]> { // fallback
  const officialUrl = process.env.NEXT_PUBLIC_TOKENLIST_OFFICIAL_URL || "";
  const communityUrl = process.env.NEXT_PUBLIC_TOKENLIST_COMMUNITY_URL || "";

  const lists: TokenInfo[][] = [];

  try {
    if (officialUrl) lists.push((await fetchList(officialUrl)).tokens);
  } catch {
    // ignore
  }

  try {
    if (communityUrl) lists.push((await fetchList(communityUrl)).tokens);
  } catch {
    // ignore
  }

  // if nothing loaded, fallback to local tokenlist.json
  if (lists.length === 0) {
    const local = await loadTokenList();
    return local;
  }

  // merge: official wins by order (first list has priority)
  const map = new Map<string, TokenInfo>();
  for (const list of lists) {
    for (const t of list) {
      const k = t.address.toLowerCase();
      if (!map.has(k)) map.set(k, t);
    }
  }

  return Array.from(map.values());
}

