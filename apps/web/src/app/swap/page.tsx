"use client";

import * as React from "react";
import WalletButton from "@/components/WalletButton";
import { contracts } from "@/lib/turkchain";
import { erc20Abi, routerV2Abi } from "@/lib/abis";
import { publicClient, getWalletClient } from "@/lib/evm";
import { useWallet } from "@/lib/useWallet";
import { type TokenInfo } from "@/lib/tokenlist";
import { loadMergedTokenList } from "@/lib/tokenlists";
import { formatUnits, parseUnits, type Address, isAddress, zeroAddress } from "viem";

const TURKSCAN_TX = "https://turkscan.com/tx/";

const factoryAbi = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" }
    ],
    outputs: [{ name: "pair", type: "address" }]
  }
] as const;

const pairAbi = [
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" }
    ]
  }
] as const;

function applySlippage(amountOut: bigint, bps: number) {
  return (amountOut * BigInt(10000 - bps)) / BigInt(10000);
}

function shortAddr(a: string) {
  if (!a) return "-";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function bnMaxUint256() {
  return (1n << 256n) - 1n;
}

function bnTwoPow255() {
  return 1n << 255n;
}

function formatAllowance(allow: bigint | null, decimals: number) {
  if (allow === null) return "-";
  if (allow >= bnTwoPow255()) return "Unlimited";
  return formatUnits(allow, decimals);
}

// UniswapV2 amountOut formula (fee 0.3% -> 997/1000)
function calcAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint) {
  if (amountIn <= 0n) return 0n;
  if (reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  if (denominator === 0n) return 0n;
  return numerator / denominator;
}

function calcPriceImpactBps(amountIn: bigint, amountOut: bigint, reserveIn: bigint, reserveOut: bigint) {
  if (amountIn <= 0n || amountOut <= 0n) return 0;
  if (reserveIn <= 0n || reserveOut <= 0n) return 0;

  const left = amountOut * reserveIn;
  const right = amountIn * reserveOut;
  if (right === 0n) return 0;

  if (left >= right) return 0;
  const bps = Number(((right - left) * 10000n) / right);
  return Math.max(0, Math.min(10000, bps));
}

export default function SwapPage() {
  const { address, chainId } = useWallet();

  const [tokenList, setTokenList] = React.useState<TokenInfo[]>([]);
  const [inToken, setInToken] = React.useState<TokenInfo | null>(null);
  const [outToken, setOutToken] = React.useState<TokenInfo | null>(null);

  const [amountInStr, setAmountInStr] = React.useState("0.1");
  const [quoteOut, setQuoteOut] = React.useState<bigint | null>(null);

  const [balIn, setBalIn] = React.useState<bigint | null>(null);
  const [balOut, setBalOut] = React.useState<bigint | null>(null);
  const [allowIn, setAllowIn] = React.useState<bigint | null>(null);

  const [slippageBps, setSlippageBps] = React.useState(100); // 1.00%
  const [useMaxApproval, setUseMaxApproval] = React.useState(true);

  const [minOut, setMinOut] = React.useState<bigint | null>(null);
  const [priceImpactBps, setPriceImpactBps] = React.useState<number | null>(null);
  const [routePath, setRoutePath] = React.useState<Address[] | null>(null);

  const WTC: Address = "0xa1aCbf1244fBb5cabB0b2ef2c2bB40Dbf89a4794";
  const [isQuoting, setIsQuoting] = React.useState<boolean>(false);
  const [confirmHighImpact, setConfirmHighImpact] = React.useState<boolean>(false);

  const [txHash, setTxHash] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>("");
  const [isPending, setIsPending] = React.useState<boolean>(false);

  React.useEffect(() => {
    (async () => {
      try {
        const list = await loadMergedTokenList();
        setTokenList(list);
        if (list.length >= 2) {
          setInToken(list[0]);
          setOutToken(list[1]);
        } else if (list.length === 1) {
          setInToken(list[0]);
        }
      } catch (e: any) {
        setStatus(e?.message || "tokenlist_load_failed");
      }
    })();
  }, []);

  async function refreshWallet() {
    try {
      if (!address || !isAddress(address) || !inToken || !outToken) {
        setBalIn(null);
        setBalOut(null);
        setAllowIn(null);
        return;
      }

      const [bIn, bOut, aIn] = await Promise.all([
        publicClient.readContract({
          address: inToken.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as Address]
        }),
        publicClient.readContract({
          address: outToken.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as Address]
        }),
        publicClient.readContract({
          address: inToken.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address as Address, contracts.router]
        })
      ]);

      setBalIn(bIn as bigint);
      setBalOut(bOut as bigint);
      setAllowIn(aIn as bigint);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "wallet_refresh_failed");
    }
  }

  async function fetchQuoteAndMetrics() {
    setStatus("");
    setTxHash("");
    setQuoteOut(null);
    setMinOut(null);
    setPriceImpactBps(null);
    setRoutePath(null);
    setConfirmHighImpact(false);
    setIsQuoting(true);

    try {
      if (!inToken || !outToken) return;
      if (inToken.address.toLowerCase() === outToken.address.toLowerCase()) {
        setStatus("same_token");
        return;
      }

      const amountIn = parseUnits(amountInStr || "0", inToken.decimals);
      if (amountIn <= 0n) return;

      const directPath: Address[] = [inToken.address as Address, outToken.address as Address];
      const pathsToTry: Address[][] = [directPath];

      const inIsWtc = inToken.address.toLowerCase() === WTC.toLowerCase();
      const outIsWtc = outToken.address.toLowerCase() === WTC.toLowerCase();
      if (!inIsWtc && !outIsWtc) {
        pathsToTry.push([inToken.address as Address, WTC, outToken.address as Address]);
      }

      let bestOut: bigint = 0n;
      let bestPath: Address[] | null = null;

      for (const path of pathsToTry) {
        try {
          const amts = await publicClient.readContract({
            address: contracts.router,
            abi: routerV2Abi,
            functionName: "getAmountsOut",
            args: [amountIn, path]
          });
          const out = (amts as readonly bigint[])[path.length - 1] ?? 0n;
          if (out > bestOut) {
            bestOut = out;
            bestPath = path;
          }
        } catch {
          // ignore path errors
        }
      }

      if (!bestPath || bestOut <= 0n) {
        setStatus("no_quote");
        return;
      }

      setRoutePath(bestPath);
      setQuoteOut(bestOut);

      const mo = applySlippage(bestOut, slippageBps);
      setMinOut(mo);

      if (bestPath.length === 2) {
        const pair = (await publicClient.readContract({
          address: contracts.factory,
          abi: factoryAbi,
          functionName: "getPair",
          args: [bestPath[0], bestPath[1]]
        })) as Address;

        if (!pair || pair.toLowerCase() === zeroAddress) {
          setPriceImpactBps(null);
          return;
        }

        const [t0, t1, reserves] = await Promise.all([
          publicClient.readContract({ address: pair, abi: pairAbi, functionName: "token0" }) as Promise<Address>,
          publicClient.readContract({ address: pair, abi: pairAbi, functionName: "token1" }) as Promise<Address>,
          publicClient.readContract({ address: pair, abi: pairAbi, functionName: "getReserves" }) as Promise<
            readonly [bigint, bigint, number]
          >
        ]);

        const reserve0 = BigInt(reserves[0]);
        const reserve1 = BigInt(reserves[1]);

        let reserveIn = 0n;
        let reserveOut = 0n;

        if (bestPath[0].toLowerCase() === t0.toLowerCase() && bestPath[1].toLowerCase() === t1.toLowerCase()) {
          reserveIn = reserve0;
          reserveOut = reserve1;
        } else if (bestPath[0].toLowerCase() === t1.toLowerCase() && bestPath[1].toLowerCase() === t0.toLowerCase()) {
          reserveIn = reserve1;
          reserveOut = reserve0;
        } else {
          setPriceImpactBps(null);
          return;
        }

        const outModel = calcAmountOut(amountIn, reserveIn, reserveOut);
        const pibps = calcPriceImpactBps(amountIn, outModel, reserveIn, reserveOut);
        setPriceImpactBps(pibps);
        return;
      }

      if (bestPath.length === 3) {
        const a = bestPath[0];
        const b = bestPath[1];
        const c = bestPath[2];

        const [pair1, pair2] = await Promise.all([
          publicClient.readContract({ address: contracts.factory, abi: factoryAbi, functionName: "getPair", args: [a, b] }) as Promise<Address>,
          publicClient.readContract({ address: contracts.factory, abi: factoryAbi, functionName: "getPair", args: [b, c] }) as Promise<Address>
        ]);

        if (!pair1 || pair1.toLowerCase() === zeroAddress || !pair2 || pair2.toLowerCase() === zeroAddress) {
          setPriceImpactBps(null);
          return;
        }

        const [[t0a, t1a, ra], [t0b, t1b, rb]] = await Promise.all([
          Promise.all([
            publicClient.readContract({ address: pair1, abi: pairAbi, functionName: "token0" }) as Promise<Address>,
            publicClient.readContract({ address: pair1, abi: pairAbi, functionName: "token1" }) as Promise<Address>,
            publicClient.readContract({ address: pair1, abi: pairAbi, functionName: "getReserves" }) as Promise<readonly [bigint, bigint, number]>
          ]),
          Promise.all([
            publicClient.readContract({ address: pair2, abi: pairAbi, functionName: "token0" }) as Promise<Address>,
            publicClient.readContract({ address: pair2, abi: pairAbi, functionName: "token1" }) as Promise<Address>,
            publicClient.readContract({ address: pair2, abi: pairAbi, functionName: "getReserves" }) as Promise<readonly [bigint, bigint, number]>
          ])
        ]);

        const r0a = BigInt(ra[0]);
        const r1a = BigInt(ra[1]);
        const r0b = BigInt(rb[0]);
        const r1b = BigInt(rb[1]);

        let rIn1 = 0n, rOut1 = 0n;
        if (a.toLowerCase() === t0a.toLowerCase() && b.toLowerCase() === t1a.toLowerCase()) {
          rIn1 = r0a; rOut1 = r1a;
        } else if (a.toLowerCase() === t1a.toLowerCase() && b.toLowerCase() === t0a.toLowerCase()) {
          rIn1 = r1a; rOut1 = r0a;
        } else {
          setPriceImpactBps(null);
          return;
        }

        let rIn2 = 0n, rOut2 = 0n;
        if (b.toLowerCase() === t0b.toLowerCase() && c.toLowerCase() === t1b.toLowerCase()) {
          rIn2 = r0b; rOut2 = r1b;
        } else if (b.toLowerCase() === t1b.toLowerCase() && c.toLowerCase() === t0b.toLowerCase()) {
          rIn2 = r1b; rOut2 = r0b;
        } else {
          setPriceImpactBps(null);
          return;
        }

        if (rIn1 <= 0n || rOut1 <= 0n || rIn2 <= 0n || rOut2 <= 0n) {
          setPriceImpactBps(null);
          return;
        }

        const out1 = calcAmountOut(amountIn, rIn1, rOut1);
        const out2 = calcAmountOut(out1, rIn2, rOut2);

        const scale = 1000000000000000000n;
        const execScaled = (out2 * scale) / amountIn;
        const midScaled = (((rOut1 * rOut2) * scale) / (rIn1 * rIn2));

        if (midScaled <= 0n) {
          setPriceImpactBps(null);
          return;
        }

        let pibps = 0n;
        if (midScaled > execScaled) {
          pibps = ((midScaled - execScaled) * 10000n) / midScaled;
        }

        const pibpsNum = Number(pibps);
        setPriceImpactBps(Number.isFinite(pibpsNum) ? pibpsNum : null);
        return;
      }

      setPriceImpactBps(null);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "quote_failed");
    } finally {
      setIsQuoting(false);
    }
  }

  React.useEffect(() => {
    const t = setTimeout(() => {
      void fetchQuoteAndMetrics();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountInStr, slippageBps, inToken?.address, outToken?.address]);

  function needsApproval(amountIn: bigint) {
    return (allowIn ?? 0n) < amountIn;
  }

  async function doApprove() {
    if (isPending) return;
    setStatus("");
    setTxHash("");

    try {
      if (!address) return setStatus("connect_wallet");
      if (chainId !== 1919) return setStatus("wrong_network");
      if (!inToken) return setStatus("select_token");

      const amountIn = parseUnits(amountInStr || "0", inToken.decimals);
      if (amountIn <= 0n) return setStatus("invalid_amount");

      const wc = getWalletClient();
      if (!wc) return setStatus("no_wallet_client");

      const approveAmount = useMaxApproval ? bnMaxUint256() : amountIn;

      setStatus("approving");
      const hash = await wc.writeContract({
        address: inToken.address,
        abi: erc20Abi,
        functionName: "approve",
        args: [contracts.router, approveAmount],
        account: address as Address
      });

      setTxHash(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setStatus(receipt.status === "success" ? "approve_success" : "approve_failed");

      await refreshWallet();
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "approve_error");
    }
  }

  async function doSwap() {
    if (isPending) return;
    setStatus("");
    setTxHash("");

    try {
      if (!address) return setStatus("connect_wallet");
      if (chainId !== 1919) return setStatus("wrong_network");
      if (!inToken || !outToken) return setStatus("select_tokens");
      if (inToken.address.toLowerCase() === outToken.address.toLowerCase()) return setStatus("same_token");

      const amountIn = parseUnits(amountInStr || "0", inToken.decimals);
      if (amountIn <= 0n) return setStatus("invalid_amount");

      if (needsApproval(amountIn)) return setStatus("need_approval");

      if (priceImpactBps !== null && priceImpactBps >= 500 && !confirmHighImpact) {
        setConfirmHighImpact(true);
        return setStatus("confirm_high_impact");
      }

      const q = quoteOut ?? 0n;
      if (q <= 0n) return setStatus("no_quote");

      const mo = minOut ?? applySlippage(q, slippageBps);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      const wc = getWalletClient();
      if (!wc) return setStatus("no_wallet_client");

      const path: Address[] = (routePath && routePath.length >= 2)
        ? routePath
        : [inToken.address as Address, outToken!.address as Address];

      setIsPending(true);
      setStatus("swapping");
      const hash = await wc.writeContract({
        address: contracts.router,
        abi: routerV2Abi,
        functionName: "swapExactTokensForTokens",
        args: [amountIn, mo, path, address as Address, deadline],
        account: address as Address
      });

      setTxHash(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setStatus(receipt.status === "success" ? "swap_success" : "swap_failed");

      await refreshWallet();
      await fetchQuoteAndMetrics();
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "swap_error");
    } finally {
      setIsPending(false);
    }
  }

  const amountInParsed = React.useMemo(() => {
    try {
      if (!inToken) return 0n;
      return parseUnits(amountInStr || "0", inToken.decimals);
    } catch {
      return 0n;
    }
  }, [amountInStr, inToken]);

  const needApprove = React.useMemo(() => {
    if (!inToken) return false;
    if (amountInParsed <= 0n) return false;
    return needsApproval(amountInParsed);
  }, [allowIn, amountInParsed, inToken]);

  const insufficientBalance = React.useMemo(() => {
    if (!address || !isAddress(address)) return false;
    if (!inToken) return false;
    if (amountInParsed <= 0n) return false;
    if (balIn === null) return true;
    return balIn < amountInParsed;
  }, [address, balIn, amountInParsed, inToken]);

  React.useEffect(() => {
    setConfirmHighImpact(false);
    if (status === "confirm_high_impact") setStatus("");
  }, [amountInStr, inToken?.address, outToken?.address]);

  const canSwap = React.useMemo(() => {
    if (!address || !isAddress(address)) return false;
    if (chainId !== 1919) return false;
    if (!inToken || !outToken) return false;
    if (amountInParsed <= 0n) return false;
    if ((quoteOut ?? 0n) <= 0n) return false;
    if (needApprove) return false;
    if (insufficientBalance) return false;
    if (isPending) return false;
    return true;
  }, [address, chainId, inToken, outToken, amountInParsed, quoteOut, needApprove, insufficientBalance, isPending]);

  const statusLabel = React.useMemo(() => {
    if (!status) return "";
    const m: Record<string, string> = {
      connect_wallet: "Connect wallet",
      wrong_network: "Wrong network (switch to Turkchain 1919)",
      select_token: "Select token",
      select_tokens: "Select tokens",
      same_token: "Select different tokens",
      invalid_amount: "Enter a valid amount",
      no_quote: "No quote available (check liquidity)",
      need_approval: "Approval required before swap",
      approving: "Approving...",
      approve_success: "Approve success",
      approve_failed: "Approve failed",
      swapping: "Swapping...",
      swap_success: "Swap success",
      swap_failed: "Swap failed",
      confirm_high_impact: "High price impact. Click Swap again to confirm."
    };
    return m[status] || status;
  }, [status]);

  return (
    <main className="min-h-screen bg-[#070A12] text-white overflow-hidden">
      {/* Background decorations (same language as Home) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-44 -left-44 h-[520px] w-[520px] rounded-full blur-3xl opacity-30 bg-gradient-to-br from-cyan-400/40 via-blue-500/30 to-fuchsia-500/40" />
        <div className="absolute -bottom-52 -right-52 h-[620px] w-[620px] rounded-full blur-3xl opacity-25 bg-gradient-to-br from-emerald-400/30 via-teal-500/25 to-indigo-500/30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.05),transparent_45%),radial-gradient(circle_at_60%_85%,rgba(255,255,255,0.04),transparent_45%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-6">
        {/* Top header */}
        <header className="flex items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Swap</h1>
            <div className="mt-1 text-xs opacity-70">
              Router: {shortAddr(contracts.router)}
            </div>
          </div>
          <WalletButton />
        </header>

        {/* Nav */}
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
            href="/"
          >
            Home
          </a>
          <a
            className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
            href="/pool"
          >
            Pool
          </a>
          <a
            className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
            href="/positions"
          >
            My Pools
          </a>
        </div>

        {/* Layout */}
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left: small info / live chip / helper */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Turkchain 1919</div>
                <span className="rounded-full bg-emerald-400/15 border border-emerald-400/25 px-3 py-1 text-xs text-emerald-200">
                  Live
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <span className="opacity-70">Quote</span>
                  <span className={"text-xs " + (isQuoting ? "opacity-90" : "opacity-70")}>
                    {isQuoting ? "Updating..." : "Ready"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <span className="opacity-70">Wallet</span>
                  <span className="text-xs opacity-70">{address ? shortAddr(address) : "-"}</span>
                </div>
              </div>

              <button
                className="mt-4 w-full rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                onClick={async () => {
                  await refreshWallet();
                  await fetchQuoteAndMetrics();
                }}
              >
                Refresh
              </button>

              <div className="mt-4 text-xs opacity-60">
                Not: Token cekimi ve swap mantigi ayni. Bu alan sadece UI.
              </div>
            </div>
          </div>

          {/* Right: glass swap card */}
          <div className="lg:col-span-8">
            <div className="relative">
              {/* 3D glass layers */}
              <div className="pointer-events-none absolute -inset-6 rounded-[28px] bg-gradient-to-br from-white/10 via-white/5 to-transparent blur-2xl" />
              <div className="pointer-events-none absolute -top-10 right-6 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-10 h-56 w-56 rounded-full bg-fuchsia-400/15 blur-3xl" />

              <div className="relative rounded-[28px] border border-white/15 bg-white/7 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 rounded-[28px] opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:22px_22px]" />
                <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/10" />

                <div className="relative p-5 sm:p-7">
                  {/* Token selects */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                      <label className="text-xs opacity-70">From</label>
                      <select
                        className="mt-2 w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm outline-none"
                        value={inToken?.address ?? ""}
                        onChange={(e) => {
                          const t = tokenList.find((x) => x.address === (e.target.value as Address)) || null;
                          setInToken(t);
                        }}
                      >
                        <option value="" disabled>Select token</option>
                        {tokenList.map((t) => (
                          <option key={t.address} value={t.address}>
                            {t.symbol} ({t.address.slice(0, 6)}...{t.address.slice(-4)})
                          </option>
                        ))}
                      </select>

                      <div className="mt-2 text-xs opacity-70">
                        Balance: {inToken && balIn !== null ? formatUnits(balIn, inToken.decimals) : "-"}
                      </div>
                      <div className="mt-1 text-xs opacity-70">
                        Allowance: {inToken ? formatAllowance(allowIn, inToken.decimals) : "-"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                      <label className="text-xs opacity-70">To</label>
                      <select
                        className="mt-2 w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm outline-none"
                        value={outToken?.address ?? ""}
                        onChange={(e) => {
                          const t = tokenList.find((x) => x.address === (e.target.value as Address)) || null;
                          setOutToken(t);
                        }}
                      >
                        <option value="" disabled>Select token</option>
                        {tokenList.map((t) => (
                          <option key={t.address} value={t.address}>
                            {t.symbol} ({t.address.slice(0, 6)}...{t.address.slice(-4)})
                          </option>
                        ))}
                      </select>

                      <div className="mt-2 text-xs opacity-70">
                        Balance: {outToken && balOut !== null ? formatUnits(balOut, outToken.decimals) : "-"}
                      </div>
                    </div>
                  </div>

                  {/* Amount + settings */}
                  <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <div className="lg:col-span-2 rounded-2xl border border-white/12 bg-black/20 p-4">
                      <label className="text-xs opacity-70">Amount In</label>
                      <input
                        className="mt-2 w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm outline-none"
                        value={amountInStr}
                        onChange={(e) => setAmountInStr(e.target.value)}
                      />
                    </div>

                    <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
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

                      <label className="mt-3 flex items-center gap-2 text-xs opacity-70">
                        <input
                          type="checkbox"
                          checked={useMaxApproval}
                          onChange={(e) => setUseMaxApproval(e.target.checked)}
                        />
                        Max approval
                      </label>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-4 text-sm">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="opacity-85">
                        Quote Out:{" "}
                        <span className="font-medium">
                          {outToken && quoteOut !== null ? formatUnits(quoteOut, outToken.decimals) : "-"}{" "}
                          {outToken?.symbol ?? ""}
                        </span>
                      </div>
                      <div className="opacity-85">
                        Min received:{" "}
                        <span className="font-medium">
                          {outToken && minOut !== null ? formatUnits(minOut, outToken.decimals) : "-"}{" "}
                          {outToken?.symbol ?? ""}
                        </span>
                      </div>
                      <div className="opacity-85">
                        Price impact:{" "}
                        <span className="font-medium">
                          {priceImpactBps === null ? "-" : (priceImpactBps / 100).toFixed(2) + "%"}
                        </span>
                      </div>
                      <div className="opacity-85">
                        Route:{" "}
                        <span className="font-medium">
                          {inToken?.symbol ?? "?"} {"->"} {outToken?.symbol ?? "?"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                      onClick={() => {
                        const a = inToken;
                        const b = outToken;
                        setInToken(b);
                        setOutToken(a);
                      }}
                    >
                      Flip
                    </button>

                    <button
                      className={
                        "rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition " +
                        ((!needApprove || isPending) ? "opacity-50 cursor-not-allowed hover:bg-white/5" : "")
                      }
                      onClick={doApprove}
                      disabled={!needApprove || isPending}
                      title={needApprove ? "Approve token" : "No approval needed"}
                    >
                      Approve
                    </button>

                    <button
                      className={
                        "sm:ml-auto rounded-xl bg-white text-black px-4 py-2 text-sm font-medium hover:opacity-90 transition " +
                        (!canSwap ? "opacity-50 cursor-not-allowed hover:opacity-50" : "")
                      }
                      onClick={doSwap}
                      disabled={!canSwap}
                      title={needApprove ? "Approve first" : "Swap"}
                    >
                      {confirmHighImpact ? "Swap anyway" : "Swap"}
                    </button>
                  </div>

                  {/* Tx + Status */}
                  {txHash ? (
                    <div className="mt-4 rounded-2xl border border-white/12 bg-black/20 p-3 text-xs opacity-85">
                      Tx:{" "}
                      <a className="underline" target="_blank" rel="noreferrer" href={TURKSCAN_TX + txHash}>
                        {shortAddr(txHash)}
                      </a>
                    </div>
                  ) : null}

                  {statusLabel ? (
                    <div className="mt-3 rounded-2xl border border-white/12 bg-black/20 p-3 text-xs opacity-85">
                      Status: {statusLabel}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* small floating chip (3D accent) */}
              <div className="pointer-events-none absolute -right-2 top-10 hidden lg:block">
                <div className="rounded-2xl border border-white/12 bg-white/7 px-4 py-3 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
                  <div className="text-xs opacity-70">Explorer</div>
                  <div className="mt-1 text-sm font-medium">turkscan.com</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer social (same style language) */}
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
