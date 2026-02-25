"use client";

import * as React from "react";
import WalletButton from "@/components/WalletButton";
import { contracts } from "@/lib/turkchain";
import { useWallet } from "@/lib/useWallet";
import { multicallRead } from "@/lib/multicall";
import { erc20Abi, pairAbi } from "@/lib/abis";
import { formatUnits, isAddress, type Address } from "viem";

type PairRow = {
  pair: Address;
  token0: Address;
  token1: Address;
};

type PairsJson = {
  chainId: number;
  factory: string;
  updatedAt: string;
  pairs: Array<{ pair: string; token0: string; token1: string }>;
};

type Row = {
  pair: Address;
  token0: Address;
  token1: Address;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  reserve0: bigint;
  reserve1: bigint;
  lpBalance: bigint;
};

function shortAddr(a: string) {
  if (!a) return "-";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function safeSymFromAddr(a: Address) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function safeNum(x: any, fallback: number) {
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return fallback;
  return n;
}

export default function PositionsPage() {
  const { address } = useWallet();

  const [limit, setLimit] = React.useState<number>(500);
  const [status, setStatus] = React.useState<string>("");
  const [pairsMeta, setPairsMeta] = React.useState<{ updatedAt: string; count: number } | null>(null);
  const [rows, setRows] = React.useState<Row[]>([]);

  const load = React.useCallback(async () => {
    setStatus("");
    setRows([]);

    if (!address || !isAddress(address)) {
      setStatus("wallet_not_connected");
      return;
    }

    let pj: PairsJson;
    try {
      const res = await fetch("/pairs.json", { cache: "no-store" });
      if (!res.ok) {
        setStatus("pairs_json_fetch_failed");
        return;
      }
      pj = (await res.json()) as PairsJson;
    } catch {
      setStatus("pairs_json_parse_failed");
      return;
    }

    const rawPairs = Array.isArray(pj.pairs) ? pj.pairs : [];
    const pairs: PairRow[] = rawPairs
      .slice(0, Math.max(0, Number(limit) || 0))
      .map((p) => ({
        pair: p.pair as Address,
        token0: p.token0 as Address,
        token1: p.token1 as Address
      }))
      .filter((p) => isAddress(p.pair) && isAddress(p.token0) && isAddress(p.token1));

    setPairsMeta({ updatedAt: String(pj.updatedAt || ""), count: pairs.length });

    if (pairs.length === 0) {
      setStatus("no_pairs_in_pairs_json");
      return;
    }

    // unique tokens for symbol/decimals calls
    const tokenSet = new Map<string, Address>();
    for (const p of pairs) {
      tokenSet.set(p.token0.toLowerCase(), p.token0);
      tokenSet.set(p.token1.toLowerCase(), p.token1);
    }
    const tokens = Array.from(tokenSet.values());

    try {
      setStatus("loading_multicall");

      // 1) symbols + decimals for tokens
      const symCalls = tokens.map((t) => ({
        target: t,
        abi: erc20Abi as any,
        functionName: "symbol",
        args: []
      }));

      const decCalls = tokens.map((t) => ({
        target: t,
        abi: erc20Abi as any,
        functionName: "decimals",
        args: []
      }));

      const [symRes, decRes] = await Promise.all([multicallRead(symCalls), multicallRead(decCalls)]);

      const symMap = new Map<string, string>();
      const decMap = new Map<string, number>();

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];

        const sr = symRes[i];
        const sv = sr && sr.ok ? (sr.value as any) : null;
        const sym = typeof sv === "string" && sv.length > 0 ? sv : safeSymFromAddr(t);
        symMap.set(t.toLowerCase(), sym);

        const dr = decRes[i];
        const dv = dr && dr.ok ? (dr.value as any) : null;
        const dec = safeNum(dv, 18);
        decMap.set(t.toLowerCase(), dec);
      }

      // 2) per pair: LP balance + reserves
      const pairCalls = pairs.flatMap((p) => [
        {
          target: p.pair,
          abi: pairAbi as any,
          functionName: "balanceOf",
          args: [address as Address]
        },
        {
          target: p.pair,
          abi: pairAbi as any,
          functionName: "getReserves",
          args: []
        }
      ]);

      const pairRes = await multicallRead(pairCalls);

      const out: Row[] = [];
      for (let i = 0; i < pairs.length; i++) {
        const p = pairs[i];
        const balIdx = i * 2;
        const resIdx = i * 2 + 1;

        const balOk = pairRes[balIdx]?.ok;
        const resOk = pairRes[resIdx]?.ok;

        const lpBal = balOk ? (pairRes[balIdx].value as any as bigint) : 0n;
        if (lpBal <= 0n) continue;

        let reserve0 = 0n;
        let reserve1 = 0n;

        if (resOk) {
          const rr = pairRes[resIdx].value as any;
          reserve0 = BigInt(rr?.[0] ?? 0);
          reserve1 = BigInt(rr?.[1] ?? 0);
        }

        const symbol0 = symMap.get(p.token0.toLowerCase()) || safeSymFromAddr(p.token0);
        const symbol1 = symMap.get(p.token1.toLowerCase()) || safeSymFromAddr(p.token1);

        const decimals0 = decMap.get(p.token0.toLowerCase()) ?? 18;
        const decimals1 = decMap.get(p.token1.toLowerCase()) ?? 18;

        out.push({
          pair: p.pair,
          token0: p.token0,
          token1: p.token1,
          symbol0,
          symbol1,
          decimals0,
          decimals1,
          reserve0,
          reserve1,
          lpBalance: lpBal
        });
      }

      setRows(out);
      setStatus(out.length ? "ok" : "no_positions_found");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "multicall_failed");
    }
  }, [address, limit]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-[#070A12] text-white overflow-hidden">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-44 -left-44 h-[520px] w-[520px] rounded-full blur-3xl opacity-30 bg-gradient-to-br from-cyan-400/40 via-blue-500/30 to-fuchsia-500/40" />
        <div className="absolute -bottom-52 -right-52 h-[620px] w-[620px] rounded-full blur-3xl opacity-25 bg-gradient-to-br from-emerald-400/30 via-teal-500/25 to-indigo-500/30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.05),transparent_45%),radial-gradient(circle_at_60%_85%,rgba(255,255,255,0.04),transparent_45%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {/* Header */}
        <header className="flex items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">My Pools</h1>
            <div className="text-xs sm:text-sm opacity-70 mt-1">
              Factory: {shortAddr(contracts.factory)}
            </div>
            {pairsMeta ? (
              <>
                <div className="text-xs sm:text-sm opacity-70 mt-1">
                  pairs.json updatedAt: {pairsMeta.updatedAt}
                </div>
                <div className="text-xs sm:text-sm opacity-70 mt-1">
                  pairs.json count: {pairsMeta.count}
                </div>
              </>
            ) : null}
          </div>
          <WalletButton />
        </header>

        {/* Nav + controls */}
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left: controls panel */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Controls</div>
                <span className="rounded-full bg-white/8 border border-white/12 px-3 py-1 text-xs text-white/80">
                  Multicall
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                  href="/"
                >
                  Home
                </a>
                <a
                  className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                  href="/swap"
                >
                  Swap
                </a>
                <a
                  className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                  href="/pool"
                >
                  Pool
                </a>
              </div>

              <div className="mt-4 rounded-2xl border border-white/12 bg-black/20 p-4">
                <label className="text-sm opacity-70">Pairs limit</label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    className="w-28 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm outline-none"
                    value={String(limit)}
                    onChange={(e) => setLimit(Number(e.target.value || "0"))}
                    inputMode="numeric"
                  />
                  <button
                    className="ml-auto rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:opacity-90 transition"
                    onClick={() => void load()}
                  >
                    Refresh
                  </button>
                </div>
                <div className="mt-3 text-xs opacity-70">
                  Address: {address ? shortAddr(address) : "-"}
                </div>
              </div>

              {status ? (
                <div className="mt-4 rounded-2xl border border-white/12 bg-black/20 p-3 text-sm opacity-90">
                  Status: {status}
                </div>
              ) : null}

              <div className="mt-4 text-xs opacity-60">
                Production: /pairs.json + Multicall (aggregate3)
              </div>
            </div>
          </div>

          {/* Right: positions list glass card */}
          <div className="lg:col-span-8">
            <div className="relative">
              <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-gradient-to-br from-white/10 via-white/5 to-transparent blur-2xl" />
              <div className="pointer-events-none absolute -top-10 right-6 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-10 h-56 w-56 rounded-full bg-fuchsia-400/15 blur-3xl" />

              <div className="relative rounded-[28px] border border-white/15 bg-white/7 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 rounded-[28px] opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]" />
                <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/10" />

                <div className="relative p-5 sm:p-7">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm sm:text-base font-medium opacity-90">
                      Positions
                    </div>
                    <div className="text-xs opacity-70">
                      {rows.length} item
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {rows.map((r) => (
                      <div key={r.pair} className="rounded-2xl border border-white/12 bg-black/20 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="text-lg font-semibold">
                            {r.symbol0} / {r.symbol1}
                          </div>
                          <a
                            className="text-sm underline opacity-90"
                            href={`https://turkscan.com/address/${r.pair}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Pair {shortAddr(r.pair)}
                          </a>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 opacity-90">
                            LP balance: {formatUnits(r.lpBalance, 18)}
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 opacity-90">
                            Reserves: {formatUnits(r.reserve0, r.decimals0)} {r.symbol0} /{" "}
                            {formatUnits(r.reserve1, r.decimals1)} {r.symbol1}
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <a
                            className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                            href={`/pool?pair=${r.pair}&tokenA=${r.token0}&tokenB=${r.token1}`}
                          >
                            Manage
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!rows.length ? (
                    <div className="mt-4 rounded-2xl border border-white/12 bg-black/20 p-4 text-sm opacity-85">
                      No positions rendered (check status and wallet connection).
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="pointer-events-none absolute -right-2 top-10 hidden lg:block">
                <div className="rounded-2xl border border-white/12 bg-white/7 px-4 py-3 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
                  <div className="text-xs opacity-70">Wallet</div>
                  <div className="mt-1 text-sm font-medium">{address ? shortAddr(address) : "-"}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer social */}
        <footer className="mt-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/5 hover:bg-white/10 transition"
              aria-label="X"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18.9 3H22l-6.8 7.8L23 21h-6.9l-4.5-5.9L6 21H3l7.3-8.4L1 3h7.1l4.1 5.4L18.9 3Z"
                  fill="rgba(255,255,255,0.9)"
                />
              </svg>
            </a>

            <a
              href="#"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/5 hover:bg-white/10 transition"
              aria-label="GitHub"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  fill="rgba(255,255,255,0.9)"
                  d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.86-.01-1.69-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.4 9.4 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.9-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.95.68 1.92 0 1.39-.01 2.51-.01 2.85 0 .26.18.59.69.48A10.07 10.07 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z"
                />
              </svg>
            </a>
          </div>

          <div className="text-xs opacity-60">swap.turkscan.com</div>
        </footer>
      </div>
    </main>
  );
}