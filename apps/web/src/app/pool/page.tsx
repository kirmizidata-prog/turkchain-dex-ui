"use client";

import * as React from "react";
import WalletButton from "@/components/WalletButton";
import { contracts } from "@/lib/turkchain";
import { erc20Abi, pairAbi, routerV2Abi, factoryAbi } from "@/lib/abis";
import { formatUnits, parseUnits, type Address, zeroAddress, isAddress } from "viem";
import { publicClient, getWalletClient } from "@/lib/evm";
import { useWallet } from "@/lib/useWallet";
import { useRouter, useSearchParams } from "next/navigation";
import { loadTokenList, type TokenInfo } from "@/lib/tokenlist";

function applySlippage(x: bigint, bps: number) {
  return (x * BigInt(10000 - bps)) / BigInt(10000);
}

type Tab = "ADD" | "REMOVE";

async function fetchTokenInfo(addr: Address): Promise<TokenInfo> {
  const [sym, dec] = await Promise.all([
    publicClient.readContract({ address: addr, abi: erc20Abi, functionName: "symbol" }).catch(() => ""),
    publicClient.readContract({ address: addr, abi: erc20Abi, functionName: "decimals" }).catch(() => 18)
  ]);

  const symbol = typeof sym === "string" && sym.length ? sym : addr.slice(0, 6) + "..." + addr.slice(-4);
  const decimals = Number(dec) || 18;

  return {
    chainId: 1919,
    address: addr,
    symbol,
    decimals
  };
}

export default function PoolPage() {
  const { address, chainId } = useWallet();
  const router = useRouter();
  const sp = useSearchParams();

  const [tab, setTab] = React.useState<Tab>("ADD");
  const [slippageBps, setSlippageBps] = React.useState(100);

  const [tokenList, setTokenList] = React.useState<TokenInfo[]>([]);
  const [tokenA, setTokenA] = React.useState<TokenInfo | null>(null);
  const [tokenB, setTokenB] = React.useState<TokenInfo | null>(null);

  const [pair, setPair] = React.useState<Address | null>(null);
  const [pairPinned, setPairPinned] = React.useState<boolean>(false);
  const [pairStatus, setPairStatus] = React.useState<string>("");

  const [amountAStr, setAmountAStr] = React.useState("0.1");
  const [amountBStr, setAmountBStr] = React.useState("");

  const [status, setStatus] = React.useState("");

  const [reserveA, setReserveA] = React.useState<bigint | null>(null);
  const [reserveB, setReserveB] = React.useState<bigint | null>(null);
  const [token0, setToken0] = React.useState<Address | null>(null);

  const [balA, setBalA] = React.useState<bigint | null>(null);
  const [balB, setBalB] = React.useState<bigint | null>(null);
  const [allowA, setAllowA] = React.useState<bigint | null>(null);
  const [allowB, setAllowB] = React.useState<bigint | null>(null);

  const [lpBal, setLpBal] = React.useState<bigint | null>(null);
  const [lpAllow, setLpAllow] = React.useState<bigint | null>(null);
  const [lpTotal, setLpTotal] = React.useState<bigint | null>(null);

  const [removePct, setRemovePct] = React.useState(25);

  // Load token list + seed from URL
  React.useEffect(() => {
    (async () => {
      try {
        const list = await loadTokenList();
        setTokenList(list);

        const qPair = sp.get("pair");
        const qA = sp.get("tokenA");
        const qB = sp.get("tokenB");

        // If pair is pinned: read token0/token1 from pair and lock selectors
        if (qPair && isAddress(qPair)) {
          const pinned = qPair as Address;
          setPair(pinned);
          setPairPinned(true);
          setPairStatus("pair_pinned_by_query");

          const [t0, t1] = await Promise.all([
            publicClient.readContract({ address: pinned, abi: pairAbi, functionName: "token0" }),
            publicClient.readContract({ address: pinned, abi: pairAbi, functionName: "token1" })
          ]);

          const token0Addr = t0 as Address;
          const token1Addr = t1 as Address;

          const inList0 = list.find((x) => x.address.toLowerCase() === token0Addr.toLowerCase()) || null;
          const inList1 = list.find((x) => x.address.toLowerCase() === token1Addr.toLowerCase()) || null;

          const resolved0 = inList0 || (await fetchTokenInfo(token0Addr));
          const resolved1 = inList1 || (await fetchTokenInfo(token1Addr));

          setTokenA(resolved0);
          setTokenB(resolved1);

          const qs = new URLSearchParams();
          qs.set("pair", pinned);
          qs.set("tokenA", token0Addr);
          qs.set("tokenB", token1Addr);
          router.replace(`/pool?${qs.toString()}`);
          return;
        }

        // Non pinned mode: seed tokenA/tokenB from tokenA/tokenB query
        if (qA && isAddress(qA)) {
          const t = list.find((x) => x.address.toLowerCase() === qA.toLowerCase());
          if (t) setTokenA(t);
        }
        if (qB && isAddress(qB)) {
          const t = list.find((x) => x.address.toLowerCase() === qB.toLowerCase());
          if (t) setTokenB(t);
        }

        // Default if none
        if (!qA && !qB && list.length >= 2) {
          setTokenA(list[0]);
          setTokenB(list[1]);
        }
      } catch (e: any) {
        setStatus(e?.message || "tokenlist_load_failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve pair from factory (only if NOT pinned)
  React.useEffect(() => {
    (async () => {
      try {
        if (pairPinned) return;
        if (!tokenA || !tokenB) return;

        if (tokenA.address.toLowerCase() === tokenB.address.toLowerCase()) {
          setPair(null);
          setPairStatus("same_token");
          return;
        }

        setPairStatus("resolving_pair");
        const p = await publicClient.readContract({
          address: contracts.factory,
          abi: factoryAbi,
          functionName: "getPair",
          args: [tokenA.address, tokenB.address]
        });

        const addr = p as Address;
        if (!addr || addr === zeroAddress) {
          setPair(null);
          setPairStatus("pair_not_found_will_create_on_add");
        } else {
          setPair(addr);
          setPairStatus("pair_ok");
        }

        const qs = new URLSearchParams();
        qs.set("tokenA", tokenA.address);
        qs.set("tokenB", tokenB.address);
        router.replace(`/pool?${qs.toString()}`);
      } catch (e: any) {
        setPair(null);
        setPairStatus(e?.shortMessage || e?.message || "pair_resolve_failed");
      }
    })();
  }, [tokenA, tokenB, pairPinned, router]);

  async function refreshReserves() {
    try {
      if (!pair || !tokenA || !tokenB) return;

      const [t0, reserves] = await Promise.all([
        publicClient.readContract({ address: pair, abi: pairAbi, functionName: "token0" }),
        publicClient.readContract({ address: pair, abi: pairAbi, functionName: "getReserves" })
      ]);

      const r = reserves as readonly [bigint, bigint, number];
      const _token0 = t0 as Address;
      setToken0(_token0);

      const aIs0 = _token0.toLowerCase() === tokenA.address.toLowerCase();
      const rA = aIs0 ? (r[0] as bigint) : (r[1] as bigint);
      const rB = aIs0 ? (r[1] as bigint) : (r[0] as bigint);

      setReserveA(rA);
      setReserveB(rB);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "reserves_failed");
    }
  }

  async function refreshWalletState() {
    try {
      if (!address || !pair || !tokenA || !tokenB) {
        setBalA(null);
        setBalB(null);
        setAllowA(null);
        setAllowB(null);
        setLpBal(null);
        setLpAllow(null);
        setLpTotal(null);
        return;
      }

      const [bA, bB, aA, aB, lpb, lpa, lpt] = await Promise.all([
        publicClient.readContract({ address: tokenA.address, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
        publicClient.readContract({ address: tokenB.address, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
        publicClient.readContract({ address: tokenA.address, abi: erc20Abi, functionName: "allowance", args: [address, contracts.router] }),
        publicClient.readContract({ address: tokenB.address, abi: erc20Abi, functionName: "allowance", args: [address, contracts.router] }),
        publicClient.readContract({ address: pair, abi: pairAbi, functionName: "balanceOf", args: [address] }),
        publicClient.readContract({ address: pair, abi: pairAbi, functionName: "allowance", args: [address, contracts.router] }),
        publicClient.readContract({ address: pair, abi: pairAbi, functionName: "totalSupply" })
      ]);

      setBalA(bA as bigint);
      setBalB(bB as bigint);
      setAllowA(aA as bigint);
      setAllowB(aB as bigint);

      setLpBal(lpb as bigint);
      setLpAllow(lpa as bigint);
      setLpTotal(lpt as bigint);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "wallet_state_failed");
    }
  }

  React.useEffect(() => {
    refreshReserves();
    refreshWalletState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, address, tokenA?.address, tokenB?.address]);

  function computeBfromA(aStr: string) {
    try {
      if (!reserveA || !reserveB || !tokenA || !tokenB) return "";
      const a = parseUnits(aStr || "0", tokenA.decimals);
      if (a <= 0n) return "";
      const b = (a * reserveB) / reserveA;
      return formatUnits(b, tokenB.decimals);
    } catch {
      return "";
    }
  }

  async function approveIfNeeded(tokenAddr: Address, current: bigint | null, needed: bigint) {
    if (!address) throw new Error("connect_wallet");
    if (chainId !== 1919) throw new Error("wrong_network");
    if ((current ?? 0n) >= needed) return;

    const wc = getWalletClient();
    if (!wc) throw new Error("no_wallet_client");

    const hash = await wc.writeContract({
      address: tokenAddr,
      abi: erc20Abi,
      functionName: "approve",
      args: [contracts.router, needed],
      account: address as Address
    });

    await publicClient.waitForTransactionReceipt({ hash });
  }

  async function doAdd() {
    setStatus("");
    try {
      if (!address) return setStatus("connect_wallet");
      if (chainId !== 1919) return setStatus("wrong_network");
      if (!tokenA || !tokenB) return setStatus("select_tokens");

      const amountADesired = parseUnits(amountAStr || "0", tokenA.decimals);
      if (amountADesired <= 0n) return setStatus("invalid_amount_a");

      const amountBDesired = parseUnits(amountBStr || computeBfromA(amountAStr) || "0", tokenB.decimals);
      if (amountBDesired <= 0n) return setStatus("invalid_amount_b");

      if (balA !== null && balA < amountADesired) return setStatus("insufficient_balance_a");
      if (balB !== null && balB < amountBDesired) return setStatus("insufficient_balance_b");

      setStatus("approving...");
      await approveIfNeeded(tokenA.address, allowA, amountADesired);
      await approveIfNeeded(tokenB.address, allowB, amountBDesired);

      const amountAMin = applySlippage(amountADesired, slippageBps);
      const amountBMin = applySlippage(amountBDesired, slippageBps);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      const wc = getWalletClient();
      if (!wc) throw new Error("no_wallet_client");

      setStatus("adding_liquidity...");
      const hash = await wc.writeContract({
        address: contracts.router,
        abi: routerV2Abi,
        functionName: "addLiquidity",
        args: [
          tokenA.address,
          tokenB.address,
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          address as Address,
          deadline
        ],
        account: address as Address
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setStatus(receipt.status === "success" ? "add_success" : "add_failed");

      if (!pairPinned) {
        const p = await publicClient.readContract({
          address: contracts.factory,
          abi: factoryAbi,
          functionName: "getPair",
          args: [tokenA.address, tokenB.address]
        });
        const addr = p as Address;
        if (addr && addr !== zeroAddress) setPair(addr);
      }

      await refreshReserves();
      await refreshWalletState();
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "add_error");
    }
  }

  async function doRemove() {
    setStatus("");
    try {
      if (!address) return setStatus("connect_wallet");
      if (chainId !== 1919) return setStatus("wrong_network");
      if (!tokenA || !tokenB) return setStatus("select_tokens");
      if (!pair) return setStatus("no_pair");
      if (!lpBal || lpBal <= 0n) return setStatus("no_lp_balance");
      if (!reserveA || !reserveB || !lpTotal || lpTotal <= 0n) return setStatus("no_pool_state");

      const liquidity = (lpBal * BigInt(removePct)) / BigInt(100);
      if (liquidity <= 0n) return setStatus("invalid_liquidity");

      const expectedA = (liquidity * reserveA) / lpTotal;
      const expectedB = (liquidity * reserveB) / lpTotal;

      const amountAMin = applySlippage(expectedA, slippageBps);
      const amountBMin = applySlippage(expectedB, slippageBps);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      const wc = getWalletClient();
      if (!wc) throw new Error("no_wallet_client");

      if ((lpAllow ?? 0n) < liquidity) {
        setStatus("approving_lp...");
        const h1 = await wc.writeContract({
          address: pair,
          abi: pairAbi,
          functionName: "approve",
          args: [contracts.router, liquidity],
          account: address as Address
        });
        await publicClient.waitForTransactionReceipt({ hash: h1 });
      }

      setStatus("removing_liquidity...");
      const hash = await wc.writeContract({
        address: contracts.router,
        abi: routerV2Abi,
        functionName: "removeLiquidity",
        args: [
          tokenA.address,
          tokenB.address,
          liquidity,
          amountAMin,
          amountBMin,
          address as Address,
          deadline
        ],
        account: address as Address
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setStatus(receipt.status === "success" ? "remove_success" : "remove_failed");

      await refreshReserves();
      await refreshWalletState();
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "remove_error");
    }
  }

  const poolLabel = tokenA && tokenB ? `${tokenA.symbol} / ${tokenB.symbol}` : "Pool";

  const lpSharePct =
    lpBal && lpTotal && lpTotal > 0n ? Number((lpBal * 10000n) / lpTotal) / 100 : null;

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
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Pool</h1>
            <div className="mt-1 text-xs opacity-70">{poolLabel}</div>
          </div>
          <WalletButton />
        </header>

        {/* Content grid */}
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left: info */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Pool State</div>
                <span className="rounded-full bg-white/8 border border-white/12 px-3 py-1 text-xs text-white/80">
                  {pairPinned ? "Pinned" : "Dynamic"}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <span className="opacity-70">Factory</span>
                  <span className="opacity-85">{contracts.factory}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <span className="opacity-70">Pair</span>
                  <span className="opacity-85">{pair ? pair : "(not resolved)"}</span>
                </div>
                {pairStatus ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <span className="opacity-70">Pair status</span>
                    <span className="opacity-85">{pairStatus}</span>
                  </div>
                ) : null}
                {pairPinned ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <span className="opacity-70">Mode</span>
                    <span className="opacity-85">pinned_by_pair_query</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  className={`rounded-xl border border-white/12 px-4 py-2 text-sm transition ${
                    tab === "ADD" ? "bg-white text-black" : "bg-white/5 hover:bg-white/10"
                  }`}
                  onClick={() => setTab("ADD")}
                >
                  Add
                </button>
                <button
                  className={`rounded-xl border border-white/12 px-4 py-2 text-sm transition ${
                    tab === "REMOVE" ? "bg-white text-black" : "bg-white/5 hover:bg-white/10"
                  }`}
                  onClick={() => setTab("REMOVE")}
                >
                  Remove
                </button>
                <button
                  className="ml-auto rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                  onClick={async () => {
                    setStatus("");
                    await refreshReserves();
                    await refreshWalletState();
                  }}
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 text-xs opacity-60">
                Router: {contracts.router}
              </div>
            </div>
          </div>

          {/* Right: glass main card */}
          <div className="lg:col-span-8">
            <div className="relative">
              <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-gradient-to-br from-white/10 via-white/5 to-transparent blur-2xl" />
              <div className="pointer-events-none absolute -top-10 right-6 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-10 h-56 w-56 rounded-full bg-fuchsia-400/15 blur-3xl" />

              <div className="relative rounded-[28px] border border-white/15 bg-white/7 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 rounded-[28px] opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]" />
                <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/10" />

                <div className="relative p-5 sm:p-7">
                  {/* Token selectors */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                      <label className="text-xs opacity-70">Token A</label>
                      <select
                        className="mt-2 w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm outline-none"
                        value={tokenA?.address ?? ""}
                        disabled={pairPinned}
                        onChange={(e) => {
                          const t = tokenList.find((x) => x.address === (e.target.value as Address));
                          setTokenA(t ?? null);
                        }}
                      >
                        <option value="" disabled>
                          Select token
                        </option>
                        {tokenList.map((t) => (
                          <option key={t.address} value={t.address}>
                            {t.symbol} ({t.address.slice(0, 6)}...{t.address.slice(-4)})
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 text-xs opacity-70">
                        Balance A: {tokenA && balA !== null ? formatUnits(balA, tokenA.decimals) : "-"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                      <label className="text-xs opacity-70">Token B</label>
                      <select
                        className="mt-2 w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm outline-none"
                        value={tokenB?.address ?? ""}
                        disabled={pairPinned}
                        onChange={(e) => {
                          const t = tokenList.find((x) => x.address === (e.target.value as Address));
                          setTokenB(t ?? null);
                        }}
                      >
                        <option value="" disabled>
                          Select token
                        </option>
                        {tokenList.map((t) => (
                          <option key={t.address} value={t.address}>
                            {t.symbol} ({t.address.slice(0, 6)}...{t.address.slice(-4)})
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 text-xs opacity-70">
                        Balance B: {tokenB && balB !== null ? formatUnits(balB, tokenB.decimals) : "-"}
                      </div>
                    </div>
                  </div>

                  {/* Reserves */}
                  {pair && reserveA !== null && reserveB !== null && tokenA && tokenB ? (
                    <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-4 text-sm">
                      <div className="opacity-85">
                        Reserves: {formatUnits(reserveA, tokenA.decimals)} {tokenA.symbol} /{" "}
                        {formatUnits(reserveB, tokenB.decimals)} {tokenB.symbol}
                      </div>
                      {lpSharePct !== null ? (
                        <div className="mt-1 opacity-85">Your LP share: ~{lpSharePct}%</div>
                      ) : null}
                      {token0 ? <div className="mt-2 text-xs opacity-70">Pair token0: {token0}</div> : null}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-white/12 bg-black/20 p-4 text-sm opacity-85">
                      Pool reserves not available yet. If pair does not exist, first addLiquidity will create it.
                    </div>
                  )}

                  {/* Slippage */}
                  <div className="mt-4 rounded-2xl border border-white/12 bg-black/20 p-4">
                    <label className="text-xs opacity-70">Slippage (%)</label>
                    <input
                      className="mt-2 w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm outline-none"
                      value={String(slippageBps / 100)}
                      onChange={(e) => {
                        const v = Number(e.target.value || "1");
                        const bps = Math.max(0, Math.min(500, Math.floor(v * 100)));
                        setSlippageBps(bps);
                      }}
                    />
                  </div>

                  {/* Tab content */}
                  <div className="mt-4 space-y-3">
                    {tab === "ADD" ? (
                      <>
                        <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                          <label className="text-xs opacity-70">Amount A ({tokenA?.symbol ?? "TokenA"})</label>
                          <input
                            className="mt-2 w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm outline-none"
                            value={amountAStr}
                            onChange={(e) => {
                              const v = e.target.value;
                              setAmountAStr(v);
                              setAmountBStr(computeBfromA(v));
                            }}
                          />
                        </div>

                        <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                          <label className="text-xs opacity-70">
                            Amount B ({tokenB?.symbol ?? "TokenB"}) (auto)
                          </label>
                          <input
                            className="mt-2 w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm outline-none"
                            value={amountBStr || computeBfromA(amountAStr)}
                            onChange={(e) => setAmountBStr(e.target.value)}
                          />
                        </div>

                        <button
                          className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:opacity-90 transition"
                          onClick={doAdd}
                        >
                          Add Liquidity
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm">
                          <div className="opacity-85">LP balance: {lpBal !== null ? formatUnits(lpBal, 18) : "-"}</div>
                          <div className="mt-1 opacity-85">Remove percent: {removePct}%</div>
                        </div>

                        <input
                          className="w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm outline-none"
                          value={String(removePct)}
                          onChange={(e) => setRemovePct(Math.max(1, Math.min(100, Number(e.target.value || "25"))))}
                        />

                        <button
                          className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:opacity-90 transition"
                          onClick={doRemove}
                        >
                          Remove Liquidity
                        </button>
                      </>
                    )}
                  </div>

                  {/* Status */}
                  {status ? (
                    <div className="mt-4 rounded-2xl border border-white/12 bg-black/20 p-3 text-xs opacity-85">
                      Status: {status}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="pointer-events-none absolute -right-2 top-10 hidden lg:block">
                <div className="rounded-2xl border border-white/12 bg-white/7 px-4 py-3 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
                  <div className="text-xs opacity-70">Pair</div>
                  <div className="mt-1 text-xs font-medium opacity-90">{pair ? pair : "-"}</div>
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